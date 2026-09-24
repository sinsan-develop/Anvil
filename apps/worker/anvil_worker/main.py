"""F-15 Worker process boundary; queue execution remains owned by later wiring."""

from __future__ import annotations

import argparse
import json
import os
import signal
import threading

from sqlalchemy import create_engine, text

from packages.persistence.config import DatabaseSettings


REQUIRED_MIGRATION_HEAD = "0016_operations_recovery"


def probe_worker_database(engine) -> dict[str, str]:
    """Prove only DB reachability/head, never queue-processing readiness."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            head = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
    except Exception:
        return {"component": "worker_process", "status": "not_ready", "reason": "database_unavailable"}
    if head != REQUIRED_MIGRATION_HEAD:
        return {"component": "worker_process", "status": "not_ready", "reason": "migration_head_mismatch"}
    return {"component": "worker_process", "status": "ready", "migration_head": head}


def main(argv: list[str] | None = None) -> int:
    arguments = argparse.ArgumentParser(description="Anvil worker process boundary")
    arguments.add_argument("--check", action="store_true", help="Check DB/head once and exit")
    args = arguments.parse_args(argv)
    try:
        settings = DatabaseSettings.from_environment(os.environ)
        engine = create_engine(settings.dsn, pool_pre_ping=True)
    except Exception:
        print(json.dumps({"component": "worker_process", "status": "not_ready", "reason": "configuration_unavailable"}))
        return 1
    try:
        result = probe_worker_database(engine)
        print(json.dumps(result, sort_keys=True), flush=True)
        if result["status"] != "ready":
            return 1
        if args.check:
            return 0
        stop = threading.Event()
        signal.signal(signal.SIGINT, lambda *_: stop.set())
        signal.signal(signal.SIGTERM, lambda *_: stop.set())
        while not stop.wait(5):
            result = probe_worker_database(engine)
            if result["status"] != "ready":
                print(json.dumps(result, sort_keys=True), flush=True)
                return 1
        print(json.dumps({"component": "worker_process", "status": "stopped"}), flush=True)
        return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
