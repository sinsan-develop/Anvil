# FN06 writer 권위 B·저장 한도 A — source-only 구현 작업지시서

2026-11-02 / Main 어울 / ADOPTED_SOURCE_ONLY / TEST_FIRST

## 1. 기준·목표
부모 B: docs/contracts/FN06_ACTUAL_WRITER_AUTHORITY_DELTA_CANDIDATE.md SHA BF19670DAF44B01D2EAA12CB4CB8661AB573A77CF6133A5B3EC4FBAD8885533D.
한도 A: docs/contracts/FN06_WRITER_AUTHORITY_STORAGE_LIMIT_DECISION_20261102.md SHA A74FF95EEFB4526D38F678DBAFA07344ECFB518DC3C86519AECE201133D72484.
직접 승인: docs/04_test_reports/AV3/FN06_WRITER_AUTHORITY_SOURCE_APPROVAL_20261102.md SHA 63C7EECF3E6C479133E57B4DAB2225C2B474CE5DAD6D65F2771AFD898E397C98.
계획 FN06/FN08·설계의 명령/권한/원문/회수·이력 요구를 위한 별도 writer current/history 원장과 정확 source 계약을 구현한다. 시작 HEAD2d595c7813b2981709386aa3c1ce95b3c73593d8 local/private 동일·tracked clean/보호3 보존. 실제 착수 기준은 Main의 이 WI 게시 commit이다.
부모의 미승인 표기는 승인 전 이력이다. 기존 D1정확5표·합성 writer_claims·SyntheticOwnershipPreparationStore·ProviderHandle·환경507B를 actual로 승격하지 않는다.

## 2. 역할·정확 허용11경로
기존 Primary 단일 code/test writer, Main 문서/관리/독립 검수/통합·Git. 같은 경로 동시 writer0. 새 agent/세션/branch/예약0.
기존 수정4:
- apps/server/app.ts
- apps/server/modules/projects/routes.ts
- apps/server/modules/access/project-command.ts
- apps/server/modules/approvals/project-approvals.ts
신규7:
- contracts/runtime/project-writer-authority-v1.ts
- apps/server/modules/executions/project-writer-authority.ts
- apps/server/modules/executions/project-writer-authority-routes.ts
- db/migrations/0070_project_writer_authority.sql.pending
- tests/unit/FN06/project-writer-authority-contract.test.ts
- tests/unit/FN06/project-writer-authority-state.test.ts
- tests/unit/FN06/project-writer-authority-routes.test.ts
0070은 실제 파일 목록0069 다음의 미사용 번호로 확인했다. 기존 적용/미적용 SQL 원본·manifest·package/lock·계정/설정 파일은 수정하지 않는다. 경로 밖 변경이 필요하면 근거를 먼저 Main에 반환한다. 정본 WORK_STATUS/WORK_PLAN·이 WI/결과 문서는 Main만 갱신한다.

## 3. 구현 계약의 고정 원칙
부모 §4의 event/head 정확 열·fullref·hash snapshot·kind/phase와 §5의 네 서명 domain, bootstrap 명시 null 및 lease-bound 필수 필드를 그대로 구현한다. 자유 JSON/임의 source bool·caller NONE·기간 만료를 실제 권위로 받지 않는다. SourceScopeV1/canonical/fullref·기존 공개키 검산 저수준 연산만 재사용하고 등록 proof exact8·서명 바이트·D1 scope를 넓히지 않는다.
event의 kind별 payload는 부모의 필수 결박을 exact한 닫힌 합집합으로 정한다. unknown key·다른 namespace·자기 headRef/hash 순환·상태 head와 event tip 혼동을 거절한다. 상세 내부 명칭은 이 요구 안의 구현 방법이며 새 operation/효과/권한은 추가하지 않는다.
establish는 현재 HUMAN/OWNER·제어·최근 재인증·정확 정책/필요승인·현재 등록/범위를 검사한 원명령에 purpose별 두 REQUESTED/nonce를 결박한다. 두 ACCEPTED와 최초 BOUNDARY_ESTABLISHED/head 생성은 원 요청과 현재 HUMAN·head 부재·과거 전체 이력·epoch·기한 재대조 후에만 가능하다. 최초 과정을 위해 기존 D1의 execution 필수 scope를 가짜 값으로 채우지 않는다. 추가 사용자 승인 클릭을 임의 요구하거나 다른 주체로 가장하지 않는다.
reserveWriterAuthority는 검산된 원 preparation command/receipt·승인·등록·scope와 정확 head CAS를 받는 별도 내부 접점이다. 기존 합성 준비 객체로 예약을 성립시키지 않는다. 새 lease용 nonce/요청을 발급하며 bootstrap 보고를 재사용하지 않는다. 실제 native factory는 호출하지 않는다.
NATIVE_CREATE_REQUESTED/OS_OBSERVATION_ACCEPTED/SOURCE_FENCE_OBSERVATION_ACCEPTED/ACTIVATED는 부모의 동일 lease/epoch·서로 다른 purpose·원 factory/증빙 참조와 현재성을 모델로 검산한다. 새 임의 OS 사실 원형이나 강제 수단을 설계해 actual 지원으로 선언하지 않는다. 실제 관측/현재 권위 공급자가 없으면 미등록/UNAVAILABLE다.
revoke는 RECLAIM_PENDING으로 새 배정을 막고, 원 run 실제 종결·source WRITE 폐쇄의 충분한 fresh 증빙을 검산한 모델에서만 RECLAIM_CONFIRMED/RECLAIMED_AT가 된다. UNKNOWN/EXPIRED/응답 유실은 EMPTY나 회수 성공이 아니다. head 유실·옛 epoch의 lease·이력 절단/미확인 복원·환경 재등록은 UNSUPPORTED/UNKNOWN이며 최초 경로로 복구하지 않는다.
같은 project lock→current head→준비 slot/원명령/승인/예산 순서를 지킨다. 현재/기한/주체/등록·source/tip이 await 중 바뀌면 새 mutation을 거절한다. 원자 journal 모델의 commit 전/후 유실을 구분하고 원 결과 replay는 현재 접근 검사 후 추가 사건/nonce/lease/실행0으로 반환한다.

## 4. API·의존성·미적용 SQL
부모 §5의 establish/revoke/current와 connector writer-observations 입구·HUMAN operation만 연결한다. 기존 ProjectCommand/현재 인증·OWNER/단독제어·정책·일회승인·원명령 hash/영수증/감사 구조를 재사용한다. arbitrary request body의 actor/true/ref만으로 통과시키지 않는다.
app 의존성은 기본 undefined/미등록이다. 제품 buildApp의 기본 등록과 실제 실행 소비는 열지 않는다. 명시된 source-only 검수 의존성에서만 실제 handler와 상태기계를 합성 검수한다. 반환의 executionAuthorized/dispatchPerformed·실제 권위 가용성은 false로 구분하고 ACTIVE 모델 상태를 실제 Agent 실행으로 보고하지 않는다.
새 목적 credential issuer·키·인증서·서버 신뢰·native IPC/stdio·process/OS/source fence를 준비하거나 호출하지 않는다. REGISTRATION_STATUS_ONLY를 새 보고/준비 권한으로 쓰지 않는다. source 공급자 인터페이스와 실제 공급자 부재를 구분하고 실제 supplier를 빈 성공 함수로 대체하지 않는다.
0070은 current/history2표·PK/unique/FK/불변/참조·기본 DML 거절/RLS false를 정의하는 forward 미적용 SQL이다. 실제 DB/SQL/DDL/GRANT·역할·정책 부여0, 기존 manifest 등록0. schema/static/모델 PASS를 PG RLS/OID·원자성/경합/COMMIT 기한 검증으로 승격하지 않는다.

## 5. 저장 한도 A — 임의 개선/축소 금지
프로젝트의 전체 epoch/lease events10000·head1, 모든 event+현재 head의 canonical UTF-8 합계64MiB(67108864), payload2MiB·전체 wrapper4MiB·targets200을 검산한다. 실제 canonical bytes로 계산하고 caller 숫자를 신뢰하지 않는다. 기존 used/held와 이 원장의 합산10GiB는 모델에서 검산하되 기존 quota SQL/다른 저장 계약을 임의 확장하지 않는다.
fresh 증가를 같은 원자 경계에서 계산하고 초과 시 event/head/receipt 전체를 거절한다. 원 replay/보호 조회는 추가0이며 UNKNOWN·만료·회수 이력도 분모에서 제외하지 않는다. 현재 head 교체는 기존 head canonical bytes를 빼고 새 head를 더한다. event 자동 삭제·초기화·회수 이력 환급0이다.
별도 회수 용량 예약은 없다. 포화면 새 revoke/reclaim/UNKNOWN 저장도 원자 거절하고 원행/head/receipt를 보존한다. 미수용 보고를 저장했다고 하거나 회수확정/다음 writer로 승격하지 않는다. 이 한계를 실제 안전성으로 포장하지 않고 다른 B예약안을 몰래 구현하지 않는다.

## 6. TDD·필수 검수·진행
WA-1 exact DTO/hash/domain/명시 null·한도; WA-2 bootstrap/CAS/lease·revoke·history/replay/UNKNOWN; WA-3 source 입구/원 승인·정책·기한과 기본 미등록/현재조회 및 SQL 정적 검수 순서로 구현한다.
첫 RED는 가능한 기존 buildApp/명령 경로의 누락 route/operation·현재성 경계 같은 기능 반례로 확보한다. module/loader 부재는 준비 실패로 별도 기록하고 기능 RED라고 부르지 않는다. 테스트 먼저 작성하고 실제 실패를 확인한 후 제품을 작성한다.
필수 음성: 두 bootstrap purpose 교차·누락/null혼합·같은 nonce/report 재사용, 두 요청 경쟁/head생성후bootstrap·head유실/옛epoch/history절단/부정복원, foreign project·등록회수·서명domain/원문hash·scope/원명령/승인불일치, 늦은 기한·await 중 actor/control/tip/source 변경, 서로 다른 lease의 증빙·같은 명령/다른 body, UNKNOWN 후 자동 retry 금지, 포화 정확상한/초과1·전체이력·회수기록 거절의 원행 보존·replay/조회 추가0.
기존 D1/등록 proof·합성 false·인접 정책/승인·default buildApp 거절만 직접 영향 범위에서 확인한다. 실키/실DB/실자료/브라우저/App/Agent·서비스·P03R3·compiler/native/OS/IPC/socket/프로세스/비용 시험0. 메모리 모델·Fastify inject·Node/type/SQL 정적·diff와 새 기능의 필요한 인접 검수만 수행하며 기존 전체 회귀는 반복하지 않는다.
부분 구현은 부분이라고 반환하고 같은 GO 범위 구현을 계속한다. source/schema·공급자 미정으로 기능을 빈 성공/가짜 true로 대체하지 않는다. 중요한 결함은 같은 Primary가 최소 보정하고 기존 Reviewer가 scoped 재검수한다. Main은 같은 코드 경로를 수정하지 않는다.

## 7. 제출·미검증·복구
실제 변경파일/diff/hash·명령/각 exit·RED/GREEN·준비오류/정식 실패 횟수·미실행·livehandle/QA·남은 작업을 반환하고 writer를 돌려준다. 단순 진행 문장을 COMPLETED로 쓰지 않는다. new dedicated QA root/파일·실서비스를 만들지 않는다.
실제 권위/OS/provider·보호키/credential·DB/RLS/경합·실통신·Agent·사용자 인수·head 복구/재등록과 전체 FN06/FN08/WORK_PLAN은 남는 범위다. 복구는 새 source 비활성 보존 또는 정확 diff의 정상 revert 검토이며 reset/force/history rewrite·원문/실패 이력 삭제0이다.
