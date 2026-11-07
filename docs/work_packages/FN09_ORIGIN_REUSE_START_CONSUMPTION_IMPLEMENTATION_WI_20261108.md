# FN09 원자료 승인 START 소비·보호 재조회 작업지시서

## 근거와 책임

WORK_PLAN FN09/FN08/FN11의 남은 원자료 재사용 승인 소비를 구현한다. 직접 채택 계약 docs/work_packages/FN09_ORIGIN_REUSE_DETAILED_CONTRACT_CANDIDATE_20261107.md SHA256 1EABB2AD93AA87CCB61865249E88953D8400229DE92299AA24DD3BB046E96522의 §4~6이 기준이다. 새 승인 후보나 공개 API 계약을 만드는 문서가 아니다.

기준 main은 7d51ce10594df663ddf13cba4a65e860d838d1e2, branch는 codex/av3-fn09-origin-consumption이다. 현황 checkpoint48296ac18e56c2972a8b19e4c06a132931850e80의 제품은 main과 같다. PR62로 인수한 요청·세 결정 저장/UI와 성능 보완은 다시 구현하지 않는다.

기존 Primary가 단일 code writer이며 Main은 WI·현황·검수·통합을 소유한다. 다른 사람/agent 변경을 되돌리지 않는다. backend 소비 뒤 기존 UI08 보호 조회를 연결한다. 실제 DB/SQL 적용·권한·키·서비스·Agent·SSH·실자료/백업 조사·C# 컴파일은 제외한다. 새 실행/재개 버튼, 프로덕션 합성 포트 활성화, 실제 VERIFIED_CURRENT/새 token 발급도 제외한다.

## 정확 허용 경로

제품/미적용 SQL10:

1. apps/server/modules/executions/execution-commands.ts
2. apps/server/modules/executions/execution-start-origin-reuse.ts
3. apps/server/modules/executions/execution-start-origin-queue-basis.ts
4. apps/server/modules/executions/execution-start-context-source.ts
5. apps/server/modules/executions/execution-start-material-registration-store.ts
6. apps/server/modules/executions/project-runtime-commands.ts
7. apps/server/modules/approvals/project-approvals.ts
8. apps/server/modules/access/project-command.ts
9. apps/server/modules/projects/project-storage-quota.ts
10. db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending

기존 UI08 보호 재조회3:

- apps/web/src/features/decisions/origin-reuse-approval-api.ts
- apps/web/src/features/decisions/api.ts
- apps/web/src/features/decisions/ApprovalsPage.tsx

시험/fixture7:

- tests/unit/FN09/execution-start-origin-fixture.ts
- tests/unit/FN09/execution-start-origin-routes.test.ts
- tests/unit/FN08/execution-start-context-source.test.ts
- tests/unit/FN08/execution-start-material-registration-schema.test.ts
- tests/unit/FN13/project-storage-quota-schema.test.ts
- tests/unit/UI08/origin-reuse-approval-read.test.ts
- tests/unit/UI08/approval-api.test.ts

이 밖의 경로는 수정하지 않는다. 기존 generic consumable 목록·routes·runtime-policy 평가기·적용된 과거 SQL을 변경하지 않는다. 추가 경로가 꼭 필요하면 정확 이유와 기존 범위 내 대안을 Main에 반환한다.

## 업무1 — 정확8키 START와 같은 인증 트랜잭션

기존 ProjectInitialExecutionQueue.command의 AccessRepository.authenticated callback을 재사용하고 그 안에서만 새 목적의 private 문맥을 등록한다. 기존 exact7/null START·SEND와 일반 원문의 MATCHED 요구/POLICY_CHANGED 판정은 유지한다. 새 목적은 exact8 payload와 non-null approvalRef 양쪽이 올바를 때만 허용한다. 부분적인 승인 흔적이나 잘못된 값을 일반 분기로 보내 성공시키지 않는다.

원 S/Q/P1/P2·현재 actor/client/Session/H/control·단계/임무/등록/Context/Options·재인증·최단기한과 저장 APPROVED/v2의 APPROVE·requestRef/decisionRef/scopeDigest·candidateCommandId/payloadHash/원 명령 전체hash를 다시 검산한다. authorizeExecution/queueExecutionCommand의 기존 정책 평가와 reuseExecutionStartOrigin 목적 검산을 모두 요구한다. 정상 두 연산의 null approval 투영은 기존 정책 평가 호출 안으로만 한정한다. 저장 명령·resolver·registrar에는 non-null을 포함한 원 exact8 명령을 넘긴다. DENY·정상 두 규칙의 REQUIRE_APPROVAL·오래된 정책·누락 규칙은 계속 거절한다.

queue/access/resolver/registrar의 실제 조합·PoolClient/query/xid·원 actor·원 명령hash·S/Q/P1/P2·원문 fullref/최단기한에 결박한 opaque lease를 private WeakMap으로 검산한다. 공개 raw db/actor setter, caller boolean, clone 증명, GUC, raw fact만으로 생산하지 못한다. 앞선 성능 관측 ticket은 이 권위의 생산자가 아니다.

## 업무2 — 원문/등록과의 순차 결박

prepare/describe 때는 원 명령ID/hash와 private lease·descriptor/manifest를 결박한다. 아직 없는 queue fullref를 먼저 발급하거나 nullable 성공값으로 대체하지 않는다. register에서 실제 저장 queue command fullref/createdCommandId를 결박하고, 이후 inspect/readBody loan을 원 command/descriptor/manifest/group/query/xid/기한에 묶는다.

최초·최종 환경 재관측에서만 기존 목적별 보호 검산을 사용하며 다른 head/등록/회수/권한 변화는 거절한다. readBody는 commandRef 형상뿐 아니라 실제 원 저장 fullref와 정확히 비교한다. 같은 PoolClient 재사용만으로 같은 Tx를 추정하지 않는다. 각 await 뒤와 최종 반환 전 현재성·기한을 검산하고 COMMIT/rollback/실패 때 증명/loan을 폐기한다. 역사 GET이 새 loan이나 기한을 만들면 안 된다.

## 업무3 — 일회 소비와 기존 queue 원자 저장

원 명령ID를 고정한 목적별 저장량 예약→persistProjectReceipt→기존 ProjectApprovals.consume의 APPROVED/v2→CONSUMED/v3 CAS→기존 execution/grant/usage/writer/queue/material/outbox→저장량 정산을 한 인증Tx에서 수행한다. 새 queue/소비 장부를 다시 만들지 않는다. receipt/audit의 정확 approvalRef·원 requestHash, ONE_TIME_APPROVAL_SCOPE payload_ref와 approval_consumption_id를 연결한다. envelope/원문의 두 ref는 유지하고 8번째 키·승인 외피는 복제하지 않는다.

동일 승인 경쟁·다른 승인/같은 실행ID·같은 명령 재송신은 현재 잠금·단발 유일성·저장 graph로 거절하거나 정확 replay한다. 모든 저장 단계 실패에서 소비·예산·queue/material/outbox를 rollback한다. COMMIT 불명/응답 유실을 미실행으로 추정하거나 자동 재송신·승인 재발행하지 않는다.

## 업무4 — 내부 계상과 SQL 완결 명세

새 내부 목적은 ORIGIN_REUSE_APPROVAL_CONSUMPTION, part key는 origin_reuse_consumption, R의 ID는 원 START serverCommandId, part ref는 같은 queueCommandRef다. 예약 전에 consumption/C/A/U/operation/writer/outbox의 ID를 고정하며 caller JSON만으로 서버 계획을 인정하지 않는다.

기존 P(v)=fn09_registered_cost_projection(v), C(v)=fn75_cost(P(v))를 재사용한다. base는 새 consumption+C+A+U, 동일 approval_requests 행의 v3/CONSUMED와 v2/APPROVED 비용 차분, 이번 START 신규 executions1·execution_grants1·usage_reservations1·writer_claims1·execution_commands1·delivery_outbox1·execution_material_manifests1·descriptor에 일치하는 execution_materials N의 합계다. 원 S/Q·request/decision 원행과 각 C/A/U·최초 알림N·기존 원문/artifact는 재계상0이다. 소비에서 새 credential/challenge/proof binding을 만들지 않는다.

실정산은 fn09_registered_reservation_fixed_point(base,to_jsonb(R),R.reserved_bytes)를 쓴다. 자료 count/byte admission과 registrar capacity는 유지하며 project quota 정산으로 오인하지 않는다. 기존 분모와 같은 행의 중복을 배제하고 kind/row_id별 이번 귀속을 검산한다. used 증가/held 감소, s<=r, generation/CAS/coverage/U/H/O/10GiB를 완화하지 않는다.

0082의 목적별 함수는 fn09_origin_reuse_consumption_context / maximum / rows / actual / reserve / settle / complete로 고정한다. reserve는 기존과 같은 11인자(s,a,c,p,q,ref,record,policy,ids,expected_tx,observed_until), settle은 10인자(s,a,c,p,external_id,rid,sealed_hash,cid,result,expected_tx)를 사용한다. 필요한 목적별 deferred 최종guard·quota_plan_valid/quota_settled_complete·원 request/decision 검산·기존 START material 완결/역완결의 한정 분기를 0082에 연결한다.

불변 request/decision seal과 현재 상태 완결을 나눈다. request v1/결정0, v2/소비0, v3/APPROVE결정1·소비1을 검산한다. 결정의 역사 비용은 v3 이후에도 원 v1→v2 투영으로 재현한다. 소비 직전 목적별 인정에서 아직 없는 queue/material을 요구하지 않고 전체 graph는 deferred 완결에서 요구한다. 함수 DAG 순환은 금지한다. 기존7키/null START와 SEND는 원 완결로 위임하고 다른 목적/부분 승인 흔적은 일반 성공 분기로 보내지 않는다.

새 private helper는 기존 privileged 경계에 두고 PUBLIC/app 직접 EXECUTE를 부여하지 않는다. 새 함수 중 reserve/settle 두 개만 기존과 같은 인증·현재Tx·목적 검산을 거치는 앱 생산자 RPC의 source상 EXECUTE 접점으로 둔다. context/maximum/rows/actual/complete와 최종guard는 앱 직접 호출을 허용하지 않는다. 기존 invoker 함수가 새 helper의 추가 GRANT 없이 실패하는 구조를 만들지 않는다. 기존 signature/ACL과 다른 목적 본문을 보존하며 실제 DDL/GRANT 실행0이다.

## 업무5 — 원 승인ID v3 보호 재조회와 기존 화면

기존 GET에서만 저장 request/decision/consumption과 원 command ID/hash·queue/receipt/audit를 검산하고 exact originReuseOutcome:{commandId,requestHash,queueCommandRef,status,executionAuthorized,dispatchPerformed}를 반환한다. status는 SYNTHETIC_QUEUE_STORED, 두 표식은 false다. 현재 같은 actor/client와 읽기 권한을 검사하고 읽을 수 없으면 원문/receipt를 숨긴다. APPROVED나 읽기 거절을 미실행 증명으로 취급하지 않는다.

기존 UI08 보호 조회에서 v3/CONSUMED·APPROVE·원 candidateCommandId/복원 명령hash·정확 소비/승인 관계와 outcome 6키·두 false·queue fullref를 검산한 뒤 저장 결과를 읽기 전용으로 표시한다. 원 request snapshot/hash는 계속 v1/PENDING 원형으로 검산한다. 새 실행/재개/소비 버튼·START 재송신·자동 승인/재발행은 추가하지 않는다. 원 UNKNOWN packet/승인ref·선택/제어scope 소유권을 유지하고 늦은 응답이 다른 scope를 덮지 못하게 한다. API만 만들고 화면 연결까지 완료했다고 하지 않는다.

## TDD·검수·반환

첫 RED는 실제 보호 클래스로 P1 S/Q→P2 요청/APPROVE→원 exact8 START→소비1/queue/material/outbox1→원ID GETv3 흐름의 미구현을 보여야 한다. 성공 source/fact override는 금지하며 기존 명시 합성 모델과 원 거절 정책을 사용한다. UI는 기존 GET의 v3 수용/표시 누락을 RED로 보여준다. 합성 결과를 실제 DB 증거로 승격하지 않는다.

필수 음성은 후보/approval/원 명령 교차, REJECT/REQUEST_CHANGE, 다른 Session/H/control, DENY/회수/기한/query/xid, 원문/descriptor/manifest/group/queueRef 오염, 동일DB의 다음Tx 재사용, clone 증명/boolean, 관측 await 뒤 변화, 중복 소비/같은 실행ID 경쟁, 각 저장단계 rollback, COMMIT 불명/replay 추가효과0, v3 graph 누락, 기존7키/null START/SEND 회귀다. SQL 정적 검수에서 exact8 원hash·정역 완결·역사 비용 불변·중복 배제·ACL/DAG를 확인한다.

UI는 outcome 누락/추가키·다른 command/hash/queueRef·true 표식·v2에 소비/outcome 혼입·미승인 소비·늦은 GET/주체/client/project/transport 변경·unmount·401/403 뒤 숨김을 확인한다. GET 실패가 원 packet/영수증 삭제나 자동 POST로 이어지면 안 된다.

변경7시험과 직접 영향받는 기존 FN08 ledger/queue-basis 등을 선택해 실행한다. npm run typecheck, UI 변경의 기존 build/DOM, git diff --check, 원 START 보호 Context의 필요한 회귀를 수행한다. timeout/기대값/skip을 완화하지 않으며 동일 무변경 검사·전수 검사를 불필요하게 반복하지 않는다. 실제 미실행 검증은 명시한다.

Primary는 정확 명령/exit/실제 결과·변경hash/bytes·오류 횟수·살아 있는 handle/미검증을 반환하고 writer를 해제한다. Main 독립 검수의 C/I 미해결0·필요gate PASS 후에만 commit/push/PR 통합한다. 중간 checkpoint는 미완료로 같은 branch에 보존하며 전체 계획 완료로 표시하지 않는다.

## 복구

소유하는 허용 경로의 변경 hunk만 기준 HEAD와 비교해 분리한다. 기존 자료/미추적/다른 사람 변경·원문·적용된 SQL 이력·Git 이력을 덮지 않는다. 통합 후에는 정상 PR revert를 사용한다. 실패·미검증은 WORK_STATUS에 보존한다.
