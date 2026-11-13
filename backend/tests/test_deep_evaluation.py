import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.models.interview_session import InterviewSession
from app.core.security import get_password_hash
from app.services.ai import AIProvider, AIProviderError
from app.services.interview_engine import InterviewEngine
from app.services.rag_coach import RAGCoachService


# Test in-memory SQLite database
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def test_1_deep_structured_evaluation_fields():
    """Verify evaluation generates deep structured fields for candidate answer."""
    provider = AIProvider()
    eval_dto = provider.evaluate_answer(
        question="Explain how polymorphism works in object-oriented programming.",
        answer="Polymorphism allows objects of different classes to be treated as instances of a common superclass through method overriding and interfaces.",
        job_role="Backend Developer",
    )

    # Core scores
    assert eval_dto.score >= 7.0
    assert eval_dto.correctness >= 0.7
    assert eval_dto.technical_depth >= 0.6
    assert eval_dto.conceptual_understanding is not None and eval_dto.conceptual_understanding >= 0.7
    assert eval_dto.explanation_clarity is not None and eval_dto.explanation_clarity >= 0.7

    # Deep structured diagnostic fields
    assert eval_dto.answer_summary != ""
    assert isinstance(eval_dto.correct_points, list) and len(eval_dto.correct_points) > 0
    assert isinstance(eval_dto.expected_answer, str) and len(eval_dto.expected_answer) > 0
    assert isinstance(eval_dto.scoring_rationale, str) and len(eval_dto.scoring_rationale) > 0


def test_2_unasked_skills_never_in_strengths():
    """Verify that unasked resume skills (e.g. AWS, Docker, Kubernetes) are NEVER classified as verified strengths."""
    db = TestingSessionLocal()
    user = User(
        email="candidate_unasked@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate Unasked",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Session evaluated ONLY on React Hooks, but candidate resume has AWS, Docker, Kubernetes
    resume_skills = ["AWS", "Docker", "Kubernetes", "React", "Python"]
    evals = [
        {
            "question": "How do you optimize expensive computations in React components?",
            "answer": "Use the useMemo hook to cache the result of expensive calculations across re-renders based on a dependency array.",
            "score": 8.5,
            "correctness": 0.9,
            "relevance": 0.9,
            "technical_depth": 0.8,
            "communication_quality": 0.8,
            "conceptual_understanding": 0.9,
            "explanation_clarity": 0.8,
            "strengths": ["React Hooks", "useMemo optimization"],
            "weaknesses": [],
            "correct_points": ["Correctly identified useMemo for memoizing expensive calculations."],
            "incorrect_statements": [],
            "missing_concepts": [],
            "knowledge_gaps": [],
            "feedback": "Strong explanation of React hook memoization.",
        }
    ]

    sess = InterviewSession(
        user_id=user.id,
        job_role="Frontend Developer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["How do you optimize expensive computations in React components?"]),
        evaluations=json.dumps(evals),
        resume_skills=json.dumps(resume_skills),
        selected_skills=json.dumps(["React"]),
    )
    db.add(sess)
    db.commit()

    coach_service = RAGCoachService(AIProvider())
    ctx = coach_service.build_user_context(db, user.id, user.full_name)

    # Verified strengths check
    verified_strengths = ctx.get("verified_strengths", [])
    verified_concepts = [s.concept.lower() for s in verified_strengths]

    assert "react hooks" in verified_concepts
    # Unasked resume skills must NEVER be in verified strengths
    assert "aws" not in verified_concepts
    assert "docker" not in verified_concepts
    assert "kubernetes" not in verified_concepts
    db.close()


def test_3_resume_skills_not_treated_as_evaluated_skills():
    """Verify that a candidate with resume skills but 0 interviews has NO verified strengths."""
    db = TestingSessionLocal()
    user = User(
        email="candidate_zero_interviews@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate Zero",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Created a session but not completed (0 evaluations)
    sess = InterviewSession(
        user_id=user.id,
        job_role="Backend Developer",
        interview_type="Technical",
        experience_level="Senior",
        difficulty="Hard",
        question_count=3,
        answered_count=0,
        status="in_progress",
        resume_skills=json.dumps(["Python", "PostgreSQL", "FastAPI", "Redis"]),
    )
    db.add(sess)
    db.commit()

    coach_service = RAGCoachService(AIProvider())
    summary = coach_service.get_coach_summary(db, user)

    assert summary.has_enough_data is False
    assert len(summary.verified_strengths) == 0
    assert len(summary.verified_weaknesses) == 0
    assert len(summary.concepts_to_improve) == 0
    assert summary.candidate_resume_skills == ["Python", "PostgreSQL", "FastAPI", "Redis"]
    db.close()


def test_4_high_scores_not_classified_as_weaknesses():
    """Verify that topics evaluated with high scores (>= 7.0) are NOT classified as weaknesses."""
    db = TestingSessionLocal()
    user = User(
        email="candidate_high_score@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate High Score",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    evals = [
        {
            "question": "What is primary key in SQL?",
            "answer": "A primary key is a column or set of columns that uniquely identifies each row in a table. It cannot contain NULL values.",
            "score": 9.0,
            "correctness": 0.95,
            "relevance": 0.9,
            "technical_depth": 0.85,
            "communication_quality": 0.9,
            "correct_points": ["Accurately identified uniqueness constraint and NOT NULL requirement."],
            "incorrect_statements": [],
            "missing_concepts": [],
            "knowledge_gaps": [],
            "feedback": "Flawless explanation of primary key constraints.",
        }
    ]

    sess = InterviewSession(
        user_id=user.id,
        job_role="Database Engineer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["What is primary key in SQL?"]),
        evaluations=json.dumps(evals),
    )
    db.add(sess)
    db.commit()

    coach_service = RAGCoachService(AIProvider())
    ctx = coach_service.build_user_context(db, user.id, user.full_name)

    weaknesses = ctx.get("verified_weaknesses", [])
    strengths = ctx.get("verified_strengths", [])

    assert len(strengths) >= 1
    assert any("sql" in s.concept.lower() or "primary" in s.concept.lower() for s in strengths)
    # Must NOT be in weaknesses
    assert not any("sql" in w.topic.lower() for w in weaknesses)
    assert len(weaknesses) == 0
    db.close()


def test_5_low_scores_have_supporting_evidence_and_explanation():
    """Verify that topics with low scores (< 6.5) include diagnostic reasons, answer excerpts, and explanations."""
    db = TestingSessionLocal()
    user = User(
        email="candidate_low_score@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate Low Score",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    evals = [
        {
            "question": "Explain how database indexing works.",
            "answer": "Database indexing just duplicates all data into another table to make it faster.",
            "score": 4.0,
            "correctness": 0.35,
            "relevance": 0.6,
            "technical_depth": 0.25,
            "communication_quality": 0.5,
            "correct_points": ["Understood that indexing improves search speed."],
            "incorrect_statements": ["Stated that an index duplicates all table data into another table."],
            "missing_concepts": ["B-Tree data structure", "pointer references to row IDs"],
            "knowledge_gaps": ["Misunderstands physical storage vs index pointer structures."],
            "expected_answer": "An index is an auxiliary search data structure (typically a B+Tree) containing sorted key values and pointers/row IDs.",
            "feedback": "Fundamental misunderstanding of index architecture.",
        }
    ]

    sess = InterviewSession(
        user_id=user.id,
        job_role="Backend Developer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["Explain how database indexing works."]),
        evaluations=json.dumps(evals),
    )
    db.add(sess)
    db.commit()

    coach_service = RAGCoachService(AIProvider())
    ctx = coach_service.build_user_context(db, user.id, user.full_name)

    weaknesses = ctx.get("verified_weaknesses", [])
    assert len(weaknesses) >= 1
    w = weaknesses[0]

    assert "index" in w.topic.lower()
    assert w.score <= 5.0
    assert len(w.why_weak) > 0
    assert len(w.misunderstood_or_missed) > 0
    assert "duplicates all data" in w.demonstrated_answer.lower() or "candidate" in w.demonstrated_answer.lower()
    assert len(w.correct_explanation) > 0
    assert len(w.recommended_practice) > 0

    # Concepts to improve must be High priority due to score <= 4.5 and incorrect statements
    concepts = ctx.get("concepts_to_improve", [])
    assert len(concepts) >= 1
    assert concepts[0].priority == "High"
    assert len(concepts[0].practice_questions) >= 1
    db.close()


def test_6_user_data_isolation():
    """Verify strict user isolation: User A cannot see User B's strengths, weaknesses, or evaluations."""
    db = TestingSessionLocal()
    user_a = User(
        email="candidate_a@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate A",
        is_active=True,
    )
    user_b = User(
        email="candidate_b@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate B",
        is_active=True,
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    # User A takes React interview and is weak in React Hooks
    sess_a = InterviewSession(
        user_id=user_a.id,
        job_role="Frontend Engineer",
        interview_type="Technical",
        experience_level="Junior",
        difficulty="Easy",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["What are hooks in React?"]),
        evaluations=json.dumps([{
            "question": "What are hooks in React?",
            "answer": "I don't know.",
            "score": 2.0,
            "weaknesses": ["React Hooks"],
            "feedback": "Did not answer.",
        }]),
    )

    # User B takes Python interview and excels in Python Decorators
    sess_b = InterviewSession(
        user_id=user_b.id,
        job_role="Python Engineer",
        interview_type="Technical",
        experience_level="Senior",
        difficulty="Hard",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["How do decorators work in Python?"]),
        evaluations=json.dumps([{
            "question": "How do decorators work in Python?",
            "answer": "Decorators wrap functions using closures and functools.wraps.",
            "score": 9.5,
            "strengths": ["Python Fundamentals"],
            "correct_points": ["Explained closures and functools.wraps."],
            "feedback": "Excellent explanation.",
        }]),
    )
    db.add_all([sess_a, sess_b])
    db.commit()

    coach_service = RAGCoachService(AIProvider())

    # Check User A context
    ctx_a = coach_service.build_user_context(db, user_a.id, user_a.full_name)
    assert ctx_a["user_id"] == user_a.id
    assert ctx_a["overall_score"] == 2.0
    assert not any("python" in s.concept.lower() for s in ctx_a.get("verified_strengths", []))

    # Check User B context
    ctx_b = coach_service.build_user_context(db, user_b.id, user_b.full_name)
    assert ctx_b["user_id"] == user_b.id
    assert ctx_b["overall_score"] == 9.5
    assert not any("react" in w.topic.lower() for w in ctx_b.get("verified_weaknesses", []))
    db.close()


def test_7_conversational_coach_grounded_responses():
    """Verify coach chat responds accurately regarding mistakes, session comparison, and strengths."""
    db = TestingSessionLocal()
    user = User(
        email="candidate_chat@example.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Candidate Chat",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Session 1: Baseline score 5.0
    sess1 = InterviewSession(
        user_id=user.id,
        job_role="Backend Developer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["What is SQL JOIN?"]),
        evaluations=json.dumps([{
            "question": "What is SQL JOIN?",
            "answer": "It combines tables.",
            "score": 5.0,
            "weaknesses": ["SQL Fundamentals"],
            "feedback": "Needs more detail on JOIN types.",
        }]),
    )
    # Session 2: Improved score 8.0
    sess2 = InterviewSession(
        user_id=user.id,
        job_role="Backend Developer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=1,
        answered_count=1,
        status="completed",
        questions=json.dumps(["Explain SQL LEFT JOIN vs INNER JOIN."]),
        evaluations=json.dumps([{
            "question": "Explain SQL LEFT JOIN vs INNER JOIN.",
            "answer": "INNER JOIN returns matching rows only; LEFT JOIN returns all rows from left table plus matched rows.",
            "score": 8.0,
            "strengths": ["SQL Fundamentals"],
            "correct_points": ["Accurately distinguished INNER vs LEFT JOIN."],
            "feedback": "Great explanation.",
        }]),
    )
    db.add_all([sess1, sess2])
    db.commit()

    coach_service = RAGCoachService(AIProvider())

    # 1. Ask to compare sessions
    compare_res = coach_service.chat_with_coach(db, user, "Compare my first and latest interview")
    assert "5.0" in compare_res.response or "8.0" in compare_res.response or "improved" in compare_res.response.lower()

    # 2. Ask for practice question
    pq_res = coach_service.chat_with_coach(db, user, "Give me a practice question")
    assert pq_res.practice_question is not None or "practice question" in pq_res.response.lower()
    db.close()


def test_8_malformed_llm_json_handling():
    """Verify that corrupt or malformed JSON from LLM does not fabricate invalid scores."""
    provider = AIProvider()
    with pytest.raises(AIProviderError):
        # Passing invalid JSON text to _call_llm_json directly
        class MockLLMBroken(AIProvider):
            def _call_llm(self, *args, **kwargs):
                return "THIS IS NOT VALID JSON AT ALL {unclosed"

        broken_provider = MockLLMBroken()
        broken_provider._call_llm_json("Evaluate this answer")
