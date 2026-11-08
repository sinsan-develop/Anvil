# FN03 제안 내용 출처 보존 소스 결과

## 판정과 기준
기존 DocumentContent.sourceRefs 4종의 제안 준비·저장·상세 조회·명시 반영·문서 고정 조회를 연결한 소스/합성 검수 인수다. 실제 DB·RLS·COMMIT·served 브라우저·사용자 인수와 전체 FN03/작업계획 완료는 미검증이다. 기준 main339fdad926f9a0ad2593cfe75dd71758cda9d2c3, branch codex/av3-fn03-proposal-content-sources, 구현 전 checkpoint b51dbb77a41a97c94eecc7140e393cbf51da953e. WI FN03_PROPOSED_CONTENT_SOURCE_REFS_IMPLEMENTATION_WI_20261108.md SHA256 d5824c9a393074a42526279622fc5723a4f8abb00dc3adcf0b9b040ca28901f8. Primary 구현, Main 검수·통합, 독립 읽기 검수로 분리했다.

## 구현과 보호 경계
제품4/시험4의 정확 허용 범위다. genuine ProjectDocuments.proposeCommand→quota.prepare→reserve/start→policies.command→publish→receipt/store→settle를 사용한다. private WeakSet을 수동 삽입하거나 createDocumentProposal 직접 호출을 정상 경로로 대신하지 않았다. base/version 그래프200과 proposed 그래프200을 분리하고 각 그래프의 전이·모든 종류는 같은 예산을 공유한다. prepare/store는 fresh 검산하며 source SELECT800회인200+200 양성과 전이201 거절을 구분했다. 기존 diff의 실제 bytes 예약/정산을 유지하고 metadata 새 분모나 참조 원문 중복 비용을 추가하지 않았다.

제안 content/diff/hash에 refs를 보존하고 보호 상세 GET에서 실제 원출처를 검산한다. 선택은 exact content·version을 검사하며 문서 GET으로 이어진다. UI는 strict4종/hash를 검사하고 stored proposal 재개·ack·명시 반영 뒤 원refs를 먼저 보존한다. 후속 GET 실패에도 refs를 지우지 않으며 CAS/epoch/CSRF·UNKNOWN 원packet 명시 재확인을 유지한다.

최상위 payload.sourceRefs 비빈 배열의412/DB효과0은 유지했다. 기존 document-source-refs.test.ts207~215의 임시 proposedContent412만 기존 계약의 genuine 정상/음성 시험으로 대체했다. 다른 assert/거절 기준 삭제·완화0이다. 새 Proposal 자체 출처 상세 배열은 미채택 별도 결정으로 남긴다. 새 endpoint/공개 필드/SQL/migration/권한/예약 목적0. 0003 SQL의 full content·선택 exact equality를 읽기 확인했지만 실제 SQL 실행 증거는 아니다. native0072/import0073 기존 제한은 변경하지 않았다.

## 실행 증거
- 최초 서버 RED ba8b48/session73610→755730 exit1/1FAIL: 실제 route→quota.prepare→private plan의 정상4종 proposedContent412.
- 초기 fixture SQL 인용 syntax efd69b와 form_definitions SELECT 누락500(1c0af3→f57ba0 5PASS/1FAIL)은 준비/모형 오류로 분리했다. 정확 pid/form/version/actor SELECT만 모델링하고 음성을422/404/409/412/503으로 고정해 generic500을 거절 성공으로 세지 않았다.
- API RED9d791b: 정상4종1PASS와 별개로 hash-valid 미지원 종류 수용1FAIL. 실제 Editor RED18d889: 비교/ack/반영 후 refs가[]로 지워지는 정상/후속GET실패2FAIL.
- 최종 집중: node --test tests/unit/FN03/document-proposal-content-sources.test.ts tests/unit/UI06/proposal-api.test.ts tests/unit/UI06/document-proposal-content-sources-ui.test.ts — 612da9/session42523→04e956,20PASS/skip0/exit0.
- FN13 직접 인접: node --test --test-name-pattern='actual commands route and protected document reader reserve generated diff|^diff (original replay|current source|FS success|copies actual|replay returns)' tests/unit/FN13/project-storage-quota-writers.test.ts — f38823,6PASS/exit0.
- source observation과 source refs의 mixed 명령37609a→a7cc83은 전체 exit1이다. observation의26 통과 segment를 전체 PASS로 승격하거나 다른 결과와 합산하지 않는다. source refs는 module mocks flag 누락으로 실패했다.
- 실패 파일만 node --experimental-test-module-mocks --test tests/unit/FN03/document-source-refs.test.ts 로 검증 — cae856/session74991→81440e,16PASS/skip0/exit0. observation을 불필요하게 재실행하지 않았다.
- 기존 Editor 직접 인접: node --test --test-name-pattern='실제 Page/Editor에서 4종|저장 후 보호 GET 실패|부모가 완료 CAS' tests/unit/UI06/document-source-refs-ui.test.ts — aae69e,3PASS/exit0.
- npm run typecheck — 442ad4/session10304→921d91 exit0. git diff --check — 5e24d8 exit0.
- Main Web memory build: node --input-type=module -e "const {build}=await import('vite');await build({configFile:'apps/web/vite.config.ts',build:{write:false}})" — b5084f,520modules/1.39s/exit0. 이후 제품 불변.

## 불명 결과·정리와 독립 검수
이전 출력이 잘린 시험은 원 handle/exit가 반환되지 않아 UNKNOWN으로 보존한다. 새로운20PASS로 그 과거 exit를 대체하지 않는다. Get-Process의 SilentlyContinue exit1도 당시 잔여0 증거가 아니었다. Main cd3bfa는 정확 NoProcessFoundForGivenName,Microsoft.PowerShell.Commands.GetProcessCommand 를 구분한 조회에서 GET_PROCESS_NO_MATCHES/count0,exit0,UTC2026-11-08T01:59:54.5947633Z를 확인했다. 이는 그 시점 Windows node0만 증명하며 과거 시험 exit가 아니다. 프로세스 종료/실QA 재실행0. 최신 알려진 실행 handle0·writer 반환이다.

정렬 raw8 manifest9efccf0c2c801107f134ea464de5e36532caa4d5ab0d821711c869ce52ec9d21, 제품4 manifest1778a2de6ce121c35cd3675b70f2b7a6f1fd59844bd4c55b23f1a4f78107351b. 독립 최종20481c→c50259와 제품 검수9abe45→571d50는 시작/끝 지문 동일 C0/I0/M0다. 독립 검토가 시험을 다시 실행했다고 하지 않는다.

## 미검증·다음과 복구
실제 route/Policy/Quota/Documents/ArtifactStore 코드와 합성 Access.authenticated·DB/FS/DOM 포트를 사용한 검증이다. MemoryAccess가 AccessRepository.authenticated를 합성 구현으로 override하므로 실제 로그인·인증 검증 증거가 아니다. 실제 DB/RLS/OS/served 화면/Agent 실행을 증명하지 않는다. 실제 DB·권한·키·서비스·Agent·SSH·사용자 자료 조사는 수행하지 않았다. 정식 실패3회 인수 조건은 발생하지 않았으며 준비 오류와 제품 RED를 구분해 보존했다.

소스상 S06 문서편집→출처 포함 수정제안→비교/ack→명시 반영→고정 문서 재조회 경로다. 현재 서비스 배포/실사용 확인 URL은 새로 제공하지 않는다. 안전 commit/private push→PR 필수검증→main 병합→merged 한정 smoke→완료 branch 정리 뒤 UI07 변경요청/보관 재조회와 UI06 import 사용문서의 기존 SourceRef 소비 누락을 다음 단일 writer 업무로 진행한다. 후속 WI는 준비 상태이며 현재 동시 구현0이다. 회귀는 이 변경의 정상 revert로 복구하며 원문·과거 이력은 보존한다.

Main 게시 전 독립 실행735985: 위 최종 집중3파일 명령 그대로20PASS/skip0/fail0/exit0,4947.881ms. 제품 변경 없이 제출 결과와 실제 검증을 대조했다.
