"""Opt-in isolated PostgreSQL 15 test of the OIDC Operations Run host."""

from __future__ import annotations

import os

import pytest
import sqlalchemy as sa


def _validated_target(dsn: str | None, isolated: str | None) -> sa.engine.URL:
    try:
        url = sa.engine.make_url(dsn)
        valid = (
            isolated == "1"
            and url.drivername in {"postgresql", "postgresql+psycopg"}
            and url.host == "127.0.0.1"
            and url.port == 5548
            and url.username == "anvil_u01_r18"
            and url.database == "anvil_u01_r18"
            and not url.query
        )
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R18_PG_TARGET_REJECTED") from None
    return url


def _opt_in_target(environment: dict[str, str]):
    dsn = environment.get("ANVIL_U01_R18_PG_DSN")
    isolated = environment.get("ANVIL_U01_R18_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R18 isolated PostgreSQL 15 opt-in is absent")
    return _validated_target(dsn, isolated)


@pytest.mark.parametrize("dsn, isolated", [
    (None, "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18", None),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18", "0"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5432/anvil_u01_r18", "1"),
    ("postgresql://anvil_u01_r18@localhost:5548/anvil_u01_r18", "1"),
    ("postgresql://shared@127.0.0.1:5548/anvil_u01_r18", "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/shared", "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18?sslmode=disable", "1"),
    ("sqlite:///shared", "1"),
])
def test_partial_or_shared_target_rejected_before_database_access(dsn, isolated, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *_a, **_kw: pytest.fail("DB accessed"))
    with pytest.raises(ValueError, match="^R18_PG_TARGET_REJECTED$"):
        _opt_in_target({"ANVIL_U01_R18_PG_DSN": dsn,
                        "ANVIL_U01_R18_PG_ISOLATED": isolated})


def test_validated_target_is_exact_and_credentials_are_never_reflected():
    url = _validated_target(
        "postgresql+psycopg://anvil_u01_r18:secret@127.0.0.1:5548/anvil_u01_r18", "1"
    )
    assert (url.drivername, url.host, url.port, url.username, url.database) == (
        "postgresql+psycopg", "127.0.0.1", 5548, "anvil_u01_r18", "anvil_u01_r18"
    )
    assert "secret" not in repr(url)


def test_absent_opt_in_is_explicit_skip(monkeypatch):
    monkeypatch.delenv("ANVIL_U01_R18_PG_DSN", raising=False)
    monkeypatch.delenv("ANVIL_U01_R18_PG_ISOLATED", raising=False)
    _opt_in_target(os.environ)
