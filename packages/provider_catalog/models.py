"""Value-only F01 contracts; the canonical egress/SecretRef DTO owners are reused."""
from dataclasses import dataclass
import hashlib
import json
import re
from packages.git_adapter.models import plain as _plain, path as _path
from packages.action_policy.admission import secret_shape
from packages.action_policy.policy import SecretRef
from packages.orchestration.delegation import DataEgressProfile

PROVIDER_IDS = ('cerebras','groq','mistral','openrouter','upstage','gemini','anthropic','openai','ollama')


class CatalogRejected(ValueError):
    """Only stable codes, never rejected source values."""


def fail(code):
    raise CatalogRejected(code)


def clean(value):
    try:
        data = _plain(value)
    except ValueError:
        fail('INPUT_INVALID_OR_SENSITIVE')
    if secret_shape(data): fail('INPUT_INVALID_OR_SENSITIVE')
    return data


def ident(value):
    clean(value)
    if type(value) is not str or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', value) is None:
        fail('IDENTIFIER_INVALID')
    return value


def provider(value):
    if type(value) is not str or value not in PROVIDER_IDS: fail('PROVIDER_ID_INVALID')
    return value


def timestamp(value):
    if type(value) is not int or not 0 <= value <= 2**53: fail('TIME_INVALID')
    return value


def canonical(data):
    return json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False)


def digest(data):
    return 'sha256:'+hashlib.sha256(canonical(data).encode()).hexdigest()


def path(value):
    try: return _path(value)
    except ValueError: fail('PATH_INVALID')


def scope(value):
    if type(value) is not str: fail('PATH_INVALID')
    if value=='**': return value
    return path(value[:-3])+'/**' if value.endswith('/**') else path(value)


def covers(pattern,value):
    return pattern=='**' or pattern==value or pattern.endswith('/**') and (value==pattern[:-3] or value.startswith(pattern[:-2]))


@dataclass(frozen=True,slots=True)
class Snapshot:
    kind: str
    record_id: str
    content_hash: str
    payload_json: str

    def to_dict(self):
        return json.loads(self.payload_json)


def snapshot(kind,record_id,data):
    return Snapshot(kind,record_id,digest(data),canonical(data))
