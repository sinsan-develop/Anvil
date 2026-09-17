"""Read-only framework-neutral graph projection; no HTTP wiring or worker execution."""
from packages.queue.dag import DagQueueService


class TaskGraphAPI:
    def __init__(self, service, *, run_id):
        from packages.persistence.dag_queue_repository import PostgresDagQueue
        if type(service) not in (DagQueueService,PostgresDagQueue) or type(run_id) is not str or not run_id:
            raise ValueError('HOST_GRAPH_AUTHORITY_REQUIRED')
        self._service=service;self._run_id=run_id

    def request(self, operation, payload):
        if operation!='graph' or type(payload) is not dict or set(payload)!={'graph_id'} or type(payload['graph_id']) is not str:
            return {'status':400,'body':{'reason':'GRAPH_REQUEST_DENIED'}}
        try:result=self._service.project(payload['graph_id'])
        except (KeyError,ValueError):return {'status':404,'body':{'reason':'GRAPH_NOT_FOUND'}}
        if result['run_id']!=self._run_id:return {'status':403,'body':{'reason':'GRAPH_SCOPE_DENIED'}}
        return {'status':200,'body':result}
