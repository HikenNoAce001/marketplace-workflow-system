# MinIO file storage operations (upload, download, validation).

import io
import zipfile
from datetime import timedelta
from uuid import UUID, uuid4

from minio import Minio

from app.config import settings

# lazy init — skip if MinIO isn't configured (e.g., Railway without MinIO)
minio_client: Minio | None = None

if settings.MINIO_ENDPOINT:
    minio_client = Minio(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_USE_SSL,
    )


def ensure_bucket_exists() -> None:
    # Create the upload bucket if it doesn't already exist.
    if not minio_client:
        print("⚠ MinIO not configured — skipping bucket check. File uploads disabled.")
        return
    if not minio_client.bucket_exists(settings.MINIO_BUCKET):
        minio_client.make_bucket(settings.MINIO_BUCKET)


async def validate_zip(file_bytes: bytes, filename: str, content_type: str) -> None:
    # Validate uploaded file is a real ZIP (extension, MIME, structure, size).
    if not filename.lower().endswith(".zip"):
        raise ValueError("File must have .zip extension")

    if content_type != "application/zip":
        raise ValueError("File must have application/zip MIME type")

    if not zipfile.is_zipfile(io.BytesIO(file_bytes)):
        raise ValueError("File is not a valid ZIP archive")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")


def upload_file(project_id: UUID, task_id: UUID, file_bytes: bytes) -> str:
    # Upload a ZIP to MinIO. Returns the object path for DB storage.
    if not minio_client:
        raise RuntimeError("MinIO is not configured — file uploads are disabled")

    object_name = f"submissions/{project_id}/{task_id}/{uuid4()}.zip"

    minio_client.put_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_name,
        data=io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type="application/zip",
    )

    return object_name


def get_presigned_url(object_name: str) -> str:
    # Generate a 1-hour presigned GET URL for downloading from MinIO.
    if not minio_client:
        raise RuntimeError("MinIO is not configured — file downloads are disabled")

    url = minio_client.presigned_get_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(hours=1),
    )
    return url
