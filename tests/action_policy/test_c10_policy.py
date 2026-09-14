"""C-10: requests cannot manufacture their own authorization."""
import pytest
from collections.abc import Mapping
from dataclasses import replace
from packages.action_policy import (ActionPolicy, Decision, ActionKind, EgressSnapshot,
                                    FencingTokens, SecretRef)
from tests.action_policy.test_policy import req


@pytest.mark.parametrize("permission", ["developer", "administrator", "unknown"])
def test_missing_trusted_authority_is_denied(permission):
    receipt = ActionPolicy(("packages/app",)).evaluate(req(permission=permission))
    assert receipt.decision is Decision.DENY
    assert receipt.reason_code == "POLICY_AUTHORITY_REQUIRED"


def authority(**changes):
    data = dict(tokens={"execution": "exec-1", "write": "write-1"}, permission="developer",
                project_id="project-1", environment_id="env-1", provider_id="provider-1",
                purpose="completion", protected_paths=(),
                now=100, lease_expires_at=200,
                egress_fingerprints=(req().egress.fingerprint,),
                canonical_paths={"packages/app/a.py": "packages/app/a.py"},
                grants={"developer": {"kinds": ("patch", "write", "execute"),
                        "paths": ("packages/app",), "commands": ("python -m unittest",), "expires_at": 200}},
                impact={"a-1": {"changed_paths": ("packages/app/a.py",), "flags": ()}},
                blocked_code=None)
    data.update(changes)
    return data


def policy(**changes):
    return ActionPolicy(("packages/app",), authority=authority(**changes))


@pytest.mark.parametrize("kind", list(ActionKind))
def test_trusted_grant_allows_medium_risk_with_bound_receipt(kind):
    request = req(kind=kind, command="python -m unittest" if kind is ActionKind.EXECUTE else None)
    receipt = policy().evaluate(request)
    assert receipt.decision is Decision.ALLOW
    assert receipt.risk == "medium"
    assert receipt.blocked_code is None
    assert receipt.io_count == 0
    assert receipt.receipt_sha256 == policy().evaluate(request).receipt_sha256
    assert receipt.request_sha256 != policy().evaluate(replace(request, action_id="other")).request_sha256


def test_request_cannot_select_a_more_privileged_grant():
    grants = authority()["grants"]
    grants["administrator"] = {"kinds": ("patch", "write", "execute"),
                               "paths": ("packages/app",), "commands": (), "expires_at": 200}
    receipt = policy(grants=grants).evaluate(req(permission="administrator"))
    assert receipt.reason_code == "PERMISSION_DENIED"


def test_malformed_authority_collections_fail_closed():
    receipt = policy(egress_fingerprints=req().egress.fingerprint).evaluate(req())
    assert receipt.reason_code == "POLICY_AUTHORITY_INVALID"


@pytest.mark.parametrize("changes,reason", [
    ({"permission": "admin"}, "PERMISSION_DENIED"),
    ({"permission": "observe"}, "PERMISSION_DENIED"),
    ({"tokens": FencingTokens("old", "write-1"), "expected_tokens": FencingTokens("old", "write-1")}, "STALE_FENCING_TOKEN"),
    ({"tokens": FencingTokens("exec-1", "old"), "expected_tokens": FencingTokens("exec-1", "old")}, "STALE_FENCING_TOKEN"),
    ({"path": "packages/app/.env"}, "PROTECTED_PATH_DENIED"),
    ({"path": "packages/app/.GiT/config"}, "PROTECTED_PATH_DENIED"),
    ({"path": "packages/app/private.pem"}, "PROTECTED_PATH_DENIED"),
    ({"path": "elsewhere/a.py"}, "PATH_NOT_ALLOWED"),
    ({"path": "packages/application/a.py"}, "PATH_NOT_ALLOWED"),
    ({"secret_read": True}, "SECRET_READ_DENIED"),
    ({"destructive": True}, "DESTRUCTIVE_ACTION_DENIED"),
])
def test_guards_return_exact_blocked_receipt(changes, reason):
    receipt = policy().evaluate(req(**changes))
    assert receipt.decision is Decision.DENY
    assert receipt.reason_code == reason
    assert receipt.io_count == 0


@pytest.mark.parametrize("path", ["../secret", "packages/app/../secret", "C:/Windows/key", "//server/share",
    "\\\\server\\share", "\\\\?\\C:\\file", "packages/app/NUL.txt", "packages/app/a.py:stream", "packages/app/x.",
    "packages/app/%2e%2e/file", "packages/app/a~1", "packages/app/./file", "packages//app/file"])
def test_path_normalization_escapes_return_receipt(path):
    receipt = policy().evaluate(req(path=path))
    assert receipt.reason_code == "INVALID_PATH"
    assert receipt.decision is Decision.DENY


@pytest.mark.parametrize("target,reason", [("elsewhere/a.py", "PATH_NOT_ALLOWED"),
    ("packages/app/.env", "PROTECTED_PATH_DENIED"), ("packages/app/a.py", "CANONICAL_PATH_REQUIRED")])
def test_trusted_alias_resolution_is_required_and_scoped(target, reason):
    aliases = {} if reason == "CANONICAL_PATH_REQUIRED" else {"packages/app/a.py": target}
    assert policy(canonical_paths=aliases).evaluate(req()).reason_code == reason


@pytest.mark.parametrize("change,reason", [({"tokens": None}, "STALE_FENCING_TOKEN"),
    ({"egress": None}, "EGRESS_SNAPSHOT_REQUIRED"), ({"permission": None}, "PERMISSION_DENIED"),
    ({"path": None}, "INVALID_PATH")])
def test_missing_required_fields_have_structured_denial(change, reason):
    assert policy().evaluate(req(**change)).reason_code == reason


@pytest.mark.parametrize("cmd", ["rm -rf scratch", "git push --force", "git push -f", "git reset --hard",
    "git branch -D topic", "git clean -fd", "Remove-Item scratch -Recurse", "del scratch", "cmd /c erase scratch",
    "python -c pass", "sh script.sh", "git -c alias.x=status x", "git update-ref -d refs/heads/topic",
    "git tag -d checkpoint", "git checkout -- packages/app/a.py", "git restore packages/app/a.py"])
def test_execute_cannot_bypass_deterministic_command_policy(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


@pytest.mark.parametrize("host,ips", [("localhost", ("8.8.8.8",)), ("node.localhost", ("8.8.8.8",)),
    ("metadata.google.internal", ("8.8.8.8",)), ("provider.test", ("169.254.169.254",)),
    ("provider.test", ("10.1.2.3",)), ("provider.test", ("::ffff:127.0.0.1",)),
    ("provider.test", ("not-an-ip",)), ("127.1", ("8.8.8.8",)), ("2130706433", ("8.8.8.8",))])
def test_egress_special_addresses_never_dispatch(host, ips):
    receipt = policy().evaluate(req(egress=EgressSnapshot("e", host, ips, connected_ip=ips[0])))
    assert receipt.reason_code == "METADATA_ADDRESS_DENIED"
    assert receipt.io_count == 0


def test_redirect_rebinding_and_approved_snapshot_drift():
    assert policy().evaluate(req(egress=EgressSnapshot("e", "p.test", ("8.8.8.8",),
        ("https://other.test",), connected_ip="8.8.8.8"))).reason_code == "REDIRECT_DENIED"
    assert policy().evaluate(req(egress=EgressSnapshot("e", "p.test", ("8.8.8.8", "1.1.1.1"),
        connected_ip="8.8.8.8"))).reason_code == "DNS_REBINDING_DENIED"
    assert policy().evaluate(req(egress=EgressSnapshot("e", "p.test", ("1.1.1.1",), connected_ip="1.1.1.1"),
        approved_resolved_ips=("8.8.8.8",))).reason_code == "DNS_REBINDING_DENIED"
    assert policy().evaluate(req(egress=EgressSnapshot("e-changed", "provider.test", ("8.8.8.8",),
        connected_ip="8.8.8.8"))).reason_code == "EGRESS_SNAPSHOT_DRIFT"


@pytest.mark.parametrize("flag", ["global_configuration", "test_weakened", "verification_disabled", "network_or_install",
    "operational_side_effect", "dirty_conflict", "plan_diff_mismatch"])
def test_impact_risks_cannot_be_lowered_by_llm(flag):
    p = policy(impact={"a-1": {"changed_paths": ("packages/app/a.py",), "flags": (flag,)}})
    receipt = p.evaluate(req())
    assert flag in receipt.risk_factors
    assert receipt.risk == "high"
    assert receipt.decision is Decision.DENY


def test_six_paths_raise_risk_and_unknown_impact_fails_closed():
    p = policy(impact={"a-1": {"changed_paths": tuple(f"packages/app/{i}.py" for i in range(6)), "flags": ()}})
    assert "more_than_five_files" in p.evaluate(req()).risk_factors
    assert p.evaluate(req()).risk == "high"
    assert policy(impact={}).evaluate(req()).reason_code == "IMPACT_EVIDENCE_REQUIRED"


@pytest.mark.parametrize("code", ["BASELINE_CONFLICT", "SCOPE_EXPANSION_REQUIRED", "PROTECTED_PATH_DENIED",
    "TOOLCHAIN_UNAVAILABLE", "VERIFICATION_ENV_UNAVAILABLE", "LLM_PROVIDER_UNAVAILABLE",
    "BUDGET_OR_QUOTA_EXCEEDED", "APPROVAL_EXPIRED", "WORKER_INTERRUPTED"])
def test_av_stat_020_retains_canonical_blocked_code(code):
    receipt = policy(blocked_code=code).evaluate(req())
    assert receipt.blocked_code == code
    assert receipt.reason_code == code
    assert receipt.decision is Decision.DENY


def test_grant_expiration_and_authority_snapshot_are_enforced():
    assert policy(now=200).evaluate(req()).reason_code == "STALE_FENCING_TOKEN"
    grants = authority()["grants"]
    grants["developer"]["expires_at"] = 100
    assert policy(grants=grants).evaluate(req()).reason_code == "APPROVAL_EXPIRED"
    config = authority()
    instance = ActionPolicy(("packages/app",), authority=config)
    config["tokens"]["execution"] = "attacker"
    assert instance.evaluate(req()).decision is Decision.ALLOW


def test_secret_ref_is_metadata_only_and_bound_to_trusted_broker_snapshot():
    ref = SecretRef("secret-ref-1", "project-1", "env-1", "provider-1", "completion",
                    3, "ACTIVE", 180, 90, "sha256:broker-policy")
    record = {"secret_ref_id": "secret-ref-1", "project_id": "project-1",
              "environment_id": "env-1", "provider_id": "provider-1", "purpose": "completion",
              "version": 3, "status": "ACTIVE", "expires_at": 180, "last_rotated_at": 90,
              "broker_policy_hash": "sha256:broker-policy"}
    receipt = policy(secret_refs={"secret-ref-1": record}).evaluate(req(secret_ref=ref))
    assert receipt.decision is Decision.ALLOW
    assert "secret-ref-1" not in repr(receipt.to_dict())


@pytest.mark.parametrize("status,expires_at", [("REVOKED", 180), ("EXPIRED", 180), ("ACTIVE", 100)])
def test_revoked_or_expired_secret_ref_fails_closed(status, expires_at):
    ref = SecretRef("secret-ref-1", "project-1", "env-1", "provider-1", "completion",
                    3, status, expires_at, 90, "sha256:broker-policy")
    record = {"secret_ref_id": "secret-ref-1", "project_id": "project-1",
              "environment_id": "env-1", "provider_id": "provider-1", "purpose": "completion",
              "version": 3, "status": status, "expires_at": expires_at, "last_rotated_at": 90,
              "broker_policy_hash": "sha256:broker-policy"}
    assert policy(secret_refs={"secret-ref-1": record}).evaluate(req(secret_ref=ref)).reason_code == "SECRET_REF_DENIED"


def test_raw_secret_like_arguments_are_denied_without_echoing_value():
    raw = "Bearer super-sensitive-value"
    receipt = policy().evaluate(req(arguments={"authorization": raw}))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert raw not in repr(receipt.to_dict())


@pytest.mark.parametrize("cmd", [
    "git push origin :refs/heads/topic", "git push --delete origin topic", "git push --mirror",
    "git update-ref refs/heads/topic 0000000000000000000000000000000000000000",
    "git remote remove origin", "git rebase main", "git commit --amend", "git notes remove HEAD",
    "git stash clear", "robocopy source target /MIR", "Clear-Content target.txt", "truncate -s 0 target.txt",
])
def test_r1_destructive_commands_are_hard_denied_even_when_granted(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


def test_r1_connected_ip_is_required_and_exactly_bound():
    missing = EgressSnapshot("e", "provider.test", ("8.8.8.8",))
    assert policy(egress_fingerprints=(missing.fingerprint,)).evaluate(
        req(egress=missing)).reason_code == "EGRESS_SNAPSHOT_REQUIRED"
    mismatch = EgressSnapshot("e", "provider.test", ("8.8.8.8",), connected_ip="1.1.1.1")
    assert policy(egress_fingerprints=(mismatch.fingerprint,)).evaluate(
        req(egress=mismatch)).reason_code == "DNS_REBINDING_DENIED"


@pytest.mark.parametrize("ip", ["100.100.100.200", "255.255.255.255", "198.18.0.1", "fec0::1"])
def test_r1_all_special_or_non_global_egress_is_denied(ip):
    egress = EgressSnapshot("e", "provider.test", (ip,), connected_ip=ip)
    receipt = policy(egress_fingerprints=(egress.fingerprint,)).evaluate(req(egress=egress))
    assert receipt.reason_code == "METADATA_ADDRESS_DENIED"


def test_r1_custom_protected_impact_precedes_general_high_risk():
    impact = {"a-1": {"changed_paths": ("packages/app/generated/out.py",),
                       "flags": ("network_or_install",)}}
    receipt = policy(protected_paths=("packages/app/generated",), impact=impact).evaluate(req())
    assert receipt.reason_code == "PROTECTED_PATH_DENIED"
    assert receipt.risk == "prohibited"


def test_r1_protected_paths_must_be_an_exact_tuple():
    assert policy(protected_paths="packages/app/generated").evaluate(
        req()).reason_code == "POLICY_AUTHORITY_INVALID"


@pytest.mark.parametrize("field,value", [
    ("kinds", "patch"), ("paths", "packages/app"), ("commands", "python -m unittest"),
])
def test_r1_nested_grant_collections_must_be_exact_tuples(field, value):
    grants = authority()["grants"]
    grants["developer"][field] = value
    assert policy(grants=grants).evaluate(req()).reason_code == "POLICY_AUTHORITY_INVALID"


class HostileMapping(Mapping):
    def __getitem__(self, key):
        raise RuntimeError("hostile getitem")

    def __iter__(self):
        raise RuntimeError("hostile iter")

    def __len__(self):
        raise RuntimeError("hostile len")


def test_r1_hostile_mapping_returns_structured_denial():
    receipt = policy().evaluate(req(arguments=HostileMapping()))
    assert receipt.reason_code == "INVALID_ACTION"
    assert receipt.io_count == 0


@pytest.mark.parametrize("key", ["token", "private_key", "PRIVATE-TOKEN"])
def test_r1_raw_secret_key_variants_are_denied(key):
    assert policy().evaluate(req(arguments={key: "opaque-value"})).reason_code == "SECRET_INPUT_DENIED"


def test_r1_secret_ref_must_match_current_authority_context():
    ref = SecretRef("secret-ref-1", "project-1", "env-1", "provider-1", "completion",
                    3, "ACTIVE", 180, 90, "sha256:broker-policy")
    record = {"secret_ref_id": "secret-ref-1", "project_id": "project-1",
              "environment_id": "env-1", "provider_id": "provider-1", "purpose": "completion",
              "version": 3, "status": "ACTIVE", "expires_at": 180, "last_rotated_at": 90,
              "broker_policy_hash": "sha256:broker-policy"}
    receipt = policy(project_id="other-project", secret_refs={"secret-ref-1": record}).evaluate(
        req(secret_ref=ref))
    assert receipt.reason_code == "SECRET_REF_DENIED"


@pytest.mark.parametrize("path", ["packages/app/COM¹.txt", "packages/app/LPT¹",
                                   "packages/app/CONIN$", "packages/app/CONOUT$"])
def test_r1_windows_device_aliases_are_invalid(path):
    assert policy().evaluate(req(path=path)).reason_code == "INVALID_PATH"


def test_r1_request_arguments_are_frozen_at_construction():
    arguments = {"payload": {"value": "safe"}}
    request = req(arguments=arguments)
    before = policy().evaluate(request)
    arguments["payload"]["authorization"] = "Bearer injected-after-construction"
    after = policy().evaluate(request)
    assert before.decision is Decision.ALLOW
    assert after.receipt_sha256 == before.receipt_sha256


@pytest.mark.parametrize("cmd", [
    "git checkout .", "git checkout packages/app/a.py",
    "git worktree remove ../topic", "git worktree prune", "git gc", "git prune",
    "git push origin +main:main", "git push --prune origin", "git push --delete origin topic",
    "git push --mirror", "git push origin :topic", "git remote prune origin",
    "git remote remove origin", "git symbolic-ref -d HEAD",
    "git symbolic-ref HEAD refs/heads/topic", "git branch topic", "git tag release-candidate",
    "git replace old new",
    "git fetch --prune origin", "git update-ref refs/heads/topic 0000000000000000000000000000000000000000",
    "git update-ref -d refs/heads/topic", "git rebase main", "git commit --amend",
    "git notes remove HEAD", "git stash clear", "find . -delete", "Set-Content target.txt value",
    "Clear-Content target.txt", "truncate -s 0 target.txt", "robocopy source target /MIR",
    "env git checkout .", "env SAFE=1 git push --mirror", "clc target.txt", "ri target.txt",
])
def test_r2_structured_command_effect_denies_mutation_even_when_granted(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"
    assert receipt.io_count == 0


def test_r2_unknown_command_structure_is_denied_even_when_granted():
    cmd = "custom-tool --declared-safe"
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    assert policy(grants=grants).evaluate(
        req(kind=ActionKind.EXECUTE, command=cmd)).reason_code == "UNSAFE_COMMAND_DENIED"


@pytest.mark.parametrize("key", [
    "accessToken", "refreshToken", "idToken", "clientSecret", "clientPassword",
    "X-API-Key", "privateKey", "access-token", "refresh_token", "id.token",
    "client-secret", "client.password", "x_api_key", "PRIVATE-KEY",
])
def test_r2_canonical_secret_key_variants_are_denied(key):
    receipt = policy().evaluate(req(arguments={key: "opaque-value"}))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "git diff --output=packages/app/leak.patch",
    "git show HEAD --output=packages/app/show.txt",
    "git stash show --output=packages/app/stash.patch",
    "git diff --ext-diff",
    "env GIT_EXTERNAL_DIFF=remove-item git diff",
    "env GIT_EXTERNAL_DIFF=touch git diff --ext-diff",
    "env GIT_DIR=../../other/.git git status",
    "git -C ../../other status",
    "mypy --install-types --non-interactive",
    "python -m pytest --basetemp=packages/app/tmp",
])
def test_main_takeover_denies_read_or_verify_commands_with_side_effects(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "python -B -m pytest -q -p no:cacheprovider",
    "python -I -B -m pytest -q -p no:cacheprovider",
])
def test_main_takeover_preserves_safe_python_interpreter_flags_for_pytest(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.decision is Decision.ALLOW
    assert receipt.reason_code == "ALLOWED"


def test_main_takeover_denies_interactive_python_flag_even_when_granted():
    cmd = "python -i -m pytest -q"
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


class HostileOSErrorMapping(Mapping):
    def __getitem__(self, key):
        raise OSError("hostile getitem")

    def __iter__(self):
        raise OSError("hostile iter")

    def __len__(self):
        raise OSError("hostile len")


def test_main_takeover_hostile_oserror_mapping_returns_structured_denial():
    request = req(arguments=HostileOSErrorMapping())
    receipt = policy().evaluate(request)
    assert receipt.reason_code == "INVALID_ACTION"
    assert receipt.decision is Decision.DENY
    assert receipt.io_count == 0


@pytest.mark.parametrize("key", [
    "apiKeyValue", "apiKeyHeader", "privateKeyPem", "privateKeyValue",
])
def test_main_takeover_secret_suffix_variants_are_denied(key):
    receipt = policy().evaluate(req(arguments={key: "opaque-value"}))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "../../evil/git status",
    "packages/tools/git status",
    "../../evil/python -B -m pytest -q",
    "python -B -m pytest -q -o cache_dir=../../outside",
    "python -B -m pytest -q --override-ini=cache_dir=../../outside",
    "python -B -m pytest -o cache_dir=packages/app/tmp",
    "python -B -m pytest -c ../../outside.ini",
    "mypy --config-file=../../outside.ini",
    "git show HEAD:.env",
    "git diff -- .env",
    "git diff -- :(top).env",
    "git show --show-signature HEAD",
    "git log --format=%G? HEAD",
    "python -B -m pytest --cov-report=html:../../outside",
    "python -B -m pytest --log-file=../../outside.log",
    "python -B -m pytest --pastebin=all",
    "mypy --cache-map source.py ../../data ../../meta",
    "mypy --python-executable=../../evil/python",
])
def test_main_takeover_r2_review_denies_executable_and_argv_effects(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"
    assert receipt.io_count == 0


@pytest.mark.parametrize("arguments", [
    {"apiКey": "opaque-value"},  # Cyrillic Ka
    {"sessionCookie": "opaque-value"},
    {"auth": "opaque-value"},
    {"httpHeader": "Basic dXNlcjpwYXNz"},
])
def test_main_takeover_r2_review_denies_confusable_and_auth_secrets(arguments):
    receipt = policy().evaluate(req(arguments=arguments))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert receipt.io_count == 0


class HostileGenericExceptionMapping(Mapping):
    def __getitem__(self, key):
        raise Exception("hostile generic")

    def __iter__(self):
        raise Exception("hostile generic")

    def __len__(self):
        raise Exception("hostile generic")


class HostileLookupErrorMapping(Mapping):
    def __getitem__(self, key):
        raise LookupError("hostile lookup")

    def __iter__(self):
        raise LookupError("hostile lookup")

    def __len__(self):
        raise LookupError("hostile lookup")


@pytest.mark.parametrize("arguments", [
    HostileGenericExceptionMapping(), HostileLookupErrorMapping(),
])
def test_main_takeover_r2_review_hostile_mapping_exceptions_are_structured(arguments):
    request = req(arguments=arguments)
    receipt = policy().evaluate(request)
    assert receipt.reason_code == "INVALID_ACTION"
    assert receipt.decision is Decision.DENY
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "python -B -m pytest ../../outside/test_payload.py",
    "python -B -m pytest -p malicious_plugin tests/action_policy",
    "python -B -m pytest --debug=../../outside.log",
    "python -B -m pytest --cov=packages --cov-append",
    "python -B -m unittest discover -s ../../outside",
    "python -B -m unittest external_package",
    "mypy ../../outside/payload.py",
    "mypy --any-exprs-report ../../outside packages",
    "mypy --lineprecision-report ../../outside packages",
    "mypy --xslt-html-report ../../outside packages",
    "git diff",
    "git show HEAD",
    "git log -p --all",
    "git diff -- :(attr:!unconfigured).env",
])
def test_main_takeover_r3_review_denies_unscoped_or_extensible_commands(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "git status --short",
    "git diff -- packages/app/a.py",
    "git show --no-patch HEAD",
    "git log --no-patch -1",
    "python -B -m pytest -q -p no:cacheprovider tests/action_policy",
    "python -B -m unittest",
    "python -B -m unittest discover -s tests/action_policy",
    "python -B -m unittest tests.action_policy.test_policy",
    "mypy packages/app",
])
def test_main_takeover_r3_review_preserves_scoped_read_and_verify_commands(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.decision is Decision.ALLOW
    assert receipt.reason_code == "ALLOWED"


@pytest.mark.parametrize("arguments", [
    {"accessTo\u200bken": "opaque"},
    {"sessionCoo\u200bkie": "opaque"},
    {"httpHeader": "Basic\u200bdXNlcjpwYXNz"},
    {"apiKeу": "opaque"},  # final character is Cyrillic U
    {"paѕѕword": "opaque"},  # Cyrillic Dze characters
    {"httpHeader": "Cookie: sessionid=opaque"},
    {"httpHeader": "Authorization: Digest user=x response=opaque"},
])
def test_main_takeover_r3_review_denies_format_confusable_and_header_secrets(arguments):
    receipt = policy().evaluate(req(arguments=arguments))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "python -B -m pytest tests/action_policy",
    "pytest -q -p no:cacheprovider tests/action_policy",
    "mypy --junit-xml=../../outside.xml packages/app",
    "mypy --python-exe=../../evil/python packages/app",
    "mypy --junit-xml=C:/outside/result.xml packages/app",
    "mypy --junit-xml=NUL packages/app",
    "git show --no-patch --patch-with-stat HEAD",
    "git show --no-patch -u HEAD",
    "git log --no-patch -pU0 -1",
    "git ls-files --exclude-from=/outside/filter.txt",
    "git remote -v",
    "git remote get-url origin",
])
def test_main_takeover_r4_review_denies_cache_output_patch_and_remote(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


def test_main_takeover_r4_review_binds_command_target_to_custom_protected_paths():
    cmd = "git diff -- packages/app/private/secret.txt"
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants, protected_paths=("packages/app/private",)).evaluate(
        req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


@pytest.mark.parametrize("cmd", [
    "mypy packages/agent_team/runtime_config.py",
    "mypy packages/orchestration/failure_report.py",
    "mypy packages/persistence/config.py",
])
def test_main_takeover_r4_review_preserves_mypy_targets_with_safe_names(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.decision is Decision.ALLOW
    assert receipt.reason_code == "ALLOWED"


@pytest.mark.parametrize("arguments", [
    {"accessTo\u0301ken": "opaque"},
    {"pass-word": "opaque"},
    {"sessionCoo-kie": "opaque"},
    {"jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123"},
    {"sessionId": "opaque-session"},
    {"httpHeader": "Authorization: ApiKey opaque"},
    {"httpHeader": "Authorization: Token opaque"},
    {"httpHeader": "Authorization: AWS4-HMAC-SHA256 Credential=x Signature=y"},
])
def test_main_takeover_r4_review_denies_combining_delimiter_and_real_credentials(arguments):
    receipt = policy().evaluate(req(arguments=arguments))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert receipt.io_count == 0


@pytest.mark.parametrize("cmd", [
    "git ls-files --exclude-f=/outside/filter.txt",
    "git status --pathspec-from-f=/outside/list.txt",
    "git show --no-patch --remerge-diff HEAD",
])
def test_main_takeover_r5_review_denies_git_long_abbreviation_and_remerge(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"


def test_main_takeover_r5_review_denies_unsecured_jwt():
    value = "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0In0."
    receipt = policy().evaluate(req(arguments={"payload": value}))
    assert receipt.reason_code == "SECRET_INPUT_DENIED"
    assert value not in repr(receipt.to_dict())


@pytest.mark.parametrize("cmd", [
    "git diff -OC:/outside/order.txt -- packages/app/a.py",
    "git ls-files -X C:/outside/filter.txt",
])
def test_main_takeover_r6_review_denies_git_short_file_input_options(cmd):
    grants = authority()["grants"]
    grants["developer"]["commands"] = (cmd,)
    receipt = policy(grants=grants).evaluate(req(kind=ActionKind.EXECUTE, command=cmd))
    assert receipt.reason_code == "UNSAFE_COMMAND_DENIED"
    assert receipt.risk == "prohibited"
