from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    return user


def require_farmer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Farmers only")
    return current_user


def require_agent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "agent":
        raise HTTPException(status_code=403, detail="Agents only")
    return current_user