# all models imported here for Alembic autogenerate
from app.models.user import User, UserRole  # noqa: F401
from app.models.project import Project, ProjectStatus  # noqa: F401
from app.models.request import ProjectRequest, RequestStatus  # noqa: F401
from app.models.task import Task, TaskStatus  # noqa: F401
from app.models.submission import Submission, SubmissionStatus  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
