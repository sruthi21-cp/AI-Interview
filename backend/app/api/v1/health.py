from fastapi import APIRouter

router = APIRouter()

@router.get("/health", status_code=200)
def check_health():
    """
    Health check endpoint to verify backend status.
    """
    return {
        "status": "ok",
        "message": "Backend service is healthy"
    }
