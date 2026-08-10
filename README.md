# Anvil

G-03 establishes a dependency-free repository scaffold only. It deliberately contains no API, UI, worker, database schema, migration, Docker service, or runtime implementation.

## Responsibility and dependency direction

`apps` is the delivery layer: `apps/web` will contain the same-origin operating console, `apps/api` the BFF/Control API, and `apps/worker` the worker process. `packages` is the reusable application layer. `packages/domain` is framework-independent state, policy, and event logic.

Allowed direction is `apps → packages → domain`. A package must not import an app. `packages/domain` must not import apps, other packages, FastAPI, Pydantic, SQLAlchemy, Alembic, psycopg, LLM provider SDKs, or Docker SDKs. Run the standard-library checker with `python scripts/check_dependency_boundaries.py` when a Python runtime is available.

The directories under `migrations`, `deploy`, and `data` reserve their operational boundaries. They do not authorize a schema, service, credential, or deployment implementation.
