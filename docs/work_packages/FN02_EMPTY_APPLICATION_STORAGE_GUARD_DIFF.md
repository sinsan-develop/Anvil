# FN02 빈 프로젝트 적용 전환 — 저장 보호 차이와 후속 검수

- 담당: Main 어울. 2026-10-20, 기존 Stage B/FN02 구현의 부분 작업이다.
- 상위 범위: `docs/contracts/INTERFACES.md`의 `applyMethodology(methodologyRef,expectedApplicationVersion,reason)` 및 FN02 카드. 새 Agent/계정·방법론 기능을 제안하지 않는다.
- 상태: 서버 source 후보·합성 DB 검수. **새 forward 파일 작성/등록/적용 0, 실제 DB/양성 COMMIT/served 미검증**. 아래 내용은 현재 SQL의 실행 허가나 이미 적용된 보호가 아니다.

## 1. 현재 구현과 필요한 제한

기존 `/api/v1/projects/:projectId/commands`의 `applyMethodology`만 사용한다. `targetId=projectId`, `expectedVersion=expectedApplicationVersion`으로 현재 적용 세대를 CAS한다. 현재 HUMAN·OWNER/client/control·별도 명시 정책은 기존 command transaction을 사용한다. 추가 baseline/approval 참조를 이 기능이 임의 해석하지 않는다. REQUIRE_APPROVAL의 기존 미연결 거절을 AUTO로 바꾸지 않는다.

현재 source는 같은 project/control 잠금 안에서 `assignment_drafts`, `execution_preparations`, `agent_sessions`, `executions`, `execution_grants`, `writer_claims`, `execution_commands`의 **실제 부재**를 한 번에 조회한다. 하나라도 있거나 결과가 불명이면 `EXECUTION_STATE_UNVERIFIED`다. 만료/회수/완료 상태를 빈 이력으로 간주하지 않는다. `assignment_drafts=0`에서 다른 원장 부재를 추론하지 않는다.

고정 적용본 hash·현재 세대, 프로젝트 전용 방법론의 현재 head/hash·확정·최신 ACCEPTED 검토의 확정 포함·prepared forms를 확인한다. 새 UUID/적용세대/snapshot만 append하고 기존 snapshot을 갱신하지 않는다. 적용 이유는 snapshot 형식을 바꾸지 않고 불변 commands receipt data에 보존한다. 이 작업은 Agent 실행·기존 실행 재개·writer 회수 검증이 아니다.

## 2. 현재 SQL이 양성을 막는 정확 지점

`0011_project_creation.sql`의 `guard_initial_project_methodology`는 createProject 사건·최초 세대 1만 허용한다. 현재 후보를 실제 DB에서 실행하면 그 guard를 통과했다고 주장할 수 없다. 현 SQL을 수정하거나 transaction 설정으로 createProject를 위장하지 않는다.

정상 서비스의 project/control 잠금만으로 직접 DML 경합까지 보장하지 않는다. 특히 `0012_assignment_drafts.sql`의 기존 직접 INSERT guard에는 명시 project 잠금이 없고, `0017_execution_authority.sql`에는 assignment FK가 없는 실행/grant 경로가 있다. 합성 resolver의 반환값을 실제 빈 이력/OS 안전의 근거로 쓰지 않는다.

## 3. 필요한 forward 보호 diff — 아직 작성·적용하지 않음

1. 기존 SQL 파일·초기 createProject 분기·UPDATE/DELETE 금지·과거 행을 보존한다. 새 파일명/순서는 실제 runner와 현재 migration 목록을 대조한 뒤 정한다.
2. project_methodologies INSERT guard에 별도 `applyMethodology` 분기를 추가할 경우, 현재 actor/client/control/policy, exact 원 command/request hash·receipt·감사, 목표/적용 세대 CAS, 정확 확정/최신 검토·양식, 7원장 부재, snapshot/ref/이전 적용 ref/사용자 reason을 **같은 transaction**에서 다시 결박해야 한다. 단순 operation 문자열만 허용하지 않는다.
3. 역방향 deferred COMMIT 검사로 APPLIED apply command에는 정확히 1개의 일치하는 새 적용 행이 있어야 한다. receipt만 남기거나 row만 삽입하는 경로를 막는다.
4. 부재 검사와 경합하는 직접 DML에는 동일 프로젝트 잠금 순서를 먼저 적용해야 한다. 후보 대상은 위 7원장의 INSERT 경로다. 기존 guard를 우회하지 않고 trigger 실행 순서·다른 정상 command·초기 생성·다른 프로젝트·deadlock 영향을 검토해야 한다. 추가 보호만으로 기존 execution/preparation 결박 누락을 해결했다고 주장하지 않는다.
5. app DML 권한 범위를 넓히거나 실제 사용자 정책을 자동 부여하지 않는다. 신규 DB 사용자/키·Secret·OS helper·정식 서비스 변경은 포함하지 않는다.

이 diff에는 **기존 DB 쓰기 허용 조건과 직접 DML의 동시성 보호 변경**이 포함된다. 논리 기능은 이미 승인됐지만 실제 forward 작성/채택·격리 실행·정식 적용의 실행 범위는 구분하여 PMO에 정확 근거를 전달한다. 0011을 즉석 완화하거나 source TDD의 PASS로 이 결정을 대신하지 않는다.

## 4. 후속 검수·완료 기준

- source: 정상 append, 7원장 각 단독 존재/불명, 다른 주체/세대·target, stale application/source head, 확정/최신검토/양식 부족, 같은 source 중복, 이유 보존, 동일 명령 replay·충돌, 저장 실패 원자 rollback.
- 격리 PG는 별도 정확 범위/자원 등록 후에만 수행한다. 모든 적용 SQL의 구문/COMMIT, 초기 createProject 불변, 직접 DML의 잘못된 receipt/정책/양식 거절, row-only/receipt-only COMMIT 거절, 동시 적용/직접 임무 INSERT·grant INSERT와의 경쟁을 실제 확인한다. 다른 프로젝트 기존 흐름의 영향도 확인한다.
- 서버 저장 보호가 확인되기 전 UI의 양성 완료나 실제 전환 성공을 표시하지 않는다. 이후 기존 UI03에서 별도 명시 적용·미확인 명령 보존·재조회까지 연결하고 실제 DB/served 상태를 따로 기록한다.
- rollback: 새 소비를 일반 revert로 닫고 과거 snapshot/receipt는 보존한다. forward 적용 이력을 down/DROP/force rewrite하지 않는다.

## 5. 현재 증거

- 신규3 첫 양성 RED/음성2 PASS 392.7712ms → source3 PASS 934.25ms. 음성의 초기 PASS는 기존 무조건412 경로이며 새 양성 구현의 증거가 아니다.
- implicit-any 보정 뒤 재검증 PowerShell 초기화 실패 `0x800705AF`, exit `-532462766`: 그 시도의 tests/type는 미실행이다. OS/pagefile/권한 변경0.
- 같은 설치 경로 Node v24.18.0을 직접 확인하고 cmd로 미실행 집중/직접11 PASS 4855.1594ms·type0. 물리 메모리 여유만으로 PowerShell 원인을 확정하지 않는다. cmd의 초기 인용부호 오류도 제품 실패가 아니다.
- 독립 검토 C0/I1/M0의 적용 이유 소실 → 반환/commands INSERT result_ref 검사 RED391.8935ms → receipt.data.reason 보존 뒤 집중4 PASS287.8512ms·type0·한정 재리뷰 C0/I0/M0. 원 I1 이력 유지.
- `row/read`를 대체한 합성 DB 시험은 실제 원문/검토 영수증·HTTP 인증/정책/replay·실제 PG/경합/COMMIT을 증명하지 않는다. 실제 기능은 여전히 **부분 구현**이다.
