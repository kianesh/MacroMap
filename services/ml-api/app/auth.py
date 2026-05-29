"""Bearer-token authentication dependency.

A single shared secret (ML_API_SECRET) gates the API. The React Native client
never sees this secret: it calls a Firebase callable, which authenticates the
user with Firebase Auth and then forwards the request here with the bearer
token. This service therefore trusts the proxy, not the end user directly.
"""
import hmac

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

_bearer = HTTPBearer(auto_error=True)


def require_token(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    """Reject the request unless a valid bearer token was supplied."""
    expected = get_settings().ml_api_secret
    provided = creds.credentials if creds else ""
    # Constant-time comparison to avoid leaking the secret via timing.
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing bearer token.",
        )
