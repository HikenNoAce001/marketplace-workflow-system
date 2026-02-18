"""
Submission Router — HTTP endpoints for file submissions.

Endpoints:
  POST  /api/tasks/{id}/submissions       → Upload ZIP (SOLVER)
  GET   /api/tasks/{id}/submissions       → List submissions (role-aware)
  GET   /api/submissions/{id}/download    → Get presigned download URL (role-aware)
  PATCH /api/submissions/{id}/accept      → Accept submission (BUYER, CASCADE)
  PATCH /api/submissions/{id}/reject      → Reject submission (BUYER)

The upload endpoint is special:
  - Uses multipart/form-data (not JSON) because it includes a file
  - FastAPI reads the file with UploadFile and optional notes with Form()
  - The file is read into memory, validated, then uploaded to MinIO
"""

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
    """Convert Submission model → SubmissionRead schema."""
    return SubmissionRead(
        id=s.id, task_id=s.task_id, file_name=s.file_name,
        file_size=s.file_size, notes=s.notes, status=s.status.value,
        reviewer_notes=s.reviewer_notes, submitted_at=s.submitted_at,
        reviewed_at=s.reviewed_at,
    )


# ---------------------------------------------------------------------------
# Upload — the only endpoint that uses multipart/form-data
#
# Why UploadFile + Form instead of a JSON body?
#   JSON can't carry binary files. Multipart encoding splits the request into
#   "parts" — one for the file bytes, one for the notes text.
#   FastAPI handles this with UploadFile (file part) + Form (text parts).
#
# Why read the entire file into memory (await file.read())?
#   We need the full bytes to:
#   1. Run zipfile.is_zipfile() — needs the whole file, not a stream
#   2. Get the file size (len(file_bytes))
#   3. Upload to MinIO in one shot
#   This is fine for files under 50MB (our limit).
# ---------------------------------------------------------------------------

@router.post("/api/tasks/{task_id}/submissions", response_model=SubmissionRead, status_code=201)
async def upload_submission(
    task_id: UUID,
    file: UploadFile = File(...),           # The ZIP file — "..." means required
    notes: str | None = Form(default=None), # Optional text notes — Form because it's multipart
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    """
    Solver uploads a ZIP file for a task.
    CASCADE: creates submission (PENDING_REVIEW) + task → SUBMITTED
    """
    # Read entire file into memory (up to 50MB, validated later)
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


# ---------------------------------------------------------------------------
# List — submission history for a task (all submissions, newest first)
# ---------------------------------------------------------------------------

@router.get("/api/tasks/{task_id}/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    task_id: UUID,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all submissions for a task. Shows full revision history."""
    result = await service.list_submissions_for_task(
        session, task_id, current_user, page, limit,
    )
    return SubmissionListResponse(
        data=[_to_read(s) for s in result["data"]],
        meta=result["meta"],
    )


# ---------------------------------------------------------------------------
# Download — returns a presigned URL (frontend downloads from MinIO directly)
# ---------------------------------------------------------------------------

@router.get("/api/submissions/{submission_id}/download", response_model=SubmissionDownloadResponse)
async def download_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get a 1-hour presigned URL to download the submission ZIP from MinIO."""
    url = await service.get_download_url(session, submission_id, current_user)
    return SubmissionDownloadResponse(download_url=url)


# ---------------------------------------------------------------------------
# Accept — CASCADE: submission ACCEPTED + task COMPLETED + maybe project COMPLETED
# ---------------------------------------------------------------------------

@router.patch("/api/submissions/{submission_id}/accept", response_model=SubmissionRead)
async def accept_submission(
    submission_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    """
    Buyer accepts a submission. CASCADE:
    1. Submission → ACCEPTED
    2. Task → COMPLETED
    3. If ALL tasks done → Project → COMPLETED
    """
    submission = await service.accept_submission(session, submission_id, current_user)
    return _to_read(submission)


# ---------------------------------------------------------------------------
# Reject — submission REJECTED + task REVISION_REQUESTED
# ---------------------------------------------------------------------------

@router.patch("/api/submissions/{submission_id}/reject", response_model=SubmissionRead)
async def reject_submission(
    submission_id: UUID,
    body: SubmissionReject,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    """Buyer rejects a submission with feedback. Task → REVISION_REQUESTED."""
    submission = await service.reject_submission(
        session, submission_id, current_user, body.reviewer_notes,
    )
    return _to_read(submission)
