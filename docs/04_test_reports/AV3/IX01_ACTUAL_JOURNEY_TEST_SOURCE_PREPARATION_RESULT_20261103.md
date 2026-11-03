# IX01 실제 문서 여정 — 시험 source 준비·독립 검토
2026-11-03 · Main 어울 검수·통합 / 기존 Primary 단일 구현

판정: **PREPARED_NOT_EXECUTED**. 실제 PG에서 실행할 시험 source 한 개를 준비했다. 새 제품 기능 구현, 실제 저장 여정 성공, IX01 합격 또는 전체 계획 완료가 아니다.

## 범위와 기준
- 계획: WORK_PLAN Stage B / INTEGRATION_WORK IX01. 원 실제 저장·재조회·화면 검수 조건을 유지한다.
- 기준 branch codex/av3-stage-b, HEAD17351bebbbefd9b3dae5c21c3399609c8686702c.
- WI: IX01_ACTUAL_JOURNEY_TEST_SOURCE_PREPARATION_20261103.md 최초 EA01CBBA2FF07ACB3A58163E3AFBD51ADAE3629E77582170B1CE860BC7F08A0D → r2 C65067B1C10CB9814E3CC7264284D0F8777AC7CAE1E453DE090F3C0C27CFA883.
- 정확 신규1파일: tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts.
- 최종 SHA256 7DB320AC0781F9FD10D8CA94A77E8BB06A23CCDF3704D0C02886F2D29D7B34F8, 32357B/183행.
- Main은 제품/시험 코드를 쓰지 않았다. 실제 DB·권한·키·서비스·Agent·네트워크·OS/실자료 실행·조사는 제외했다.

## 준비한 소비선
큰 SQL fake나 미리 확정한 ref의 조합 대신 기존 app.inject와 Web ApiClient/문서·계획·추적·지식 API를 실제 서버 handler/저장/reader에 연결했다.
방법론 저장·검토/확정/적용의 실제 응답 ref와 양식 출력 노드를 문서 stageNodeRef에 넘기고, 문서 검토/확정 결과의 설계·화면 원문 ref로 계획·선행·검수와 양방향 추적을 작성하도록 했다. 원 근거를 지식 저장·검색·고정 조회에 넘기고 새 reader 객체에서도 재조회하는 코드다. 실제 서버/OS 재시작 검증은 아니다.

정상 명령 replay와 타 프로젝트/비회원·옛/회수 제어·변형 ref/hash·미확정 설계·만료 session 거절에서 원 명령/receipt/audit 및 문서·계획·추적·지식 행/원본문 불변을 비교하도록 했다. 이는 아직 실행되지 않은 assertion이며 검증 성공 증거가 아니다. 내장/복사/직접 정의의 전체3경로·화면/재시작을 요구하는 IX01 전체 범위를 대신하지 않는다.

## 실행 입력·안전 경계
기본 opt-in 없음은 NOT_RUN/skip이며 PASS로 세지 않는다. 명시 opt-in 뒤의 공개 실행 계획 JSON은 exact 필드·중복키·64KiB/원문hash·source HEAD/파일bytes·순서 있는 SQL목록hash·Linux 비rootUID·기한·새 전용 root/소유 marker를 검산한다. 그 뒤에만 QA credential과 Pool을 사용한다.
입력 hash는 사람 승인이나 제품 인증의 증명이 아니다. 후속 플랫폼 실행 승인과 정확 자원/manifest 계획을 별도로 받아야 한다. 승인마다 코드 상수를 고쳐야 하는 approvedExecution=null scaffold는 제거했다.
시험은 DB/container/network/root 생성·삭제·migration 적용을 하지 않는다. 부분 생성·종료 오류에서도 반환받은 소유 app/Pool의 close를 모두 시도하고 원 오류·정리 불명을 함께 보존하도록 했다. 실제 정착·자원 회수는 실행하지 않았다.
schema_migrations 집합 일치는 실제 적용 순서 증명이 아니다. 기존 FN02 정확53은 현재 raw checksum 일치만 확인했고 최신 IX01 source의 충분한 의존 폐쇄는 미확정이다. 모든 pending SQL을 자동 적용하지 않는다.

## 재작업과 실제 확인
- 최초 작성 구문30dfea exit0. 최초 noEmit b9b77c의 수동 WorkPlanBuffer 필드·application 반환키3진단은 실제 prepareStoredWorkPlan/applicationRef 소비로 보정했다.
- 영구 null guard의 scaffold 위험을 Main이 발견해 외부 실행 계획 검산으로 바꿨다. 쓰기+구문 호출 출력 소실1은 exit UNKNOWN/회수 handle 없음으로 보존한다. 후속 성공으로 소급하지 않는다.
- 보완 전 CD37FE13 제출: e1e29d 구문0/1.0423초,6bfcb8 noEmit0/6.8781초. 최종 증거와 구분한다.
- Main 독립 읽기 Important3: 방법론→문서 stage 미연결, 생성/close 오류 시 후속 정리 누락 가능, replay/거절의 도메인·원본문 footprint 미검산. 같은 Primary가 정확1파일에서 보완했고 trace traversal 반전/확장자 literal도 정리했다.
- 두 번째 noEmit 준비 진단2는 Pool을 PoolClient 인자로 넘긴 부분으로, 실제 connect/finally release를 쓰도록 보정했다. 실제 PG 실패가 아니다.
- Primary 최종042e52 구문0/0.8783초·e0a153 noEmit0/5.3899초·05ed67 diff0·89d51c 공백0/끝LF.
- **Main 최종0e1b83 구문 exit0/0.8209초, a51435 root noEmit exit0/5.7180초**. 851cf4에서 최종 지문·stage 연결/footprint/정리 보완을 읽기 대조했다. 검토한 시험 준비 source의 Important3은 source상 보완됐으며 실제 동작 검증은 아니다.

정확한 명령:
```text
node --check tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```
실제 시험 실행 명령은 수행하지 않았다. skip를 포함한 test 실행, 실제 TDD RED/GREEN·PG/RLS·원자성/경합·정리 동작·browser·사용자 인수는 모두 NOT_RUN이다.

## 다음 선행·rollback
최신 소비 함수/테이블의 정확 SQL 의존·적용 순서/지문 manifest, 새 격리 QA 자원/소유 marker·수명/정리, 정확 source/실행 입력hash와 별도 실제 실행 승인이 필요하다. 새 기능을 완료했다고 보고하지 않는다.
source rollback은 이번 소유 시험/문서 commit의 일반 revert이며 DB·서비스 rollback은 필요하지 않다(적용/실행0). 실제 실행 후 자원 정리는 별도 소유 실행기가 정확 대상만 회수해야 한다. 보호 untracked3과 다른 변경은 보존한다.

FN06 새 수신 인증/profile/current·회수 계약은 미채택으로 따로 남긴다. 이 시험 준비는 그 계약을 승인하거나 실제 코딩 Agent 연결을 증명하지 않는다.
