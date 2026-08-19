from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User as UserModel
from app.models.interview_session import InterviewSession
from app.schemas.interview import (
    InterviewSessionCreate,
    InterviewSessionResponse,
    InterviewSessionListResponse,
)
from app.services.interview_engine import InterviewEngine

router = APIRouter()

engine = InterviewEngine()

@router.post("/", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_interview(
    session_in: InterviewSessionCreate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Legacy endpoint: create interview session without AI flow."""
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

@router.post("/start", response_model=Dict, status_code=status.HTTP_201_CREATED)
def start_interview(
    session_in: InterviewSessionCreate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Create a session and return the first question."""
    session = engine.create_session(db, session_in, current_user.id)
    question = engine.get_next_question(db, session.id)
    return {"session_id": session.id, "question": question}

@router.get("/{session_id}/next", response_model=Dict)
def get_next_question(
    session_id: int,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Return the next question for a session."""
    sess = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    question = engine.get_next_question(db, sess.id)
    return {"session_id": sess.id, "question": question}

@router.post("/{session_id}/answer", response_model=Dict)
def submit_answer(
    session_id: int,
    payload: Dict = Body(...),  # expects {"answer": "..."}
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Submit an answer and receive evaluation."""
    sess = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    answer_text = payload.get("answer", "")
    evaluation = engine.submit_answer(db, sess.id, answer_text)
    return {"session_id": sess.id, "evaluation": evaluation}

@router.get("/", response_model=InterviewSessionListResponse)
def list_interviews(
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
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
    interview = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == interview_id, InterviewSession.user_id == current_user.id)
        .first()
    )
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    return interview

@router.get("/{session_id}/evaluation", response_model=Dict)
def get_session_evaluation(
    session_id: int,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Return aggregated evaluation for a completed interview session."""
    sess = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == current_user.id,
    ).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    return engine.get_aggregated_evaluation(db, sess.id)

