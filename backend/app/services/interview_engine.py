import os
from typing import List, Dict, Any

try:
    from fastapi import HTTPException, status
except ImportError:
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
    class status:
        HTTP_404_NOT_FOUND = 404
from datetime import datetime

from app.models.interview_session import InterviewSession
from app.schemas.interview import InterviewSessionResponse, InterviewSessionCreate
from app.services.ai import AIProvider
from sqlalchemy.orm import Session


import json

class InterviewEngine:
    def __init__(self):
        # Initialize AI provider (mock or real based on env)
        self.provider = AIProvider()

    def _get_session(self, db: Session, session_id: int) -> InterviewSession:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
        return session

    def create_session(self, db: Session, session_in: InterviewSessionCreate, user_id: int) -> InterviewSession:
        # Batch generate the questions upfront using the AI provider (with mock fallback)
        setup = {
            "job_role": session_in.job_role,
            "interview_type": session_in.interview_type,
            "experience_level": session_in.experience_level,
            "difficulty": session_in.difficulty,
            "question_count": session_in.question_count,
        }
        questions_list = self.provider.generate_questions_batch(setup, session_in.question_count)

        # Create interview session record and set status to in_progress
        new_session = InterviewSession(
            user_id=user_id,
            job_role=session_in.job_role,
            interview_type=session_in.interview_type,
            experience_level=session_in.experience_level,
            difficulty=session_in.difficulty,
            question_count=session_in.question_count,
            status="in_progress",
            questions=json.dumps(questions_list),
            evaluations='[]',
            answered_count=0,
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    def get_next_question(self, db: Session, session_id: int) -> Dict[str, Any]:
        session = self._get_session(db, session_id)
        questions_list = json.loads(session.questions or '[]')
        idx = session.answered_count or 0

        if idx >= len(questions_list):
            return {
                "question_id": None,
                "text": "No more questions. The interview is complete.",
                "metadata": {"complete": True}
            }

        question_text = questions_list[idx]
        return {
            "question_id": idx + 1,
            "text": question_text,
            "metadata": {
                "question_number": idx + 1,
                "total_questions": len(questions_list)
            },
        }

    def submit_answer(self, db: Session, session_id: int, answer: str) -> Dict[str, Any]:
        session = self._get_session(db, session_id)
        questions_list = json.loads(session.questions or '[]')
        idx = session.answered_count or 0

        if idx >= len(questions_list):
            raise HTTPException(status_code=400, detail="All questions have already been answered.")

        question_text = questions_list[idx]

        # Evaluate answer using the AI provider
        evaluation_dto = self.provider.evaluate_answer(question_text, answer, [])

        eval_dict = {
            "question": question_text,
            "answer": answer,
            "score": evaluation_dto.score,
            "feedback": evaluation_dto.feedback,
            "correctness": evaluation_dto.correctness,
            "relevance": evaluation_dto.relevance,
            "technical_depth": evaluation_dto.technical_depth,
            "communication_quality": evaluation_dto.communication_quality,
            "strengths": evaluation_dto.strengths,
            "weaknesses": evaluation_dto.weaknesses,
        }

        # Persist evaluation in the session's evaluations JSON column
        existing_evals = json.loads(session.evaluations or '[]')
        existing_evals.append(eval_dict)
        session.evaluations = json.dumps(existing_evals)

        # Increment answered count
        session.answered_count = (session.answered_count or 0) + 1

        # If all questions answered, mark session completed
        if session.answered_count >= session.question_count:
            session.status = "completed"
            session.completed_at = datetime.utcnow()

        db.add(session)
        db.commit()

        return eval_dict

    def get_aggregated_evaluation(self, db: Session, session_id: int) -> Dict[str, Any]:
        """Aggregate all per-question evaluations into a final summary."""
        session = self._get_session(db, session_id)
        evals = json.loads(session.evaluations or '[]')

        if not evals:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No evaluations found for this interview session."
            )

        count = len(evals)

        avg_score = round(sum(e.get("score", 0) for e in evals) / count, 1)
        avg_correctness = round(sum(e.get("correctness", 0) for e in evals) / count, 3)
        avg_relevance = round(sum(e.get("relevance", 0) for e in evals) / count, 3)
        avg_technical_depth = round(sum(e.get("technical_depth", 0) for e in evals) / count, 3)
        avg_communication = round(sum(e.get("communication_quality", 0) for e in evals) / count, 3)

        # Collect all unique strengths and weaknesses
        all_strengths = []
        all_weaknesses = []
        all_feedback = []
        for e in evals:
            all_strengths.extend(e.get("strengths", []))
            all_weaknesses.extend(e.get("weaknesses", []))
            if e.get("feedback"):
                all_feedback.append(e["feedback"])

        # Deduplicate strengths/weaknesses
        unique_strengths = list(dict.fromkeys(all_strengths))
        unique_weaknesses = list(dict.fromkeys(all_weaknesses))

        return {
            "session_id": session.id,
            "job_role": session.job_role,
            "interview_type": session.interview_type,
            "difficulty": session.difficulty,
            "question_count": session.question_count,
            "answered_count": session.answered_count or count,
            "status": session.status,
            "overall_score": avg_score,
            "overall_correctness": avg_correctness,
            "overall_relevance": avg_relevance,
            "overall_technical_depth": avg_technical_depth,
            "overall_communication_quality": avg_communication,
            "strengths": unique_strengths,
            "weaknesses": unique_weaknesses,
            "feedback": " | ".join(all_feedback) if all_feedback else "No feedback available.",
            "per_question_evaluations": evals,
        }

