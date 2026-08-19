from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # Store evaluations as JSON string list
    evaluations = Column(String, default='[]', nullable=False)
    # Track number of answered questions
    answered_count = Column(Integer, default=0, nullable=False)

    job_role = Column(String, nullable=False)
    interview_type = Column(String, nullable=False)
    experience_level = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    question_count = Column(Integer, nullable=False)

    # Status: created | in_progress | completed | cancelled
    status = Column(String, default="created", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationship back to User (read-only, no cascade changes to User model)
    user = relationship("User", back_populates="interview_sessions")
