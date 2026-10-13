"""WSL 개발 전용 profile: 실제 배포·DB·TLS 성공을 대신하지 않는 국소 계약."""
from copy import deepcopy
import json
from pathlib import Path

import pytest
import yaml

from scripts import check_project_progress as checker

ROOT = Path(__file__).resolve().parents[2]


def test_profile_has_only_three_hardened_roles_and_existing_database():
    path = ROOT / "deploy/wsl/compose.u01-development.yml"
    assert path.is_file(), "개발 전용 Compose profile 미구현"
    profile = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert set(profile["services"]) == {"web", "api", "oidc-issuer"}
    for name, role in profile["services"].items():
        assert role["read_only"] is True
        assert role["cap_drop"] == ["ALL"]
        assert role["security_opt"] == ["no-new-privileges:true"]
        assert role["user"] == ("101:101" if name == "web" else "10001:10001")
        assert "build" not in role and "privileged" not in role
        assert all(mount["read_only"] is True for mount in role.get("volumes", []))
    api = profile["services"]["api"]
    assert api["entrypoint"] == ["/opt/venv/bin/uvicorn", "apps.api.anvil_api.asgi:app",
        "--host", "0.0.0.0", "--port", "3770", "--no-access-log"]
    assert api["environment"]["ANVIL_AUTH_MODE"] == "OIDC"
    assert api["environment"]["ANVIL_F15_OPERATIONAL_SHELL"] == "1"
    assert api["environment"]["ANVIL_RUNTIME_ENVIRONMENT"] == "WSL_SERVER_TEST_STAGING"
    assert "ports" not in api and "ports" not in profile["services"]["oidc-issuer"]
    assert profile["networks"]["proxy"]["external"] is True
    assert profile["networks"]["proxy"]["name"] == "proxy-network"
    assert profile["networks"]["internal"]["internal"] is True


def test_nginx_private_ingress_never_logs_auth_queries_even_upstream_errors():
    path = ROOT / "deploy/wsl/nginx-u01-development.conf"
    assert path.is_file(), "개발 TLS 설정 미구현"
    text = path.read_text(encoding="utf-8")
    assert "listen 3770 ssl;" in text
    assert "ssl_protocols TLSv1.2 TLSv1.3;" in text
    assert "access_log off;" in text and "error_log /dev/null crit;" in text
    assert "/dev/stdout" not in text and "/dev/stderr" not in text
    assert "http://anvil-u01-api:3770" in text
    assert "http://anvil-u01-issuer:8302" in text
    assert "connect-src 'self'" in text
    assert "location = /fixture-workbench { return 404; }" in text
    assert text.count("proxy_set_header X-Forwarded-Proto $scheme;") == 3


def manifest():
    return {
        "schema_version": "u01_wsl_development_manifest/v1",
        "environment": "WSL_SERVER_TEST_STAGING", "purpose": "WSL_DEVELOPMENT_ONLY",
        "release": "NOT_RELEASE", "acceptance": "NOT_ACCEPTED",
        "source_commit": "c" * 40,
        "source_files": {p: "A" * 64 for p in checker._U01_WSL_CODE},
        "images": {role: "sha256:" + char * 64 for role, char in
                   (("web", "a"), ("api", "b"), ("issuer", "c"))},
        "origin": "https://172.27.253.53:3770",
        "migration": {"before": "0013", "after": "0020"},
        "backup": {"encrypted_sha256": "B" * 64, "restore_verified": True,
                   "existing_data_preserved": True, "original_tables": 50,
                   "fingerprint_before": "C" * 64, "fingerprint_restored": "C" * 64,
                   "old_columns_after_migration": "C" * 64},
        "rollback": {"container_id": "d" * 64, "image_id": "sha256:" + "e" * 64,
                     "config_sha256": "D" * 64},
        "qa_principal": {"project": "anvil-wsl-development", "environment": "wsl-development",
                         "principal": "anvil-wsl-development-reader", "subject": "f19a-qa-reader",
                         "permissions": ["dashboard:read"]},
        "data_owner": "MAIN_VERIFIED_EXISTING_ANVIL_OWNER",
        "approval_sha256": "171D1524C2B20CF774076C8278F766721BB21E45BBC7A34C599437B27C9E7145",
        "unverified": ["PRODUCTION", "EXTERNAL_SSO", "PROVIDER", "FULL_U01_ACCEPTANCE", "PG18"],
    }


def test_manifest_template_is_not_executable_until_actual_main_evidence():
    path = ROOT / "deploy/wsl/U01DevelopmentReleaseManifest.template.json"
    assert path.is_file(), "Main용 미확정 manifest template 미구현"
    template = json.loads(path.read_text(encoding="utf-8"))
    assert checker.validate_u01_wsl_development_manifest(template)
    assert checker.validate_u01_wsl_development_manifest(manifest()) == []


@pytest.mark.parametrize("mutation", [
    lambda m: m.update(environment="PRODUCTION"),
    lambda m: m.update(origin="https://envil.sinsan.kr:3770"),
    lambda m: m.update(origin="https://172.27.253.53:443"),
    lambda m: m.update(origin="http://172.27.253.53:3770"),
    lambda m: m.update(origin="https://127.0.0.1:3770"),
    lambda m: m["images"].update(api="anvil:latest"),
    lambda m: m["qa_principal"].update(permissions=["admin"]),
    lambda m: m["backup"].update(restore_verified=False),
    lambda m: m["backup"].update(old_columns_after_migration="0" * 64),
    lambda m: m["backup"].update(original_tables=True),
    lambda m: m.update(client_secret="SYNTHETIC_DO_NOT_EXPORT"),
    lambda m: m["source_files"].update({"apps/api/forged.py": "A" * 64}),
    lambda m: m.update(acceptance="ACCEPTED"),
])
def test_manifest_rejects_unverified_or_expanded_deployment(mutation):
    value = manifest()
    mutation(value)
    assert checker.validate_u01_wsl_development_manifest(value) == ["U01_WSL_DEVELOPMENT_MANIFEST_INVALID"]
