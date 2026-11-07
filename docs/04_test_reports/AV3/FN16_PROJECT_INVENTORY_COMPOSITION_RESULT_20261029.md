# FN16 고정 프로젝트 자료 조합 검수 결과 — 2026-10-29

## 판정
신규 내부 조합 구현의 Main 집중 검증 통과. 독립 최종 검수·Git 게시 전 후보이며 전체 FN16/실사용 백업 완료가 아니다.

## 기준·범위
- 기준 branch codex/av3-stage-b, 시작 HEAD a6bec11bd0c21314003bfc94eec1421a8f18550e.
- WI docs/work_packages/FN16_PROJECT_INVENTORY_COMPOSITION_IMPLEMENTATION_20261029.md SHA256 E4A9CECD1102EC11290D45AB633C726904BAA4C75924654D74B93E7900B54A8F.
- 신규 project-inventory-composition.ts 및 집중 행동/schema 시험2만 제품 변경. 기존 source/SQL/공개 API/실제 키·DB·서비스 변경0. Main은 관리·검수·통합, 단일 primary는 구현, reviewer는 읽기 전용이다.
- 시작의 관리문서 dirty·신규 WI/시험2 및 보호 untracked8을 보존했다. 이전 worker handle 부재는 실제 list_agents로 확인한 뒤 동일 범위 단일 구현자에 인수했다.

## 변경 전후
이전에는 자료군별 내부 수집만 가능했다. 이제 고정19 실제 수집기를 순서대로 호출해 원 관측·원지문·수집 범위와 미검증 선언, namespace/실행범위별 정확 참조·누락/충돌, 전역 원문 tuple 합집합을 하나로 묶는다. child 원결과를 바꾸거나 전체 snapshot·복원 가능을 발급하지 않는다.
최초/최종 OWNER와 동일 로그인 세대·중간 최소 기한, 누적 metadata와 파일 수/선언 용량을 검사한다. 서로 다른 RR 결과는 독립 관측으로 남는다. compositionHash는 최상위 usage/observation을 제외한 의미 projection이며 child 전체 resultDigest/관측에는 종속된다. 시점 독립 hash나 archive checksum이 아니다.

## 검증·오류 이력
- 이전 미구현 RED13은 보존한다. 실제 DB 장애가 아니다.
- 복구 담당 초기8PASS/5FAIL→12PASS/1FAIL은 메모리 RC 조회/guard 오류 전달과 타입 보완 과정의 중간 결과다. 최종 시험 기대값을 완화하지 않았다.
- 독립 읽기에서 실행 scope 반례·전역 artifact 합집합 초과 누락과 빈 every를 발견해 보강했다.
- 실제 producer 대조에서 OBSERVATION의 event scope, ContextPreparation ARTIFACT의 ref tuple 경로 오류를 발견·보완했다. 정책 미수집 분류 및 원 sourceScopeContainment/verification/scope를 보존했다.
- Primary 38af10: 집중16PASS/0FAIL/skip0, 791.0437ms, typecheck exit0.
- Main 8895b7: node --test tests/unit/FN16/project-inventory-composition.test.ts tests/unit/FN16/project-inventory-composition-schema.test.ts →16PASS/0FAIL/skip0, 783.9566ms, exit0. npm run typecheck exit0, git diff --check exit0.
- 정상은 19 실제 collector 호출·반납 및 서로 다른 snapshot, 문서→계획 참조, 중복 원문1회, 같은 ACK ID의 다른 execution scope, context-only 원문을 확인했다. 실패는 hash 충돌/누락·인증 변경·최소 만료·COMMIT 후 취소/기한·전체 한도·회수불명503을 확인했다.
- 도구 오류(Windows wildcard/PowerShell parser/sandbox Git work-tree 조회)는 제품 실패와 분리하고 실제 경로·elevated 읽기로 교정했다. 실제 환경을 수정하지 않았다.

## 제출 지문
- source: 855B3544E57B43F7BE8D583A093DE325DC0864BA58EA9DC99A811140F43F8508
- 행동 시험: 0E7267099FDA4C89FE057304409EE286D012E69C3816CFC1EC7329488C1CF83C
- schema 시험: C5E3108E13C073CE4FDB2CE5E9B98640949314756A9F0DD7E97F3B1774717280

## 미검증·남은 작업·복구
실제 PG/RLS·동시 변경·전체 실시간 상한, 원문 FS/키·서비스, archive 생성·복원·UI/사용자 인수는 NOT_RUN. 고정 미수집은 정책/승인/명령/감사 전체, 공통자료, 연결 설정, 생성초안/제어 인계, 공유요청/백업참조, 미참조·결과첨부/checkpoint, 소스·미커밋, 실제 blob/archive/복원이다. 전체coverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false를 유지한다.
158E10 수동 정책 후보는 NOT_ADOPTED이며 이 내부 결과로 READY/정책저장/API 허가를 만들지 않는다. 다음은 기존 승인 범위에서 수집 원문 현재 상태·바이트 검증 연결을 검토한다. rollback은 신규3파일의 검토된 Git revert이며 데이터/백업 삭제0이다. 전체 WORK_PLAN은 미완료다.

## I5 최종 보완·Main 재검증
초기 제출855B3544/0E726709는 위 이력이다. 독립 I5는 중복 artifact의 뒤 출처가 사라지는 결함이었다. b13379에서 Document만 반환/Document+Conversation 기대의 RED1을 보존하고 기존 reference.sources에 중복 없는 후속 출처만 추가했다. Primary ad5237 신규16PASS/956.9869ms 후 타입 좁히기 보완, Main 6302c5 최종 집중16PASS/0FAIL/skip0/816.5532ms·typecheck/diff exit0을 확인했다. 기존 완료 collector 반복0.
최종 source SHA256 C4A0660EA2F59A071C8F0C3F82B4052FD59ED7B4FFBAA366082FF8374A6E8AD1, 행동시험 D1103B5300AAD4C52E9C12161B5BE85741A7F803DA96609C2ABA89D74982E425, schema C5E3108E13C073CE4FDB2CE5E9B98640949314756A9F0DD7E97F3B1774717280. 실제 환경 검증/전체 완료로 승격하지 않는다.

독립 최종 9d84b2: Critical0/Important0, I1~I5 해소 및 최종3지문 일치. 이번 내부 source 범위만 인수한다.
