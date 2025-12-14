from typing import Annotated, Any, Dict

from fastapi import Depends, Header, HTTPException, status

from firebase_client import verify_id_token


async def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = verify_id_token(token)
    except RuntimeError as exc:  # propagated from firebase_client
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    return decoded


async def get_admin_user(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    from os import getenv

    admin_email = getenv("ADMIN_EMAIL")
    if not admin_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_EMAIL not configured on server",
        )
    if user.get("email") != admin_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
