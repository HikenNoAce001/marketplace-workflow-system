from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://marketplace:marketplace@localhost:5432/marketplace"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "marketplace-uploads"
    MINIO_USE_SSL: bool = False

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback/google"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback/github"

    # JWT
    JWT_SECRET: str = "change-me-to-random-64-char-string"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    ADMIN_EMAIL: str = "admin@example.com"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Deployment environment: "development" or "production"
    ENVIRONMENT: str = "development"

    # Cookie settings — overridden per environment.
    # Development: secure=False (HTTP), samesite=lax (same origin)
    # Production:  secure=True (HTTPS), samesite=none (cross-origin Railway subdomains)
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # Dev login toggle — keep True for demo, set False to fully disable
    ENABLE_DEV_LOGIN: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def async_database_url(self) -> str:
        """
        Railway provides DATABASE_URL as postgresql://user:pass@host/db.
        asyncpg requires postgresql+asyncpg://user:pass@host/db.
        This property auto-converts so the same DATABASE_URL works everywhere.
        Locally, the URL already has +asyncpg, so the replace is a no-op.
        """
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
