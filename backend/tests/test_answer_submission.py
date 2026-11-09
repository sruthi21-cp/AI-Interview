import json
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.api.deps import get_db
from app.main import app
from app.models.user import User
from app.models.interview_session import InterviewSession
from app.core.security import create_access_token, get_password_hash

from sqlalchemy.pool import StaticPool

# Setup in-memory test database for fast, isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


@pytest.fixture
def test_data():
    """Create test users and test interview sessions in the isolated test database."""
    db = TestingSessionLocal()
    u1 = User(
        email="test_candidate1@example.com",
        full_name="Candidate One",
        hashed_password="fake_hashed_password_1",
        is_active=True,
    )
    db.add(u1)

    u2 = User(
        email="test_candidate2@example.com",
        full_name="Candidate Two",
        hashed_password="fake_hashed_password_2",
        is_active=True,
    )
    db.add(u2)
    db.commit()
    db.refresh(u1)
    db.refresh(u2)

    sess1 = InterviewSession(
        user_id=u1.id,
        job_role="Backend Developer",
        interview_type="Technical",
        experience_level="Intermediate",
        difficulty="Medium",
        question_count=2,
        answered_count=0,
        status="in_progress",
        questions=json.dumps([
            "What is the difference between a process and a thread?",
            "How does database indexing improve query performance?"
        ]),
        evaluations="[]",
        selected_skills=json.dumps(["Python", "FastAPI"]),
        adaptive_state=json.dumps({"current_difficulty": "Medium"}),
    )
    db.add(sess1)
    db.commit()
    db.refresh(sess1)

    sess1_id = sess1.id
    u1_id = u1.id
    u2_id = u2.id
    db.close()

    return {
        "user1_id": u1_id,
        "user2_id": u2_id,
        "session1_id": sess1_id,
    }


def test_submit_valid_answer(test_data):
    """Test submitting a valid typed answer returns 200 with structured evaluation."""
    token = create_access_token(test_data["user1_id"])
    headers = {"Authorization": f"Bearer {token}"}
    sess_id = test_data["session1_id"]

    res = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "A process has its own dedicated memory space, whereas threads share the memory of their parent process."},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == sess_id
    assert "evaluation" in data
    eval_res = data["evaluation"]
    assert "score" in eval_res
    assert "feedback" in eval_res
    assert "correctness" in eval_res
    assert "relevance" in eval_res


def test_submit_empty_or_whitespace_answer_fails(test_data):
    """Test submitting an empty or whitespace answer returns 422 validation error."""
    token = create_access_token(test_data["user1_id"])
    headers = {"Authorization": f"Bearer {token}"}
    sess_id = test_data["session1_id"]

    # Empty string
    res = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": ""},
        headers=headers,
    )
    assert res.status_code == 422
    assert "empty" in res.json()["detail"].lower()

    # Whitespace only
    res2 = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "   \n\t  "},
        headers=headers,
    )
    assert res2.status_code == 422
    assert "empty" in res2.json()["detail"].lower()


def test_submit_answer_ownership_isolation(test_data):
    """Test that User 2 cannot submit answers to User 1's interview session."""
    token_user2 = create_access_token(test_data["user2_id"])
    headers = {"Authorization": f"Bearer {token_user2}"}
    sess_id = test_data["session1_id"]

    res = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "Trying to answer another candidate's session."},
        headers=headers,
    )
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower() or "permission" in res.json()["detail"].lower()


def test_submit_answer_invalid_session_id(test_data):
    """Test submitting to non-existent session ID returns 404."""
    token = create_access_token(test_data["user1_id"])
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/v1/interviews/99999999/answer",
        json={"answer": "Some answer text."},
        headers=headers,
    )
    assert res.status_code == 404


def test_complete_interview_flow_marks_completed(test_data):
    """Test answering all remaining questions marks the session completed."""
    token = create_access_token(test_data["user1_id"])
    headers = {"Authorization": f"Bearer {token}"}
    sess_id = test_data["session1_id"]

    # Submit answer 1
    res1 = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "Answer for question 1 on processes and threads."},
        headers=headers,
    )
    assert res1.status_code == 200

    # Submit answer 2 (final question)
    res2 = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "Database indexes use B-Tree data structures to reduce search time complexity from O(N) to O(log N)."},
        headers=headers,
    )
    assert res2.status_code == 200

    # Verify session is marked completed in database
    db = TestingSessionLocal()
    sess = db.query(InterviewSession).filter(InterviewSession.id == sess_id).first()
    assert sess.status == "completed"
    assert sess.answered_count == 2
    assert sess.completed_at is not None
    db.close()

    # Attempting to submit after completion returns 400
    res_overflow = client.post(
        f"/api/v1/interviews/{sess_id}/answer",
        json={"answer": "Extra answer attempt."},
        headers=headers,
    )
    assert res_overflow.status_code == 400
    assert "already been answered" in res_overflow.json()["detail"]
