# FN06 native 준비 전용 권위 source 구현 계획·작업지시서

2026-11-02 / Main 어울 / **R2_A_SOURCE_APPROVED · TEST_FIRST · 단일 기존 Primary**

> 신산님의 r2 A 직접 승인을 기록했다. 기존 Primary가 Main GO 후 subagent-driven-development·TDD로 구현하며 기존 Reviewer는 읽기 전용, Main은 검수·통합을 맡는다. 실제 효과 제외는 유지한다.

**목표:** 별도 준비 권위의 HUMAN 요청·원 영수증·writer 예약·보호 저장/조회와 connector의 한 번 소비·factory 진입 보호를 source에서 연결한다. coding Agent 실행 기능의 완료를 뜻하지 않는다.
**구조:** 기존 D1/v1·writer 계약을 보존하고 새 목적의 분리 모듈과 forward 미적용 SQL만 추가한다. 실제 공급자·라우트는 기본 미등록이며 보호 공급자 부재를 성공 대역으로 채우지 않는다.
**기술:** 기존 TypeScript/Node/Fastify·PostgreSQL adapter source·React·Node test/메모리 ReactDOM. 의존성·package/lock 변경 없음.
**채택 설계:** `docs/contracts/FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md` r2 A, SHA256 `5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085`. 직접 승인 기록은 `docs/04_test_reports/AV3/FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md`다. 원 후보의 정확 필드·정책·wire·저장 한도가 정본이며 이 WI가 변경하지 않는다.

## 1. 착수 조건과 제외

- [x] 신산님의 새 직접 지시로 r2 A 채택을 확인하고 발화/대상 hash/제외 범위를 별도 기록했다. 시간 경과·권장·질문 전달·기존 writer B 승인을 채택으로 취급하지 않는다.
- [ ] Main이 현재 branch/HEAD·dirty 소유권·후보 hash·기존 SQL·보호 untracked3 보존을 확인하고 아래 정확 경로에만 GO를 전달한다. 미채택이면 계획·읽기만 하며 제품/SQL 쓰기0이다.
- [ ] 실제 DB/DDL/GRANT·권한·계정·키·CA/TLS·서비스·OS/native/compiler/helper·Agent·실자료/백업 파일 조사·P03 R3는 계속 제외한다. 합성 시험의 대역 함수 호출은 실제 OS/factory 호출이 아니다.
- [ ] 같은 기능/경로 writer는 기존 Primary 한 명이며 Main 동시 수정0. 새 agent/chat/branch/worktree/예약0. 추가 경로가 필요하면 쓰기 전에 Main에 이유를 반환한다.

## 2. 정확 경로 초안

기존 수정 후보 9개:

1. `apps/server/app.ts` — 주입 가능한 선택 등록, 기본 미등록 보존.
2. `apps/server/modules/access/project-command.ts` — 새 두 operation과 원 공통 command/receipt 연결.
3. `apps/server/modules/approvals/project-approvals.ts` — 새 준비 명령의 정확 승인 요청/결정/소비 결박.
4. `apps/server/modules/executions/project-writer-authority.ts` — 새 intent를 명시 검산하는 예약 분기만 추가, 원 D1 branch 보존.
5. `apps/web/src/features/connections/ConnectionsPage.tsx` — 새 패널 진입/버퍼 연결.
6. `apps/web/src/App.tsx` — 기존 방식의 소유자·project·client 문맥별 버퍼 보존.
7. `apps/web/src/features/decisions/api.ts` — 새 준비 원명령의 승인 요청 소비.
8. `apps/web/src/features/decisions/ApprovalsPage.tsx` — 새 목적 표시/정확 원명령 확인.
9. `apps/web/src/features/connections/policy-editor-profile.ts` — 기존 준비 profile 안의 두 행동 표시 후보. 실제 소비 대조 뒤 확정하며 기존 정책 자동 변경0.

신규 source 10개:

10. `contracts/runtime/native-preparation-authority-v1.ts` — 정확 DTO·canonical/fullref·목적/상수.
11. `apps/server/modules/executions/native-preparation-input.ts` — HUMAN exact 입력과 원 intent 생성/검산.
12. `apps/server/modules/executions/project-native-preparations.ts` — 현재 권한·원 명령·영수증·예약·발급 source 조율.
13. `apps/server/modules/executions/native-preparation-store.ts` — 실제 PG query/INSERT/CAS/단일 Tx source 및 보호 조회·한도.
14. `apps/server/modules/executions/native-preparation-routes.ts` — 후보의 HUMAN/host 목적 분리 API.
15. `apps/connector/runtime/native-preparation-client.ts` — 고정 채널·요청 proof·전체 예산·응답 검산.
16. `apps/connector/runtime/native-preparation-local-attempt.ts` — 보호 local journal 포트와 원시도 상태 검사.
17. `apps/connector/runtime/native-preparation-factory-consumer.ts` — private owned capability의 단발 소비와 호출 전 current/기한 검사.
18. `apps/web/src/features/connections/native-boundary-preparation-api.ts` — same-origin 요청·응답/명령 검산·보존.
19. `apps/web/src/features/connections/NativeBoundaryPreparationPanel.tsx` — 선택→요청/승인→원결과/과거 조회.

신규 미적용 SQL 1개:

20. `db/migrations/0071_native_preparation_authority.sql.pending` — 후보의 분리2표·불변/정확 사건/원 연결·보호 guard. 번호는 GO 직전 실제 목록에서 부재 확인 후 확정한다. manifest/적용 SQL/기존 SQL 변경0.

신규 시험 5개:

21. `tests/unit/FN06/native-preparation-authority-contract.test.ts`
22. `tests/unit/FN06/native-preparation-store.test.ts`
23. `tests/unit/FN06/native-preparation-routes.test.ts`
24. `tests/unit/FN06/native-preparation-client.test.ts`
25. `tests/unit/UI11/native-boundary-preparation.test.ts`

26. 기존 `tests/unit/UI11/preparation-policy.test.ts` — 채택 후 새 두 행동을 명시 추가하고 정확12 목록·12×3 처리를 검산한다. 채택 전 기존 정확10 보완과 분리한다.

27. 기존 `apps/server/modules/approvals/approval-input.ts` — 새 prepareNativeBoundary에만 정확1 baseline head fullref와 target/version 일치 분기를 연결한다. 기존 다른 연산의 비어 있지 않은 baseline 거절과 activateDesignChange 원형은 보존한다.

Main 문서는 이 WI·WORK_STATUS·WORK_PLAN·승인 기록과 결과서다. 다른 소스·보호 파일·Backup·전역 설정은 소유 범위 밖이다. 기존 Primary의 읽기 대조로 정책 UI는 기존 PROJECT_PREPARATION 목록에 두 행동을 추가하면 되고 새 profile/buffer는 불필요함을 확인했다. 위27경로를 채택된 source 허용 범위로 확정한다. 실제 사용자 정책을 부여하지 않는다.

## 3. 업무 A — HUMAN 원명령에서 보호 저장·재조회까지

- [ ] 원 후보의 HUMAN command exact11·payload5·server 생성 actor/세대·원 intent→receipt→RESERVED→authority 비순환 순서를 먼저 시험한다. 존재하지 않는 module import만으로 RED를 주장하지 않는다.
- [ ] AUTO 정상, REQUIRE_APPROVAL의 원 command/hash/기한/일회 소비 정상과 DENY·다른 주체/등록/old head·만료·옛 세대·승인 재사용 실패를 고정한다. 원 D1 reader/합성 승인 계약은 바꾸지 않는다.
- [ ] 기존 approval-input의 nonempty baseline 거절 반례를 신규 FN06 routes 시험에 넣고, 새 준비 operation에만 정확1 head fullref·target/expectedVersion 일치의 정상 승인 요청을 연결한다. 빈/다중/다른 head·불일치 hash 및 기존 다른 operation 거절은 보존한다. 후보 원 명령과 actionScope의 정확 대조도 함께 확인한다.
- [ ] 원 common command/receipt/audit·writer event/head·새 authority/events가 같은 Tx에서 전부 commit 또는 rollback되는 PG adapter source를 구현한다. fake PoolClient로 실제 query 순서와 저장 재조회·CAS·오류 rollback을 시험한다. 메모리 모델만 구현하고 PG 저장 source 완료로 보고하지 않는다.
- [ ] 2표 합산 record/bytes·기존 project used+held와 신규 크기·event 한도를 원 후보대로 검사한다. 실제 파일 크기를 조사하지 않고 supplier 부재는 거절한다. 포화 시 fresh close도 막힐 수 있는 A의 한계를 표시하고 완화하지 않는다.
- [ ] current 접근 검사를 통과한 원 역사 replay는 fresh phase/사업 기한 검사보다 먼저 원결과를 반환한다. fresh 발급/소비만 정확 RESERVED·동일 원 tuple·최단기한을 요구한다. 회수/만료 credential은 권한 없는 역사 조회 우회로 쓰지 않는다.

## 4. 업무 B — host 보호 채널·한 번 소비·factory 진입까지

- [ ] 후보의 세 host API와 정확 proof8필드/별도 목적, nonce·고정 origin/TLS profile·등록 키 지문·digest 보관 경계를 구현한다. STATUS_ONLY/합성 credential·cookie·query token·redirect·추가/누락 필드는 거절한다.
- [ ] consume receipt→COMMITTED 사건→첫 permit을 단방향으로 만들고 COMMIT 전 응답을 내보내지 않는다. 같은 원 요청 replay는 저장 receipt/recordRef와 null permit만 반환한다. commit 후 응답 유실·재시작·다른 요청 충돌에서 두 번째 callable capability를 만들지 않는다.
- [ ] local PREPARED를 먼저 보관하고 challenge/proof/receipt/permit에 같은 localAttemptRef를 결박한다. FACTORY_ATTEMPTED append·flush·readback 뒤에만 소유 capability를 한 번 소비한다. 복사/직렬화한 JSON은 callable이 아니다.
- [ ] ATTEMPTED/UNKNOWN 재시작·consume 성공 응답 유실·journal 부재/불명·현재 등록 회수/clock 역행/await 뒤 만료/중복 요청 실패를 시험한다. 보호 journal 구현체가 없는 포트를 실제 내구 저장으로 부르지 않는다.
- [ ] 원 작업 전체 최대10초·각 최소기한·최대30초 proof/permit·왕복 단조 elapsed 차감을 유지한다. 응답별 대기로 예산을 다시 시작하지 않는다. mock factory counter 외 실제 factory/OS 실행0이다.

## 5. 화면 업무 — UI11 요청·승인·과거 조회

- [ ] 접힘 진입의 자동 요청0, 명시 options/선택·권한 정책/원 준비 요청→필요 시 UI08 일회 승인→같은 원명령 결과 확인→보호 과거 조회를 연결한다. options 공급자 부재503을 수동 ID나 과거 성공으로 대체하지 않는다.
- [ ] 토큰·키·actor 원문·물리 경로를 노출하지 않는다. 원 receipt 확인도 실제 native 준비/Agent 실행 성공으로 표시하지 않는다. 기존 후보·환경·writer 조회 및 다른 화면 버퍼를 보존한다.
- [ ] 메모리 ReactDOM 실제 click/effect로 정상/거절·결과 불명·동일 원명령·project/client/transport ABA·닫기/unmount 뒤 지연 응답 폐기를 시험한다. 새 정책 행동 선택은 기존 규칙 보존을 검산하고 실제 사용자 정책을 부여하지 않는다.

## 6. 검수·통합·완료 판정

- [ ] 각 업무의 실제 행동 반례 RED→최소 GREEN→인접 회귀를 보고한다. 준비 오류·정식 기능 오류·SKIP/NOT_SELECTED를 구분하고 변경 없는 전체 검사를 반복하지 않는다.
- [ ] `node --test`로 위5 시험과 실제 변경으로 직접 영향받은 기존 `tests/unit/UI11/preparation-policy.test.ts`, writer state/routes, FN11 승인 입력 중 필요한 항목을 선정한다. 키 생성/실제 fixture 실행을 포함하는 경로는 실행 전 분리하고 고정 합성 검증만 사용한다.
- [ ] `tsc --noEmit -p tsconfig.base.json`, 기존 메모리 Vite build(write:false)의 browser server-import 검사, `git diff --check`를 수행한다. 실제 DB·Browser·서비스·native·Agent·P03 R3 시험은 NOT_RUN이다.
- [ ] Primary는 정확 파일/hash/diff·명령/exit·반례·미구현 supplier·미검증·잔여 handle0과 writer 반환을 제출한다. Main fresh 검증과 기존 Reviewer C0/I0 확인 전 source 완료 판정/통합0이다.
- [ ] Main은 허용 branch에 정확 파일만 checkpoint/private 게시하고 local/private SHA·main 불변·보호 파일을 대조한다. 실제 gate 미충족으로 PR/main 병합·배포·인수0이다.

**검수 초점:** 승인 자기소비 뒤 정상 rollback, 원 intent/hash 순환, CAS/limit 후 부분 commit, 역사 replay에 새 permit 발급, local await/재시작 뒤 중복 factory 호출을 각 담당 시험에서 직접 고정한다.

**복구:** source 변경은 전용 commit의 정상 revert 후보로 보존한다. 실제 DB에 미적용이므로 down migration·자료 삭제를 수행하지 않는다. 보호 dirty/untracked와 기존 승인 원본은 그대로 둔다.

**남는 미구현:** writer bootstrap의 실제 issuer/관측·물리 source 강제·보호 채널/키 발급·내구 local journal/실제 factory·actual START/SEND/STOP/ACK·장기 lease/실제 회수. 이번 source 포트·합성 성공은 이들 기능의 구현 또는 실행 증거가 아니다. 전체 FN06/FN08/Stage/작업계획서 완료가 아니다.

## 7. 초안 검토 이력

초안 SHA10C886A2ECEBFB05025793CCA155053109FB27DA766BCF7DAE03A71221780AFE의 독립 C0/I1은 후보 baselineRefs 계약을 현재 approval-input.ts가 거절하지만 해당 경로가 빠진 점이다. Main이 현재 source와 후보 §10.1을 대조해 27번째 경로·새 operation 한정 분기/반례를 추가했다. 후보 의미·승인 상태는 바뀌지 않았고 제품 쓰기0이며 재검토 대상이다.
