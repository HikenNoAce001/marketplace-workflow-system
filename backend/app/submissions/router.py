# Submission endpoints — upload, list, download, accept, reject.

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.submissions import service
from app.submissions.schemas import (
    SubmissionDownloadResponse,
    SubmissionListResponse,
    SubmissionRead,
    SubmissionReject,
)

router = APIRouter(tags=["submissions"])


def _to_read(s) -> SubmissionRead:
    # Convert Submission model to response schema.
    return SubmissionRead(
        id=s.id, task_id=s.task_id, file_name=s.file_name,
        file_size=s.file_size, notes=s.notes, status=s.status.value,
        reviewer_notes=s.reviewer_notes, submitted_at=s.submitted_at,
        reviewed_at=s.reviewed_at,
    )


@router.post("/api/tasks/{task_id}/submissions", response_model=SubmissionRead, status_code=201)
async def upload_submission(
    task_id: UUID,
    file: UploadFile = File(...),
    notes: str | None = Form(default=None),
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    # Upload a ZIP for a task. Creates submission + task moves to SUBMITTED.
    file_bytes = await file.read()

    submission = await service.create_submission(
        session=session,
        solver=current_user,
        task_id=task_id,
        file_bytes=file_bytes,
        filename=file.filename or "upload.zip",
        content_type=file.content_type or "application/octet-stream",
        notes=notes,
    )
    return _to_read(submission)


@router.get("/api/tasks/{task_id}/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    task_id: UUID,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # List all submissions for a task, newest first.
    result = await service.list_submissions_for_task(
        session, task_id, current_user, page, limit,
    )
    return SubmissionListResponse(
        data=[_to_read(s) for s in result["data"]],
        meta=result["meta"],
    )


@router.get("/api/submissions/{submission_id}/download", response_model=SubmissionDownloadResponse)
async def download_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Get a presigned URL to download the submission ZIP from MinIO.
    url = await service.get_download_url(session, submission_id, current_user)
    return SubmissionDownloadResponse(download_url=url)


@router.patch("/api/submissions/{submission_id}/accept", response_model=SubmissionRead)
async def accept_submission(
    submission_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Accept a submission. Cascades: task COMPLETED, project COMPLETED if all tasks done.
    submission = await service.accept_submission(session, submission_id, current_user)
    return _to_read(submission)


@router.patch("/api/submissions/{submission_id}/reject", response_model=SubmissionRead)
async def reject_submission(
    submission_id: UUID,
    body: SubmissionReject,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Reject a submission with feedback. Task moves to REVISION_REQUESTED.
    submission = await service.reject_submission(
        session, submission_id, current_user, body.reviewer_notes,
    )
    return _to_read(submission)
