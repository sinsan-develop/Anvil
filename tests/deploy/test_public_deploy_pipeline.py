from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import hashlib

import pytest


ROOT = Path(__file__).parents[2]
SCRIPT = ROOT / "deploy" / "ysna" / "deploy-public-preview.sh"
BOOTSTRAP = ROOT / "deploy" / "ysna" / "bootstrap-public-deploy.sh"
TARGET_COMPOSE = ROOT / "deploy" / "ysna" / "compose.public-preview.yml"
COMMIT = "1" * 40
PREVIOUS_COMMIT = "2" * 40
TAG = "anvil-ui-preview-20260902.1"


def _posix(path: Path) -> str:
    value = path.resolve().as_posix()
    if len(value) >= 3 and value[1:3] == ":/":
        return f"/{value[0].lower()}/{value[3:]}"
    return value


@pytest.fixture
def deployment(tmp_path: Path):
    git_bash = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "usr" / "bin" / "bash.exe"
    bash = str(git_bash) if git_bash.is_file() else shutil.which("bash")
    if not bash:
        pytest.skip("bash is required for deployment contract tests")

    home = tmp_path / "home"
    deploy_root = home / "deploy" / "anvil"
    repo = deploy_root / "repo"
    runtime = deploy_root / "runtime"
    fake_bin = tmp_path / "bin"
    fake_root = tmp_path / "fake"
    for path in (repo / ".git", runtime, fake_bin, fake_root):
        path.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "deploy" / "ysna", repo / "deploy" / "ysna")
    source_env = deploy_root / ".env"
    source_env.write_text(
        "ANVIL_DATABASE_URL=postgresql://redacted\n"
        "TELEGRAM_BOT_TOKEN=redacted\n"
        "TELEGRAM_WEBHOOK_SECRET=redacted\n"
        "TELEGRAM_INTERNAL_SIGNING_SECRET=redacted\n"
        "TELEGRAM_ALLOWED_IDENTITIES=1:1\n"
        "ANVIL_CONSOLE_BASE_URL=https://anvil.sinsan.kr\n",
        encoding="utf-8",
    )
    os.chmod(source_env, 0o600)
    (runtime / "current-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    previous_dockerfile = fake_root / "previous-Dockerfile.web"
    previous_dockerfile.write_text("FROM python:3.12-slim\n", encoding="utf-8", newline="\n")
    previous_compose = fake_root / "previous-compose.public-preview.yml"
    previous_compose.write_text(
        "services:\n  anvil-web:\n    image: anvil-web:preview\n"
        "    environment:\n      ANVIL_API_UPSTREAM: http://anvil-internal-web-1:4173\n",
        encoding="utf-8",
        newline="\n",
    )

    git = fake_bin / "git"
    git.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\\n' "$*" >> "$FAKE_LOG"
if [[ "$1 $2" == "status --porcelain" ]]; then exit 0; fi
if [[ "$1" == "show" && "$2" == "$RELEASE_COMMIT:deploy/ysna/deploy-public-preview.sh" ]]; then cat "$TARGET_DEPLOY_SCRIPT"; exit 0; fi
if [[ "$1" == "show" && "$2" == "$RELEASE_COMMIT:deploy/ysna/Dockerfile.web" ]]; then cat "$TARGET_DOCKERFILE"; exit 0; fi
if [[ "$1" == "show" && "$2" == "$RELEASE_COMMIT:deploy/ysna/compose.public-preview.yml" ]]; then cat "$TARGET_COMPOSE"; exit 0; fi
if [[ "$1 $2" == "checkout --detach" && "${FAKE_PREVIOUS_COMPOSE_NO_ENV:-0}" == "1" ]]; then
  cp "$PREVIOUS_COMPOSE" "$REPO_DIR/deploy/ysna/compose.public-preview.yml"
  exit 0
fi
if [[ "$1 $2" == "rev-parse HEAD" ]]; then printf '%s\\n' "$RELEASE_COMMIT"; exit 0; fi
if [[ "$1 $2" == "rev-parse anvil-ui-preview-20260902.1^{commit}" ]]; then printf '%s\\n' "$RELEASE_COMMIT"; fi
""",
        encoding="utf-8",
    )
    curl = fake_bin / "curl"
    curl.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\\n' "$*" >> "$FAKE_LOG"
if [[ "${FAKE_ROLLBACK_PUBLIC_FAILURE:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then exit 28; fi
if [[ "${FAKE_PUBLIC_PERSISTENT_FAILURE:-0}" == "1" ]]; then exit 28; fi
if [[ "${FAKE_PUBLIC_FIRST_TIMEOUT:-0}" == "1" && ! -f "$FAKE_ROOT/public-first-timeout-seen" ]]; then
  : > "$FAKE_ROOT/public-first-timeout-seen"
  exit 28
fi
printf '200'
""",
        encoding="utf-8",
    )
    docker = fake_bin / "docker"
    docker.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s revision=%s\\n' "$*" "${ANVIL_RELEASE_COMMIT:-unset}" >> "$FAKE_LOG"

if [[ "$1" == "inspect" && "$2" == "nginx-proxy-manager" ]]; then printf 'npm-id\\n'; exit 0; fi
if [[ "$1" == "inspect" && "$2" == "shared-db" ]]; then printf 'db-id\\n'; exit 0; fi
if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  if [[ -f "$FAKE_ROOT/image-missing-revision" ]]; then printf '\\n'; exit 0; fi
  if [[ "${FAKE_ROLLBACK_IMAGE_MISMATCH:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then
    printf '%s\\n' "$RELEASE_COMMIT"
  else
    printf '%s\\n' "${ANVIL_RELEASE_COMMIT:-$RELEASE_COMMIT}"
  fi
  exit 0
fi
if [[ "$1" == "build" ]]; then
  dockerfile=""
  for ((index=1; index<=$#; index++)); do
    if [[ "${!index}" == "--file" ]]; then next=$((index + 1)); dockerfile="${!next}"; fi
  done
  [[ -n "$dockerfile" ]] || exit 31
  grep -Fq 'ARG ANVIL_RELEASE_COMMIT' "$dockerfile" || exit 32
  grep -Fq 'org.opencontainers.image.revision' "$dockerfile" || exit 33
  cmp -s "$dockerfile" "$TARGET_DOCKERFILE" || exit 34
  rm -f "$FAKE_ROOT/image-missing-revision"
  exit 0
fi
if [[ "$1" == "inspect" && "$2" == "anvil-web" && "$*" == *"Health.Status"* ]]; then
  if [[ "${FAKE_RUNTIME_FAILURE:-0}" == "1" || ("${FAKE_ROLLBACK_UNHEALTHY:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT") ]]; then
    printf 'unhealthy\\n'
  else
    printf 'healthy\\n'
  fi
  exit 0
fi
if [[ "$1" == "inspect" && "$2" == "anvil-web" && "$*" == *"proxy-network"* ]]; then printf '10.0.0.9\\n'; exit 0; fi
if [[ "$1" == "logs" ]]; then
  if [[ "${FAKE_ROLLBACK_LOG_FAILURE:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then printf 'unrelated\\n'; exit 0; fi
  if [[ "${FAKE_LOG_PERSISTENT_MISS:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" != "$PREVIOUS_COMMIT" ]]; then printf 'unrelated\\n'; exit 0; fi
  if [[ "${FAKE_LOG_FIRST_MISS:-0}" == "1" && ! -f "$FAKE_ROOT/log-first-miss-seen" ]]; then
    : > "$FAKE_ROOT/log-first-miss-seen"
    printf 'unrelated\\n'
    exit 0
  fi
  if [[ "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then
    printf '/health/live?rollback_probe=%s\\n' "$PREVIOUS_COMMIT"
  else
    printf '/health/live?deploy_probe=%s\\n' "$RELEASE_COMMIT"
  fi
  exit 0
fi

if [[ "$1" == "compose" && "$*" == *" run "* && "$*" == *"alembic current"* ]]; then
  if [[ -f "$FAKE_ROOT/migrated" ]]; then printf '0012_run_authority (head)\\n'; else printf '%s\\n' "${FAKE_CURRENT_REVISION:-0011_telegram_webhook_state}"; fi
  exit 0
fi
if [[ "$1" == "compose" && "$*" == *" run "* && "$*" == *"alembic upgrade 0012_run_authority"* ]]; then
  : > "$FAKE_ROOT/migrated"
  exit 0
fi
if [[ "$1" == "compose" && "$*" == *" up "* ]]; then
  if [[ "${FAKE_PREVIOUS_COMPOSE_NO_ENV:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then
    compose=""
    for ((index=1; index<=$#; index++)); do
      if [[ "${!index}" == "-f" ]]; then next=$((index + 1)); compose="${!next}"; fi
    done
    [[ -n "$compose" ]] || exit 42
    cmp -s "$compose" "$TARGET_COMPOSE" || exit 43
    grep -Fq 'env_file:' "$compose" || exit 44
    grep -Fq 'healthcheck:' "$compose" || exit 45
  fi
  [[ "${FAKE_RUNTIME_FAILURE:-0}" == "1" ]] && exit 1 || exit 0
fi
if [[ "$1" == "compose" ]]; then
  if [[ "$*" == *" build anvil-web"* && "${FAKE_PREVIOUS_DOCKERFILE_NO_LABEL:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then
    grep -Fq 'org.opencontainers.image.revision' "$PREVIOUS_DOCKERFILE" && exit 41
    : > "$FAKE_ROOT/image-missing-revision"
  fi
  exit 0
fi

if [[ "$1" == "exec" && "$*" == *" shared-db pg_dump "* ]]; then
  for arg in "$@"; do case "$arg" in --file=*) target="${arg#--file=}";; esac; done
  mkdir -p "$FAKE_ROOT/container$(dirname "$target")"
  printf 'custom-format-backup' > "$FAKE_ROOT/container$target"
  exit 0
fi
if [[ "$1" == "exec" && "$*" == *" shared-db pg_restore -l "* ]]; then
  [[ "${FAKE_BACKUP_VERIFY_FAILURE:-0}" == "1" ]] && exit 1 || printf 'verified backup catalog\\n'
  exit 0
fi
if [[ "$1" == "exec" && "$*" == *" shared-db sha256sum "* ]]; then
  target="${@: -1}"
  sha256sum "$FAKE_ROOT/container$target" | awk '{print $1}'
  exit 0
fi
if [[ "$1" == "exec" && "$*" == *" shared-db rm -- "* ]]; then
  target="${@: -1}"
  rm -f "$FAKE_ROOT/container$target"
  exit 0
fi
if [[ "$1" == "cp" && "$2" == shared-db:* ]]; then
  cp "$FAKE_ROOT/container${2#shared-db:}" "$3"
  [[ "${FAKE_BACKUP_CORRUPTION:-0}" == "1" ]] && printf 'corrupt' >> "$3"
  exit 0
fi

if [[ "$1" == "exec" && "$2" == "nginx-proxy-manager" && "$3" == "getent" ]]; then
  if [[ "${FAKE_ROLLBACK_STALE_DNS:-0}" == "1" && "${ANVIL_RELEASE_COMMIT:-}" == "$PREVIOUS_COMMIT" ]]; then
    printf '10.0.0.8 anvil-web\\n'
  else
    printf '10.0.0.9 anvil-web\\n'
  fi
  exit 0
fi
if [[ "$1" == "exec" && "$2" == "nginx-proxy-manager" && "$3" == "sha256sum" ]]; then
  printf '406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf  %s\\n' "$4"
  exit 0
fi
if [[ "$1" == "cp" && "$2" == nginx-proxy-manager:* ]]; then printf 'override' > "$3"; exit 0; fi
if [[ "$1" == "exec" && "$2" == "nginx-proxy-manager" ]]; then exit 0; fi

exit 0
""",
        encoding="utf-8",
    )
    stat = fake_bin / "stat"
    stat.write_text("#!/usr/bin/env bash\nprintf '600\\n'\n", encoding="utf-8")
    for executable in (git, curl, docker, stat):
        executable.write_bytes(executable.read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8"))
        os.chmod(executable, 0o755)
    bash_env = fake_root / "bash-env"
    bash_env.write_text(
        """stat() { printf '600\\n'; }
git() { /usr/bin/bash "$FAKE_BIN/git" "$@"; }
curl() { /usr/bin/bash "$FAKE_BIN/curl" "$@"; }
docker() { /usr/bin/bash "$FAKE_BIN/docker" "$@"; }
sleep() { :; }
""",
        encoding="utf-8",
    )
    bash_env.write_bytes(bash_env.read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8"))

    log = fake_root / "commands.log"
    env = os.environ.copy()
    env.update(
        {
            "HOME": _posix(home),
            "PATH": f"{_posix(fake_bin)}:/usr/bin:{env['PATH']}",
            "BASH_ENV": _posix(bash_env),
            "FAKE_BIN": _posix(fake_bin),
            "FAKE_ROOT": _posix(fake_root),
            "FAKE_LOG": _posix(log),
            "RELEASE_COMMIT": COMMIT,
            "PREVIOUS_COMMIT": PREVIOUS_COMMIT,
            "TARGET_DEPLOY_SCRIPT": _posix(SCRIPT),
            "TARGET_DOCKERFILE": _posix(ROOT / "deploy" / "ysna" / "Dockerfile.web"),
            "TARGET_COMPOSE": _posix(TARGET_COMPOSE),
            "PREVIOUS_DOCKERFILE": _posix(previous_dockerfile),
            "PREVIOUS_COMPOSE": _posix(previous_compose),
            "REPO_DIR": _posix(repo),
            "MSYS_NO_PATHCONV": "1",
        }
    )

    def run(**overrides: str) -> subprocess.CompletedProcess[str]:
        command_env = env | overrides
        return subprocess.run(
            [bash, _posix(SCRIPT), COMMIT, TAG],
            cwd=ROOT,
            env=command_env,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=20,
        )

    return run, log, runtime, env, bash, repo


def test_deploy_backs_up_and_migrates_before_starting_runtime(deployment):
    run, log_path, runtime, *_ = deployment

    result = run()

    assert result.returncode == 0, result.stderr
    backups = list((runtime / "db-backups").glob(f"*{COMMIT}*.dump"))
    assert len(backups) == 1
    checksum_path = backups[0].with_suffix(".dump.sha256")
    assert checksum_path.read_text(encoding="utf-8").split()[0] == hashlib.sha256(backups[0].read_bytes()).hexdigest()
    assert (runtime / "npm-custom-override-backup" / "server_proxy.conf").is_file()
    log = log_path.read_text(encoding="utf-8")
    assert f"docker image inspect anvil-web:{COMMIT[:12]}" in log
    assert log.index("pg_dump") < log.index("alembic upgrade 0012_run_authority")
    assert log.index("alembic upgrade 0012_run_authority") < log.index(" up -d --no-deps anvil-web")
    assert "curl -sS -o /dev/null -w %{http_code} --connect-timeout 2 --max-time 3 https://anvil.sinsan.kr/health/ready" in log
    assert "curl -sS -o /dev/null -w %{http_code} --connect-timeout 2 --max-time 3 https://anvil.sinsan.kr/openapi.json" in log
    assert log.index("/health/ready") < log.index("rm -- /data/nginx/custom/server_proxy.conf")


def test_public_probe_retries_first_timeout_then_succeeds(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_PUBLIC_FIRST_TIMEOUT="1")

    assert result.returncode == 0, result.stderr
    live_url = f"https://anvil.sinsan.kr/health/live?deploy_probe={COMMIT}"
    live_calls = [line for line in log_path.read_text(encoding="utf-8").splitlines() if live_url in line]
    assert len(live_calls) == 2
    assert all("--max-time 3" in line for line in live_calls)


def test_public_probe_persistent_failure_is_bounded_and_enters_hold(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_PUBLIC_PERSISTENT_FAILURE="1")

    assert result.returncode == 12
    assert "public live probe failed" in result.stderr
    log = log_path.read_text(encoding="utf-8")
    live_url = f"https://anvil.sinsan.kr/health/live?deploy_probe={COMMIT}"
    assert sum(live_url in line for line in log.splitlines()) == 5
    assert "rm -- /data/nginx/custom/server_proxy.conf" not in log


def test_public_log_correlation_retries_first_miss_then_succeeds(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_LOG_FIRST_MISS="1")

    assert result.returncode == 0, result.stderr
    log_calls = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line.startswith("docker logs --since ")]
    assert len(log_calls) == 2


def test_public_log_correlation_persistent_miss_is_bounded(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_LOG_PERSISTENT_MISS="1")

    assert result.returncode == 12
    assert "public live probe did not correlate" in result.stderr
    log = log_path.read_text(encoding="utf-8")
    deploy_log_calls = [
        line
        for line in log.splitlines()
        if line.startswith("docker logs --since ") and line.endswith(f"revision={COMMIT}")
    ]
    assert len(deploy_log_calls) == 10
    assert "rm -- /data/nginx/custom/server_proxy.conf" not in log


def test_deploy_fails_closed_when_database_is_not_at_0011(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_CURRENT_REVISION="0010_unexpected")

    assert result.returncode != 0
    assert "0011_telegram_webhook_state" in result.stderr
    log = log_path.read_text(encoding="utf-8")
    assert "alembic upgrade" not in log
    assert " up -d --no-deps anvil-web" not in log


def test_backup_catalog_failure_prevents_migration(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_BACKUP_VERIFY_FAILURE="1")

    assert result.returncode != 0
    assert "backup catalog verification failed" in result.stderr
    log = log_path.read_text(encoding="utf-8")
    assert "alembic upgrade" not in log


def test_post_migration_runtime_failure_enters_hold_without_downgrade_or_override_removal(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_RUNTIME_FAILURE="1")

    assert result.returncode == 12
    assert "INCIDENT_HOLD" in result.stderr
    assert "automatic database downgrade is forbidden" in result.stderr
    log = log_path.read_text(encoding="utf-8")
    assert "alembic downgrade" not in log
    assert "rm -- /data/nginx/custom/server_proxy.conf" not in log
    rollback_builds = [line for line in log.splitlines() if line.startswith("docker build --file ")]
    assert rollback_builds[-1].endswith(f"revision={PREVIOUS_COMMIT}")
    assert f"--build-arg ANVIL_RELEASE_COMMIT={PREVIOUS_COMMIT}" in rollback_builds[-1]
    assert "up -d --no-deps --no-build anvil-web" in log


def test_corrupted_host_backup_prevents_migration(deployment):
    run, log_path, *_ = deployment

    result = run(FAKE_BACKUP_CORRUPTION="1")

    assert result.returncode != 0
    assert "backup checksum mismatch" in result.stderr
    assert "alembic upgrade" not in log_path.read_text(encoding="utf-8")


def test_rollback_builds_previous_source_with_target_versioned_dockerfile(deployment):
    _, log_path, runtime, env, bash, repo = deployment
    (runtime / "current-anvil-web-sha").write_text(COMMIT + "\n", encoding="utf-8")
    (runtime / "previous-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    (runtime / "anvil.env").write_text("ANVIL_DATABASE_URL=redacted\n", encoding="utf-8")
    assert "org.opencontainers.image.revision" not in Path(env["PREVIOUS_DOCKERFILE"].replace("/c/", "C:/", 1)).read_text(encoding="utf-8")

    result = subprocess.run(
        [bash, _posix(repo / "deploy" / "ysna" / "rollback-public-preview.sh")],
        env=env | {"FAKE_PREVIOUS_DOCKERFILE_NO_LABEL": "1"},
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode == 0, result.stderr
    log = log_path.read_text(encoding="utf-8")
    assert "compose -p anvil -f deploy/ysna/compose.public-preview.yml build anvil-web" not in log
    assert "docker build --file " in log
    assert f"--build-arg ANVIL_RELEASE_COMMIT={PREVIOUS_COMMIT}" in log
    assert f"--tag anvil-web:{PREVIOUS_COMMIT[:12]} ." in log
    assert "up -d --no-deps --no-build anvil-web" in log
    assert log.index("docker build --file") < log.index(f"docker image inspect anvil-web:{PREVIOUS_COMMIT[:12]}")
    assert (runtime / "current-anvil-web-sha").read_text(encoding="utf-8").strip() == PREVIOUS_COMMIT
    assert not list(runtime.glob("rollback-Dockerfile.*"))


def test_rollback_uses_target_compose_when_previous_compose_omits_runtime_env(deployment):
    _, log_path, runtime, env, bash, repo = deployment
    (runtime / "current-anvil-web-sha").write_text(COMMIT + "\n", encoding="utf-8")
    (runtime / "previous-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    (runtime / "anvil.env").write_text("ANVIL_DATABASE_URL=redacted\n", encoding="utf-8")
    previous_compose = Path(env["PREVIOUS_COMPOSE"].replace("/c/", "C:/", 1)).read_text(encoding="utf-8")
    assert "env_file:" not in previous_compose
    assert "ANVIL_API_UPSTREAM" in previous_compose

    result = subprocess.run(
        [bash, _posix(repo / "deploy" / "ysna" / "rollback-public-preview.sh")],
        env=env | {"FAKE_PREVIOUS_COMPOSE_NO_ENV": "1"},
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode == 0, result.stderr
    log = log_path.read_text(encoding="utf-8")
    rollback_up = [line for line in log.splitlines() if "up -d --no-deps --no-build anvil-web" in line]
    assert "rollback-compose.public-preview" in rollback_up[-1]
    assert (runtime / "current-anvil-web-sha").read_text(encoding="utf-8").strip() == PREVIOUS_COMMIT
    assert not list(runtime.glob("rollback-compose.public-preview.*"))


@pytest.mark.parametrize(
    "failure_flag",
    ["FAKE_ROLLBACK_STALE_DNS", "FAKE_ROLLBACK_PUBLIC_FAILURE", "FAKE_ROLLBACK_LOG_FAILURE"],
)
def test_rollback_keeps_alias_when_public_route_verification_fails(deployment, failure_flag: str):
    _, log_path, runtime, env, bash, repo = deployment
    (runtime / "current-anvil-web-sha").write_text(COMMIT + "\n", encoding="utf-8")
    (runtime / "previous-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    (runtime / "anvil.env").write_text("ANVIL_DATABASE_URL=redacted\n", encoding="utf-8")

    result = subprocess.run(
        [bash, _posix(repo / "deploy" / "ysna" / "rollback-public-preview.sh")],
        env=env | {failure_flag: "1"},
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode != 0
    assert (runtime / "current-anvil-web-sha").read_text(encoding="utf-8").strip() == COMMIT
    log = log_path.read_text(encoding="utf-8")
    if failure_flag == "FAKE_ROLLBACK_PUBLIC_FAILURE":
        rollback_url = f"https://anvil.sinsan.kr/health/live?rollback_probe={PREVIOUS_COMMIT}"
        assert sum(rollback_url in line for line in log.splitlines()) == 5
    if failure_flag == "FAKE_ROLLBACK_LOG_FAILURE":
        assert sum(line.startswith("docker logs --since ") for line in log.splitlines()) == 10


def test_rollback_verifies_dns_reload_public_probe_and_log_before_alias(deployment):
    _, log_path, runtime, env, bash, repo = deployment
    (runtime / "current-anvil-web-sha").write_text(COMMIT + "\n", encoding="utf-8")
    (runtime / "previous-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    (runtime / "anvil.env").write_text("ANVIL_DATABASE_URL=redacted\n", encoding="utf-8")

    result = subprocess.run(
        [bash, _posix(repo / "deploy" / "ysna" / "rollback-public-preview.sh")],
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode == 0, result.stderr
    log = log_path.read_text(encoding="utf-8")
    dns = "docker exec nginx-proxy-manager getent hosts anvil-web"
    nginx_test = "docker exec nginx-proxy-manager nginx -t"
    nginx_reload = "docker exec nginx-proxy-manager nginx -s reload"
    public_probe = f"https://anvil.sinsan.kr/health/live?rollback_probe={PREVIOUS_COMMIT}"
    correlation = "docker logs --since "
    assert log.index(dns) < log.index(nginx_test) < log.index(nginx_reload)
    assert log.index(nginx_reload) < log.index(public_probe) < log.index(correlation)
    assert (runtime / "current-anvil-web-sha").read_text(encoding="utf-8").strip() == PREVIOUS_COMMIT


@pytest.mark.parametrize("failure_flag", ["FAKE_ROLLBACK_IMAGE_MISMATCH", "FAKE_ROLLBACK_UNHEALTHY"])
def test_rollback_keeps_current_alias_until_previous_image_is_verified(deployment, failure_flag: str):
    _, _, runtime, env, bash, repo = deployment
    (runtime / "current-anvil-web-sha").write_text(COMMIT + "\n", encoding="utf-8")
    (runtime / "previous-anvil-web-sha").write_text(PREVIOUS_COMMIT + "\n", encoding="utf-8")
    (runtime / "anvil.env").write_text("ANVIL_DATABASE_URL=redacted\n", encoding="utf-8")

    result = subprocess.run(
        [bash, _posix(repo / "deploy" / "ysna" / "rollback-public-preview.sh")],
        env=env | {failure_flag: "1"},
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode != 0
    assert (runtime / "current-anvil-web-sha").read_text(encoding="utf-8").strip() == COMMIT


def test_versioned_bootstrap_executes_target_script_from_old_checkout(tmp_path: Path):
    assert BOOTSTRAP.is_file(), "versioned bootstrap script is missing"
    git_exe = shutil.which("git")
    git_bash = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "usr" / "bin" / "bash.exe"
    if not git_exe or not git_bash.is_file():
        pytest.skip("Git and Git Bash are required")

    home = tmp_path / "home"
    repo = home / "deploy" / "anvil" / "repo"
    deploy_dir = repo / "deploy" / "ysna"
    deploy_dir.mkdir(parents=True)
    old_marker = tmp_path / "old-ran"
    target_marker = tmp_path / "target-ran"
    old_script = deploy_dir / "deploy-public-preview.sh"
    old_script.write_text(f"#!/usr/bin/env bash\nprintf old > '{_posix(old_marker)}'\n", encoding="utf-8", newline="\n")
    subprocess.run([git_exe, "init", "-q", str(repo)], check=True)
    subprocess.run([git_exe, "-C", str(repo), "add", "."], check=True)
    subprocess.run([git_exe, "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "old"], check=True)
    old_commit = subprocess.check_output([git_exe, "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()

    shutil.copy2(BOOTSTRAP, deploy_dir / BOOTSTRAP.name)
    old_script.write_text(f"#!/usr/bin/env bash\nprintf target > '{_posix(target_marker)}'\n", encoding="utf-8", newline="\n")
    subprocess.run([git_exe, "-C", str(repo), "add", "."], check=True)
    subprocess.run([git_exe, "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "target"], check=True)
    target_commit = subprocess.check_output([git_exe, "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    tag = "anvil-ui-preview-20260902.9"
    subprocess.run([git_exe, "-C", str(repo), "tag", tag], check=True)
    subprocess.run([git_exe, "-C", str(repo), "remote", "add", "origin", str(repo)], check=True)
    subprocess.run([git_exe, "-C", str(repo), "checkout", "-q", "--detach", old_commit], check=True)

    launcher = tmp_path / "versioned-bootstrap.sh"
    launcher.write_bytes(subprocess.check_output([git_exe, "-C", str(repo), "show", f"{target_commit}:deploy/ysna/{BOOTSTRAP.name}"]))
    result = subprocess.run(
        [str(git_bash), _posix(launcher), target_commit, tag],
        env=os.environ | {"HOME": _posix(home)},
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=20,
    )

    assert result.returncode == 0, result.stderr
    assert target_marker.is_file()
    assert not old_marker.exists()
