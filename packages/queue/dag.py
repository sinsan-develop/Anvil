"""Host-owned DAG publication over the existing B09 queue, not a worker launcher."""
from dataclasses import dataclass
from datetime import datetime
from threading import RLock
import re

from packages.agent_team.collaboration import DependencyGraph, canonical_hash
from .models import QueueJob, QueueStatus
from .service import DurableQueue, QueueTokenError


class GraphError(ValueError):
    pass


def _identity(value):
    if type(value) is not str or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}', value):
        raise GraphError('GRAPH_IDENTITY_INVALID')


@dataclass(frozen=True, slots=True)
class DagNode:
    step_id: str
    dependency_ids: tuple[str, ...]
    conflict_groups: tuple[str, ...]
    independent: bool
    input_hash: str

    def __post_init__(self):
        _identity(self.step_id)
        for values in (self.dependency_ids,self.conflict_groups):
            if type(values) is not tuple or len(values)!=len(set(values)):raise GraphError('GRAPH_MEMBERS_INVALID')
            for value in values:_identity(value)
        if type(self.independent) is not bool:raise GraphError('GRAPH_INDEPENDENCE_INVALID')
        if type(self.input_hash) is not str or not re.fullmatch('sha256:[0-9a-f]{64}',self.input_hash):raise GraphError('INPUT_HASH_INVALID')
        object.__setattr__(self,'dependency_ids',tuple(sorted(self.dependency_ids)))
        object.__setattr__(self,'conflict_groups',tuple(sorted(set(x.casefold() for x in self.conflict_groups))))


@dataclass(frozen=True, slots=True)
class TaskGraph:
    graph_id: str
    run_id: str
    repository_id: str
    nodes: tuple[DagNode, ...]

    def __post_init__(self):
        for value in (self.graph_id,self.run_id,self.repository_id):_identity(value)
        if type(self.nodes) is not tuple or not self.nodes or any(type(n) is not DagNode for n in self.nodes):raise GraphError('GRAPH_NODES_INVALID')
        identities={n.step_id for n in self.nodes}
        if len(identities)!=len(self.nodes) or any(set(n.dependency_ids)-identities for n in self.nodes):raise GraphError('GRAPH_DEPENDENCY_INVALID')
        try:DependencyGraph(tuple((n.step_id,n.dependency_ids) for n in self.nodes))
        except ValueError as exc:raise GraphError('GRAPH_CYCLE') from exc
        object.__setattr__(self,'nodes',tuple(sorted(self.nodes,key=lambda n:n.step_id)))

    @property
    def content_hash(self):return canonical_hash(self)

    @property
    def execution_mode(self):
        if any(not n.independent for n in self.nodes):return 'SINGLE_WORKER'
        ancestors={n.step_id:set(n.dependency_ids) for n in self.nodes}
        for _ in self.nodes:
            for key in ancestors:ancestors[key].update(*(ancestors[x] for x in tuple(ancestors[key])))
        pairs=[(a,b) for a in self.nodes for b in self.nodes if a.step_id<b.step_id]
        independent=any(a.step_id not in ancestors[b.step_id] and b.step_id not in ancestors[a.step_id]
                        and not set(a.conflict_groups)&set(b.conflict_groups) for a,b in pairs)
        return 'INDEPENDENT_READY' if independent else 'SINGLE_WORKER'


def graph_job_id(graph, step_id):
    return 'dag-'+canonical_hash([graph.run_id,graph.graph_id,step_id])[7:]


def snapshot_graph(graph):
    if type(graph) is not TaskGraph:raise GraphError('GRAPH_TYPE_INVALID')
    return TaskGraph(graph.graph_id,graph.run_id,graph.repository_id,tuple(DagNode(n.step_id,n.dependency_ids,n.conflict_groups,n.independent,n.input_hash) for n in graph.nodes))


def jobs_for(graph, *, now, verified_inputs, max_attempts):
    # Reconstruct at the public boundary: forced dataclass mutation cannot bypass validation.
    checked=snapshot_graph(graph)
    if type(max_attempts) is not int or max_attempts<1:raise GraphError('GRAPH_RETRY_BUDGET_INVALID')
    if verified_inputs!={n.step_id:n.input_hash for n in checked.nodes}:raise GraphError('INPUT_HASH_MISMATCH')
    return tuple(QueueJob(graph_job_id(checked,n.step_id),checked.run_id,n.step_id,now,max_attempts,
        graph_id=checked.graph_id,graph_hash=checked.content_hash,
        dependency_ids=tuple(graph_job_id(checked,d) for d in n.dependency_ids),
        conflict_keys=tuple(sorted([checked.repository_id.casefold()+':group:'+g for g in n.conflict_groups]
                       +(['graph:'+checked.run_id+':'+checked.graph_id] if checked.execution_mode=='SINGLE_WORKER' else [])))) for n in checked.nodes)


class DagQueueService:
    def __init__(self, queue):
        if type(queue) is not DurableQueue:raise GraphError('QUEUE_OWNER_REQUIRED')
        self._queue=queue;self._graphs={};self._lock=RLock()

    job_id=staticmethod(graph_job_id)

    def register(self, graph, *, now, verified_inputs, max_attempts=3):
        graph=snapshot_graph(graph)
        jobs=jobs_for(graph,now=now,verified_inputs=verified_inputs,max_attempts=max_attempts)
        with self._lock:
            previous=self._graphs.get(graph.graph_id)
            if previous:
                if previous.content_hash!=graph.content_hash or any(self._queue.get(j.job_id).max_attempts!=max_attempts for j in jobs):raise GraphError('GRAPH_REBIND')
                return previous.content_hash
            self._queue.enqueue_many(jobs)
            # Detached immutable publication (caller-forced mutation cannot edit canonical graph).
            self._graphs[graph.graph_id]=graph
            return graph.content_hash

    def claim(self, worker_id, *, now, visibility_timeout):
        return self._queue.claim(worker_id,now,visibility_timeout=visibility_timeout)

    def complete(self, claim, *, now):
        with self._lock:
            if self._queue.get(claim.job_id).lease_epoch!=claim.lease_epoch:raise QueueTokenError('STALE_FENCING_TOKEN')
            return self._queue.complete(claim.job_id,claim.execution_fencing_token,now)

    def fail(self, claim, *, now, reason):
        with self._lock:
            if self._queue.get(claim.job_id).lease_epoch!=claim.lease_epoch:raise QueueTokenError('STALE_FENCING_TOKEN')
            return self._queue.fail(claim.job_id,claim.execution_fencing_token,now,reason)

    def project(self, graph_id):
        with self._lock:
            graph=self._graphs[graph_id];nodes=[]
            for node in graph.nodes:
                job=self._queue.get(graph_job_id(graph,node.step_id));status=job.status.value
                if job.status is QueueStatus.PENDING and any(self._queue.get(d).status is not QueueStatus.SUCCEEDED for d in job.dependency_ids):status='BLOCKED_DEPENDENCY'
                nodes.append({'step_id':node.step_id,'dependencies':list(node.dependency_ids),'conflict_groups':list(node.conflict_groups),'status':status,'attempts':job.attempts})
            return {'schema':'task_graph/v1','graph_id':graph.graph_id,'run_id':graph.run_id,'graph_hash':graph.content_hash,'execution_mode':graph.execution_mode,'nodes':nodes,'worker_execution':'NOT_EXECUTED','delivery':'AT_LEAST_ONCE'}
