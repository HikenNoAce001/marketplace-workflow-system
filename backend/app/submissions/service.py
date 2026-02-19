# Submission service — ZIP upload, accept/reject, and download logic.

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


async def create_submission(
    session: AsyncSession, solver: User, task_id: UUID,
    file_bytes: bytes, filename: str, content_type: str, notes: str | None = None,
) -> Submission:
    # Upload a ZIP for a task. Creates submission + moves task to SUBMITTED.
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = await session.get(Project, task.project_id)
    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    if task.status not in (TaskStatus.IN_PROGRESS, TaskStatus.REVISION_REQUESTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit when task is {task.status.value}. "
                   f"Must be IN_PROGRESS or REVISION_REQUESTED.",
        )

    try:
        await validate_zip(file_bytes, filename, content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # upload to MinIO before DB writes — if this fails, no orphan rows
    file_url = upload_file(task.project_id, task_id, file_bytes)

    # only one PENDING_REVIEW submission per task at a time
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

    submission = Submission(
        task_id=task_id,
        file_url=file_url,
        file_name=filename,
        file_size=len(file_bytes),
        notes=notes,
    )
    session.add(submission)

    task.status = TaskStatus.SUBMITTED
    task.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(submission)
    return submission


async def accept_submission(
    session: AsyncSession, submission_id: UUID, buyer: User,
) -> Submission:
    # Accept submission: mark ACCEPTED, complete task, auto-complete project if all tasks done.
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    if submission.status != SubmissionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Submission is not pending review")

    submission.status = SubmissionStatus.ACCEPTED
    submission.reviewed_at = datetime.now(timezone.utc)

    task.status = TaskStatus.COMPLETED
    task.updated_at = datetime.now(timezone.utc)

    # auto-complete project if all tasks are done
    await session.flush()
    incomplete_stmt = select(func.count()).select_from(Task).where(
        Task.project_id == project.id,
        Task.status != TaskStatus.COMPLETED,
    )
    incomplete_count = (await session.exec(incomplete_stmt)).one()

    if incomplete_count == 0:
        project.status = ProjectStatus.COMPLETED
        project.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(submission)
    return submission


async def reject_submission(
    session: AsyncSession, submission_id: UUID, buyer: User, reviewer_notes: str,
) -> Submission:
    # Reject submission with feedback. Task moves to REVISION_REQUESTED.
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    if submission.status != SubmissionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Submission is not pending review")

    submission.status = SubmissionStatus.REJECTED
    submission.reviewer_notes = reviewer_notes
    submission.reviewed_at = datetime.now(timezone.utc)

    task.status = TaskStatus.REVISION_REQUESTED
    task.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(submission)
    return submission


async def list_submissions_for_task(
    session: AsyncSession, task_id: UUID, user: User,
    page: int = 1, limit: int = 20,
) -> dict:
    # List all submissions for a task, newest first.
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = await session.get(Project, task.project_id)
    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

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
        .order_by(Submission.submitted_at.desc())
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


async def get_download_url(
    session: AsyncSession, submission_id: UUID, user: User,
) -> str:
    # Generate a presigned URL for downloading a submission's ZIP.
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    task = await session.get(Task, submission.task_id)
    project = await session.get(Project, task.project_id)

    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    url = get_presigned_url(submission.file_url)
    return url
