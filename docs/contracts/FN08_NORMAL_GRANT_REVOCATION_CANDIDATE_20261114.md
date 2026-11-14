# FN08 기존 HUMAN 허가 회수의 normal 저장 계약 후보

상태: 미채택 후보. 기준 main `97a2a7348df2815b491c6373e2314609a2bd3842`. 실제 DB·권한·키·서비스·Agent 실행 승인이 아니다.

## 목적과 기존 근거

기존 D071 제안서 §6의 `revokeExecutionGrant`는 HUMAN 명령이다. 현재 합성 생산자와 0022 회수표가 있으며, 0084 normal challenge는 같은 표의 회수 기록을 거절 근거로 읽는다. normal 생산자 누락만 연결한다. 회수 저장은 프로세스 종료·credential 삭제·writer 해제 완료가 아니다.

기존 공개 commands 경로·요청 필드·현재 OWNER/로그인/단독 제어·명시 회수 정책을 유지한다. 새 endpoint·role·표·자동 권한을 추가하지 않는다. 기존 synthetic 코드와 0022 원문은 보존하고 normal 분기만 미적용 forward SQL로 보완한다.

## 제안하는 정확한 저장·응답 의미

| 위치 | 제안값 |
|---|---|
| snapshot.transport 및 currentBinding.transport | NORMAL_PROTECTED |
| snapshot.state | NORMAL_REVOCATION_STORED |
| 기존 영수증 바깥 status | APPLIED 유지 |
| 기존 영수증 data.status | NORMAL_GRANT_REVOCATION_STORED |

snapshot의 scope/request/requestHash/requestedBy/currentBinding/reason/recordedAt/authorityExpiresAt 및 기존 ref 구조는 유지한다. snapshot과 receipt.data의 revocationEffectiveVerified/credentialRevocationVerified/writerReleaseVerified/executionAuthorized/dispatchPerformed는 모두 false다. APPLIED는 이 명령의 기록 저장만 의미한다. 새 바깥 transport/state는 추가하지 않는다. 기존 합성 응답과 구분되지만 검증되지 않은 효과를 나타내지 않는다.

기존 synthetic 영수증은 기존 판별값과 원 payload로 그대로 재조회하며 normal로 변환하지 않는다. normal 영수증은 위 세 값을 정확히 검산하고, 알 수 없는 transport/state/status 조합은 거절한다. 같은 명령 재조회는 저장된 원 결과를 그대로 반환하며 이전 합성 기록을 normal 현재성의 근거로 사용하지 않는다.

## 주체·기한·거래

- requestedBy는 현재 인증된 회수자이며 currentBinding.grantSubject는 원 grant의 발급 주체다. 둘의 동일성을 강제하지 않는다. 현재 OWNER가 명시 정책에 따라 다른 발급자의 과거 grant를 회수할 수 있는 기존 규칙을 보존한다.
- 기존 runtime 정책 검산을 유지한다. 최신 PROJECT 범위 APPLIED budget만 허용하고 미설정·만료·철회·DENY 및 일치하는 REQUIRE_APPROVAL은 기존 규칙대로 거절한다. approvalRef는 null이며 승인 소비 경로를 새로 열지 않는다.
- 현재 normal EXECUTION grant의 ACTIVE/EXPIRED를 대상으로 한다. 원 발급자의 현재 로그인·제어권과 원 grant의 유효 기한을 회수 조건으로 재사용하지 않는다. 만료 grant를 되살리지 않는다. RECOVERY normal 신규 발급은 범위 밖이다.
- 대상의 project/execution/generation/fullref/hash/sourceScopes를 원 저장에서 검산·잠금한다. currentBinding의 permissionPolicyRef/budgetPolicyRef는 현재 회수 요청에 적용되는 정확 정책이며 과거 발급 정책과 혼동하지 않는다.
- 권한 기한은 현재 HUMAN 세션·명시 회수/예산 정책·최대 30초의 최단 기한이다. OS current·설치·journal·Agent 응답은 요구하지 않는다.
- 같은 인증 거래에서 current OWNER/session/control/policy, command/authorization receipt/audit/revocation 행을 검산하고 원자 저장한다. grant별 회수 1행·append-only·현재 한도·정확 참조 보호는 유지한다.

## 중복·실패

동일 actor/client의 동일 commandId/hash는 현재 권한 검산 후 원 영수증만 반환한다. 원 ref·시각·기한을 갱신하지 않는다. 같은 commandId의 다른 내용은 기존 충돌 거절, 다른 commandId로 동일 grant 이중 회수는 409 GRANT_ALREADY_REVOKED다. 중복 연산으로 새 회수·감사·outbox 효과를 만들지 않는다.

COMMIT 확정 전 성공 반환 금지, COMMIT 불명은 자동 재시도·성공 승격 금지다. 기존 AccessRepository의 원 오류 전파·release(error) 및 app의 503 STORAGE_FAILED / retryDisposition: reconcile-first를 재사용한다. 새 normal 전용 오류나 AuthFailure로 변환하지 않는다. 기존 ROLLBACK 시도는 COMMIT 실패 확정 또는 결과 소멸의 증거로 간주하지 않는다. 후속 동일 명령의 명시 재조회와 자동 재실행은 구분한다.

## source-only 구현 후보 7경로

1. apps/server/modules/executions/normal-grant-revocation.ts
2. db/migrations/0096_normal_grant_revocation.sql.pending
3. apps/server/modules/projects/routes.ts
4. apps/server/app.ts
5. tests/unit/FN08/normal-grant-revocation.test.ts
6. tests/unit/FN08/normal-grant-revocation-sql.test.ts
7. tests/unit/FN08/normal-grant-revocation-journey.test.ts

이는 소유 후보이며 구현 전 실제 경로 충돌과 호출 계약을 고정한다. 기존 app 조회/쓰기 권한을 확대할 필요가 발견되면 임의로 추가하지 않고 실제 변경점을 별도 분류한다.

## 검수와 미검증

원 normal producer → 현재 다른 OWNER의 회수 명령 → 원자 저장 → 동일 명령 재조회 → 기존 normal challenge 거절을 제품 함수 RAM 여정으로 검증한다. 만료 grant, 교차 참조·옛 세대, 정책 철회, 동시 중복, 부분 rollback, COMMIT 응답 유실을 포함한다. OS current 포트는 호출하면 실패하는 대역으로 두고 호출 0을 단언한다. 기존 synthetic 회귀와 변경 범위 타입·문법을 확인한다.

실제 PostgreSQL의 동시성/권한·Windows·credential 효과·프로세스 종료·Agent 통합은 미검증으로 남긴다. 실제 DB·권한·키·사용자 파일 조사·설치·서비스·C#·Agent 실행은 하지 않는다. source 검수 완료를 전체 계획 완료로 올리지 않는다.
