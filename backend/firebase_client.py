import json
import os
from functools import lru_cache
from typing import Any, Dict

import firebase_admin
from firebase_admin import auth, credentials, firestore


def _init_firebase_app() -> firebase_admin.App:
    if firebase_admin._apps:  # type: ignore[attr-defined]
        return firebase_admin.get_app()

    raw = os.getenv("FIREBASE_CREDENTIALS")
    if not raw:
        raise RuntimeError(
            "FIREBASE_CREDENTIALS env var is required (service account JSON or file path)",
        )

    if raw.strip().startswith("{"):
        info: Dict[str, Any] = json.loads(raw)
        cred = credentials.Certificate(info)
    else:
        cred = credentials.Certificate(raw)

    return firebase_admin.initialize_app(cred)


@lru_cache(maxsize=1)
def get_firestore_client() -> firestore.Client:
    _init_firebase_app()
    return firestore.client()


def verify_id_token(id_token: str) -> Dict[str, Any]:
    _init_firebase_app()
    try:
        decoded = auth.verify_id_token(id_token)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("Invalid or expired Firebase ID token") from exc
    return decoded
