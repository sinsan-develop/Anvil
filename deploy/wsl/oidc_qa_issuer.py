"""Synthetic F-18 WSL QA issuer; never use with real identities or credentials."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import threading
import time
from hmac import compare_digest
from typing import Callable
from urllib.parse import parse_qs, urlencode

import jwt
import uvicorn
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse


ISSUER = "https://anvil-f18-qa.local:8444/realms/anvil"
REDIRECT_URI = "https://anvil-f18-qa.local:8444/"
CLIENT_ID = "anvil-web"
_OPENID = "/realms/anvil/protocol/openid-connect"
_CODE_TTL = 60
_TOKEN_TTL = 60
_B64 = re.compile(r"[A-Za-z0-9_-]{43}\Z", re.ASCII)
_STEP_UP = {"id_token": {
    "acr": {"essential": True, "values": ["urn:anvil:step-up"]},
    "auth_time": {"essential": True},
}}


def _reject() -> ValueError:
    return ValueError("QA_ISSUER_NOT_CONFIGURED")


def _read_regular(path: Path, limit: int) -> bytes:
    try:
        if not isinstance(path, Path) or not path.is_absolute() or not stat.S_ISREG(path.lstat().st_mode):
            raise _reject()
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                raise _reject()
            value = os.read(descriptor, limit + 1)
        finally:
            os.close(descriptor)
        if not value or len(value) > limit:
            raise _reject()
        return value
    except Exception:
        raise _reject() from None


def _fields(items: list[tuple[str, str]], expected: set[str], optional: set[str] = frozenset()):
    result: dict[str, str] = {}
    for key, value in items:
        if key in result or key not in expected | optional:
            return None
        result[key] = value
    return result if expected <= result.keys() else None


def _basic(value: str | None) -> tuple[str, str] | None:
    try:
        if not value or not value.startswith("Basic "):
            return None
        decoded = base64.b64decode(value[6:], validate=True).decode("ascii")
        client, secret = decoded.split(":", 1)
        return client, secret
    except Exception:
        return None


def create_qa_issuer(
    signing_key_file: Path,
    client_secret_file: Path,
    *,
    clock: Callable[[], float] = time.time,
    code_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32),
    qa_subject: str = "synthetic-subject-1",
) -> FastAPI:
    """Build a bounded, file-backed issuer with in-memory one-use codes."""
    try:
        key = serialization.load_pem_private_key(_read_regular(signing_key_file, 8192), password=None)
        secret = _read_regular(client_secret_file, 4096).decode("ascii")
        if (type(qa_subject) is not str
                or qa_subject not in {"synthetic-subject-1", "f19a-qa-reader"}
                or not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 2048
                or not (16 <= len(secret) <= 256) or secret != secret.strip()
                or not all(33 <= ord(char) <= 126 for char in secret)
                or not callable(clock) or not callable(code_factory)):
            raise _reject()
        public_key = key.public_key()
        der = public_key.public_bytes(serialization.Encoding.DER,
                                      serialization.PublicFormat.SubjectPublicKeyInfo)
        kid = hashlib.sha256(der).hexdigest()[:24]
        jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
        jwk = {field: jwk[field] for field in ("kty", "n", "e")}
        jwk.update(kid=kid, use="sig", alg="RS256")
    except Exception:
        raise _reject() from None

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    pending: dict[str, tuple[int, str, str, bool]] = {}
    lock = threading.Lock()

    @app.get(_OPENID + "/certs")
    async def certs():
        return {"keys": [jwk]}

    @app.get(_OPENID + "/auth")
    async def authorize(request: Request):
        required = {"response_type", "scope", "client_id", "redirect_uri", "state",
                    "nonce", "code_challenge", "code_challenge_method"}
        fields = _fields(list(request.query_params.multi_items()), required, {"claims", "max_age"})
        if fields is None:
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        stepped_up = "claims" in fields or "max_age" in fields
        try:
            valid_claims = (not stepped_up or (
                fields.get("max_age") == "300" and json.loads(fields.get("claims", "")) == _STEP_UP
            ))
            if (fields["response_type"] != "code" or fields["scope"] != "openid"
                    or fields["client_id"] != CLIENT_ID or fields["redirect_uri"] != REDIRECT_URI
                    or fields["code_challenge_method"] != "S256" or not valid_claims
                    or _B64.fullmatch(fields["state"]) is None
                    or _B64.fullmatch(fields["nonce"]) is None
                    or _B64.fullmatch(fields["code_challenge"]) is None):
                raise ValueError()
            code = code_factory()
            if type(code) is not str or not (32 <= len(code) <= 128) or not code.isascii():
                raise ValueError()
            now = int(clock())
            with lock:
                if code in pending:
                    raise ValueError()
                pending[code] = (now + _CODE_TTL, fields["code_challenge"], fields["nonce"], stepped_up)
            return RedirectResponse(
                REDIRECT_URI + "?" + urlencode({"code": code, "state": fields["state"]}),
                status_code=302,
            )
        except Exception:
            return JSONResponse({"error": "invalid_request"}, status_code=400)

    @app.post(_OPENID + "/token")
    async def token(request: Request):
        try:
            if request.headers.get("content-type", "").split(";", 1)[0] != "application/x-www-form-urlencoded":
                raise ValueError()
            body = await request.body()
            if len(body) > 8192:
                raise ValueError()
            parsed = parse_qs(body.decode("ascii"), keep_blank_values=True, strict_parsing=True)
            if any(len(values) != 1 for values in parsed.values()):
                raise ValueError()
            fields = _fields([(key, values[0]) for key, values in parsed.items()], {
                "grant_type", "code", "code_verifier", "redirect_uri", "client_id",
            })
            if fields is None:
                raise ValueError()
            with lock:
                entry = pending.pop(fields["code"], None)
            credentials = _basic(request.headers.get("authorization"))
            if (entry is None or credentials is None or credentials[0] != CLIENT_ID
                    or not compare_digest(credentials[1], secret)
                    or fields["grant_type"] != "authorization_code"
                    or fields["client_id"] != CLIENT_ID or fields["redirect_uri"] != REDIRECT_URI
                    or not 43 <= len(fields["code_verifier"]) <= 128):
                raise ValueError()
            expires, challenge, nonce, stepped_up = entry
            now = int(clock())
            digest = hashlib.sha256(fields["code_verifier"].encode("ascii")).digest()
            actual = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
            if now >= expires or not compare_digest(actual, challenge):
                raise ValueError()
            claims = {"iss": ISSUER, "aud": CLIENT_ID, "sub": qa_subject,
                      "nonce": nonce, "iat": now, "exp": now + _TOKEN_TTL}
            if stepped_up:
                claims.update(acr="urn:anvil:step-up", auth_time=now)
            return {"id_token": jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})}
        except Exception:
            return JSONResponse({"error": "invalid_grant"}, status_code=401)

    return app


if __name__ == "__main__":
    app = create_qa_issuer(
        Path("/run/anvil-f18-oidc/signing.key"),
        Path("/run/anvil-f18-oidc/client-secret"),
        qa_subject=os.environ.get("ANVIL_F19A_QA_SUBJECT", "synthetic-subject-1"),
    )
    uvicorn.run(app, host="0.0.0.0", port=8302, access_log=False)
