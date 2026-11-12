"""
Tests for database URL normalization and SQLAlchemy driver compatibility.

Ensures PostgreSQL URLs from Render (postgres:// or postgresql://) are explicitly
normalized to postgresql+psycopg2:// so SQLAlchemy loads the installed
psycopg2-binary package instead of attempting to load psycopg (v3).

Also verifies SQLite URLs (local development & testing) remain fully compatible.
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from app.core.config import Settings, normalize_database_url


class TestDatabaseURLNormalization:
    """Unit tests for normalize_database_url helper."""

    def test_render_postgres_scheme_normalized(self):
        """Render provides DATABASE_URL with postgres:// scheme."""
        raw = "postgres://ai_user:s3cr3t@dpg-abc1234.oregon-postgres.render.com:5432/ai_interview"
        expected = "postgresql+psycopg2://ai_user:s3cr3t@dpg-abc1234.oregon-postgres.render.com:5432/ai_interview"
        assert normalize_database_url(raw) == expected

    def test_standard_postgresql_scheme_normalized(self):
        """Standard postgresql:// scheme must be upgraded to explicit psycopg2 driver."""
        raw = "postgresql://ai_user:s3cr3t@localhost:5432/ai_interview"
        expected = "postgresql+psycopg2://ai_user:s3cr3t@localhost:5432/ai_interview"
        assert normalize_database_url(raw) == expected

    def test_psycopg_v3_scheme_normalized(self):
        """postgresql+psycopg:// scheme must be redirected to installed psycopg2."""
        raw = "postgresql+psycopg://ai_user:s3cr3t@localhost:5432/ai_interview"
        expected = "postgresql+psycopg2://ai_user:s3cr3t@localhost:5432/ai_interview"
        assert normalize_database_url(raw) == expected

    def test_already_psycopg2_scheme_unchanged(self):
        """postgresql+psycopg2:// scheme should remain untouched."""
        raw = "postgresql+psycopg2://ai_user:s3cr3t@localhost:5432/ai_interview"
        assert normalize_database_url(raw) == raw

    def test_preserves_special_characters_in_credentials(self):
        """Ensures percent-encoded or complex passwords with symbols are preserved."""
        raw = "postgres://ai_user:p%40ss%3Aw%2Ford%21@localhost:5432/ai_interview"
        expected = "postgresql+psycopg2://ai_user:p%40ss%3Aw%2Ford%21@localhost:5432/ai_interview"
        assert normalize_database_url(raw) == expected

    def test_preserves_query_parameters(self):
        """Ensures sslmode and other query parameters are untouched."""
        raw = "postgres://ai_user:s3cr3t@host.render.com/ai_interview?sslmode=require&target_session_attrs=read-write"
        expected = "postgresql+psycopg2://ai_user:s3cr3t@host.render.com/ai_interview?sslmode=require&target_session_attrs=read-write"
        assert normalize_database_url(raw) == expected

    def test_sqlite_relative_url_preserved(self):
        """SQLite relative development URLs must remain unchanged."""
        raw = "sqlite:///./sql_app.db"
        assert normalize_database_url(raw) == raw

    def test_sqlite_in_memory_url_preserved(self):
        """SQLite in-memory test URLs must remain unchanged."""
        raw = "sqlite:///:memory:"
        assert normalize_database_url(raw) == raw

    def test_sqlite_absolute_path_preserved(self):
        """SQLite absolute file paths must remain unchanged."""
        raw = "sqlite:////var/data/interview.db"
        assert normalize_database_url(raw) == raw

    def test_empty_and_whitespace_handling(self):
        """Empty or whitespace-only inputs should not throw errors."""
        assert normalize_database_url("") == ""
        assert normalize_database_url("   ") == ""
        assert normalize_database_url(None) is None


class TestSettingsIntegration:
    """Verifies that Pydantic Settings applies the validator automatically."""

    def test_settings_normalizes_postgres_url(self):
        settings = Settings(DATABASE_URL="postgres://user:pass@host/db")
        assert settings.DATABASE_URL == "postgresql+psycopg2://user:pass@host/db"

    def test_settings_normalizes_postgresql_url(self):
        settings = Settings(DATABASE_URL="postgresql://user:pass@host/db")
        assert settings.DATABASE_URL == "postgresql+psycopg2://user:pass@host/db"

    def test_settings_preserves_sqlite_url(self):
        settings = Settings(DATABASE_URL="sqlite:///./test.db")
        assert settings.DATABASE_URL == "sqlite:///./test.db"


class TestSQLAlchemyDriverResolution:
    """Verifies that SQLAlchemy parses the normalized URL with psycopg2."""

    def test_sqlalchemy_resolves_psycopg2_driver(self):
        normalized = normalize_database_url("postgres://user:pass@host:5432/dbname")
        url = make_url(normalized)
        assert url.get_backend_name() == "postgresql"
        assert url.get_driver_name() == "psycopg2"

    def test_sqlite_engine_executes_successfully(self):
        """Verifies SQLite engine works end-to-end with normalized URL."""
        normalized = normalize_database_url("sqlite:///:memory:")
        engine = create_engine(normalized, connect_args={"check_same_thread": False})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            assert result == 1
        engine.dispose()

