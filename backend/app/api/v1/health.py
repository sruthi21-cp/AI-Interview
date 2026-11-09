from fastapi import APIRouter
from app.services.ai import get_ai_status

router = APIRouter()

@router.get("/health", status_code=200)
def check_health():
    """
    Health check endpoint to verify backend status and active AI provider configuration.
    """
    return {
        "status": "ok",
        "message": "Backend service is healthy",
        "ai": get_ai_status(),
    }
