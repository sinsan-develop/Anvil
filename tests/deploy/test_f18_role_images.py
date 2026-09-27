"""Static role-image contract; real image behavior is verified on WSL by Main."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = ROOT / "deploy/wsl/Dockerfile.f18"
IGNORE = ROOT / "deploy/wsl/Dockerfile.f18.dockerignore"


def _stages() -> dict[str, str]:
    text = DOCKERFILE.read_text(encoding="utf-8")
    matches = list(re.finditer(r"(?im)^FROM\s+\S+\s+AS\s+([\w-]+)\s*$", text))
    return {
        match.group(1): text[match.end() : matches[index + 1].start() if index + 1 < len(matches) else None]
        for index, match in enumerate(matches)
    }


def test_three_final_roles_use_pinned_base_digests_and_exact_revision_arg():
    stages = _stages()
    for role in ("web", "api", "worker"):
        body = stages[role]
        assert "ARG ANVIL_RELEASE_COMMIT" in body
        assert 'org.opencontainers.image.revision="${ANVIL_RELEASE_COMMIT}"' in body
        assert "USER " in body
        assert "ENTRYPOINT " in body
    source = DOCKERFILE.read_text(encoding="utf-8")
    assert re.search(r"(?m)^FROM node:22\.23\.0-bookworm-slim@sha256:[0-9a-f]{64} AS web-build$", source)
    assert re.search(r"(?m)^FROM python:3\.12\.8-slim-bookworm@sha256:[0-9a-f]{64} AS python-deps$", source)
    assert re.search(r"(?m)^FROM nginx:1\.28\.3-alpine3\.23@sha256:[0-9a-f]{64} AS web$", source)
    for role in ("api", "worker"):
        assert re.search(rf"(?m)^FROM python:3\.12\.8-slim-bookworm@sha256:[0-9a-f]{{64}} AS {role}$", source)


def test_web_contains_only_static_bundle_and_existing_same_origin_proxy():
    stages = _stages()
    assert "npm ci --ignore-scripts --no-audit --no-fund" in stages["web-build"]
    assert "npm run web:typecheck && npm run web:build" in stages["web-build"]
    web = stages["web"]
    assert "COPY deploy/local/nginx.conf /etc/nginx/nginx.conf" in web
    assert "COPY --from=web-build /opt/anvil/apps/web/dist/ /usr/share/nginx/html/" in web
    assert not re.search(r"(?m)^COPY .*?(apps/api|apps/worker|packages|migrations)", web)
    nginx = (ROOT / "deploy/local/nginx.conf").read_text(encoding="utf-8")
    assert "location /api/" in nginx and "location /auth/" in nginx
    assert "proxy_pass http://anvil-api:8301;" in nginx


def test_api_and_worker_copy_only_their_required_source_and_have_role_entrypoints():
    stages = _stages()
    api, worker = stages["api"], stages["worker"]
    for source in ("packages", "apps/api", "migrations"):
        assert re.search(rf"(?m)^COPY {source}(?:\s|/)", api)
    assert "apps.api.anvil_api.asgi:app" in api
    assert '"--port", "8301"' in api
    assert not re.search(r"(?m)^COPY .*?(apps/web|apps/worker)", api)
    for source in ("packages", "apps/worker"):
        assert re.search(rf"(?m)^COPY {source}(?:\s|/)", worker)
    assert "apps.worker.anvil_worker.main" in worker
    assert not re.search(r"(?m)^COPY .*?(apps/web|apps/api|migrations)", worker)


def test_context_ignore_excludes_git_secrets_caches_and_local_build_outputs():
    patterns = set(IGNORE.read_text(encoding="utf-8").splitlines())
    for pattern in (".git", "**/.git", ".env*", "**/.env*", "**/__pycache__", "**/*.pyc", "**/node_modules", "apps/web/dist", "**/.pytest_cache", "**/.venv", ".f18-*"):
        assert pattern in patterns
