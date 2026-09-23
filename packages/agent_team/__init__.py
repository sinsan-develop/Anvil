"""Durable collaboration primitives for Anvil Agent Teams."""

from .role_contracts import (
    AgentDefinition, BudgetLimits, RoleAssignment, RoleDecision,
    RolePolicyService, TestWriteGrant, TestWriteLease, RoleContract, CodeWriteLease,
)
from .role_results import ReviewFinding, RoleEvidence, RoleResult, RoleResultReceipt, RoleResultService, RoleEnvelope
from .handoff import ArtifactRef, SourceRef, RoleHandoff, RoleHandoffService, HandoffError

from .models import (
    ConversationRole,
    ConversationTurn,
    DecisionRequest,
    Mailbox,
    RequestState,
    RequestStatus,
    RevisionRequest,
    TeamDeliveryState,
    TeamMailbox,
    TeamMessage,
    TeamMessageType,
    TeamSession,
    TeamSessionState,
    TeamSessionStatus,
    TeamTask,
    TeamTaskStatus,
)
from .provider_catalog import (
    CANONICAL_PROVIDER_IDS,
    PRIMARY_PROVIDER,
    PRIMARY_PROVIDER_ID,
    PROVIDER_CREDENTIAL_KEYS,
    SUPPORTED_PROVIDERS,
    ProviderCatalogEntry,
    ProviderDefinition,
    catalog_entries,
    ordered_candidates,
    provider_definitions,
)
from .provider_status import ProviderStatus, ProviderStatusService
from .moa import (
    BenchmarkRecord, CapabilityProfile, CapabilityRouter, FallbackPolicy,
    ProviderModelCatalog, ProviderModelEntry, ProviderModelRef,
    RoutingProvenance, validate_benchmark,
)
from .runtime_config import credential_reference, runtime_catalog
from .collaboration import (
    AppendOnlyTeamLog,
    DependencyGraph,
    TeamEvent,
    TeamEventType,
    TeamProgressProjection,
    ThreadIdentity,
    ThreadKind,
    canonical_hash,
    validate_schema_identity,
)
from .orchestration import (
    HookRecord,
    OrchestrationEvent,
    OrchestrationEventType,
    PeerReview,
    TaskLease,
    TeamMember,
    TeamOrchestrator,
)
from .remote_control import (
    AgentStatusSnapshot, ApprovalRequired, ApprovalRequest, ApprovalState,
    ArtifactReference, AuditEvent, CommandKind, CommandState,
    ConversationMessage, OfflineQueue, OperatorCommand, ProgressEvent,
    RemoteControlPlane, RemoteSession,
)

__all__ = [
    "ArtifactRef", "SourceRef", "RoleHandoff", "RoleHandoffService", "HandoffError",
    "AgentDefinition", "BudgetLimits", "RoleAssignment", "RoleDecision",
    "RolePolicyService", "TestWriteGrant", "TestWriteLease",
    "RoleContract", "CodeWriteLease", "RoleEnvelope",
    "ReviewFinding", "RoleEvidence", "RoleResult", "RoleResultReceipt", "RoleResultService",
    "ConversationRole",
    "ConversationTurn",
    "DecisionRequest",
    "Mailbox",
    "RequestState",
    "RequestStatus",
    "RevisionRequest",
    "TeamDeliveryState",
    "TeamMailbox",
    "TeamMessage",
    "TeamMessageType",
    "TeamSession",
    "TeamSessionState",
    "TeamSessionStatus",
    "TeamTask",
    "TeamTaskStatus",
    "PRIMARY_PROVIDER",
    "PRIMARY_PROVIDER_ID",
    "CANONICAL_PROVIDER_IDS",
    "PROVIDER_CREDENTIAL_KEYS",
    "SUPPORTED_PROVIDERS",
    "ProviderCatalogEntry",
    "ProviderDefinition",
    "ProviderStatus",
    "ProviderStatusService",
    "catalog_entries",
    "ordered_candidates",
    "provider_definitions",
    "BenchmarkRecord",
    "CapabilityProfile",
    "CapabilityRouter",
    "FallbackPolicy",
    "ProviderModelCatalog",
    "ProviderModelEntry",
    "ProviderModelRef",
    "RoutingProvenance",
    "validate_benchmark",
    "credential_reference",
    "runtime_catalog",
    "AppendOnlyTeamLog",
    "DependencyGraph",
    "TeamEvent",
    "TeamEventType",
    "TeamProgressProjection",
    "ThreadIdentity",
    "ThreadKind",
    "canonical_hash",
    "validate_schema_identity",
    "HookRecord",
    "OrchestrationEvent",
    "OrchestrationEventType",
    "PeerReview",
    "TaskLease",
    "TeamMember",
    "TeamOrchestrator",
    "AgentStatusSnapshot", "ApprovalRequired", "ApprovalRequest", "ApprovalState",
    "ArtifactReference", "AuditEvent", "CommandKind", "CommandState",
    "ConversationMessage", "OfflineQueue", "OperatorCommand", "ProgressEvent",
    "RemoteControlPlane", "RemoteSession",
]
from .external_verifier import ExternalVerifierAdapter, ExternalVerificationError, ManualImportAuthorization
from .orchestration import RoleTeamOrchestrator, TeamTaskBinding
from .collaboration import TeamSnapshot

__all__ += ["RoleTeamOrchestrator", "TeamTaskBinding", "TeamSnapshot"]
from .moa import MoADeliberation
from .provider_catalog import CapabilityCatalog, CapabilityAdmissionRouter
from .provider_status import QuotaObservations
__all__ += ["MoADeliberation", "CapabilityCatalog", "CapabilityAdmissionRouter", "QuotaObservations"]
from .sns_gateway import SNSMessageEnvelope, SNSGateway
from .daon_user_api import DaonUserAPI
__all__ += ["SNSMessageEnvelope", "SNSGateway", "DaonUserAPI"]
from .telegram_adapter import TelegramGatewayAdapter
__all__ += ["TelegramGatewayAdapter"]
from .kakao_adapter import KakaoContractAdapter
__all__ += ["KakaoContractAdapter"]

__all__ += ["ExternalVerifierAdapter", "ExternalVerificationError", "ManualImportAuthorization"]

# Concurrency is imported lazily by callers to keep the E04 queue import graph acyclic.
__all__ += ["AnalysisTask", "ConcurrencyScheduler", "ConcurrencyError"]
__all__ += ["WorktreeWriteService"]

def __getattr__(name):
    if name == "WorktreeWriteService":
        from .worktree_writes import WorktreeWriteService
        return WorktreeWriteService
    if name in {"AnalysisTask", "ConcurrencyScheduler", "ConcurrencyError"}:
        from . import concurrency
        return getattr(concurrency,name)
    raise AttributeError(name)
