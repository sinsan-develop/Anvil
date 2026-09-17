"""PostgreSQL transaction adapter over B09 queue functions; never uses a worker clock.

Construction is a host trust boundary. This class neither creates an engine nor
runs migrations. A caller supplies its approved, isolated or production engine.
"""
from datetime import datetime, timezone
import json
from sqlalchemy import text
from packages.queue.dag import TaskGraph,DagNode,GraphError,jobs_for,graph_job_id,snapshot_graph
from packages.queue.models import QueueClaim


class PostgresDagQueue:
    def __init__(self,engine):self._engine=engine

    def register(self,graph,*,verified_inputs,max_attempts=3):
        graph=snapshot_graph(graph)
        # Validation only; timestamps below are assigned by PostgreSQL, not this placeholder.
        jobs=jobs_for(graph,now=datetime(1970,1,1,tzinfo=timezone.utc),verified_inputs=verified_inputs,max_attempts=max_attempts)
        data={'graph_id':graph.graph_id,'run_id':graph.run_id,'repository_id':graph.repository_id,
              'nodes':[{'step_id':n.step_id,'dependency_ids':list(n.dependency_ids),'conflict_groups':list(n.conflict_groups),
                        'independent':n.independent,'input_hash':n.input_hash} for n in graph.nodes]}
        payload=json.dumps(data,sort_keys=True,separators=(',',':'))
        with self._engine.begin() as c:
            c.execute(text('SELECT pg_advisory_xact_lock(17004001)'))
            previous=c.execute(text('SELECT job_id,graph_hash,payload,max_attempts FROM durable_queue_jobs WHERE graph_id=:g FOR UPDATE'),{'g':graph.graph_id}).mappings().all()
            if previous:
                if {r['job_id'] for r in previous}!={j.job_id for j in jobs} or any(r['graph_hash']!=graph.content_hash or r['payload']!=payload or r['max_attempts']!=max_attempts for r in previous):raise GraphError('GRAPH_REBIND')
                return graph.content_hash
            for job in jobs:
                c.execute(text('''INSERT INTO durable_queue_jobs(job_id,run_id,payload,max_attempts,available_at,graph_id,graph_hash,dependency_ids,conflict_keys,input_verified)
                  VALUES(:j,:r,:p,:m,CURRENT_TIMESTAMP,:g,:h,:d,:c,true)'''),
                  {'j':job.job_id,'r':job.run_id,'p':payload,'m':job.max_attempts,'g':job.graph_id,'h':job.graph_hash,'d':list(job.dependency_ids),'c':list(job.conflict_keys)})
        return graph.content_hash

    def claim(self,worker_id,*,visibility_seconds):
        if type(worker_id) is not str or not worker_id.strip() or type(visibility_seconds) is not int or visibility_seconds<=0:raise GraphError('QUEUE_CLAIM_INVALID')
        with self._engine.begin() as c:
            row=c.execute(text('SELECT * FROM anvil_queue_claim_next(:w,:ttl)'),{'w':worker_id,'ttl':visibility_seconds}).mappings().one()
            if row['job_id'] is None:return None
            return QueueClaim(row['job_id'],worker_id,row['lease_epoch'],row['execution_fencing_token'],row['lease_expires_at'])

    def complete(self,claim):
        with self._engine.begin() as c:
            c.execute(text('SELECT anvil_queue_complete(:j,:e,:t)'),{'j':claim.job_id,'e':claim.lease_epoch,'t':claim.execution_fencing_token})

    def fail(self,claim,*,reason):
        if type(reason) is not str or not reason:raise GraphError('QUEUE_FAILURE_REASON_REQUIRED')
        with self._engine.begin() as c:
            c.execute(text('SELECT anvil_queue_fail(:j,:e,:t,:r)'),{'j':claim.job_id,'e':claim.lease_epoch,'t':claim.execution_fencing_token,'r':reason})

    def heartbeat(self,claim,*,visibility_seconds):
        if type(visibility_seconds) is not int or visibility_seconds<=0:raise GraphError('QUEUE_CLAIM_INVALID')
        with self._engine.begin() as c:
            c.execute(text('SELECT anvil_queue_heartbeat(:j,:e,:t,:ttl)'),{'j':claim.job_id,'e':claim.lease_epoch,'t':claim.execution_fencing_token,'ttl':visibility_seconds})

    def project(self,graph_id):
        with self._engine.connect() as c:
            rows=c.execute(text('SELECT job_id,run_id,payload,graph_hash,status,attempts,dependency_ids,conflict_keys FROM durable_queue_jobs WHERE graph_id=:g ORDER BY job_id'),{'g':graph_id}).mappings().all()
        if not rows:raise KeyError(graph_id)
        try:
            data=json.loads(rows[0]['payload']);nodes=tuple(DagNode(n['step_id'],tuple(n['dependency_ids']),tuple(n['conflict_groups']),n['independent'],n['input_hash']) for n in data['nodes'])
            g=TaskGraph(data['graph_id'],data['run_id'],data['repository_id'],nodes)
            expected=jobs_for(g,now=datetime(1970,1,1,tzinfo=timezone.utc),verified_inputs={n.step_id:n.input_hash for n in g.nodes},max_attempts=1)
            by_id={r['job_id']:r for r in rows}
            if g.graph_id!=graph_id or set(by_id)!={j.job_id for j in expected}:raise GraphError('GRAPH_STORAGE_DRIFT')
            for job in expected:
                r=by_id[job.job_id]
                if r['payload']!=rows[0]['payload'] or r['run_id']!=g.run_id or r['graph_hash']!=g.content_hash or tuple(r['dependency_ids'])!=job.dependency_ids or tuple(r['conflict_keys'])!=job.conflict_keys:raise GraphError('GRAPH_STORAGE_DRIFT')
            projection=[]
            for n in g.nodes:
                r=by_id[graph_job_id(g,n.step_id)];status=r['status']
                if status=='PENDING' and any(by_id[d]['status']!='SUCCEEDED' for d in r['dependency_ids']):status='BLOCKED_DEPENDENCY'
                projection.append({'step_id':n.step_id,'dependencies':list(n.dependency_ids),'conflict_groups':list(n.conflict_groups),'status':status,'attempts':r['attempts']})
            return {'schema':'task_graph/v1','graph_id':g.graph_id,'run_id':g.run_id,'graph_hash':g.content_hash,'execution_mode':g.execution_mode,'nodes':projection,'worker_execution':'NOT_EXECUTED','delivery':'AT_LEAST_ONCE'}
        except (KeyError,TypeError,ValueError) as exc:raise GraphError('GRAPH_STORAGE_DRIFT') from exc
