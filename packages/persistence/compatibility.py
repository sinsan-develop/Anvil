"""Fail-closed PostgreSQL capability evaluation."""
from dataclasses import dataclass
class CompatibilityError(RuntimeError): pass
@dataclass(frozen=True, slots=True)
class CompatibilityProfile:
    major: int
    extensions: frozenset[str]
def evaluate_server(server_version_num: int, extensions: set[str]) -> CompatibilityProfile:
    if type(server_version_num) is not int: raise CompatibilityError("invalid server version")
    major = server_version_num // 10000
    if major not in {15, 18}: raise CompatibilityError("unsupported PostgreSQL major")
    if "plpgsql" not in extensions: raise CompatibilityError("required extension missing")
    return CompatibilityProfile(major, frozenset(extensions))
