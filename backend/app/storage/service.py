"""
Storage Service — MinIO (S3-compatible) file operations.

WHY MinIO instead of saving files on the server?
  1. Backend servers are stateless — if the container restarts, files are gone
  2. If you scale to 2+ backends, they don't share a filesystem
  3. MinIO is purpose-built for file storage — it handles replication, durability
  4. Files are served via presigned URLs — backend never proxies file downloads

HOW it works:
  Upload:   backend receives file → validates → uploads to MinIO → returns the object path
  Download: backend generates a presigned URL (temp link, 1hr expiry) → frontend downloads from MinIO directly

File path convention:
  submissions/{project_id}/{task_id}/{uuid}.zip
  This structure makes it easy to find all submissions for a project/task.
"""

import io
import zipfile
from datetime import timedelta
from uuid import UUID, uuid4

from minio import Minio

from app.config import settings

# ---------------------------------------------------------------------------
# MinIO client — initialized once, reused across all requests
# This is NOT async (minio Python package is sync), but the operations
# are I/O-bound and fast enough for our file sizes (<50MB).
# ---------------------------------------------------------------------------

# Initialize MinIO client only if MINIO_ENDPOINT is configured.
# On Railway without MinIO, the endpoint is empty — we skip initialization
# so the app can start. File upload/download won't work until MinIO is added.
minio_client: Minio | None = None

if settings.MINIO_ENDPOINT:
    minio_client = Minio(
        endpoint=settings.MINIO_ENDPOINT,     # "minio:9000" inside Docker, "localhost:9000" outside
        access_key=settings.MINIO_ACCESS_KEY, # "minioadmin" (default)
        secret_key=settings.MINIO_SECRET_KEY, # "minioadmin" (default)
        secure=settings.MINIO_USE_SSL,        # False for local dev, True for production
    )


def ensure_bucket_exists() -> None:
    """
    Create the upload bucket if it doesn't exist.
    Called once on app startup (in main.py lifespan).
    Idempotent — safe to call multiple times.
    Skips silently if MinIO is not configured.
    """
    if not minio_client:
        print("⚠ MinIO not configured — skipping bucket check. File uploads disabled.")
        return
    if not minio_client.bucket_exists(settings.MINIO_BUCKET):
        minio_client.make_bucket(settings.MINIO_BUCKET)


# ---------------------------------------------------------------------------
# ZIP Validation — ALL 4 checks required per requirements
#
# Why 4 checks instead of just one?
#   1. Extension check → catches obvious wrong files (user picks a .pdf by mistake)
#   2. MIME type check → catches files with renamed extensions (someone renames .exe to .zip)
#   3. zipfile.is_zipfile() → validates actual file structure (catches corrupted/fake ZIPs)
#      This handles ALL valid ZIP variants: PK\x03\x04, empty archives PK\x05\x06,
#      and spanned archives PK\x07\x08. Magic byte check would miss the last two.
#   4. Size check → prevents 500MB uploads from killing the server
# ---------------------------------------------------------------------------

async def validate_zip(file_bytes: bytes, filename: str, content_type: str) -> None:
    """
    Validate that the uploaded file is a real ZIP file.
    Raises ValueError with a descriptive message if any check fails.
    The router catches ValueError and returns 400.
    """
    # Check 1: File extension must be .zip
    if not filename.lower().endswith(".zip"):
        raise ValueError("File must have .zip extension")

    # Check 2: MIME type must be application/zip
    # The browser sets this based on the file extension, but we verify anyway
    if content_type != "application/zip":
        raise ValueError("File must have application/zip MIME type")

    # Check 3: Actual ZIP file structure validation
    # io.BytesIO wraps raw bytes into a file-like object that zipfile can read
    if not zipfile.is_zipfile(io.BytesIO(file_bytes)):
        raise ValueError("File is not a valid ZIP archive")

    # Check 4: Size limit (default 50MB from config)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert MB → bytes
    if len(file_bytes) > max_bytes:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")


# ---------------------------------------------------------------------------
# Upload — stores file in MinIO with a structured path
# ---------------------------------------------------------------------------

def upload_file(project_id: UUID, task_id: UUID, file_bytes: bytes) -> str:
    """
    Upload a ZIP file to MinIO.

    Args:
        project_id: The project this submission belongs to
        task_id:    The task this submission is for
        file_bytes: The raw ZIP file bytes

    Returns:
        The object path in MinIO (e.g., "submissions/abc123/def456/789ghi.zip")
        This path is stored in the Submission DB row as file_url.

    Why uuid4 in the filename?
        Prevents collisions if the same task is resubmitted multiple times.
        Each submission gets a unique filename even though they share the same task.
    """
    if not minio_client:
        raise RuntimeError("MinIO is not configured — file uploads are disabled")

    # Build the storage path: submissions/{project_id}/{task_id}/{random_uuid}.zip
    object_name = f"submissions/{project_id}/{task_id}/{uuid4()}.zip"

    # Upload to MinIO
    # io.BytesIO wraps bytes into a file-like object that minio.put_object expects
    minio_client.put_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_name,
        data=io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type="application/zip",
    )

    return object_name  # This string is stored in the DB


# ---------------------------------------------------------------------------
# Presigned URL — temporary download link (1 hour)
# ---------------------------------------------------------------------------

def get_presigned_url(object_name: str) -> str:
    """
    Generate a presigned GET URL for downloading a file from MinIO.

    What is a presigned URL?
        A regular MinIO URL requires auth credentials to access.
        A presigned URL is a special URL with a cryptographic signature embedded in it.
        Anyone with this URL can download the file — BUT it expires after 1 hour.
        After expiry, the URL returns 403 Forbidden.

    Why presigned instead of serving through backend?
        1. Backend doesn't have to proxy the file (saves CPU/memory)
        2. Works with any file size — even 500MB files won't block the backend
        3. Frontend downloads directly from MinIO (faster)

    The frontend gets this URL from GET /api/submissions/{id}/download
    and opens it in a new tab or triggers a download.
    """
    if not minio_client:
        raise RuntimeError("MinIO is not configured — file downloads are disabled")

    url = minio_client.presigned_get_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_name,
        expires=timedelta(hours=1),  # URL valid for 1 hour
    )
    return url
