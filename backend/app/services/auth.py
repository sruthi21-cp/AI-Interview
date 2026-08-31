from typing import Optional
from sqlalchemy.orm import Session
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdateMe

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_me(db: Session, user: User, update_in: UserUpdateMe) -> tuple[User, Optional[str]]:
    """Update the current user's full_name and/or password.

    Returns (updated_user, error_message). error_message is None on success.
    """
    # Handle password change
    if update_in.new_password is not None:
        if not update_in.current_password:
            return user, "current_password is required to set a new password."
        if not verify_password(update_in.current_password, user.hashed_password):
            return user, "Current password is incorrect."
        user.hashed_password = get_password_hash(update_in.new_password)

    # Handle name update (allow clearing to None)
    if update_in.full_name is not None:
        user.full_name = update_in.full_name.strip() or None

    db.add(user)
    db.commit()
    db.refresh(user)
    return user, None

