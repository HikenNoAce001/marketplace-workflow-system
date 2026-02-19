from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class SubmissionRead(SQLModel):
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
    reviewer_notes: str


class SubmissionDownloadResponse(SQLModel):
    download_url: str


class SubmissionListResponse(SQLModel):
    data: list[SubmissionRead]
    meta: dict
