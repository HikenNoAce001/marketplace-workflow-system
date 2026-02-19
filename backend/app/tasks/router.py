# Task endpoints — create, list, get, update.

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.tasks import service
from app.tasks.schemas import TaskCreate, TaskListResponse, TaskRead, TaskUpdate

router = APIRouter(tags=["tasks"])


def _to_read(t) -> TaskRead:
    # Convert Task model to response schema.
    return TaskRead(
        id=t.id, project_id=t.project_id, created_by=t.created_by,
        title=t.title, description=t.description, deadline=t.deadline,
        status=t.status.value, created_at=t.created_at, updated_at=t.updated_at,
    )


@router.post("/api/projects/{project_id}/tasks", response_model=TaskRead, status_code=201)
async def create_task(
    project_id: UUID,
    body: TaskCreate,
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    # Create a task on an assigned project. Must be the assigned solver.
    task = await service.create_task(
        session, current_user, project_id, body.title, body.description, body.deadline,
    )
    return _to_read(task)


@router.get("/api/projects/{project_id}/tasks", response_model=TaskListResponse)
async def list_project_tasks(
    project_id: UUID,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # List all tasks for a project.
    result = await service.list_tasks_for_project(session, project_id, current_user, page, limit)
    return TaskListResponse(
        data=[_to_read(t) for t in result["data"]],
        meta=result["meta"],
    )


@router.get("/api/tasks/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Get a single task by ID.
    task = await service.get_task_by_id(session, task_id, current_user)
    return _to_read(task)


@router.patch("/api/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    body: TaskUpdate,
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    # Update task metadata. Status is managed by submissions, not this endpoint.
    task = await service.update_task(
        session, task_id, current_user, body.title, body.description, body.deadline,
    )
    return _to_read(task)
