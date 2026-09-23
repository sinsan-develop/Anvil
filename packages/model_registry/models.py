"""F02 callback-free intake and detached value projections."""
from datetime import datetime, timezone
import re
from packages.provider_catalog.models import (Snapshot, canonical, digest, ident, provider, snapshot)
from packages.git_adapter.models import plain as clean


class RoutingRejected(ValueError):
    pass


def reject(reason): raise RoutingRejected(reason)


def utc(value):
    if type(value) is not datetime or value.tzinfo is not timezone.utc: reject('UTC_TIMESTAMP_REQUIRED')
    return datetime(value.year,value.month,value.day,value.hour,value.minute,value.second,value.microsecond,tzinfo=timezone.utc)


def run_ref(value):
    data=clean(value)
    if type(data) is not dict or set(data)!={'session_id','task_id','run_id','snapshot_id','content_hash'}: reject('RUN_REFERENCE_INVALID')
    for key in ('session_id','task_id','run_id','snapshot_id'): ident(data[key])
    if type(data['content_hash']) is not str or re.fullmatch(r'[0-9a-f]{64}',data['content_hash']) is None: reject('RUN_REFERENCE_INVALID')
    return data


def contracts(value):
    data=clean(value)
    if type(data) is not dict or set(data)!={'task_graph_hash','permission_hash','evidence_hash','resume_hash','baseline_hash'}: reject('CONTRACT_REQUIRED')
    if any(type(v) is not str or re.fullmatch(r'sha256:[0-9a-f]{64}',v) is None for v in data.values()): reject('CONTRACT_REQUIRED')
    return data
