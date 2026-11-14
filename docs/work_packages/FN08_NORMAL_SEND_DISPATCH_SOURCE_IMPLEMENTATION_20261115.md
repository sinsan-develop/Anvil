# FN08 normal SEND source 구현 지시

- 채택: 2026-11-15 신산님 직접 답변 `A안 계약·source-only 구현 채택`.
- 부모 후보: `docs/contracts/FN08_NORMAL_SEND_DISPATCH_CANDIDATE_20261115.md`, SHA256 `DEA72C3FB14A955E02956C50898A50ED6BE9705E911A17CB651DAFE2847FFB7C`. 후보 원문은 지문 보존하며 이 WI가 채택을 기록한다.
- 기준 HEAD: `16eecc19ebaed0855133c9787aaddc40269160ad`, branch `codex/av3-fn08-normal-stop-contract`.
- 담당: 기존 developer_primary 단일 제품 writer. Main은 문서·검수·통합, 독립 reviewer는 읽기 전용이다.

## 목표

실제 normal START 생산 결과에 SEND 저장→명령 페이지→정확 지시 자료→명령별 permit→동일 명령 재조회를 source/RAM 여정으로 연결한다. 채택 후보의 정상·실패·기한·원 주체·보호 읽기 의미를 그대로 구현한다. Query 생성·STOP·실제 Agent 실행까지 완료했다고 표시하지 않는다.

## 허용 파일

신규 제품:
- `apps/server/modules/executions/normal-instruction-command.ts`
- `apps/server/modules/executions/normal-instruction-materials.ts`
- `apps/server/modules/executions/normal-instruction-source.ts`
- `apps/server/modules/executions/normal-instruction-permit.ts`
- `db/migrations/0097_normal_instruction_dispatch.sql.pending`

기존 제품:
- `apps/server/app.ts`
- `apps/server/modules/projects/routes.ts`
- `apps/server/modules/executions/normal-command-pages.ts`
- `apps/server/modules/executions/normal-start-materials.ts`
- `apps/server/modules/executions/normal-start-permit.ts`
- `apps/server/modules/context/context-sources.ts`
- `apps/server/modules/context/read-access.ts`
- `apps/server/modules/knowledge/conversations.ts`

신규 시험:
- `tests/unit/FN08/normal-instruction-command.test.ts`
- `tests/unit/FN08/normal-instruction-materials.test.ts`
- `tests/unit/FN08/normal-instruction-permit.test.ts`
- `tests/unit/FN08/normal-instruction-dispatch-sql.test.ts`
- `tests/unit/FN08/normal-instruction-dispatch-journey.test.ts`

초기18경로다. 아래 직접 채택한 부분계획 보완2경로를 더해 현재 총20경로로 고정한다. 추가 접점이 실제로 필요하면 먼저 Main에게 정확 경로·이유·계약 영향과 함께 반환한다. Main은 기존 채택 내 내부 파일배치를 판단하고 WI를 갱신할 수 있으나 공개/권한 범위를 늘리지 않는다. 기존 동작을 삭제하거나 기대값을 낮추지 않는다. 다른 담당자의 문서·기존 dirty 작업을 되돌리지 않는다.

### 2026-11-15 부분계획 한정 보완 채택

신산님이 `A안 한정 보완·source-only 구현 채택`으로 후보 `docs/contracts/FN08_INSTRUCTION_PARTS_PLAN_ADDENDUM_CANDIDATE_20261115.md` SHA256 `F3243D1411C4FF434F4548904B99A9B0BBA353EA171FAC0314F7D99353DD91DF`를 직접 채택했다. 정확 canonical plan/목적·1기반번호·64KiB/2MiB/200부분·원 receipt ref 검산·HUMAN GET 경로는 그 후보를 따른다. 새 표/일반 권한은 없다.

추가 소유 경로:
- `apps/server/modules/executions/instruction-parts-plan.ts`
- `tests/unit/FN08/instruction-parts-plan.test.ts`

기존 허용 source/routes/conversations 접점에서 보호 원문→부분계획 GET→SEND의 서버 재생성·비교를 연결한다. 사전 등록 부분계획 모형만으로 전체 여정을 완료하지 말고 실제 보호 reader와 원 메시지/명령 결과를 쓰는 RAM 여정을 보완한다. 실제 사용자 자료 조회·DB·권한·키·서비스·Agent/SDK 실행 제외는 불변이다.

## 진행 및 필수 보호

1. 기존 생산자·guard의 미구현 정상과 핵심 거절 사례를 RED로 확인한다.
2. 원 HUMAN5tuple·ACTIVE grant·현재성·원 START 부모·SEND 예약·정확 지시 원문을 연결한다. 다른 OWNER 허용 회수 규칙을 복사하지 않는다.
3. 명시 normal SEND 앱 설정에서만 등록하고 기본/합성/START를 보존한다. 내부 exported 조립 경로도 exact 설정을 검사한다.
4. 기존0024 명령별 permit을 사용한다. START 세대당 UNIQUE·기존 SQL·일반 권한은 바꾸지 않는다. 새 forward SQL만 source로 작성한다.
5. 첫 SDK init을 새 선행으로 넣지 않는다. 보호 원문 표식은 같은 DB 원본의 정확 대화/메시지/body/parts 및 SEND에 결박한다. caller JSON으로 원 권위를 만들지 않는다.
6. 동일 replay·다른 hash 충돌·BUSY 신규 거절·nonce/attempt 중복·COMMIT 불명·현재성/기한·정정/격리와 교차 대화 접근을 검증한다.
7. 원 NormalInitialExecution 생산값을 쓰는 실제 handler/RAM 저장 여정으로 page/material/permit을 연결한다. 임의 성공 current fixture를 실PG/OS 현재성 증거로 보고하지 않는다.

## 검증·반환

신규 직접 시험, 직접 영향받는 기존 synthetic instruction 및 normal START/page/material/permit 회귀, root TypeScript 검사, diff check를 수행한다. 테스트는 Node/메모리 합성으로 한정한다. 실제 DB·권한·키·서비스·사용자자료 조회·SDK 설치/호출·Agent/C# 실행·외부 원문 추가 조회는 금지한다.

반환은 변경 파일/지문·RED/GREEN 정확 명령/종료/개수·오류 원인·회귀 영향·미실행·rollback·live handle0·쓰기 반환을 포함한다. 중간 모듈 동결 시 Main에게 알려 독립 검토를 겹쳐 진행한다. 자체 commit/push/PR/병합·공용 기록 수정은 하지 않는다. 불명 결과 자동 재실행은 하지 않는다.

전체 계획/FN07/FN08 완료가 아닌 이 source 구현 단위의 검수다. Main이 독립 결과·fresh 필수검사를 대조한 뒤 통합 여부를 판단한다.
