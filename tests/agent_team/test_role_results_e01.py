"""E-01 role-specific results are proposals, never acceptance authority."""
import importlib.util
import copy
from dataclasses import replace
from datetime import timedelta
import pytest
from tests.agent_team.test_role_contracts_e01 import fixture, NOW, TARGET
from packages.orchestration.result_envelope import ResultEnvelope, ResultTest, EvidenceReference
from packages.execution.models import ResultStatus


def result_fixture(role="TESTER",mode="real",source=None,status="PASS",writable=False,**fixture_changes):
    from packages.agent_team import role_results as v
    _,policy,a,_,_=fixture(role,writable=writable,**fixture_changes)
    service=v.RoleResultService(policy)
    kind="diff_review" if role=="REVIEWER" else "independent_execution"
    capture=service.capture_evidence(assignment=a,evidence_id="ev1",kind=kind,
        source=source or ("independent_review" if role=="REVIEWER" else "independent_execution"),
        mode=mode,status=status,raw_hash="sha256:"+"d"*64,command="review diff" if role=="REVIEWER" else "pytest tests/test_x.py",
        exit_code=0 if status=="PASS" else 1,expected="requirements satisfied",observed="observed result",now=NOW)
    envelope=ResultEnvelope("subagent_result/v1","r1","d1","attempt1",1,"lineage1",ResultStatus.COMPLETED,TARGET,"verified",
        evidence_refs=(EvidenceReference("ev1","sha256:"+"d"*64),),
        tests=(ResultTest("review diff" if role=="REVIEWER" else "pytest tests/test_x.py","PASS",0),))
    result=v.RoleResult(a.definition.result_schema,a.assignment_id,a.content_hash,a.definition.role,a.actor_id,a.context_id,TARGET,
        envelope,"completed",(),None,(capture,))
    args=dict(assignment=a,actor_id=a.actor_id,session_id=a.session_id,context_id=a.context_id,target_hash=TARGET,
        execution_fence=a.execution_fence,now=NOW)
    return v,policy,service,a,capture,result,args


@pytest.mark.parametrize("role",["REVIEWER","TESTER"])
def test_role_results_are_validated_proposals_not_acceptance(role):
    _,p,s,a,e,result,args=result_fixture(role)
    receipt=s.validate(result,**args)
    assert receipt.valid and receipt.reason=="VALIDATED_PROPOSAL"
    assert not receipt.accepted and receipt.state_transitions==() and receipt.io_count==0
    assert s.validate(result,**args)==receipt


def test_role_schema_cross_submission_and_wrong_target_fail_closed():
    _,p,s,a,e,result,args=result_fixture()
    assert s.validate(replace(result,schema_version="reviewer_result/v1"),**args).reason=="ROLE_SCHEMA_MISMATCH"
    assert s.validate(replace(result,target_hash="sha256:"+"e"*64),**args).reason=="RESULT_BINDING_MISMATCH"


@pytest.mark.parametrize("mode",["mock","fixture","static","build"])
def test_nonruntime_evidence_cannot_claim_real_pass(mode):
    _,p,s,a,e,result,args=result_fixture(mode=mode)
    assert s.validate(result,**args).reason=="EVIDENCE_NOT_REAL"


@pytest.mark.parametrize("status",["SKIPPED","BLOCKED","NOT_EXECUTED","FAIL"])
def test_unexecuted_or_failed_evidence_cannot_be_promoted_to_pass(status):
    _,p,s,a,e,result,args=result_fixture(status=status)
    assert s.validate(result,**args).reason=="EVIDENCE_NOT_PASS"


def test_developer_report_requotation_is_not_independent_test_execution():
    _,p,s,a,e,result,args=result_fixture(source="developer_completion_report")
    assert s.validate(result,**args).reason=="INDEPENDENT_EVIDENCE_REQUIRED"


def test_forged_or_mutated_capture_is_never_authority():
    _,p,s,a,e,result,args=result_fixture()
    unknown=replace(result,evidence=(replace(e,evidence_id="unknown"),),
        envelope=replace(result.envelope,evidence_refs=(EvidenceReference("unknown",e.raw_hash),)))
    assert s.validate(unknown,**args).reason=="EVIDENCE_UNKNOWN"
    object.__setattr__(result.evidence[0],"raw_hash","sha256:"+"f"*64)
    assert s.validate(result,**args).reason=="EVIDENCE_TAMPERED"
    assert s.get_evidence("ev1").raw_hash=="sha256:"+"d"*64


def test_missing_evidence_raw_transcript_and_human_authority_are_rejected():
    _,p,s,a,e,result,args=result_fixture()
    assert s.validate(replace(result,evidence=()),**args).reason=="REQUIRED_EVIDENCE_MISSING"
    assert s.validate(replace(result,requested_actions=("approve",)),**args).reason=="RESERVED_AUTHORITY"
    assert s.validate({"role":"TESTER","decision":"completed"},**args).reason=="ROLE_RESULT_REQUIRED"


def test_evidence_context_expiry_and_result_replay_rechecked():
    _,p,s,a,e,result,args=result_fixture()
    assert s.validate(replace(result,context_id="developer-context"),**args).reason=="RESULT_BINDING_MISMATCH"
    assert s.validate(result,**{**args,"now":NOW+timedelta(hours=1)}).reason=="ASSIGNMENT_EXPIRED"
    assert s.validate(result,**args).valid
    forged=replace(result,envelope=replace(result.envelope,summary="changed"))
    assert s.validate(forged,**args).reason=="RESULT_REPLAY_CONFLICT"
    p.revoke(a.assignment_id)
    assert s.validate(result,**args).reason=="ASSIGNMENT_REVOKED"


def test_role_result_service_rejects_duck_typed_policy():
    from packages.agent_team.role_results import RoleResultService
    with pytest.raises(ValueError,match="HOST_AUTHORITY_REQUIRED"): RoleResultService(object())


def test_arbitrary_forced_nested_payload_fails_closed_without_exception():
    _,p,s,a,e,result,args=result_fixture()
    object.__setattr__(result,"envelope",object())
    assert not s.validate(result,**args).valid


def test_test_command_cannot_be_substituted_by_unrelated_pass_evidence():
    _,p,s,a,e,result,args=result_fixture()
    changed=replace(result,envelope=replace(result.envelope,tests=(ResultTest("unrelated smoke","PASS",0),)))
    assert s.validate(changed,**args).reason=="TEST_EVIDENCE_MISMATCH"


def test_evidence_checksum_and_future_capture_cannot_be_relabelled():
    _,p,s,a,e,result,args=result_fixture()
    changed=replace(result,envelope=replace(result.envelope,evidence_refs=(EvidenceReference("ev1","sha256:"+"f"*64),)))
    assert s.validate(changed,**args).reason=="EVIDENCE_BINDING_MISMATCH"
    future=s.capture_evidence(assignment=a,evidence_id="future",kind=e.kind,source=e.source,mode=e.mode,status=e.status,
        raw_hash=e.raw_hash,command=e.command,exit_code=e.exit_code,expected=e.expected,observed=e.observed,now=NOW+timedelta(minutes=1))
    changed=replace(result,evidence=(future,),envelope=replace(result.envelope,evidence_refs=(EvidenceReference("future",e.raw_hash),)))
    assert s.validate(changed,**args).reason=="EVIDENCE_TIME_INVALID"


def test_reviewer_changed_files_are_not_accepted_as_read_only_review():
    _,p,s,a,e,result,args=result_fixture("REVIEWER")
    assert s.validate(replace(result,envelope=replace(result.envelope,changed_paths=("tests/a.py",))),**args).reason=="ROLE_ACTION_DENIED"


def test_reviewer_findings_are_structured_and_bound_to_exact_evidence_scope():
    v,p,s,a,e,result,args=result_fixture("REVIEWER")
    assert hasattr(v,"ReviewFinding"), "reviewer-specific finding contract missing"
    finding=v.ReviewFinding("finding1","REQ-1","IMPORTANT","src/main.py","ev1","scope review observation")
    assert s.validate(replace(result,review_findings=(finding,)),**args).valid
    assert s.validate(replace(result,review_findings=(replace(finding,evidence_id="absent"),)),**args).reason=="FINDING_EVIDENCE_MISMATCH"
    assert s.validate(replace(result,review_findings=(replace(finding,path="outside/file.py"),)),**args).reason=="FINDING_SCOPE_MISMATCH"


def test_tester_cannot_submit_reviewer_payload():
    v,p,s,a,e,result,args=result_fixture()
    assert hasattr(v,"ReviewFinding"), "reviewer-specific finding contract missing"
    finding=v.ReviewFinding("finding1","REQ-1","IMPORTANT","src/main.py","ev1","observation")
    assert s.validate(replace(result,review_findings=(finding,)),**args).reason=="ROLE_SCHEMA_MISMATCH"


@pytest.mark.parametrize("path,reason",[("tests/outside.py","PATH_SCOPE_DENIED"),("tests/protected/file.py","PROTECTED_SCOPE")])
def test_completed_changed_paths_must_obey_effective_packet_not_broad_grant(path,reason):
    _,_,_,_,packet=fixture(writable=True)
    permission=replace(packet.permission_snapshot,allowed_paths=("tests/allowed/**",),protected_paths=(".git/**","tests/protected/**"))
    packet=replace(packet,permission_snapshot=permission,permission_snapshot_hash=permission.snapshot_hash,allowed_paths=permission.allowed_paths)
    _,policy,service,assignment,e,result,args=result_fixture(writable=True,packet=packet)
    changed=replace(result,envelope=replace(result.envelope,changed_paths=(path,)))
    assert service.validate(changed,**args).reason==reason


@pytest.mark.parametrize("actions,tools,allowed",[
    (("read",),("repo_read",),False),
    (("read",),("repo_read","test_write","test_patch"),False),
    (("write","patch"),("repo_read",),False),
    (("write",),("test_patch",),False),
    (("patch",),("test_write",),False),
    (("write",),("test_write",),True),
    (("patch",),("test_patch",),True),
])
def test_changed_paths_require_exact_effective_mutation_capability_without_action_side_effects(actions,tools,allowed):
    _,_,_,_,packet=fixture(writable=True)
    permission=replace(packet.permission_snapshot,allowed_actions=actions,allowed_tools=tools)
    packet=replace(packet,permission_snapshot=permission,permission_snapshot_hash=permission.snapshot_hash)
    _,policy,service,assignment,e,result,args=result_fixture(writable=True,packet=packet)
    before=copy.deepcopy((policy._spent,policy._requests,policy._audits))
    changed=replace(result,envelope=replace(result.envelope,changed_paths=("tests/a.py",)))
    receipt=service.validate(changed,**args)
    assert receipt.reason==("VALIDATED_PROPOSAL" if allowed else "ROLE_ACTION_DENIED")
    assert receipt.valid is allowed and receipt.io_count==0
    assert (policy._spent,policy._requests,policy._audits)==before
    assert service.validate(changed,**args)==receipt
    assert (policy._spent,policy._requests,policy._audits)==before


def test_e01_role_result_validation_is_available():
    assert importlib.util.find_spec("packages.agent_team.role_results") is not None, "role result contract missing"
