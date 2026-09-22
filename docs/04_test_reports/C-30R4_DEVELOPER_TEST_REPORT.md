# C-30R4 Developer Test Report

- 판정: `COMPLETED`
- 담당: 세 번째 unrelated large-file patch corruption 후 `main-agent-eoul-takeover`
- 대상: canonical progress checker reconciliation, historical/current fixture isolation, completion evidence replay 차단, current projection 정합화
- 기준: branch `codex/c09-execution-backends-r1`, base HEAD `ed3cae92597d681c76417e26576bed91a0525bad`, event seq1340
- raw freeze: seq1~1325 `3985246 bytes / 09A6B52717CEF4E4E49B2AA1830B670226FEB272237668CC3EC39E2D07219431`; seq1~1334는 R2 profile로 결박
- 변경 전/후: 기존 completion seam은 unrelated report replay가 가능했고 runtime action이 stale이었다. 변경 후 보고서 본문·package·HEAD·checker/test SHA·Main takeover epoch3 lease/fencing·역할별 actor·필수 수치를 모두 교차검증한다.
- 인수 계보: seq1335~1340에서 human override 승인 결박, 기존 Developer write/worker lease 회수, `TAKEOVER_PACKET_C30R4_20260922_001`, Main worker/write lease 발급을 append-only로 기록했다.
- rollback: Manifest의 exact16 목록만 복원 대상으로 삼고 seq1~1334 prefix는 보존한다. worktree reset/clean 또는 exact16 밖의 경로 삭제는 금지한다.
- 잔여 경계: C30R3는 fixture-only다. production auth, 실제 Provider, PG18, actual server-generated 400, Oracle, live remote는 미검증이다.

```json c30r4-evidence
{
  "actor_id": "main-agent-eoul-takeover",
  "binding": {
    "base_head": "ed3cae92597d681c76417e26576bed91a0525bad",
    "checker_sha256": "1F265AA661D85E7651DB745B12F31F69050A960809319699ED71BF212BA1B300",
    "event_sequence": 1340,
    "execution_fencing_token": "c30r4-main-execution-fence-epoch-3-ed3cae9",
    "tests_sha256": "8812AE5CF28BE0BE008FB02BFEF0C50B647FE32560FE5521AC1413C9FD074ADD",
    "worker_lease_id": "worker-lease-c30r4-main-takeover-20260922-001",
    "write_fencing_token": "c30r4-main-write-fence-epoch-3-ed3cae9",
    "write_lease_id": "write-lease-c30r4-main-takeover-20260922-001"
  },
  "commands": [
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k 'C30R4CheckerSourceTests or C30CanonicalReconciliationTests or C21ProviderWslVerifyScopeCorrectionTests or C21WslRollbackScopeCompatR1Tests or C21WslCleanupGuardSourceR1Tests or C21WslCleanupRuntimeResultTests or C21WslAcceptanceStrictSuccessorTests or C21WorkbenchUiReworkLocalStartTests or C21WorkbenchUiReworkLocalResultTests or C21WorkbenchUiHistoricalFixtureReconciliationTests or C21WorkbenchUiWslGitOnlyCandidateStartTests or C21WorkbenchUiWslGitOnlyCandidateBoundTests or C21WorkbenchUiWslRuntimeResultTests or C21A13HistoricalModuleIsolationTests or C21A13HistoricalModuleIsolationCasPublicationTests or C21WorkbenchUiWslAuthBrowserProbeTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR3ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR4ResultTests or C21WorkbenchUiWslImmutableRuntimeControlV2PublicationTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR5ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR6ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR7ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR8ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR9ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR9TakeoverCorrectionTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR10ResultTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR10EvidenceCorrectionTests or C21WorkbenchUiWslAuthBrowserRuntimeRetryR11ResultTests or C21FinalAcceptanceProjectionReconciliationTests or C21PostmergeDevelopmentAuthorityReconciliationTests' -q => 125 passed, 554 deselected in 177.89s",
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k 'ProjectProgressContractTests or C10FinalAcceptanceControlTests' -q => 199 passed, 480 deselected in 1338.11s",
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k 'C01MainlineAcceptanceTests or C01L3ReworkControlTests or C01L3FinalAcceptanceProjectionTests or C01PostmergeDevelopmentAuthorityReconciliationTests or C02StartProjectionTests or C02FinalAcceptanceProjectionTests or C02PostmergeDevelopmentAuthorityReconciliationTests or C03StartProjectionTests or C03ControlR2Tests or C03FinalAcceptanceProjectionTests or C04StartProjectionTests or C04FinalAcceptanceProjectionTests or C04DetachedSmokePortabilityReconciliationTests or C05StartProjectionTests or C05ScopeRevisionProjectionTests or C05FinalAcceptanceProjectionTests or C06StartProjectionTests or C06ScopeRevisionProjectionTests or C06FinalAcceptanceProjectionTests or C07StartProjectionTests or C07FinalAcceptanceProjectionTests or C08StartProjectionTests or C08FinalAcceptanceProjectionTests or C09StartProjectionTests or C09R3ControlTests or C09R4ControlTests or C09MainTakeoverControlTests or C09FinalAcceptanceControlTests or C10StartControlTests or C10ReworkStartControlTests or C10R2StartControlTests or C10Failure3ConflictHoldControlTests or C10MainTakeoverStartControlTests or C10PostcommitReconciliationControlTests or C11StartControlTests or C11FinalAcceptanceTests' -q => 159 passed, 520 deselected in 424.70s",
    "PowerShell: $c30r4Shard4 = 'C12StartControlTests or C12ReworkLeaseControlTests or C12FinalAcceptanceTests or C13StartControlTests or C13FinalAcceptanceControlTests or C14StartControlTests or C14LeaseTimeCorrectionControlTests or C14FinalAcceptanceControlTests or C15StartControlTests or C15FinalAcceptanceDir2ControlTests or CGateDecisionControlTests or D01StartControlTests or D01FinalAcceptanceControlTests or D02StartControlTests or D02FinalAcceptanceControlTests or D03StartControlTests or D03FinalAcceptanceControlTests or D04StartControlTests or D04FinalAcceptanceControlTests or D05StartControlTests or D05ScopeRevisionControlTests or D05FinalAcceptanceControlTests or D06StartControlTests or D06FinalAcceptanceControlTests or D07StartControlTests or D07FinalAcceptanceControlTests or D08StartControlTests or D08FinalAcceptanceControlTests or D09StartControlTests or D09FinalAcceptanceControlTests or D10StartControlTests or D10FinalAcceptanceControlTests or DHookGateControlTests or D11StartControlTests or D11FinalAcceptanceControlTests or D12StartControlTests or D12LeaseTimeCorrectionControlTests or D12FinalAcceptanceControlTests or D13StartControlTests or D13FinalAcceptanceControlTests or DGateControlTests or DGateRegressionReconciliationControlTests or DGatePostcommitControlTests or E01StartControlTests or E01FinalAcceptanceControlTests or E02StartControlTests or E02FinalAcceptanceControlTests or E04StartControlTests or E03StartControlTests or E03R2CorrectiveControlTests or E03FinalAcceptanceControlTests or E04FinalAcceptanceControlTests or E05StartControlTests or E05FinalAcceptanceControlTests or E06StartControlTests or E06FinalAcceptanceControlTests or E07StartControlTests or E07LeaseTimeCorrectionControlTests or E07FinalAcceptanceControlTests or E08StartControlTests or E08FinalAcceptanceControlTests or E09StartControlTests or E09FinalAcceptanceControlTests or E10StartControlTests or E10FinalAcceptanceControlTests or E11StartControlTests'",
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k $c30r4Shard4 -q => 196 passed, 483 deselected in 327.66s",
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k 'c30 or C21ProviderWslVerifyScopeCorrectionTests or C21FinalAcceptanceProjectionReconciliationTests or C21PostmergeDevelopmentAuthorityReconciliationTests or C09MainTakeoverControlTests or C09FinalAcceptanceControlTests or C10PostcommitReconciliationControlTests' -q => 36 passed, 643 deselected in 127.16s",
    "uv run --offline --frozen python -m pytest tests/tooling/test_project_progress.py -p no:cacheprovider -k 'C30CanonicalReconciliationTests' -q => 10 passed, 669 deselected in 78.24s",
    "uv run --offline --frozen python -B -m py_compile scripts/check_project_progress.py tests/tooling/test_project_progress.py => exit 0",
    "uv run --offline --frozen python -B scripts/check_project_progress.py . => PASS sequence=1340 reporting=AUTO_CONTINUE, exit 0",
    "git diff --check: exit 0"
  ],
  "critical": 0,
  "important": 0,
  "minor": 0,
  "package_id": "C-30R4",
  "role": "developer",
  "schema_version": "c30r4_completion_evidence/v1",
  "verdict": "COMPLETED",
  "verification": {
    "c30_adversarial_passed": 10,
    "compile_exit": 0,
    "diff_check_exit": 0,
    "focused_deselected": 643,
    "focused_passed": 36,
    "fresh_tooling_passed": 679,
    "fresh_tooling_shards": [
      125,
      199,
      159,
      196
    ],
    "live_checker_exit": 0,
    "live_checker_sequence": 1340
  }
}
```
