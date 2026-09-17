"""Bounded callback-free values for the E10 host contract (no filesystem IO)."""
from dataclasses import dataclass
from datetime import datetime, timezone
import re
import unicodedata
from urllib.parse import unquote_plus
from packages.orchestration.result_envelope import canonical_hash


class GitRejected(ValueError):
    pass


def reject(code):
    raise GitRejected(code)


def plain(value, depth=0, budget=None):
    if budget is None: budget = [16000, 262144]
    budget[0] -= 1
    if depth > 10 or budget[0] < 0: reject('INPUT_BOUND_EXCEEDED')
    kind = type(value)
    if kind is str:
        budget[1] -= len(value.encode('utf-8'))
        if len(value) > 8192 or budget[1] < 0: reject('INPUT_BOUND_EXCEEDED')
        inspected = value
        for _ in range(8):
            normalized = unicodedata.normalize('NFKC', inspected)
            normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Cf')
            decoded = unquote_plus(normalized)
            if decoded == inspected: break
            inspected = decoded
        else: reject('SENSITIVE_INPUT')
        if re.search(r'(?i)(?:api[\s_-]?key|access[\s_-]?token|token|password|secret)\s*[:=]\s*\S+'
                     r'|\bauthorization\s*:\s*\S+|-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----|://[^/\s]*@', inspected):
            reject('SENSITIVE_INPUT')
        return value
    if value is None or kind is bool: return value
    if kind is int and abs(value) <= 2**53: return value
    if kind in (tuple, list) and len(value) <= 1024:
        return [plain(v, depth+1, budget) for v in value]
    if kind is dict and len(value) <= 1024 and all(type(k) is str for k in value):
        return {plain(k, depth+1, budget): plain(v, depth+1, budget) for k, v in value.items()}
    reject('INVALID_BUILTIN_INPUT')


def text(value):
    return type(value) is str and value == value.strip() and bool(value)


def identifier(value):
    return type(value) is str and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', value) is not None


def sha(value):
    return type(value) is str and re.fullmatch(r'sha256:[0-9a-f]{64}', value) is not None


def commit(value):
    return type(value) is str and re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', value) is not None


def utc(value):
    if type(value) is not str: reject('UTC_TIME_REQUIRED')
    try: parsed = datetime.fromisoformat(value)
    except ValueError: reject('UTC_TIME_REQUIRED')
    if parsed.tzinfo is not timezone.utc: reject('UTC_TIME_REQUIRED')
    return parsed


def path(value):
    if type(value) is not str or re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*', value) is None:
        reject('PATH_ALIAS_DENIED')
    for part in value.split('/'):
        stem = part.split('.')[0].casefold()
        if part in ('.', '..') or part.endswith('.') or stem in {'con', 'nul', 'prn', 'aux', *(f'com{i}' for i in range(10)), *(f'lpt{i}' for i in range(10))}:
            reject('PATH_ALIAS_DENIED')
    return value.casefold()


def ref(value):
    identity = path(value)
    if (identity == 'refs' or identity.startswith('refs/')
            or any(p.startswith('.') or p.endswith('.lock') for p in identity.split('/'))
            or '..' in identity or value.startswith('-') or identity == 'head'):
        reject('REF_ALIAS_DENIED')
    return identity


def overlaps(a, b):
    a, b = path(a), path(b)
    return a == b or a.startswith(b+'/') or b.startswith(a+'/')


def paths(values):
    if type(values) is not list: reject('PATH_INVENTORY_REQUIRED')
    identities = [path(v) for v in values]
    if len(set(identities)) != len(identities): reject('PATH_ALIAS_DENIED')
    return values


SNAPSHOT_FIELDS = {'repository_id', 'workspace_id', 'physical_identity', 'head', 'branch', 'refs',
    'tracked', 'untracked', 'index', 'owned_changes', 'user_paths', 'protected_paths', 'protected_branches',
    'remote_id', 'revision', 'execution_fence', 'write_fence', 'merge_conflicts', 'related_history'}
REQUEST_FIELDS = {'request_id', 'operation', 'repository_id', 'workspace_id', 'baseline', 'source_ref',
    'source_commit', 'target_ref', 'target_commit', 'target_hash', 'delivered_hash', 'allowed_paths', 'changes',
    'diff_hash', 'expected_commit', 'expected_tree', 'message', 'remote_id', 'metadata'}


def snapshot(value):
    data = plain(value)
    if type(data) is not dict or set(data) != SNAPSHOT_FIELDS: reject('SNAPSHOT_INVALID')
    if any(not identifier(data[k]) for k in ('repository_id', 'workspace_id', 'remote_id', 'execution_fence', 'write_fence')): reject('SNAPSHOT_INVALID')
    if not sha(data['physical_identity']) or not commit(data['head']) or type(data['revision']) is not int or data['revision'] < 1: reject('SNAPSHOT_INVALID')
    ref(data['branch'])
    if type(data['refs']) is not dict or not data['refs']: reject('REFS_REQUIRED')
    identities = [ref(k) for k in data['refs']]
    if len(set(identities)) != len(identities) or any(not commit(v) for v in data['refs'].values()): reject('REF_ALIAS_DENIED')
    if data['refs'].get(data['branch']) != data['head']: reject('BRANCH_HEAD_MISMATCH')
    for name in ('tracked', 'untracked', 'index', 'owned_changes'):
        rows = data[name]
        if type(rows) is not dict or any(not sha(v) for v in rows.values()): reject('STATUS_MANIFEST_INVALID')
        paths(list(rows))
    for name in ('user_paths', 'protected_paths', 'merge_conflicts'): paths(data[name])
    if type(data['protected_branches']) is not list: reject('SNAPSHOT_INVALID')
    for name in data['protected_branches']: ref(name)
    if type(data['related_history']) is not bool: reject('SNAPSHOT_INVALID')
    return data


def request(value):
    data = plain(value)
    if type(data) is not dict: reject('REQUEST_INVALID')
    if 'argv' in data or 'shell' in data or 'environment' in data: reject('FORBIDDEN_COMMAND')
    if data.get('operation') not in ('BRANCH', 'COMMIT', 'MERGE', 'PR'): reject('FORBIDDEN_OPERATION')
    if set(data) != REQUEST_FIELDS: reject('REQUEST_INVALID')
    if any(not identifier(data[k]) for k in ('request_id', 'repository_id', 'workspace_id', 'remote_id')): reject('REQUEST_INVALID')
    for k in ('baseline', 'source_commit', 'target_commit', 'expected_commit', 'expected_tree'):
        if not commit(data[k]): reject('COMMIT_ID_INVALID')
    if data['operation'] in ('COMMIT', 'MERGE') and data['expected_commit'] in {data['baseline'], data['source_commit'], data['target_commit']}:
        reject('IMPOSSIBLE_COMMIT_IDENTITY')
    for k in ('source_ref', 'target_ref'): ref(data[k])
    if not sha(data['target_hash']) or data['target_hash'] != data['delivered_hash']: reject('DELIVERED_HASH_MISMATCH')
    if not sha(data['diff_hash']) or type(data['changes']) is not dict or any(not sha(v) for v in data['changes'].values()): reject('DIFF_HASH_MISMATCH')
    paths(data['allowed_paths']); paths(list(data['changes']))
    if not data['allowed_paths'] or canonical_hash(data['changes']) != data['diff_hash']: reject('DIFF_HASH_MISMATCH')
    if not text(data['message']) or any(c in data['message'] for c in '\r\n\x00;$`|&'): reject('SHELL_INPUT_DENIED')
    meta = data['metadata']
    if type(meta) is not dict or set(meta) != {'purpose', 'impact', 'validation', 'unverified', 'rollback'} or any(not text(v) for v in meta.values()): reject('PR_METADATA_REQUIRED')
    return data


@dataclass(frozen=True, slots=True)
class GitGrant:
    grant_id: str
    content_hash: str
