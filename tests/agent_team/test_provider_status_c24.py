from datetime import timedelta
import pytest
from packages.agent_team import provider_status as ps
from tests.agent_team.test_provider_catalog_c24 import ready,NOW,H


def test_unknown_quota_is_never_estimated_or_eligible():
    assert hasattr(ps,'QuotaObservations'),'C24 quota observations missing'
    q=ps.QuotaObservations();value=q.status('openai','model-a',catalog_hash=H,now=NOW).to_dict()
    assert value['display']=='Quota not reported' and value['remaining_requests'] is None and not value['eligible']


def test_exact_host_quota_expiry_catalog_binding_and_detached_snapshot():
    assert hasattr(ps,'QuotaObservations'),'C24 quota observations missing'
    q=ps.QuotaObservations();receipt=q.observe('q1',provider_id='openai',model_id='model-a',catalog_hash=H,
        remaining_requests=3,evidence_hash=H,now=NOW,expires_at=NOW+timedelta(seconds=2))
    object.__setattr__(receipt,'payload_json','{}')
    assert q.status('openai','model-a',catalog_hash=H,now=NOW).to_dict()['remaining_requests']==3
    assert not q.status('openai','model-a',catalog_hash='sha256:'+'c'*64,now=NOW).to_dict()['eligible']
    assert not q.status('openai','model-a',catalog_hash=H,now=NOW+timedelta(seconds=2)).to_dict()['eligible']
