# FN10/FN11/UI11 한도 정책 저장·회수 일회 승인 연결 검수

2026-10-27 · Main 어울 · 기준 branch `codex/av3-stage-b` / `75b7405bf87742a68f8b5a9a9d5ab79a819272ed`.

## 판정·범위

기존 한도 신규 저장·개정·회수의 승인 필요 경로를 연결한 소스 단위를 검수했다. 기능 상태는 **부분 구현**이다. 코드·미적용 SQL·합성 화면을 확인했으며 정식 DB/서비스 반영·실제 사용·인수와 전체 FN10/FN11/UI11·Stage·계획 완료는 아니다.

WI r2 SHA256 `998700A28A4C4D59010D0FB2D20F21BE223A33622B42B7421535AAE9F4313D0C`, 허용19경로. 초기 E9503D9A는 preflight/첫 RED 기준으로 보존한다. 19번 추가는 강화된 역사 조회에 직접 영향받은 기존 runtime-permission.test.ts 마지막 예산 fixture의 SELECT 원열 보완만이다. 기존 MISSING/TOO_LONG/CURRENT/DOCUMENT·실패 쓰기0와 RUNTIME_POLICY_EXCEEDS_BUDGET_EXPIRY 기대를 유지하며 제품 runtime 동작·권한·검수 기준은 변경하지 않았다.

단일 writer `fn10_limit_policy_one_time_approval`, Main 제품 수정0. 변경 전에는 사전 정책 조회와 서버 guard가 REQUIRE_APPROVAL을 LIMIT_POLICY_APPROVAL_NOT_CONNECTED로 거절했다. 변경 후 사전 조회는 정책 사실만 반환해 원명령을 동결할 수 있고, 사용자가 실제 전송한 서버 명확 APPROVAL_REQUIRED/412 뒤에만 별도 승인 요청을 준비한다. 로컬 오류를 서버 거절로 위장하지 않는다.

## 구현·보존

- 신규 apply는 null/0, 개정 apply·revoke는 base fullref 전체를 원명령/payload hash·candidateCommandId·주체/client/control/현재 permission policy와 결박한다. 세 명령은 각각 다른 승인이다.
- UI08 별도 결정→기존 App limitBuffers와 정확 원후보로 connections 복귀→보호 조회·명시 결박→별도 전송→정확 ref 조회를 연결했다. 승인/결박만으로 저장0이며 원입력·pendingHash·미확인을 보존한다.
- 신규/개정/회수의 기존 한도·scope·current head/CAS·기한 검사를 유지한다. 회수는 기존 limits/expiresAt를 보존하며 실행 중지·예약 해제·과금 취소를 추가하지 않는다. 실제 비용·Agent 호출·EXECUTION 허가·새 한도 규칙을 열지 않는다.
- 저장 당시 승인/소비·불변 버전·command/receipt/audit를 기존 transaction에서 결합한다. 과거 reader는 null 승인으로 hash를 재구성하던 경로를 정확 당시 승인으로 연결하고, 현재 member·현재 resolveCurrent와 분리한다. 합법 policy/control/head 개정만으로 과거 보관본을 위조 취급하지 않는다.
- 누락/중복 receipt·감사와 실제 commandId/operationId·원 payload/hash·주체/기기/정책을 검사한다. 현재 target resolver와 과거 소비 #history를 섞어 재귀적인 현재 재인가를 하지 않는다.
- UNKNOWN 후412와 전송 중 이탈은 같은 원명령의 불명 상태로 유지한다. 승인 요청·원명령 응답 유실은 같은 전체 명령으로 재확인하고 GET 실패는 영수증을 보존한 수동 재조회다.
- 종결은 현재 제어·정확 원후보·무소비·비UNKNOWN을 보호 GET으로 다시 확인한 명시 종료다. 원입력/명령/요청/종결 이력은 유지하며 자동 POST0. 정책 개정에 따른 로컬 종료와 현재 실행용 정책 검사를 구분한다.
- 실제 DB 적용·정책/사용자 권한 부여·GRANT·Secret/TLS/서비스·외부 비용·Agent/native·runtime 실행은 0이다. 기존0017/0047과 다른 완료 소스는 보존했다.

## Main 실행 근거

| 검사 | 실제 결과 |
|---|---|
| 최초 기능 RED | 3cf55e `node --test tests/unit/FN10/limit-policy-approval-consumption.test.ts`: 1 FAIL279.7994ms/exit1, 기존 미연결 guard와 기대 APPROVAL_REQUIRED/412 차이. 제품/SQL 불변 |
| SQL 구조 계약 | ea6196 `--test-name-pattern='0048'`: 1 PASS263.9588ms/exit0. SQL 원문 정적 검사이며 actual SQL 실행 아님 |
| 최종 직접·인접 | f617d6: 한도/FN08 예산·UI11·UI08/FN11과 공유 guard에 영향받는 기준선/반출/맥락/단계요청 소비의15파일106 PASS1149.1737ms/FAIL·SKIP0·type/diff0 |
| UI I2 실제 RED | 0b79b4 FLOW1 FAIL: 승인 요청 뒤 결정 링크 부재. 실제 DOM pending 잔류와 정적 갱신 조건이 일치. 서버 저장 성공을 추정하지 않음 |
| 상태 문구 fixture | 99d119 FLOW1 FAIL·후속8 NOT_RUN. 첫 신규 저장 보관 status에는 도달했지만 시험 exact 문구에 ‘실행 허가 아님’이 빠짐 |
| 실제 App 핵심3 | ef021e FLOW(신규→개정→회수 각 독립승인)/AUTO_NULL/LOST_REQUEST3 PASS8.1s. LOST_WRITE1 FAIL·후속5 NOT_RUN은 재전송 도착 전 배열 비교 원인 |
| 실제 App 후속6 | 5b84bc LOST_WRITE/GET_FAIL/REJECTED/REVOKED_POLICY/UNKNOWN412/LEAVE_INFLIGHT6 PASS8.3s/exit0. 앞선3과 분리 실행했으며9 일괄 실행으로 표시하지 않음 |
| 최종 타입·diff | 3a073c tsc --noEmit -p tsconfig.base.json 및 git diff --check exit0 |

454모듈의 초기 I2 RED 번들 `index-BQ58TqnJ.js` SHA256 `2F76894896492FC400A2CC52CBA39CA36C22A115142208D476F4AB06806A9B56`. I2 보정 후 제품 번들은 모든 후속 실행에서 `index-uR7DKL2o.js` SHA256 `B66061E3122EEADA44A3E58F209D65B7AC9D580D6AFA518AA7BE788F957D6917`로 동일했다(330/324/최종312ms). CSS는 `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`이다. 실제 App은 제품 번들+합성 API이며 실제 PG·정식 HTTPS 서비스 증거가 아니다.

## 독립 검수·보정

- preflight C0/I0. SQL 초안 I1은 AUTO 경로의 감사 actor/client/target/policy 대조 누락이다. Main603b75가 조건을 대조했고, 같은 writer가 승인/AUTO 분기 전 공통 receipt·감사와 서버와 같은7필드 scope digest 검사를 추가했다. 최종0048 SHA256 `C306D174D09A3E091C377BCDDA8A39AE4B96E9E2116AB1B2DE721996988E03AF`, scoped I1 정적 ADDRESSED·새 C0/I0/M0. 실제 compile/DML/COMMIT/RLS/경합 NOT_RUN이다.
- UI I1 전송 중 이탈의 UNKNOWN 미보존은 POST 전에 App uncertain을 기록하고 이전 UNKNOWN을 유지하도록 보강했다. 독립 정적 해소와 최종 LEAVE_INFLIGHT actual PASS를 구분한다.
- UI I2는 old Panel closure가 limitApproval 전체를 비교해 첫 pending 이후 uncertain/saved를 버린 문제다. 실제 FLOW RED 뒤 저장/late 응답용 core matchesLimitBuffer는 유지하고 Editor 갱신 전용 안정 경계와 각 reducer의 정확 before-request를 결합했다. API030149EF/Panel36A1D415/UIunit4E694AC8·scoped ADDRESSED/C0/I0/M0이며 최종 FLOW 실제 진행을 확인했다.
- 완료 status의 ‘· 실행 허가 아님’ 누락 selector는 제품을 그대로 두고 정확 전체 문구의 role=status 검사로 강화했다. 재전송은 실제 POST 정확2건 도착을 expect.poll로 관측한 뒤 기존 전체 명령 동일성·저장1회 기대를 유지했다. sleep/timeout·기준 완화0. 최종 spec `EFA73A65E125D6E581AB9C5C3E31ECA21546D2FE2437543BEC465190768C08C6`, 두 fixture scoped C0/I0/M0.
- writer 직접39/UI보정21/runtime fixture8 PASS와 연접56 PASS/1 fixture FAIL은 제출 근거로 보존하며 Main106과 구분한다. Python cp949 읽기 오류는 UTF-8 명시로 정정했고 기능 RED로 세지 않았다. 개발자 정식 FAILURE_REPORT0. raw/index 지문은 SOURCE_MANIFEST에 기록한다.

## 자원·미검증·다음

사전등록 QA `D:/tmp/anvil-v3-stage-b/ui11-limit-policy-approval-20261027-01`의 dist/results/temp/config.mjs만 사용했다. owner SINSAN\cyhuh·각 생성30분·부재/부모 owner/nonlink/realpath 확인, 종료 후 항목별 owner/link/절대경로·해당 Node/Edge process0을 대조해 exact 회수했다.

| 실행 | 생성 UTC | 정리 UTC | 항목수·근거 |
|---|---|---|---|
| I2 FLOW RED | 01:21:42.657 | 01:22:11.219 | 25, fe17a4·별도8163d1 rootFalse |
| 완료 status fixture | 01:27:07.322 | 01:28:33.333 | 25, 809c86·별도fdd218 rootFalse |
| 핵심3·재전송 시점 | 01:30:10.198 | 01:32:02.140 | 28, febd7c·별도dd056b rootFalse |
| 최종 후속6 | 01:34:17.153 | 01:34:39.724 | 21, 3a073c·독립 부재는 WORK_STATUS 기록 |

정식 DB·실SQL/동시성·served·실제 사용량/과금·Agent/native·사용자 인수는 NOT_RUN. 실제 DOM의 API/session/transport·ABA 모든 조합까지9모드로 인증하지 않는다. 보호 untracked8·다른 작업과 원 FAIL/미실행은 보존한다. rollback은 소스 후속 revert이며 실제 자료 복원·삭제는 하지 않는다. 안전한 기존 branch checkpoint/private 게시 뒤 다음 승인 계획 업무인 총괄·단계 역할 정의와 Anvil 책임 세션 예약의 승인 연결을 대조한다. 이 예약은 외부 Agent 세션 생성·실행이 아니다. 전체 목표는 active다.
