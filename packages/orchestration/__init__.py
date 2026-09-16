"""Minimal Main Agent kernel for one budgeted model/action/observation step."""

from packages.planning.service import PlanningMainAuthorityService, MainAuthorityRecord, MainAuthoritySource, MainAuthorityStatus

from .kernel import BudgetDenied, BudgetUsageEvent, MainAgentKernel, StepBudget, StepResult
from .native_agent_adapter import NativeCodingAgentAdapter
from .delegation import (
    DataEgressProfile, DataEgressSnapshot, DelegationPacket,
    DelegationValidationReceipt, PacketValidationResult,
    PermissionProfileSnapshot, PermissionSnapshot, ValidationReceipt, validate_packet,
)
from .developer_lifecycle import (
    DeveloperLifecycleService, DeveloperRunner, DeveloperSession,
    DeterministicFakeDeveloperRunner, InvalidLifecycleTransition, LifecycleError,
    LifecycleTargetMismatch, LifecycleVersionMismatch,
    LifecycleStatus, PacketRejected, RawResult, RawResultArtifact, RawResultEnvelope,
    ReadOnlyDeveloperRunner, ReadOnlyPolicy, ReadOnlyPolicyRejected,
    CheckpointHandoff, LifecycleProjection, ResultHandoffProjection,
    WorkbenchProjection, ResumeRejected,
)
from .result_envelope import (
    EvidenceReference, ResultDomainReasonCode, ResultEnvelope, ResultReasonCode, ResultTest,
    ResultValidationResult, canonical_hash, canonical_json, validate_result,
)
from .failure_report import (
    FailureReportReasonCode, FailureReportValidationResult,
    compute_failure_fingerprint, validate_failure_report,
)
from .outcome_resolver import (
    DelegationOutcomeResolver, DelegationProjection, LeaseProjection,
    OutcomeResolutionContext, ResolutionReceipt, ResolverEvent,
    ResolverReasonCode, ResolverRejectionEvent, ResolverSnapshot,
    RunProjection, StepAttemptProjection, StepProjection, StepState,
)
from .failure_ledger import (
    FailureLedger, FailureLedgerEntry, FailureLedgerProjection,
    FailureLedgerReasonCode, FailureLedgerReceipt,
)
from .takeover import (
    MainAgentTakeoverService, TakeoverArtifactReference, TakeoverAudit,
    SealedTakeoverEvidence, TakeoverEvidenceAuthority,
    TakeoverEvidenceExpectation, TakeoverEvidenceRegistry,
    TakeoverPacket, TakeoverReasonCode, TakeoverReceipt,
    TakeoverReferenceBundle, TakeoverService,
)
from packages.planning.planner import (
    ExecutionPlan, ExecutionStep, PlannerError, RequestAnalysis, ScheduleDecision,
    MainResponsibility, MainAuthoritySnapshot, ScopeApprovalRequest, build_execution_plan,
    StepKind, analyze_request, generate_work_instruction, schedule_ready_steps,
)

__all__ = [
    "PlanningMainAuthorityService", "MainAuthorityRecord", "MainAuthoritySource", "MainAuthorityStatus",
    "BudgetDenied", "BudgetUsageEvent", "MainAgentKernel", "StepBudget", "StepResult",
    "NativeCodingAgentAdapter",
    "DataEgressProfile", "DataEgressSnapshot", "PermissionSnapshot",
    "PermissionProfileSnapshot", "DelegationPacket", "PacketValidationResult",
    "DelegationValidationReceipt", "ValidationReceipt", "validate_packet",
    "DeveloperLifecycleService", "DeveloperRunner", "DeveloperSession",
    "DeterministicFakeDeveloperRunner", "InvalidLifecycleTransition", "LifecycleError",
    "LifecycleTargetMismatch", "LifecycleVersionMismatch",
    "LifecycleStatus", "PacketRejected", "RawResult", "RawResultArtifact", "RawResultEnvelope",
    "ReadOnlyDeveloperRunner", "ReadOnlyPolicy", "ReadOnlyPolicyRejected",
    "CheckpointHandoff", "LifecycleProjection", "ResultHandoffProjection",
    "WorkbenchProjection", "ResumeRejected",
    "EvidenceReference", "ResultDomainReasonCode", "ResultEnvelope", "ResultReasonCode", "ResultTest",
    "ResultValidationResult", "canonical_hash", "canonical_json", "validate_result",
    "FailureReportReasonCode", "FailureReportValidationResult",
    "compute_failure_fingerprint", "validate_failure_report",
    "DelegationOutcomeResolver", "DelegationProjection", "LeaseProjection",
    "OutcomeResolutionContext", "ResolutionReceipt", "ResolverEvent",
    "ResolverReasonCode", "ResolverRejectionEvent", "ResolverSnapshot",
    "RunProjection", "StepAttemptProjection", "StepProjection", "StepState",
    "FailureLedger", "FailureLedgerEntry", "FailureLedgerProjection",
    "FailureLedgerReasonCode", "FailureLedgerReceipt",
    "MainAgentTakeoverService", "TakeoverArtifactReference", "TakeoverAudit",
    "SealedTakeoverEvidence", "TakeoverEvidenceAuthority",
    "TakeoverEvidenceExpectation", "TakeoverEvidenceRegistry",
    "TakeoverPacket", "TakeoverReasonCode", "TakeoverReceipt",
    "TakeoverReferenceBundle", "TakeoverService",
    "ExecutionPlan", "ExecutionStep", "PlannerError", "RequestAnalysis",
    "MainResponsibility", "MainAuthoritySnapshot", "ScopeApprovalRequest", "build_execution_plan",
    "ScheduleDecision", "StepKind", "analyze_request", "generate_work_instruction",
    "schedule_ready_steps",
]
