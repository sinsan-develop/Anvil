# FN09/FN11/UI04 책임 역할·세션 예약 일회 승인 연결 결과

2026-10-27 · 기준 branch codex/av3-stage-b · 부모 658951cc5f3e76e2968cf7d77b9113f1874cba01

## 판정

**부분 구현.** 기존 총괄/단계 책임 역할 정의와 Anvil 세션 예약에 일회 승인 요청→UI08 별도 결정→원명령 결박→별도 저장→정확 상태 재조회를 연결했다. 실제 DB·정식 서비스 반영·외부 Agent·사용자 인수는 미실행이다. 전체 FN09/FN11/UI04·Stage·작업계획 완료가 아니다.

## 승인·변경 범위

- WI docs/work_packages/FN09_RESPONSIBLE_SESSION_ONE_TIME_APPROVAL_IMPLEMENTATION.md, SHA256 73DD668F29B3F20B3B52F6FC892F4AA84513029E803B800785FDC0764077B447.
- 신산님 직접 응답 call_ecd59c3833a144098f6830a55ecaa65c/0: ‘위 범위 코드·화면·미적용 SQL 구현 승인’. 정확 두 연산과 허용18경로에 적용한다.
- 허용18 중17경로 변경. tests/unit/FN09/responsible-session-web.test.ts는 수정할 필요가 없어 불변이다. 실제 목록/원문 및 index 지문은 SOURCE_MANIFEST.json에 있다.
- Main은 관리·검수·문서·통합, 단일 구현 담당은 fn09_responsible_session_one_time_approval. 동시 writer1명, Main 제품 수정0, 정식 FAILURE_REPORT0이다.
- 실제 DB/DDL 적용·정책/권한 부여·GRANT·Secret/TLS/서비스·외부 비용·Agent 실행은 제외한다. prepareExecution/reviewUnderstanding 차단은 유지했다.

## 구현된 소스 동작

1. defineProjectRole의 COORDINATOR/STAGE_OWNER와 최초 bindResponsibleSession은 각각 target=null/expectedVersion0이다. 후속 결박은 기존 binding 전체 ref·정확 버전에 결박하며 각 명령에 다른 승인과 원명령 ID를 사용한다.
2. 현재 로그인·OWNER/client/control·DENY/정책/기한·현재 단계/부모 역할·확정 임무/현재 초안·연결 후보 head/만료를 기존대로 검사한다. 같은 명령 재전송은 원영수증을 확인하며 다른 명령/본문/주체 재사용은 거절한다.
3. 역할1건, 최초 Anvil session1+binding1, 후속 동일 sessionRef의 binding 새 버전 의미를 유지한다. RESERVED/CANDIDATE_ONLY·handle=null·executionAuthorized/dispatchPerformed=false이며 외부 Agent 세션을 만들지 않는다.
4. 당시 원명령/payload/hash·소비·영수증/감사 원열/카디널리티를 원장 재조회와 연결했다. 과거 소비 조회는 현재 정책·제어 변화와 분리하고 async 검증을 모두 await한다.
5. 신규0049.pending은 기존0016 guard·0048 wrapper를 보존하면서 정확 승인과 최초 session의 request hash를 연결한다. 공통 원자 완결/부분자료·receipt-only·allNULL·혼합 연산·이력 UPDATE/DELETE 차단은 정적으로 검토했다. **실제 SQL compile/DML/COMMIT/RLS/경합은 NOT_RUN**이다.
6. UI08에서 현재 사용자/client/project·원 candidateCommandId와 assignmentRef가 같은 보관 buffer로만 복귀한다. 확정 ref를 draft URL에 넣거나 원후보를 hash만으로 복원하지 않는다. POST 전에 uncertain을 App에 보관하고 UNKNOWN을 늦은412로 해제하지 않는다. GET 실패 뒤 영수증과 원명령을 보존한다. 무소비 종결은 보호 GET 재확인과 명시 종료로만 입력에 복귀한다.

## Main 검증

| 증거 | 정확 범위·결과 |
|---|---|
| ca6724 | node --test tests/unit/FN09/responsible-session-approval-consumption.test.ts · 제품 불변 actual RED1 FAIL358.8202ms/exit1. 기존 미연결412와 기대 APPROVAL_REQUIRED/412 차이 |
| 718c7c | 아래 신규/직접 인접9파일 77 PASS1474.1485ms/skip0/exit0. UI I1 보정 전의 증거 |
| d652da | node --test tests/unit/UI04/responsible-session-approval-api.test.ts tests/unit/FN09/responsible-session-web.test.ts · I1 보정 후25 PASS305.7762ms/skip0/exit0 |
| 4ac30e | 실제 App/합성 API FLOW1 PASS: 총괄→단계→첫 예약→같은 세션 후속 결박의 각 별도 승인. AUTO1 FAIL/후속7 NOT_RUN과 구분 |
| 251dfc | 동일 최종 제품 JS에서 AUTO_NULL/LOST_REQUEST/LOST_WRITE/GET_FAIL/REJECTED/REVOKED_POLICY/UNKNOWN412/LEAVE_INFLIGHT 8 PASS18.9s. 마지막 모드는 당시 늦은 응답 처리 후 관측이 미충족 |
| bba002 | 보강한 LEAVE_INFLIGHT만1 PASS3.4s. 정확 첫 요청의 response.finished와 렌더 후 원 pending/UNKNOWN·입력·동일 재전송2/저장0·예외0 확인 |
| 2e5661 | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json / git diff --check · exit0. CRLF→LF 경고 별도 |

718c7c의 정확 명령:

node --test tests/unit/FN09/responsible-session-approval-consumption.test.ts tests/unit/FN09/responsible-session-approval-input.test.ts tests/unit/FN09/responsible-sessions.test.ts tests/unit/FN09/responsible-session-web.test.ts tests/unit/UI04/responsible-session-approval-api.test.ts tests/unit/FN11/approval-input.test.ts tests/unit/FN05/context-approval-consumption.test.ts tests/unit/FN10/stage-start-approval-consumption.test.ts tests/unit/FN08/runtime-policy.test.ts

브라우저 실행은 사전등록 config.mjs와 ANVIL_UI04_RESPONSIBLE_SESSION_APPROVAL_DIST의 exact dist를 사용한 Playwright/Edge headless다. node node_modules/@playwright/test/cli.js test --config <등록 config.mjs> --max-failures 1이며 후속에는 --grep-invert RESPONSIBLE_SESSION_APPROVAL_FLOW, 마지막에는 --grep RESPONSIBLE_SESSION_APPROVAL_LEAVE_INFLIGHT를 사용했다. **9건을 최종 spec에서 한꺼번에 재실행했다는 뜻이 아니다.** 통과한 불변 사례를 반복하지 않았다.

최종 브라우저 source SHA256: 7CED62667EC18834FD2FD0B0A3F1DC0014DF98B83E6EF44ABCBA46F20E5CE1CA.
최종 제품 JS index-DwDwWOt4.js SHA256: A5F6F218A69B127CB2F59DFBDC2C49226DD713900275E226582405573DF1EC97.
CSS SHA256: BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87.

## 독립 검수·실패 이력

- 서버/0049 중간 초안과 최종 guard 연결 delta의 독립 정적 C0/I0. 실제 SQL 실행 판정은 아니다.
- UI 첫 정적 C0/I0 후 실제 App에서 빈 화면이 발생했다. 독립 재검수는 OPTIONAL_UNDEFINED_IN_ORDERED_BUFFER C0/I1로 정정했다. 전송전 savedReceipt:undefined와 성공/종결 responsibleApproval:undefined own-key가 ordered의 JSON.parse와 충돌했다. 신규 실제 close→ordered RED 뒤 국소 제거 보정·Main25 PASS·독립 ADDRESSED/새C0I0, actual FLOW가 통과했다. 공통 ordered와 권한 계약은 바꾸지 않았다.
- 최종 spec은 release 직후 종료해 늦은 응답 후 관측이 없던 검증 I1을 보강했다. 정확 첫 Request/response.finished·렌더 후 동일 상태 검사로 수정하고 독립 ADDRESSED/새C0I0·Main1 PASS를 확인했다.
- 최초 FLOW는 확정 저장 후 기존 확정 원본 명시 재조회 누락으로30초 실패했다. AUTO 실패는 기존 후보 목록 명시 조회 누락이다. 제품을 변경하지 않고 실제 사용자 조회 행동을 추가했다. 원 실패/미실행을 PASS로 소급하지 않는다.
- 첫/재심사와 직접 승인 후 guard 선행 분리 실행이 쓰기 전에 거절됐다. 직접 승인과 검증·소비 보강 선행→독립 검수→최종 guard 연결 순서로 해소했다. 우회·권한 완화0이다.
- 작성자 작업중 fixture clock/client 불일치4FAIL·UI 모듈 미작성 타입 실패와 메모리 설정 번들 EPERM1건은 각각 보정/환경 오류로 기록했다. Main 실제 실행 결과와 구분한다.
- 기존 tests/unit/FN09/responsible-session-screen.test.ts는 HEAD부터 있던 ClaimUnderstandingHistory.tsx의 Node ERR_UNKNOWN_FILE_EXTENSION로 수집 실패했다. 시험 기대를 삭제/완화하지 않고 그대로 보존했다. 해당 화면시험은 미충족이며 Stage 병합 전에 별도 수집 경로 보완이 필요하다.

## 일회 QA 정리

등록 경로 D:/tmp/anvil-v3-stage-b/ui04-responsible-session-approval-20261027-01만 사용했다. owner SINSAN\cyhuh, 각 생성30분 안에 종료·정리했다. 생성 전 부재/parent owner/nonlink·실경로, 정리 전 소유 항목/link/절대경로·관련 Node/Edge process0을 대조했다.

| 실행 | 생성 UTC | 회수 증거·항목·UTC | 독립 부재 |
|---|---|---|---|
| 최초 | 02:14:00.632 | 45b890 ·40 ·02:15:49.968 | 152d50 false |
| 두번째 | 02:17:06.127 | ca900a ·40 ·02:19:55.554 | f13529 false |
| 오류 진단 | 02:21:19.583 | a0c5d9 ·40 ·02:22:09.815 | 954c40 false |
| I1 보정 | 02:24:28.729 | 985715 ·41 ·02:25:58.454 | e78e70 false |
| 후속8 | 02:27:19.863 | 05b304 ·36 ·02:28:17.732 | b600c3 false |
| late1 | 02:32:23.980 | 2e5661 ·36 ·02:32:44.952 | 3b744d false |

기존 브라우저·정식 listener·PG·서비스·Secret·Agent 변경0이다. 일반 사용자 세션을 쓰거나 실제 API/DB로 합성 응답을 위장하지 않았다.

## 남은 범위·복구

- 실제 DB/migration 적용·정식 API/Web 반영·실제 저장/RLS/경합·사용자 인수 NOT_RUN. 신규 SQL은 pending 소스다.
- 기존 화면시험 수집 오류는 미충족이다. 실제 CapabilityReport/provider handle·prepareExecution/reviewUnderstanding·Native/Agent 실행 선행도 이 승인으로 해제하지 않았다.
- 사용자 확인 대상은 개발 반영 후 프로젝트 작업→확정 임무 원본→책임 역할·예약 세션과 UI08의 별도 결정이다. 현재 정식 서비스에 반영됐다고 주장하지 않는다.
- 소스 복구는 이 소유 경로의 후속 revert다. 실제 자료/DB/권한 복원·삭제는 수행하지 않았다. 보호 untracked8과 main을 보존하며 전체 Stage gate 충족 전 PR/병합/정리는 하지 않는다.
