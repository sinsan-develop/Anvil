"""C-10 신뢰된 서버 관측과 요청을 비교하는 순수 admission.

authority는 Agent가 아닌 서버가 매 admission마다 공급한다. 실제 실행 계층은
path identity와 연결 IP를 사용 시점에 다시 확인해야 한다. 여기서는 IO를 하지 않는다.
"""
from __future__ import annotations

from dataclasses import dataclass, fields
from enum import Enum
import hashlib
import ipaddress
import json
import re
import shlex
import unicodedata
from types import MappingProxyType
from typing import Any, Mapping

from .policy import (ActionKind, ActionReceipt, ActionRequest, Decision, EgressSnapshot,
                     FencingTokens, PolicyError, SecretRef)


def plain(value):
    if isinstance(value, Mapping):
        if any(type(k) is not str for k in value): raise PolicyError("string keys required")
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, Enum): return value.value
    if type(value) in (str, int, bool, type(None)): return value
    if type(value) in (FencingTokens, EgressSnapshot, SecretRef):
        return {f.name: plain(getattr(value, f.name)) for f in fields(value)}
    raise PolicyError("non canonical input")


def freeze(value):
    value = plain(value)
    if isinstance(value, dict): return MappingProxyType({k: freeze(v) for k, v in value.items()})
    if isinstance(value, list): return tuple(freeze(v) for v in value)
    return value


def digest(value):
    return "sha256:" + hashlib.sha256(json.dumps(plain(value), ensure_ascii=False, sort_keys=True,
                                                separators=(",", ":")).encode()).hexdigest()


def text(value):
    return type(value) is str and bool(value) and value == value.strip() and not any(ord(c) < 32 for c in value)


def safe_path(path):
    if not text(path) or path.startswith(("/", "~")) or any(c in path for c in "\\:%~*?<>|\""):
        return False
    for part in path.split("/"):
        if part in ("", ".", "..") or part.endswith((".", " ")) or part != part.strip(): return False
        device_part = unicodedata.normalize("NFKC", part)
        if re.fullmatch(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\..*)?",
                        device_part, re.I): return False
    return True


def inside(path, scopes):
    return isinstance(scopes, tuple) and any(path == p or path.startswith(p + "/") for p in scopes if safe_path(p))


def valid_grant(permission, grant):
    if not text(permission) or not isinstance(grant, Mapping): return False
    if set(grant) != {"kinds", "paths", "commands", "expires_at"}: return False
    kinds, paths, commands = grant["kinds"], grant["paths"], grant["commands"]
    if type(kinds) is not tuple or not kinds or any(type(item) is not str for item in kinds): return False
    if any(item not in {kind.value for kind in ActionKind} for item in kinds) or len(set(kinds)) != len(kinds):
        return False
    if type(paths) is not tuple or not paths or not all(safe_path(item) for item in paths): return False
    if len(set(paths)) != len(paths): return False
    if type(commands) is not tuple or not all(text(item) for item in commands): return False
    if len(set(commands)) != len(commands): return False
    return type(grant["expires_at"]) is int


def protected(path, configured=()):
    built_in = any(part in (".git", ".ssh", ".aws", ".azure", ".gnupg", "secrets", "credentials")
                   or part.startswith(".env") or part.endswith((".pem", ".key", ".p12", ".pfx"))
                   for part in path.casefold().split("/"))
    return built_in or any(path == item or path.startswith(item + "/") for item in configured)


SECRET_CONFUSABLES = str.maketrans({
    "А": "A", "а": "a", "В": "B", "Е": "E", "е": "e", "К": "K", "к": "k",
    "М": "M", "Н": "H", "О": "O", "о": "o", "Р": "P", "р": "p", "С": "C",
    "с": "c", "Т": "T", "У": "Y", "у": "y", "Х": "X", "х": "x", "І": "I",
    "і": "i", "Ј": "J", "ј": "j", "Ѕ": "S", "ѕ": "s",
    "Α": "A", "α": "a", "Β": "B", "Ε": "E", "ε": "e", "Ι": "I", "ι": "i",
    "Κ": "K", "κ": "k", "Μ": "M", "Ν": "N", "Ο": "O", "ο": "o", "Ρ": "P",
    "ρ": "p", "Τ": "T", "Υ": "Y", "υ": "y", "Χ": "X", "χ": "x",
})


def canonical_secret_text(value, *, join_format=False):
    normalized = unicodedata.normalize("NFKD", value).translate(SECRET_CONFUSABLES)
    replacement = "" if join_format else " "
    return "".join(replacement if unicodedata.category(character) in {"Cf", "Mn", "Mc"} else character
                   for character in normalized)


def secret_shape(value):
    if isinstance(value, Mapping):
        def secret_key(key):
            if (any(character.isascii() and character.isalnum() for character in key)
                    and any(not character.isascii() and character.isalnum() for character in key)):
                return True
            canonical = canonical_secret_text(key, join_format=True)
            expanded = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", canonical)
            normalized = re.sub(r"[^a-z0-9]+", "_", expanded.casefold()).strip("_")
            parts = set(normalized.split("_"))
            compact = normalized.replace("_", "")
            return (bool(parts & {"secret", "password", "credential", "token", "authorization",
                                  "auth", "cookie", "jwt"})
                    or any(compact.endswith(marker) or marker in compact
                           for marker in ("apikey", "privatekey", "password", "credential",
                                          "authorization", "token", "cookie", "sessionid", "jwt")))
        return any(secret_key(k) or secret_shape(v) for k, v in value.items())
    if isinstance(value, (tuple, list)): return any(secret_shape(v) for v in value)
    if not isinstance(value, str): return False
    canonical = canonical_secret_text(value)
    return bool(re.search(
        r"-----BEGIN .*PRIVATE KEY|\b(?:Authorization\s*:\s*)?"
        r"(?:Bearer|Basic|Digest|ApiKey|Token|AWS4-HMAC-SHA256)(?:\s+|(?=\S{8,}))\S+|"
        r"\b(?:Set-)?Cookie\s*:\s*\S+|\b(?:sk|ghp|gho)[_-][A-Za-z0-9_-]{8,}|"
        r"\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*(?=\s|$)|"
        r"(?:password|api[_-]?key|secret|access[_-]?token|credential|signature)\s*[:=]",
        canonical, re.I))


BLOCKED_CODES = frozenset(("BASELINE_CONFLICT", "SCOPE_EXPANSION_REQUIRED", "PROTECTED_PATH_DENIED",
    "TOOLCHAIN_UNAVAILABLE", "VERIFICATION_ENV_UNAVAILABLE", "LLM_PROVIDER_UNAVAILABLE",
    "BUDGET_OR_QUOTA_EXCEEDED", "APPROVAL_EXPIRED", "WORKER_INTERRUPTED"))
IMPACT_FLAGS = frozenset(("global_configuration", "test_weakened", "verification_disabled",
    "network_or_install", "operational_side_effect", "dirty_conflict", "plan_diff_mismatch"))
UNSAFE_COMMAND_TEXT = re.compile(r"[;&|<>`\r\n]|\$\(")


class CommandEffect(str, Enum):
    VERIFY = "verify"
    READ_ONLY = "read_only"
    MUTATION = "mutation"
    DESTRUCTIVE = "destructive"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class CommandIntent:
    executable: str
    subcommand: str | None
    argv: tuple[str, ...]
    effect: CommandEffect


def command_name(token):
    name = token.replace("\\", "/").rsplit("/", 1)[-1].casefold()
    return name[:-4] if name.endswith(".exe") else name


def has_option(argv, *names):
    """Match an option with either a separate value or ``--name=value``."""
    lowered = tuple(token.casefold() for token in argv)
    return any(token == name or token.startswith(name + "=")
               for token in lowered for name in names)


def has_short_option(argv, *names):
    return any(token == name or (token.startswith(name) and not token.startswith("--"))
               for token in argv for name in names)


def git_argument_escapes_or_protects(token, configured=()):
    normalized = unicodedata.normalize("NFKC", token).replace("\\", "/").casefold()
    if "%g" in normalized:
        return True
    parts = []
    for part in (item for item in re.split(r"[/:]", normalized) if item):
        part = re.sub(r"^\([^)]*\)", "", part).lstrip("!^")
        if part:
            parts.append(part)
    if ".." in parts:
        return True
    built_in = any(part in {".git", ".ssh", ".aws", ".azure", ".gnupg", "secrets", "credentials"}
               or part.startswith(".env") or part.endswith((".pem", ".key", ".p12", ".pfx"))
               for part in parts)
    path = token.split("::", 1)[0]
    return built_in or (safe_path(path) and protected(path, configured))


def repository_path_argument(token, configured=()):
    path = token.split("::", 1)[0]
    return safe_path(path) and not protected(path, configured)


def repository_escape_argument(token):
    normalized = unicodedata.normalize("NFKC", token).replace("\\", "/")
    if normalized.startswith(("/", "~")) or re.match(r"^[A-Za-z]:", normalized):
        return True
    return ".." in tuple(part for part in normalized.split("/") if part)


def git_patch_requested(token):
    lowered = token.casefold()
    if lowered == "--no-patch": return False
    return ((lowered.startswith("-p") or lowered.startswith("-u")) and not lowered.startswith("--")
            or long_option_abbreviates(token, {
                "--patch", "--patch-with-raw", "--patch-with-stat", "--remerge-diff",
                "--diff-merges", "--combined-all-paths",
            }) or lowered in {"-c", "--cc"})


def git_intent(argv, configured=()):
    index = 0
    while index < len(argv):
        token = argv[index]
        # Repository relocation/configuration options change the observation
        # boundary. No global git option is needed by the admitted read set.
        if token.startswith("-"): return None, CommandEffect.UNKNOWN
        break
    if index >= len(argv): return None, CommandEffect.UNKNOWN
    subcommand = argv[index].casefold()
    raw_args = tuple(argv[index + 1:])
    args = tuple(token.casefold() for token in raw_args)
    # These options write files, execute configured helpers, or escape the
    # repository comparison boundary even when paired with a read-like verb.
    if (has_option(args, "--output", "--ext-diff", "--textconv", "--no-index",
                   "--show-signature", "--verify-signatures")
            or any(git_argument_escapes_or_protects(token, configured) for token in args)):
        return subcommand, CommandEffect.MUTATION
    if subcommand == "status":
        if (any(long_option_abbreviates(arg, {"--pathspec-from-file"}) for arg in args)
                or any(repository_escape_argument(arg) for arg in args)):
            return subcommand, CommandEffect.UNKNOWN
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "diff":
        if "--" not in args:
            return subcommand, CommandEffect.UNKNOWN
        separator = args.index("--")
        targets = args[separator + 1:]
        if (not targets or any(not repository_path_argument(target, configured) for target in targets)
                or any(git_patch_requested(arg) or arg == "--all" for arg in args[:separator])
                or any(arg.startswith("-O") for arg in raw_args[:separator])):
            return subcommand, CommandEffect.UNKNOWN
        return subcommand, CommandEffect.READ_ONLY
    if subcommand in {"show", "log"}:
        if not any(arg in {"-s", "--no-patch"} for arg in args):
            return subcommand, CommandEffect.UNKNOWN
        if any(git_patch_requested(arg) or arg == "--all" or ":" in arg for arg in args):
            return subcommand, CommandEffect.UNKNOWN
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "ls-files":
        if (any(long_option_abbreviates(arg, {"--exclude-from", "--exclude-per-directory"}) for arg in args)
                or any(arg.startswith("-X") for arg in raw_args)):
            return subcommand, CommandEffect.UNKNOWN
        return subcommand, CommandEffect.READ_ONLY
    if subcommand in {"rev-parse", "merge-base"}:
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "worktree" and args[:1] == ("list",):
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "branch" and (not args or args == ("--show-current",)):
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "tag" and (not args or args[0] in {"-l", "--list"}):
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "stash" and args[:1] == ("list",):
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "notes" and args[:1] == ("list",):
        return subcommand, CommandEffect.READ_ONLY
    if subcommand == "symbolic-ref" and len(args) == 1:
        return subcommand, CommandEffect.READ_ONLY
    destructive = {
        "branch", "checkout", "clean", "commit", "fetch", "filter-branch", "gc", "notes", "prune",
        "push", "rebase", "reflog", "remote", "replace", "reset", "restore", "stash",
        "symbolic-ref", "tag", "update-ref", "worktree",
    }
    return subcommand, CommandEffect.DESTRUCTIVE if subcommand in destructive else CommandEffect.UNKNOWN


def command_intent(command, configured=()):
    if not text(command) or UNSAFE_COMMAND_TEXT.search(command):
        return CommandIntent("", None, (), CommandEffect.UNKNOWN)
    try:
        parsed = tuple(shlex.split(command, posix=True))
    except (ValueError, RuntimeError):
        return CommandIntent("", None, (), CommandEffect.UNKNOWN)
    if not parsed:
        return CommandIntent("", None, (), CommandEffect.UNKNOWN)
    # Environment wrappers can redirect git/config/helper behaviour. The
    # trusted grant must name the executable directly and cannot bless env.
    if command_name(parsed[0]) == "env":
        return CommandIntent("env", None, parsed[1:], CommandEffect.UNKNOWN)
    tokens = parsed
    raw_executable = tokens[0]
    executable = command_name(raw_executable)
    if raw_executable.casefold() not in {executable, executable + ".exe"}:
        return CommandIntent("", None, tokens[1:], CommandEffect.UNKNOWN)
    executable = {"clc": "clear-content", "ri": "remove-item"}.get(executable, executable)
    argv = tuple(tokens[1:])
    lowered = tuple(token.casefold() for token in argv)
    if executable == "git":
        subcommand, effect = git_intent(argv, configured)
        return CommandIntent(executable, subcommand, argv, effect)
    if executable in {"python", "python3"}:
        safe_interpreter_flags = {"-b", "-bb", "-B", "-E", "-I", "-P",
                                  "-q", "-s", "-S", "-u"}
        module_index = 0
        while module_index < len(argv) and argv[module_index] != "-m":
            if argv[module_index] not in safe_interpreter_flags:
                return CommandIntent(executable, None, argv, CommandEffect.UNKNOWN)
            module_index += 1
        if module_index + 1 >= len(lowered):
            return CommandIntent(executable, None, argv, CommandEffect.UNKNOWN)
        module = lowered[module_index + 1]
        module_argv = argv[module_index + 2:]
        if module == "pytest" and "-B" not in argv[:module_index]:
            return CommandIntent(executable, module, argv, CommandEffect.UNKNOWN)
        effect = verification_effect(module, module_argv, configured)
        return CommandIntent(executable, module, argv, effect)
    if executable == "pytest":
        return CommandIntent(executable, None, argv, CommandEffect.UNKNOWN)
    if executable == "mypy":
        return CommandIntent(executable, None, argv, verification_effect(executable, argv, configured))
    if executable in {"set-content", "clear-content", "remove-item", "rm", "rmdir", "del",
                      "erase", "truncate", "sudo", "shutdown", "reboot"}:
        return CommandIntent(executable, None, argv, CommandEffect.DESTRUCTIVE)
    if executable == "find" and "-delete" in lowered:
        return CommandIntent(executable, None, argv, CommandEffect.DESTRUCTIVE)
    if executable == "robocopy" and "/mir" in lowered:
        return CommandIntent(executable, None, argv, CommandEffect.DESTRUCTIVE)
    return CommandIntent(executable, None, argv, CommandEffect.UNKNOWN)


def verification_effect(module, argv, configured=()):
    lowered_module = module.casefold()
    if lowered_module == "unittest":
        return unittest_effect(argv, configured)
    if lowered_module == "pytest":
        return pytest_effect(argv, configured)
    if lowered_module == "mypy":
        return mypy_effect(argv, configured)
    return CommandEffect.UNKNOWN


def pytest_effect(argv, configured=()):
    safe_flags = {"-q", "--quiet", "-v", "-vv", "--verbose", "-x", "--exitfirst", "-s",
                  "--disable-warnings", "--strict-markers", "--strict-config", "--collect-only",
                  "--co", "--no-header", "--no-summary", "--full-trace", "--showlocals", "-l",
                  "--fixtures", "--fixtures-per-test", "--setup-show", "--setup-only", "--setup-plan"}
    value_options = {"-k", "-m", "--tb", "--color", "--capture", "--maxfail", "--durations",
                     "--durations-min", "--show-capture", "--code-highlight"}
    index = 0
    positional_only = False
    cache_disabled = False
    while index < len(argv):
        token = argv[index]
        lowered = token.casefold()
        if token == "--": positional_only = True; index += 1; continue
        if not positional_only and token == "-p":
            if index + 1 >= len(argv) or argv[index + 1].casefold() != "no:cacheprovider":
                return CommandEffect.MUTATION
            cache_disabled = True
            index += 2; continue
        if not positional_only and lowered.startswith("-p"):
            if lowered != "-pno:cacheprovider": return CommandEffect.MUTATION
            cache_disabled = True
            index += 1; continue
        if not positional_only and (token in safe_flags or re.fullmatch(r"-r[A-Za-z]*", token)):
            index += 1; continue
        if not positional_only and token in value_options:
            if index + 1 >= len(argv): return CommandEffect.UNKNOWN
            index += 2; continue
        if not positional_only and any(lowered.startswith(option + "=") for option in value_options if option.startswith("--")):
            index += 1; continue
        if not positional_only and token.startswith("-"):
            return CommandEffect.MUTATION
        if not repository_path_argument(token, configured): return CommandEffect.MUTATION
        index += 1
    return CommandEffect.VERIFY if cache_disabled else CommandEffect.MUTATION


def unittest_effect(argv, configured=()):
    if not argv: return CommandEffect.VERIFY
    index = 1 if argv[0].casefold() == "discover" else 0
    discover = index == 1
    safe_flags = {"-v", "--verbose", "-q", "--quiet", "-f", "--failfast", "-c", "--catch",
                  "-b", "--buffer", "--locals"}
    while index < len(argv):
        token = argv[index]
        if token in safe_flags: index += 1; continue
        if token in {"-k"}:
            if index + 1 >= len(argv): return CommandEffect.UNKNOWN
            index += 2; continue
        if discover and token in {"-s", "--start-directory", "-t", "--top-level-directory"}:
            if index + 1 >= len(argv) or not repository_path_argument(argv[index + 1], configured):
                return CommandEffect.MUTATION
            index += 2; continue
        if discover and token in {"-p", "--pattern"}:
            if index + 1 >= len(argv) or repository_escape_argument(argv[index + 1]):
                return CommandEffect.MUTATION
            index += 2; continue
        if token.startswith("-"): return CommandEffect.UNKNOWN
        if discover:
            return CommandEffect.MUTATION
        if not (("/" in token and repository_path_argument(token, configured))
                or token.startswith("tests.")):
            return CommandEffect.MUTATION
        index += 1
    return CommandEffect.VERIFY


def long_option_abbreviates(token, options):
    name = token.casefold().split("=", 1)[0]
    return name.startswith("--") and any(option.startswith(name) for option in options)


def mypy_effect(argv, configured=()):
    dangerous = {
        "--any-exprs-report", "--cache-dir", "--cache-map", "--cobertura-xml-report",
        "--config-file", "--custom-typeshed-dir", "--html-report", "--install-types",
        "--junit-xml", "--linecount-report", "--linecoverage-report", "--lineprecision-report",
        "--memory-xml-report", "--package-root", "--python-executable", "--shadow-file",
        "--sqlite-cache", "--txt-report", "--xml-report", "--xslt-html-report",
    }
    index = 0
    while index < len(argv):
        token = argv[index]
        lowered = token.casefold()
        if token.startswith("@") or (token.startswith("--") and long_option_abbreviates(token, dangerous)):
            return CommandEffect.MUTATION
        if token in {"-m", "--module", "-p", "--package", "-c", "--command"}:
            return CommandEffect.MUTATION
        if not token.startswith("-") and not repository_path_argument(token, configured):
            return CommandEffect.MUTATION
        index += 1
    return CommandEffect.VERIFY


def unsafe_command(command, configured=()):
    return command_intent(command, configured).effect not in {CommandEffect.VERIFY, CommandEffect.READ_ONLY}


def blocked_address(value, *, ip_only=False):
    if not text(value): return True
    lowered = value.casefold().rstrip(".")
    if lowered in {"localhost", "metadata.google.internal", "metadata", "instance-data"} or lowered.endswith(".localhost"):
        return True
    try:
        address = ipaddress.ip_address(lowered)
        if getattr(address, "ipv4_mapped", None): address = address.ipv4_mapped
        blocked = (
            ipaddress.ip_network("10.0.0.0/8"), ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"), ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("169.254.0.0/16"), ipaddress.ip_network("0.0.0.0/8"),
            ipaddress.ip_network("::1/128"), ipaddress.ip_network("fc00::/7"),
            ipaddress.ip_network("fe80::/10"), ipaddress.ip_network("::/128"),
        )
        return (str(address) == "100.100.100.200" or any(address in network for network in blocked)
                or not address.is_global or address.is_multicast
                or bool(getattr(address, "is_site_local", False)))
    except ValueError:
        if ip_only: return True
        return not bool(re.fullmatch(r"[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+", lowered))


def egress_reason(r):
    e = r.egress
    if type(e) is not EgressSnapshot: return "EGRESS_SNAPSHOT_REQUIRED"
    if (not text(e.snapshot_id) or type(e.resolved_ips) is not tuple or not e.resolved_ips
            or type(e.redirect_chain) is not tuple or type(e.metadata_access) is not bool
            or not text(e.connected_ip)): return "EGRESS_SNAPSHOT_REQUIRED"
    if (blocked_address(e.host) or any(blocked_address(ip, ip_only=True) for ip in e.resolved_ips)
            or blocked_address(e.connected_ip, ip_only=True)): return "METADATA_ADDRESS_DENIED"
    if e.metadata_access or r.metadata_access: return "METADATA_ACCESS_DENIED"
    if e.redirect_chain: return "REDIRECT_DENIED"
    if len(e.resolved_ips) != 1: return "DNS_REBINDING_DENIED"
    if r.approved_resolved_ips is not None and r.approved_resolved_ips != e.resolved_ips: return "DNS_REBINDING_DENIED"
    try:
        if ipaddress.ip_address(e.connected_ip) != ipaddress.ip_address(e.resolved_ips[0]):
            return "DNS_REBINDING_DENIED"
    except ValueError:
        return "METADATA_ADDRESS_DENIED"
    try:
        if ipaddress.ip_address(e.host) != ipaddress.ip_address(e.resolved_ips[0]): return "DNS_REBINDING_DENIED"
    except ValueError:
        pass
    if e.scheme != "https" or type(e.port) is not int or e.port != 443: return "PROVIDER_ENDPOINT_BLOCKED"
    return None


def evaluate(allowed_paths, authority, request):
    """입력 오류도 원문 없이 동일한 구조의 immutable receipt로 반환한다."""
    state = dict(risk="medium", risk_factors=(), execution_token_valid=False, write_token_valid=False, path="")
    request_hash, egress_hash = digest(None), ""
    reason = "INVALID_ACTION"
    if type(request) is ActionRequest:
        try:
            request_hash = digest({f.name: getattr(request, f.name) for f in fields(request)})
            reason = decide(allowed_paths, authority, request, state)
            if type(request.egress) is EgressSnapshot: egress_hash = request.egress.fingerprint
        except Exception:
            reason = "INVALID_ACTION"
    blocked = reason if reason in BLOCKED_CODES else {
        "PATH_NOT_ALLOWED": "SCOPE_EXPANSION_REQUIRED", "STALE_FENCING_TOKEN": "WORKER_INTERRUPTED",
    }.get(reason, None if reason == "ALLOWED" else reason)
    return ActionReceipt(
        action_id=request.action_id if type(request) is ActionRequest and text(request.action_id) and not secret_shape(request.action_id) else "invalid-action",
        decision=Decision.ALLOW if reason == "ALLOWED" else Decision.DENY, reason_code=reason,
        action_kind=request.kind.value if type(request) is ActionRequest and type(request.kind) is ActionKind else "invalid",
        egress_fingerprint=egress_hash, blocked_code=blocked, request_sha256=request_hash,
        policy_sha256=digest({"version": "C10-v1", "paths": allowed_paths, "authority": authority}), **state)


def decide(allowed_paths, a, r, state):
    if a is None: return "POLICY_AUTHORITY_REQUIRED"
    required = {"tokens", "permission", "project_id", "environment_id", "provider_id", "purpose",
                "now", "lease_expires_at", "egress_fingerprints",
                "protected_paths",
                "canonical_paths", "grants", "impact", "blocked_code"}
    if not isinstance(a, Mapping) or not required.issubset(a): return "POLICY_AUTHORITY_INVALID"
    if type(a["now"]) is not int or type(a["lease_expires_at"]) is not int: return "POLICY_AUTHORITY_INVALID"
    if (not all(text(a[name]) for name in ("permission", "project_id", "environment_id",
                                          "provider_id", "purpose"))
            or not isinstance(a["tokens"], Mapping)
            or type(a["egress_fingerprints"]) is not tuple
            or not all(text(value) for value in a["egress_fingerprints"])
            or not isinstance(a["canonical_paths"], Mapping)
            or not isinstance(a["grants"], Mapping) or not isinstance(a["impact"], Mapping)
            or type(a["protected_paths"]) is not tuple
            or not all(safe_path(path) for path in a["protected_paths"])
            or (a["blocked_code"] is not None and not text(a["blocked_code"]))):
        return "POLICY_AUTHORITY_INVALID"
    if not all(valid_grant(permission, grant) for permission, grant in a["grants"].items()):
        return "POLICY_AUTHORITY_INVALID"
    if r.ingress_error or not text(r.action_id) or type(r.kind) is not ActionKind: return "INVALID_ACTION"
    if any(type(v) is not bool for v in (r.secret_read, r.destructive, r.metadata_access)): return "INVALID_ACTION"
    if not isinstance(r.arguments, Mapping): return "INVALID_ACTION"
    if r.secret_read or secret_shape((r.arguments, r.command, r.action_id, r.path)):
        state["risk"] = "prohibited"
        return "SECRET_READ_DENIED" if r.secret_read else "SECRET_INPUT_DENIED"
    if r.secret_ref is not None:
        if type(r.secret_ref) is not SecretRef:
            return "SECRET_REF_DENIED"
        references = a.get("secret_refs", {})
        expected_ref = references.get(r.secret_ref.secret_ref_id) if isinstance(references, Mapping) else None
        if (not isinstance(expected_ref, Mapping) or plain(r.secret_ref) != plain(expected_ref)
                or (r.secret_ref.project_id, r.secret_ref.environment_id,
                    r.secret_ref.provider_id, r.secret_ref.purpose) !=
                   (a["project_id"], a["environment_id"], a["provider_id"], a["purpose"])
                or r.secret_ref.status != "ACTIVE" or a["now"] >= r.secret_ref.expires_at):
            return "SECRET_REF_DENIED"
    if r.destructive:
        state["risk"] = "prohibited"
        return "DESTRUCTIVE_ACTION_DENIED"
    if not safe_path(r.path): return "INVALID_PATH"
    if protected(r.path, a["protected_paths"]):
        state["risk"] = "prohibited"
        return "PROTECTED_PATH_DENIED"
    if not inside(r.path, allowed_paths): return "PATH_NOT_ALLOWED"
    if type(r.tokens) is FencingTokens and isinstance(a["tokens"], Mapping):
        state["execution_token_valid"] = text(r.tokens.execution) and r.tokens.execution == a["tokens"].get("execution")
        state["write_token_valid"] = text(r.tokens.write) and r.tokens.write == a["tokens"].get("write")
    if a["now"] >= a["lease_expires_at"]: state["execution_token_valid"] = state["write_token_valid"] = False
    if not state["execution_token_valid"] or not state["write_token_valid"]: return "STALE_FENCING_TOKEN"
    # Legacy expected_tokens은 권위가 아니며 canonical 값과 일치해야 한다.
    if type(r.expected_tokens) is not FencingTokens or r.expected_tokens != r.tokens: return "STALE_FENCING_TOKEN"
    canonical = a["canonical_paths"].get(r.path)
    if canonical is None: return "CANONICAL_PATH_REQUIRED"
    if not safe_path(canonical): return "INVALID_PATH"
    if protected(canonical, a["protected_paths"]):
        state["risk"] = "prohibited"
        return "PROTECTED_PATH_DENIED"
    state["path"] = canonical
    if not inside(canonical, allowed_paths): return "PATH_NOT_ALLOWED"
    if a["blocked_code"] is not None:
        return a["blocked_code"] if a["blocked_code"] in BLOCKED_CODES else "POLICY_AUTHORITY_INVALID"
    if not text(r.permission) or r.permission != a["permission"]: return "PERMISSION_DENIED"
    grant = a["grants"].get(r.permission)
    if not isinstance(grant, Mapping): return "PERMISSION_DENIED"
    if r.kind.value not in grant.get("kinds", ()) or not inside(canonical, grant.get("paths")): return "PERMISSION_DENIED"
    if type(grant.get("expires_at")) is not int or a["now"] >= grant["expires_at"]: return "APPROVAL_EXPIRED"
    if r.kind is ActionKind.EXECUTE:
        if unsafe_command(r.command, a["protected_paths"]) or r.command not in grant.get("commands", ()):
            state["risk"] = "prohibited"
            return "UNSAFE_COMMAND_DENIED"
    elif r.command is not None: return "INVALID_ACTION"
    reason = egress_reason(r)
    if reason: return reason
    if r.egress.fingerprint not in a["egress_fingerprints"]: return "EGRESS_SNAPSHOT_DRIFT"
    impact = a["impact"].get(r.action_id)
    if not isinstance(impact, Mapping): return "IMPACT_EVIDENCE_REQUIRED"
    paths, flags = impact.get("changed_paths"), impact.get("flags")
    if (not isinstance(paths, tuple) or not paths or not all(safe_path(p) for p in paths)
            or not isinstance(flags, tuple) or not all(f in IMPACT_FLAGS for f in flags)):
        return "IMPACT_EVIDENCE_REQUIRED"
    if any(protected(path, a["protected_paths"]) for path in paths):
        state["risk"] = "prohibited"
        return "PROTECTED_PATH_DENIED"
    detected = set(flags)
    if len(set(paths)) > 5: detected.add("more_than_five_files")
    if any("/" not in p for p in paths): detected.add("global_configuration")
    state["risk_factors"] = tuple(sorted(detected))
    if detected:
        state["risk"] = "high"
        if "dirty_conflict" in detected: return "BASELINE_CONFLICT"
        if "plan_diff_mismatch" in detected: return "SCOPE_EXPANSION_REQUIRED"
        return "HIGH_RISK_APPROVAL_REQUIRED"
    if canonical not in paths: return "SCOPE_EXPANSION_REQUIRED"
    if any(not inside(p, allowed_paths) or not inside(p, grant["paths"]) for p in paths): return "PATH_NOT_ALLOWED"
    return "ALLOWED"
