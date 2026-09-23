import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
S=importlib.util.spec_from_file_location("c30r5_final_overlay",ROOT/"scripts/c30r5_final_overlay.py"); O=importlib.util.module_from_spec(S); S.loader.exec_module(O)
def test_c30r5_final_exact15():
    assert len(O.paths())==len(set(O.paths()))==15
    assert set(O.paths())-set(O.controls())=={O.PRODUCT}
def test_c30r5_final_bindings():
    assert O.WI2H=="B14F3A0A253F5BE74194F2B4BC38483E855B62B0C7070D6614F061D19234B000"
    assert O.PRODUCTH=="02C99791E43DBFFEEECA823A6725EBE32C17BFDDCA8B347FF510F4A094855E3E"

def test_c30r5_final_accepts_exact_broker_merge_state():
    validator=getattr(O,"validate_broker_integration_facts",None)
    assert validator is not None,"broker integration validator is missing"
    assert validator(
        head="broker-merge",branch=O.BRANCH,upstream=O.UPSTREAM,remote=O.RECONCILED,
        staged=set(),dirty=set(),head_parents=[O.RECONCILED,O.BROKER_MAIN],
        merge_paths=set(O.BROKER_PATHS),correction_paths=None,
    )==[]

def test_c30r5_final_accepts_exact_broker_gate_correction_state():
    validator=getattr(O,"validate_broker_integration_facts",None)
    assert validator is not None,"broker integration validator is missing"
    assert validator(
        head="new-head",branch=O.BRANCH,upstream=O.UPSTREAM,remote="new-head",
        staged=set(),dirty=set(),head_parents=["broker-merge"],
        merge_parent_parents=[O.RECONCILED,O.BROKER_MAIN],
        merge_paths=set(O.BROKER_PATHS),
        correction_paths=set(O.BROKER_GATE_CORRECTION_PATHS),
    )==[]

def test_c30r5_final_accepts_exact_uncommitted_broker_gate_correction():
    validator=O.validate_broker_integration_facts
    assert validator(
        head="broker-merge",branch=O.BRANCH,upstream=O.UPSTREAM,remote=O.RECONCILED,
        staged=set(),dirty=set(O.BROKER_GATE_CORRECTION_PATHS),
        head_parents=[O.RECONCILED,O.BROKER_MAIN],
        merge_paths=set(O.BROKER_PATHS),correction_paths=None,
    )==[]

def test_c30r5_final_selects_gate_events_before_two_reconciliations():
    selector=getattr(O,"select_final_gate_events",None)
    assert selector is not None,"final gate event selector is missing"
    events=[{"sequence":seq} for seq in range(1349,1359)]
    assert [row["sequence"] for row in selector(events,1358)]==list(range(1350,1357))
