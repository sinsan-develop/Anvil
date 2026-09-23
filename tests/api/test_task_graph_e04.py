import pytest
from packages.api.task_graph import TaskGraphAPI
from tests.queue.test_dag_e04 import service,node

def test_graph_api_read_only_bound_run():
    s,g=service([node('a')]);api=TaskGraphAPI(s,run_id='run')
    response=api.request('graph',{'graph_id':'graph'})
    assert response['status']==200 and response['body']['run_id']=='run'
    assert TaskGraphAPI(s,run_id='foreign').request('graph',{'graph_id':'graph'})['status']==403

@pytest.mark.parametrize('op,payload',[('claim',{}),('complete',{}),('graph',{'graph_id':'../escape'}),('graph',{'graph_id':'graph','authority':True}),('graph',[])])
def test_api_rejects_mutation_or_untrusted_shape(op,payload):
    s,g=service([node('a')]);assert TaskGraphAPI(s,run_id='run').request(op,payload)['status'] in (400,403,404)
