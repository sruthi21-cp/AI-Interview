from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


# ---- Allowed values ----

JOB_ROLES = Literal[
    "Software Developer",
    "AI/ML Engineer",
    "Data Scientist",
    "Backend Developer",
    "Frontend Developer",
    "Custom",
]

INTERVIEW_TYPES = Literal["Technical", "HR", "Mixed"]

EXPERIENCE_LEVELS = Literal["Beginner", "Intermediate", "Advanced"]

DIFFICULTIES = Literal["Easy", "Medium", "Hard"]

QUESTION_COUNTS = Literal[5, 10, 15]


# ---- Request schema ----

class InterviewSessionCreate(BaseModel):
    job_role: JOB_ROLES
    interview_type: INTERVIEW_TYPES
    experience_level: EXPERIENCE_LEVELS
    difficulty: DIFFICULTIES
    question_count: QUESTION_COUNTS


# ---- Response schemas ----

class InterviewSessionResponse(BaseModel):
    id: int
    user_id: int
    job_role: str
    interview_type: str
    experience_level: str
    difficulty: str
    question_count: int
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InterviewSessionListResponse(BaseModel):
    interviews: list[InterviewSessionResponse]
    total: int
