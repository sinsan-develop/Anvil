# D-10 WorkInstruction — Hook sandbox runner·shadow·pilot·trust·quarantine

## 1. 식별·권위
- Work Package: `D-10`; 선행: `D-09 ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 46.4.1~46.4.3, 48.9; 작업계획 D-10
- 검증: `AV-LRN-020`, `AV-LRN-022`, `AV-SAFE-027`, `AV-STAT-040`; 구현자: `developer-primary-d10-r1`

## 2. 목표
D-09의 exact Hook definition/program identity를 받아 `SHADOW → PILOT → TRUST_REVIEW → ACTIVE` lifecycle을 수행하는
secure runner 계약을 구현한다. 새 program은 sandbox shadow·pilot·사람 trust 전 실행되지 않으며, 변경 hash는 trust를 폐기한다.
사전 신뢰된 matcher 축소 patch만 trusted_auto로 다음 Run에 적용하고 알림·rollback·quarantine·재시작 복원을 보장한다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/hook_runtime.py`
- `packages/api/hook_runtime.py`
- `tests/knowledge/test_hook_runtime_d10.py`
- `tests/api/test_hook_runtime_d10.py`
- `docs/04_test_reports/D-10_COMPLETION_REPORT.md`

## 4. 필수 계약
1. D-09 candidate/definition/program id·version·content hash, permission profile, source provenance와 host context를 exact 결박한다.
   payload가 trust, approval, shadow/pilot PASS, principal, hash를 자가 부여할 수 없다.
2. lifecycle은 `REGISTERED → SHADOW → PILOT → TRUST_REVIEW → ACTIVE → QUARANTINED | RETIRED`만 허용하고
   각 전이는 immutable evidence hash와 optimistic version/idempotency를 가진다.
3. 새 executable/script/program은 사람 trust 전 실제 Action path에서 실행되지 않는다. shadow는 원 Action을 차단·수정하지 않고
   예상 matcher/result와 read-only sandbox receipt만 기록한다. pilot은 고정 Event/fixture replay에서 positive/negative, timeout,
   output schema, fail policy, recursion을 검증한다.
4. sandbox profile은 non-root, read-only rootfs, 최소 read filesystem, project write/credential read/network deny,
   process/deployment/외부 side effect deny를 강제한다. program은 Hook 설정이나 다른 Hook/Subagent를 변경·생성할 수 없다.
5. runner adapter는 command program의 exact source/dependency/artifact/signature hash를 재검증하고 stdout JSON schema,
   stderr/exit/duration/timeout receipt를 반환한다. 실제 OS process 실행은 주입된 격리 executor 경계로만 가능하며 테스트는 deterministic fake를 사용한다.
6. secret·PII·prompt-injection scan 실패 입력은 executor에 전달하지 않거나 정책대로 마스킹한다. LLM/Agent program은 enforce에 사용할 수 없다.
7. trust는 `(definition hash, program version/hash, permission profile hash, principal id)`에 귀속한다.
   어느 hash·scope·Event·matcher·program·permission·timeout·failure policy가 바뀌면 기존 trust와 ACTIVE 재사용을 거부한다.
8. 사람 사전 승인은 새 program 최초 실행, deny/ask/modify/fail_closed 신설·강화, Event/scope/matcher 확대,
   filesystem write/network/process/credential/deployment 권한, Tool/user input 변경, global/org, 현재 Run 즉시 적용에 필수다.
9. trusted_auto는 이미 trusted ACTIVE read-only program의 동일 definition에서 matcher exclusion 추가 등 호출 범위를 엄격히 축소하고
   권한·timeout·빈도·결과 의미를 늘리지 않는 PATCH만 허용한다. 적용은 다음 Run snapshot부터이며 사후 알림, version, rollback ref가 남는다.
10. active runner는 recursion depth 최대 1, Event idempotency receipt, canonical D-09 merge/fault 규칙을 사용한다.
    untrusted project Hook·stale trust·현재 Run snapshot 미선택 Hook은 실행하지 않는다.
11. 반복 오류·비정상 latency·과도 deny·output/schema 위반은 자동 QUARANTINED로 전이한다. 안전 차단 Hook은 managed fallback을 먼저 활성화하며,
    rollback은 직전 immutable automation snapshot과 영향 Run/audit을 보존한다.
12. export/import 재시작 복원은 Skill version, Hook trust identity, lifecycle, automation snapshot, notification/rollback/audit hash를 보존하고
    변조·누락·다른 principal/context를 거부한다.
13. API는 shadow/pilot/trust/activate/run/quarantine/rollback/export/import/query의 authenticated host adapter만 제공한다.
14. 실제 OS sandbox/process, DB/HTTP/browser/deployment는 이번 fixture 검증에서 NOT_EXECUTED로 구분한다.

## 5. 검증·보고
- 새 program shadow/pilot/human trust 전 실행 거부, hash drift trust 폐기, current-run injection 거부
- fake sandbox profile/receipt, secret/PII/injection 차단, timeout/fault/recursion/idempotency
- trusted_auto matcher 축소 성공과 확대·권한·결과·timeout 변화 거부, notification/version/rollback
- quarantine/fallback/rollback/affected Run, export/import 변조·principal/context·hash 적대 검증
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check
- 실제 OS process/DB/HTTP/browser/deployment는 미실행

## 6. 완료 후
Main 독립 검토와 D-Hook Gate 판정 전 D-11을 시작하지 않는다.
