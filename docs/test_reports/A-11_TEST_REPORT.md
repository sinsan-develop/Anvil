# A-11 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-11`
- assigned verification: `AV-OPS-002`의 A-11 정적 계약 slice
- blocking finding: `0`
- current baseline: `main = origin/main = 3D4BA6E22FB414406DD4987FF742624A1C00EDAF`; clean worktree
- progress: sequence `126`, `A-11 / TEST_REVIEW / COMPLETED / accepted=false`; active agent, worker lease, write lease 모두 `null`
- Main acceptance, progress/HANDOFF 갱신, commit/push 및 A-12 착수: Tester 미실행

## 판단 이유

권위 문서와 WorkInstruction에서 독립적으로 재구성한 A-11 계약은 Operations Overview, Queue, Worker Lease, Provider/Backend Health, Alert Center, Budget/Quota, Deployment Monitoring, Audit/Details Drawer의 여덟 화면을 정적 계약으로 제공하는 것이다. `AV-OPS-002`의 실제 L4/FI/E-SHOT은 아직 F-13 구현 범위이므로, 정적 검증을 actual operations 증거로 승격하지 않는다.

시스템이 감지한 이상에는 detector evidence, cause, impact, next action, deep link가 모두 필요하다. stale health를 healthy로 보이지 않게 하고, alert dedupe와 acknowledge/resolve/evidence를 분리한다. Queue는 stale fence를 거부하고 최대 시도·quarantine을 요구하며 worker execution fence와 product write fence를 분리한다. Budget은 provider call 전에 reservation을 확보하고 unknown usage를 0으로 처리하지 않으며 사용량 reconciliation을 거친다. Provider drift는 unsafe route를 막고, deployment는 smoke만으로 release하지 않으며 `MONITORING` window, critical alert 0, Owner confirmation을 모두 요구한다.

독립 enum·permission, force-success 금지, raw fencing token/secret/internal endpoint 비노출, static-to-runtime 승격 금지, A-01~A-10 predecessor와 evidence manifest의 self-reference 금지가 모두 fail-closed 계약으로 확인됐다.

## 기준선과 독립 무결성 재계산

| 대상 | 독립 확인 결과 |
|---|---|
| Developer evidence manifest | file SHA-256 `23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0` |
| Developer raw artifact | `15/15` bytes/hash 일치, content bytes `42785`, self-reference `false` |
| Developer target / delivered | path/sha256 byte-ordinal JSON projection 재계산 `911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654`, canonical bytes `2062` — manifest와 일치 |
| Completion progress manifest | file SHA-256 `168E4A7D50927B596F68F9FBB69035E54A82D9E62024598693DC261B9C8BBC4E` |
| Completion raw checksum | `5/5` bytes/hash 일치, content bytes `12680`, self-reference `false` |
| Completion target / delivered | UTF-8 byte-ordinal path 정렬 TAB-row projection 재계산 `8E5C73A7E6DB06D38D09DD60438CA1683F7A7852885D47D6EC3365424FF5FD4B`, canonical bytes `629` — manifest와 일치 |
| Accepted predecessors | A-01~A-10 binding `10/10` 실제 manifest SHA-256 일치 |
| Completion exact path set | validated base `B665A4F32451511ADF5A466827B76FEE54113C7C..HEAD` 변경 `27`, allowlist `27`, missing `0`, unexpected `0` |

### CompletionReport untracked path 수 불일치

Developer CompletionReport는 당시 `18 untracked`라고 기록했지만, Developer product 산출물은 raw artifact `15`와 EvidenceManifest `1`로 `16`개다. 현재 acceptance-base worktree에서는 모두 commit되어 `git ls-files --others --exclude-standard = 0`으로 재현되지 않는다.

판정은 `MINOR / non-blocking evidence-accounting inconsistency`다. 완료보고가 18개 경로를 개별 열거하거나 당시의 git-status 증거를 고정하지 않아 product `16`과의 차이 2개를 독립적으로 귀속할 수 없다. 다만 현재 Developer manifest `15/15`, target/delivered hash, predecessor binding, completion exact 27-path projection과 모든 checker가 일치해 허용 범위 이탈·무결성 훼손 증거는 없다. Main은 향후 CompletionReport에 untracked path 목록과 product/non-product 분류를 고정하는 보완을 고려할 수 있으나, A-11 static contract acceptance의 차단 사유는 아니다.

## 독립 hostile 검증

`tests/fixtures/a11/mutation-catalog.json`의 25개 hostile mutation과 A-11 contract tests에서 다음 경계를 fresh 실행으로 확인했다.

| 보호 경계 | fail-closed stable reason 예시 |
|---|---|
| manual-only anomaly, cause/impact/action/deep link | `MANUAL_ONLY_ANOMALY_PROMOTION_FORBIDDEN`, `ANOMALY_CAUSE_REQUIRED`, `ANOMALY_IMPACT_REQUIRED`, `ANOMALY_NEXT_ACTION_REQUIRED`, `ANOMALY_DEEP_LINK_REQUIRED` |
| stale health, alert dedupe/ack/resolve | `STALE_HEALTHY_SIGNAL_FORBIDDEN`, `ALERT_DEDUPE_KEY_REQUIRED`, `ALERT_ACK_RESOLVE_COLLAPSE_FORBIDDEN`, `ALERT_RESOLVE_EVIDENCE_REQUIRED` |
| queue/worker/write fence, retry, quarantine | `STALE_FENCING_REJECT_REQUIRED`, `INFINITE_RETRY_FORBIDDEN`, `QUARANTINE_REQUIRED`, `FENCING_LAYER_COLLAPSE_FORBIDDEN` |
| reservation/usage reconcile, quota, provider drift | `BUDGET_RESERVE_ORDER_REQUIRED`, `UNKNOWN_USAGE_ZERO_FORBIDDEN`, `BUDGET_RECONCILIATION_REQUIRED`, `PROVIDER_DRIFT_FAIL_CLOSED_REQUIRED` |
| deployment monitoring, critical alert, Owner, rollback | `DEPLOYMENT_MONITORING_WINDOW_REQUIRED`, `DEPLOYMENT_CRITICAL_ALERT_GUARD_REQUIRED`, `DEPLOYMENT_OWNER_CONFIRMATION_REQUIRED`, `AUTOMATIC_DATA_LOSS_ROLLBACK_FORBIDDEN` |
| enum/permission separation, force-success, sensitive data | `ENUM_COLLAPSE_FORBIDDEN`, `PERMISSION_COLLAPSE_FORBIDDEN`, `FORCE_SUCCESS_CONTROL_FORBIDDEN`, `RAW_FENCING_TOKEN_DISCLOSURE_FORBIDDEN`, `SECRET_LITERAL_DISCLOSURE_FORBIDDEN` |
| static promotion, predecessor, manifest bypass | `STATIC_RUNTIME_PROMOTION_FORBIDDEN`, `PREDECESSOR_BINDING_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN` |

## fresh 검증 증거

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py' -v
C:\Users\cyhuh\anaconda3\python.exe scripts/check_a01_journey.py --json
# A-02~A-11 checker 각각 --json
C:\Users\cyhuh\anaconda3\python.exe scripts/check_g07_baseline.py
C:\Users\cyhuh\anaconda3\python.exe scripts/check_phase_g_gate.py
C:\Users\cyhuh\anaconda3\python.exe scripts/check_project_progress.py
git diff --check
```

- full tooling: exit `0`, `235/235 PASS`, `Ran 235 tests in 55.628s`.
- A-01~A-11 checker: 모두 exit `0`; A-11 `PASS`, errors `[]`.
- G-07: exit `0`, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: exit `0`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.
- project-progress: exit `0`, `PASS`, sequence `126`, reporting `AUTO_CONTINUE`.
- `git diff --check`: exit `0`.

최초 일괄 실행에서 G-07 checker에 지원하지 않는 `--json`을 전달해 usage exit `2`가 한 번 발생했다. 바로 CLI usage에 맞춘 fresh 재실행은 exit `0`이었고, 코드·계약·산출물은 변경하지 않았다. 이는 검증 대상의 정식 실패나 blocking finding으로 집계하지 않는다.

## 미실행 범위와 조치

- 이 판정은 A-11 `STATIC_ONLY / STATIC_CONTRACT_PASS` slice만 다룬다.
- actual operations, API, DB, Event, SSE, browser, network, Docker/WSL/server, deploy, runtime, DIR, L4/FI/E-SHOT은 모두 `NOT_EXECUTED`다.
- static Markdown/SVG/catalog/fixture 및 mutation test는 실제 화면·Network·운영 기능 PASS가 아니다.
- Main Agent는 이 독립 evidence를 검토한 뒤에만 A-11 최종 `ACCEPTED`를 판정할 수 있다. Tester는 acceptance, progress/HANDOFF 변경, commit/push, A-12를 수행하지 않았다.
