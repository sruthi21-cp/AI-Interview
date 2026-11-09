import os
import time
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL

# For SQLite with relative paths (e.g. sqlite:///./sql_app.db), anchor to the canonical project database
# to ensure both root and backend working directories access the exact same database.
if db_url.startswith("sqlite"):
    if (
        (db_url.startswith("sqlite:///./") or (db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////")))
        and ":memory:" not in db_url
    ):
        db_filename = db_url.replace("sqlite:///./", "").replace("sqlite:///", "")
        if not os.path.isabs(db_filename):
            _backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            _root_dir = os.path.dirname(_backend_dir)
            root_candidate = os.path.join(_root_dir, db_filename)
            backend_candidate = os.path.join(_backend_dir, db_filename)

            if os.path.exists(root_candidate):
                canonical_path = root_candidate
            elif os.path.exists(backend_candidate):
                canonical_path = backend_candidate
            else:
                canonical_path = root_candidate

            canonical_path = canonical_path.replace("\\", "/")
            db_url = f"sqlite:///{canonical_path}"

    engine = create_engine(
        db_url, connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    engine = create_engine(db_url, pool_pre_ping=True)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def wait_for_db(max_retries: int = 15, delay: float = 2.0) -> bool:
    """
    Wait for the database connection to become available during startup.
    Useful for containerized deployments (Docker Compose / Kubernetes).
    """
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            logger.info("Database connection established successfully.")
            return True
        except Exception as exc:
            if attempt == max_retries:
                logger.error(f"Could not connect to database after {max_retries} attempts: {exc}")
                raise exc
            logger.warning(f"Database connection attempt {attempt}/{max_retries} failed: {exc}. Retrying in {delay}s...")
            time.sleep(delay)
    return False

