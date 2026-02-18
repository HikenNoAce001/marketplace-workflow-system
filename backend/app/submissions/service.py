"""
Submission Service — business logic for ZIP file submissions.

Contains TWO cascade transactions:

CASCADE 1 — create_submission (upload):
  Solver uploads ZIP → in ONE transaction:
    ① Validate no existing PENDING_REVIEW submission for this task
    ② Create Submission row (status: PENDING_REVIEW)
    ③ Task status → SUBMITTED

CASCADE 2 — accept_submission:
  Buyer accepts → in ONE transaction:
    ① Submission → ACCEPTED
    ② Task → COMPLETED
    ③ If ALL tasks in the project are COMPLETED → Project → COMPLETED

Also handles:
  - reject_submission (no cascade — just status changes)
  - list_submissions (history for a task)
  - get_download_url (presigned URL from MinIO)
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.project import Project, ProjectStatus
from app.models.submission import Submission, SubmissionStatus
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.storage.service import get_presigned_url, upload_file, validate_zip


# ---------------------------------------------------------------------------
# CASCADE 1: create_submission
#
# When solver uploads a ZIP:
#   1. Validate the ZIP file (4 checks)
#   2. Upload to MinIO (get back the storage path)
#   3. In ONE transaction:
#      a. Check no existing PENDING_REVIEW submission (only 1 at a time)
#      b. Create Submission row
#      c. Task → SUBMITTED
#
# Why check for existing PENDING_REVIEW?
#   A task can have MULTIPLE submissions (resubmission after rejection),
#   but only ONE can be PENDING_REVIEW at a time. If the buyer hasn't
#   reviewed the current one yet, solver can't submit another.
# ---------------------------------------------------------------------------

async def create_submission(
    session: AsyncSession, solver: User, task_id: UUID,
    file_bytes: bytes, filename: str, content_type: str, notes: str | None = None,
) -> Submission:
    """
    Solver uploads a ZIP file for a task.

    Flow:
    1. Load task → verify solver is assigned to the parent project
    2. Verify task is in a submittable state (IN_PROGRESS or REVISION_REQUESTED)
    3. Validate the ZIP file (extension, MIME, zipfile.is_zipfile, size)
    4. Upload to MinIO → get storage path
    5. CASCADE: create submission + update task status (one transaction)
    """
    # Step 1: Load task and verify access
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = await session.get(Project, task.project_id)
    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    # Step 2: Task must be IN_PROGRESS or REVISION_REQUESTED to accept a new submission
    # - IN_PROGRESS: first submission
    # - REVISION_REQUESTED: resubmission after buyer rejected previous work
    if task.status not in (TaskStatus.IN_PROGRESS, TaskStatus.REVISION_REQUESTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit when task is {task.status.value}. "
                   f"Must be IN_PROGRESS or REVISION_REQUESTED.",
        )

    # Step 3: Validate the ZIP file (all 4 checks)
    try:
        await validate_zip(file_bytes, filename, content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Step 4: Upload to MinIO BEFORE the transaction
    # Why before? If MinIO upload fails, we don't want to create a DB row
    # pointing to a file that doesn't exist. Upload first, DB second.
    file_url = upload_file(task.project_id, task_id, file_bytes)

    # Step 5: CASCADE — create submission + update task status
    # 5a: Check no existing PENDING_REVIEW submission for this task
    # Only one PENDING_REVIEW at a time — buyer must review before solver resubmits
    existing_stmt = select(Submission).where(
        Submission.task_id == task_id,
        Submission.status == SubmissionStatus.PENDING_REVIEW,
    )
    result = await session.exec(existing_stmt)
    if result.first():
        raise HTTPException(
            status_code=400,
            detail="Task already has a submission pending review",
        )

    # 5b: Create the Submission row
    submission = Submission(
        task_id=task_id,
        file_url=file_url,       # MinIO object path (e.g., "submissions/abc/def/uuid.zip")
        file_name=filename,      # Original filename from the upload
        file_size=len(file_bytes),
        notes=notes,             # Optional notes from the solver
    )
    session.add(submission)

    # 5c: Task → SUBMITTED
    task.status = TaskStatus.SUBMITTED
    task.updated_at = datetime.now(timezone.utc)

    # Commit both submission creation and task update together
    await session.commit()
    await session.refresh(submission)
    return submission


# ---------------------------------------------------------------------------
# CASCADE 2: accept_submission
#
# When buyer accepts a submission:
#   1. Submission → ACCEPTED
#   2. Task → COMPLETED
#   3. Check: are ALL tasks in this project now COMPLETED?
#      If yes → Project → COMPLETED (the whole project is done!)
#
# This is the "auto-complete" cascade. Without it, someone would have
# to manually mark the project as completed after all tasks are done.
# ---------------------------------------------------------------------------

async def accept_submission(
    session: AsyncSession, submission_id: UUID, buyer: User,
) -> Submission:
    """
    Buyer accepts a submission.

    Flow:
    1. Load submission → load task → load project
    2. Verify buyer owns the project
    3. Verify submission is PENDING_REVIEW
    4. CASCADE: accept submission + complete task + maybe complete project
    """
    # Step 1: Load the chain: submission → task → project
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    # Step 2: Buyer must own the project
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Step 3: Submission must be PENDING_REVIEW
    if submission.status != SubmissionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Submission is not pending review")

    # Step 4: CASCADE — accept submission + complete task + maybe complete project

    # 4a: Submission → ACCEPTED
    submission.status = SubmissionStatus.ACCEPTED
    submission.reviewed_at = datetime.now(timezone.utc)

    # 4b: Task → COMPLETED
    task.status = TaskStatus.COMPLETED
    task.updated_at = datetime.now(timezone.utc)

    # 4c: Check if ALL tasks in this project are now COMPLETED
    # If yes, the entire project is done!
    # Flush first so our task status change is visible in the count query
    await session.flush()
    incomplete_stmt = select(func.count()).select_from(Task).where(
        Task.project_id == project.id,
        Task.status != TaskStatus.COMPLETED,  # Count tasks that are NOT completed
    )
    incomplete_count = (await session.exec(incomplete_stmt)).one()

    if incomplete_count == 0:
        # ALL tasks are completed → project is done!
        project.status = ProjectStatus.COMPLETED
        project.updated_at = datetime.now(timezone.utc)

    # Commit everything together
    await session.commit()
    await session.refresh(submission)
    return submission


# ---------------------------------------------------------------------------
# reject_submission — no cascade, just status changes
#
# When buyer rejects:
#   Submission → REJECTED (with reviewer notes explaining why)
#   Task → REVISION_REQUESTED (solver needs to rework)
#
# The solver then fixes the work and uploads a NEW submission
# (new row, not updating the old one — old submissions stay as history)
# ---------------------------------------------------------------------------

async def reject_submission(
    session: AsyncSession, submission_id: UUID, buyer: User, reviewer_notes: str,
) -> Submission:
    """Buyer rejects a submission with feedback notes."""
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    if submission.status != SubmissionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Submission is not pending review")

    # Update submission
    submission.status = SubmissionStatus.REJECTED
    submission.reviewer_notes = reviewer_notes  # Feedback for the solver
    submission.reviewed_at = datetime.now(timezone.utc)

    # Task → REVISION_REQUESTED (solver needs to rework and resubmit)
    task.status = TaskStatus.REVISION_REQUESTED
    task.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(submission)
    return submission


# ---------------------------------------------------------------------------
# list_submissions — submission history for a task
#
# Returns ALL submissions (not just the latest), ordered newest first.
# This lets the buyer see the full revision history:
#   Submission 3: PENDING_REVIEW (current)
#   Submission 2: REJECTED — "Fix the CSS layout"
#   Submission 1: REJECTED — "Missing unit tests"
# ---------------------------------------------------------------------------

async def list_submissions_for_task(
    session: AsyncSession, task_id: UUID, user: User,
    page: int = 1, limit: int = 20,
) -> dict:
    """List all submissions for a task. Access via parent project ownership."""
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Access control via parent project
    project = await session.get(Project, task.project_id)
    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:  # SOLVER
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    # Count + fetch — ordered by submitted_at DESC (newest first)
    count_stmt = select(func.count()).select_from(Submission).where(
        Submission.task_id == task_id,
    )
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(Submission)
        .where(Submission.task_id == task_id)
        .offset(offset)
        .limit(limit)
        .order_by(Submission.submitted_at.desc())  # Newest first
    )
    result = await session.exec(stmt)
    submissions = result.all()

    return {
        "data": submissions,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


# ---------------------------------------------------------------------------
# get_download_url — presigned URL for downloading the ZIP
# ---------------------------------------------------------------------------

async def get_download_url(
    session: AsyncSession, submission_id: UUID, user: User,
) -> str:
    """
    Generate a 1-hour presigned URL to download a submission's ZIP file.
    The frontend opens this URL directly — file comes from MinIO, not our backend.
    """
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Access control via parent chain: submission → task → project
    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:  # SOLVER
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    # Generate presigned URL from MinIO (valid for 1 hour)
    url = get_presigned_url(submission.file_url)
    return url
