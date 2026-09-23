from datetime import timedelta
import pytest
from packages.agent_team import provider_catalog as pc
from packages.provider_catalog import ProviderCatalog
from tests.model_registry.test_model_registry_f02 import owner_ready,NOW as OWNER_NOW,H
NOW=OWNER_NOW+timedelta(seconds=1)


def ready(fallback=False):
    assert hasattr(pc,'CapabilityCatalog'), 'C24 read-only catalog missing'
    discovery,owner,ctx,ref,binding=owner_ready(fallback)
    providers=ProviderCatalog(project_id='project',environment_id='local',broker_policy_hash=H)
    catalog=pc.CapabilityCatalog(providers,discovery)
    capture=catalog.capture('catalog',now=NOW)
    return catalog,capture,discovery,owner,ctx


def test_catalog_uses_f01_f02_current_immutable_provenance_without_mutation():
    catalog,capture,d,owner,ctx=ready()
    before=owner.query(ctx,now=NOW)
    value=catalog.current(capture,now=NOW).to_dict()
    assert value['models'][0]['data']['provider']=='openai' and value['io_count']==0
    assert value['provider_catalog_hash'] and value['model_catalog_hash']
    assert owner.query(ctx,now=NOW)==before and d.audit().to_dict()['events']==[]


def test_current_rejects_catalog_model_drift_and_staleness():
    from tests.knowledge.test_model_registry_d11 import model_data
    catalog,capture,d,_,_=ready()
    d.discover(model_data(version=2,region='other'),now=NOW+timedelta(seconds=1))
    with pytest.raises(ValueError,match='CATALOG_DRIFT'):catalog.current(capture,now=NOW+timedelta(seconds=1))
    catalog,capture,_,_,_=ready()
    with pytest.raises(ValueError,match='CATALOG_STALE'):catalog.current(capture,now=NOW+timedelta(hours=2))


def test_forged_or_alias_mutated_catalog_handle_is_not_authority():
    catalog,capture,_,_,_=ready();old=capture.payload_json
    object.__setattr__(capture,'payload_json','{}')
    with pytest.raises(ValueError,match='HANDLE_INVALID'):catalog.current(capture,now=NOW)
    assert catalog.capture('catalog',now=NOW).payload_json==old
