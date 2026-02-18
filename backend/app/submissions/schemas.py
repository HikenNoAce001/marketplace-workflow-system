"""
Submission Schemas — API shapes for file submission endpoints.

Why no SubmissionCreate?
  Submissions are created via multipart/form-data (file upload),
  not JSON. The router handles the file + optional notes directly.
  FastAPI reads UploadFile + Form fields, not a JSON body.
"""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class SubmissionRead(SQLModel):
    """What the API returns for a single submission."""
    id: UUID
    task_id: UUID
    file_name: str
    file_size: int
    notes: str | None = None
    status: str
    reviewer_notes: str | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None


class SubmissionReject(SQLModel):
    """Buyer sends this when rejecting a submission — includes feedback notes."""
    reviewer_notes: str


class SubmissionDownloadResponse(SQLModel):
    """Returns a presigned URL for downloading the ZIP from MinIO."""
    download_url: str


class SubmissionListResponse(SQLModel):
    """List of submissions for a task, ordered by submitted_at DESC (newest first)."""
    data: list[SubmissionRead]
    meta: dict
