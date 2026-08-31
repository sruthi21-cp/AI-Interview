from app.schemas.interview import (
    InterviewSessionCreate,
    InterviewSessionResponse,
    InterviewSessionListResponse,
)
from app.services.interview_engine import InterviewEngine
from fastapi import APIRouter, Depends, HTTPException, status, Body, File, Form, UploadFile
from app.api import deps
from app.models.user import User as UserModel
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
@router.post("/start", response_model=Dict, status_code=status.HTTP_201_CREATED)
async def start_interview(
    session_in: InterviewSessionCreate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
    resume: UploadFile = File(None),
    job_description: Optional[str] = Form(None),
) -> Any:
    """Create a session and return the first question, with optional resume PDF and job description."""
    import logging, os, tempfile
    logger = logging.getLogger("uvicorn.error")
    resume_text: Optional[str] = None
    # Process resume PDF if provided
    if resume is not None:
        if resume.content_type != "application/pdf":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume must be a PDF file.")
        content = await resume.read()
        max_size = 2 * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume PDF exceeds maximum size of 2 MiB.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            resume_text = extract_text_from_pdf(tmp_path)
            if not resume_text.strip():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume PDF is empty or could not be processed.")
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    # Validate job description length if provided
    if job_description is not None:
        if len(job_description) > 2000:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job description exceeds maximum length of 2000 characters.")
    try:
        session = engine.create_session(db, session_in, current_user.id, resume_text=resume_text, job_description=job_description)
        question = engine.get_next_question(db, session.id)
        return {"session_id": session.id, "question": question}
    except Exception as e:
        logger.error("Failed to create interview session: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interview session: {str(e)}"
        )

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

@router.get("/analytics", response_model=Dict, status_code=status.HTTP_200_OK)
def get_user_analytics(
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Return aggregated analytics for the current user across all interview sessions."""
    return engine.get_user_analytics(db, current_user.id)

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

