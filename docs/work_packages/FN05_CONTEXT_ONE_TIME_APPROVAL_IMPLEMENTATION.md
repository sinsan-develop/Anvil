# FN05/FN11/UI04 맥락 준비 원명령의 일회 승인 집행

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `1364817c5379f1551be84dc45782e19a23953ae5`.

## 목적·승인 경계

기존 buildTaskContext의 맥락 준비 저장·고정 조회를 REQUIRE_APPROVAL에서도 실행하도록 FN11 일회 승인에 연결한다. FN05_CONTEXT_PREPARATION_IMPLEMENTATION.md의 채택 범위와 기존 INTERFACES operation을 소비한다. 당시 AUTO 전용 구현의 제외를 영구 금지로 이월하거나 전체 기능을 재승인받지 않는다.

정확 payload `{assignmentRef,budgetRef,slots,limits,reason}`·기존7개 slot·manifest·자료 공개 범위는 보존한다. 실제 전달/이해/Agent 허가와 공유B는 별개다. ready/executionAuthorized/dispatchPerformed=false, DELIVERY_NOT_CONNECTED·UNDERSTANDING_NOT_REVIEWED 등 미확인은 유지한다. 새 operation/API·permission·공개 DTO·원문 영구 후보·다른 기기 복원·표/role/GRANT·의존성은 없다. 실제 DB/SQL 적용·정책/사용자 권한·Secret·TLS/서비스·Agent/native·외부 비용은 제외한다.

## 단일 writer 허용16경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/server/modules/context/project-contexts.ts`
5. `apps/web/src/features/workspace/context-api.ts`
6. `apps/web/src/features/workspace/WorkspaceContextPreparation.tsx`
7. 신규 `apps/web/src/features/workspace/context-approval.ts`
8. 신규 `apps/web/src/features/workspace/ContextApprovalEditor.tsx`
9. `apps/web/src/features/decisions/api.ts`
10. `apps/web/src/features/decisions/ApprovalsPage.tsx` — buildTaskContext 허용·기존 UI04 작업공간 복귀만
11. 신규 `db/migrations/0046_context_one_time_approval.sql.pending`
12. 신규 `tests/unit/FN05/context-approval-input.test.ts`
13. 신규 `tests/unit/FN05/context-approval-consumption.test.ts`
14. 신규 `tests/unit/UI04/context-approval-api.test.ts`
15. 신규 `tests/browser/UI04/context-one-time-approval.spec.ts`
16. `tests/unit/FN05/context-store.test.ts` — 당시 미연결 기대2건만 새 명확 승인필요/불필요·정확 malformed ref 거절로 한정 갱신하고 부작용0/나머지 검사는 보존한다.

Main 제품 수정0·동시 writer1명이다. 기존 context-input/sources/manifest·context-preparation-edit·부모 WorkspaceAssignments/App은 원칙적으로 소비·회귀만 하며 재작성하지 않는다. 불가피한 추가 경로는 실제 호출선·최소 diff를 Main에게 먼저 제시한다. 다른 dirty·보호 untracked8·현재0045와 과거SQL은 보존한다.

## 원명령·승인·저장/조회

1. ActionScope는 operation=buildTaskContext, targetRef=null/expectedVersion=0, baselineRefs=[], environmentRef=null/sourceScopes=[]/limitsRef=null이다. budgetRef나 원문 ref를 다른 scope 필드로 이동하지 않는다. actor/client/control·policy와 원 candidateCommandId·**원 command.payload 전체 canonical hash**를 결박한다. parser가 slots를 정렬해도 원명령 payload/hash를 parser 결과로 재구성하지 않는다.
2. 준비는 POST0. 명확 APPROVAL_REQUIRED에서만 원명령을 잠그고 기존 승인 요청을 작성한다. UI08 별도 결정→UI04 보호 GET/현재 조건 대조·명시 결박→별도 사용자 저장이다. UNKNOWN/응답 유실 후412는 새 요청으로 우회하지 않는다. 원명령이 사라지면 hash로 복원하지 않는다. 결박은 같은 commandId/payload와 binding을 보존하는 approvalRef 한 번 전이이며, 다른 명령/주체/client/control/policy·원문/임무/예산·기한·거절/수정/회수·소비 변경은 차단한다.
3. 승인 요청/결정/결박·조회만으로 준비본 저장이나 실제 전달0이다. 원 pending/uncertain·사용자 입력과 현재 선택을 보존한다. API/session/transport/프로젝트·입력 ABA/이탈·늦은 성공/실패는 새 buffer를 덮지 않는다. 부모/자식의 pending→uncertain→성공 연속 갱신은 binding·전체 원명령·예상 요청 단계로 확인하며 전체 객체 동일성만 요구해 정상 완료를 버리지 않는다. 새 요청으로 넘어갈 때는 종결된 결정만 기존 정상 닫기 UI로 명시 종료한다.
4. context-api commandValid/prepareContextWrite/send와 명시 결박을 연결하되, 이미 준비한 승인 원명령을 null 승인으로 되돌리지 않는다. 저장 성공 후 GET 실패는 receipt를 보존하고 수동 재조회하며, 새 command로 우회하지 않는다.
5. repository save의 null 승인 guard뿐 아니라 #stored의 expectedRequest/consumption/payload_ref/receipt·감사 재구성도 연결한다. **기존 request_payload가 원 payload를 이미 보존**하므로 새 영구 보관 필드를 만들지 않는다. 필요한 async 불변 소비 검증을 모든 실제 #stored 호출에 await하며, 당시 request/decision/consumption/command/receipt/audit를 대조한다. 후속 합법 policy/control 변화만으로 과거 manifest를 위조 처리하지 않는다. 역사 읽기에 현재 authorize/consume를 재사용하지 않는다.
6. 신규 저장은 현재 회원/권한/단독 control/정책→동일 합법 명령 replay→신규만 확정 임무·current draft·budgetRef·헌법/원문 fullref·격리/정정/제외/source 재검사→정확 승인 소비·manifest/items·receipt/audit 원자 저장이다. 저장 당시 source 검사를 승인으로 대체하지 않는다. SELECT의 현재 source 비교는 별도 MATCHED_METADATA/CHANGED/UNAVAILABLE로 표시하고401/403을503/현재성 문제로 숨기지 않는다.

## 신규 미적용 SQL

Main286fca inventory에서0046 부재 확인했으며 생성 직전에 재확인한다. 기존0014 context_preparation_authorized/guard_context_preparation의 AUTO/null 봉투를 한정 확장하고 기존 context_preparation_manifest_valid/context_items_complete와 source/manifest/분류 검사는 보존한다. 공통 승인 target/consumption wrapper는 **현재0045 기준선 통합 후 chain**을 보존한다. 기준선3연산·export·plan·detach·upload·candidate/trust의 기존 분기를 잃지 않는다.

command 또는 scope 어느 쪽만 buildTaskContext인 혼합도 전용 검증으로 거절한다. null/0·원 request_payload/hash·actor/client/policy/control·승인·자료/manifest/items·receipt/audit/감사 주체/source_kind·소비를 원자 대조한다. 최종 command/소비/자료 연결을 UPDATE/DELETE로 무력화할 수 없게 하되 정상 INSERT·AUTO/다른 연산은 보존한다. 실제 compile/DML/COMMIT/RLS/경합은 실행하지 않고 NOT_RUN으로 기록한다. 정식DB·현재 FN16 TCP 지원 미결을 우회하지 않는다.

## TDD·검수·QA

- 먼저 신규시험만 작성해 기존 제품/SQL 불변의 실제 CONTEXT_APPROVAL_NOT_CONNECTED guard를 APPROVAL_REQUIRED/412 기대로 검증하는 RED를 Main이 확인한다. 모듈 부재와 기능 반례를 구분한다. writer는 pure fake unit·type·메모리 build만 실행하며 실제 파일·브라우저·PG QA는 하지 않는다.
- 정상 수직 여정은 기존 확정 임무·선택 원문/예산→준비→명확412→정확 승인 요청·UI08 별도 결정→UI04 명시 결박→원명령 저장/고정 재조회다. 각 승인 단계 저장0, 같은 commandId/원 payload·slot 순서 보존·불변 ref와 미전달 false flags를 대조한다.
- 중요한 실패는 원문/헌법 정정·제외/격리/임무/기준/예산·정책/control 변경, 정합 재해시한 다른 scope/payload·다른 client/command·기한/거절/DENY·재사용, 합법 과거 이력 읽기, rollback/유실·UNKNOWN 후412·후속GET실패·이탈/ABA다. 기존 source 검사나 실제 SQL 실행을 합성 결과로 인증하지 않는다.
- 직접 인접 기존 FN05 context-store/input/sources/manifest/routes·UI04 context-api/편집, 공통 FN11·기준선/반출 승인 필요한 범위만 검증한다. 기존 시험 미연결 기대2건은 실제 call과 exact error/status로 갱신하고 일반 assert.rejects로 느슨하게 바꾸지 않는다. 불변 전수 검사 반복0.
- actual App fixture는 실제 server POST/보호 GET DTO를 구분한다. 결정 POST에 GET전용ref를 섞지 않고, 실제 group/role/name과 label을 source로 먼저 대조해 selector 추정 실패 반복을 피한다. 시험 기준·timeout을 성공에 맞춰 낮추지 않는다.
- Main QA root `D:/tmp/anvil-v3-stage-b/ui04-context-approval-20261027-01` (dist/results/temp/config.mjs), owner SINSAN\cyhuh·각 생성 최대30분. env `ANVIL_UI04_CONTEXT_APPROVAL_DIST`는 해당 dist만 허용한다. 생성 전 commentary/WORK_STATUS·부재/owner/nonlink/realpath 등록, 종료 후 exact 정리와 별도 잔류0을 확인한다. writer는 생성하지 않는다.
- 독립 C/I 보정·Main fresh 검증 뒤 소유 파일만 기존 branch에 checkpoint/private 게시한다. 실제 PG/served·사용자 인수·전체 FN05/FN11/UI04/Stage/계획 완료로 승격하지 않는다.

소스 rollback은 후속 revert로 가능하며 실제 DB·지속 자료 복원/삭제는 이 작업에서 하지 않는다. 작업현황에 단계/담당/상태·변경·검증·오류·미확인·다음 조치를 누적한다.
