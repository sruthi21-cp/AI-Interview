from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User as UserModel
from app.models.interview_session import InterviewSession
from app.schemas.interview import (
    InterviewSessionCreate,
    InterviewSessionResponse,
    InterviewSessionListResponse,
)

router = APIRouter()


@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_interview(
    session_in: InterviewSessionCreate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new interview session for the authenticated user.
    """
    db_session = InterviewSession(
        user_id=current_user.id,
        job_role=session_in.job_role,
        interview_type=session_in.interview_type,
        experience_level=session_in.experience_level,
        difficulty=session_in.difficulty,
        question_count=session_in.question_count,
        status="created",
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("", response_model=InterviewSessionListResponse)
def list_interviews(
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """
    Return all interview sessions belonging to the authenticated user.
    """
    interviews = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    return {"interviews": interviews, "total": len(interviews)}


@router.get("/{interview_id}", response_model=InterviewSessionResponse)
def get_interview(
    interview_id: int,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """
    Return a specific interview session — only if it belongs to the current user.
    Returns 404 if not found or if it belongs to another user.
    """
    interview = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == interview_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found",
        )
    return interview
