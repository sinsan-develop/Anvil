# UI08 선택 보고 원본 다운로드 — 연결·합성 검수 결과

## 판정 → 이유 → 조치
소스 연결과 합성 핵심 동작을 확인했다. 실제 API/DB/정식 served·사용자 인수는 미확인이다. UI08/FN12·Stage C·전체 계획 완료가 아니다.
선택 보고의 기존 원문 조회에 현재 session을 전달하고, 검증된 결과의 등록 파일을 기존 UI05 다운로드 component로 받도록 연결했다. 새 API/schema/권한·실제 DB/서비스/Agent 변경0. 다음 독립 미완료 업무를 정본 계획과 실소스로 선정한다.

## 기준과 변경 전후
branch codex/av3-stage-b / 시작585ea34ae4704621634a4db7b6dad125cbca4231. WI docs/work_packages/UI08_REPORTED_ARTIFACT_DOWNLOAD_WI_20261027.md SHA256 CD586F0D11A137B5967419F0266C415FFBE77DCADA9B40AE639B0CBBDCF62F21.
단일 담당 ui08_reported_download 구현, Main 관리·검수·Git, p03_discovery_review 독립 읽기 검수. Main 제품 직접 수정0.
ApprovalsPage는 기존 current session 전달 한 곳만 추가했다. ReportedResultIssue는 user/client/CSRF와 별도 transport·선택 문맥을 세대에 결박하고 확인된 shown.value에서 기존 ResultArtifactDownloads를 연결한다. 기존401/auth상실·403/404 접근 회수 callback과 텍스트 보기·문제원문·승인/거절 입력은 보존했다. 새 조회/다운로드는 명시 클릭이며 자동 재시도·다운로드0이다. 기존 UI08 harness는 필수 합성 session prop 한 곳만 추가했다. 신규 DOM test/harness2 외 변경0. UI05 byte검사 엔진/완료14검사 재작성·반복0.

| 경로 | 검수한 raw SHA256 |
|---|---|
| apps/web/src/features/decisions/ApprovalsPage.tsx | 561830A5B74DE777F523CF86DDDD1234654975BF0677B588E545288718144247 |
| apps/web/src/features/decisions/ReportedResultIssue.tsx | CE5C12B606EF6438C0D75DAC5D405B3EEF5AE5B98F325317BCF90776ADDF5B15 |
| tests/browser/UI08/reported-issue-artifact-dom-harness.tsx | FB44F17E1749F79C0E8CC512FB319EE741161A9CAB8908410C32D7930C141A73 |
| tests/browser/UI08/reported-artifact-download-dom.test.ts | BC36E1709242BAE48112B39D8C4ACB0BC1923DAAC4ADC68E1DFE4F1A09A18863 |
| tests/browser/UI08/reported-artifact-download-dom-harness.tsx | 9B801532A2636011FF41C100BD075B9C62130D1A74F40EB7ECC7D6ED91112A85 |

## 실행 명령과 증거
- TEST_ONLY 실제 부모 RED: ac06e3 node --test tests/browser/UI08/reported-artifact-download-dom.test.ts, 0PASS/1FAIL/skip0/5571.7373ms/exit1. 보고 원문은 조회됐고 원본 영역 locator가 없어 UI08_DOWNLOAD_NOT_CONNECTED였다. 8027eb 정확225파일/82dir·14652027bytes 정리,099915 별도 root/process0 뒤 제품 GO.
- 담당 TS7022 3진단은 count:number 주석3곳만 보완했다. Main86e9a1에서 메모리상 이3곳 제거 지문 FD268CA507389D7F012131D58AE75448E53827A2AE047E88E6C248C648A8EDFE가 원 TEST_ONLY와 일치한다. 기대/timeout 완화0.
- Main f67b36 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0. 4f5c79 실제 Web Vite 설정의 write:false 메모리 build output1/exit0. 3ba314 git diff --unified=1로 제품2/기존harness1의 변경을 대조했다. 독립 지정5 지문 일치·C0/I0, 실제 API/DB 검증은 포함하지 않는다.
- Main b4065a: ENV ANVIL_UI08_REPORTED_ARTIFACT_DOWNLOAD_DOM_QA=1, TEMP/TMP=등록root/temp에서 node --test tests/browser/UI08/reported-artifact-download-dom.test.ts → 1PASS/0FAIL/skip0/5991.6804ms·총6451.3097ms/exit0. 설치 Edge1920x1080 실제 DOM과 합성 ApiClient transport로 PDF유사/PNG유사 bytes 다운로드2·saveAs/hash를 확인했다. 기존 텍스트,401/403/404 원문 회수·401auth상실,412/type/hash/loss 실패, user/device/session/client/transport/선택 ABA·닫기/unmount/늦은401·지연 원문 응답 회수를 검사했다. 외부 실제 HTTP/실DB는 호출하지 않았다. 상대 논리GET/same-origin/no-store/redirect:error 검사는 실제 운영 Network 증거가 아니다.
- 최초 Main6b2415는 불필요한 --import tsx로 ERR_MODULE_NOT_FOUND/exit1, browser/test body 실행 전 종료했다. package.json의 Node24 직접 TS 실행 명령으로 정정했다. 패키지 설치·기대값·소스 변경0, 제품 실패로 세지 않는다.
- Main6a8a5c impeccable detect --json 변경 UI2파일 → []/exit0. 기존 CSS2의 실제 메모리 적용 PNG를 직접 확인했고 해당 영역의 겹침/잘림은 관측되지 않았다. 전체 화면·모바일 검수는 아니다.

## QA 수명과 정리
GREEN literal D:/tmp/anvil-v3-stage-b/ui08-reported-artifact-download-20261027-01 / owner SINSAN/cyhuh. RED와 같은 이름의 별도 새 빈 instance이며 86e9a1 생성전부재·부모owner/nonlink 확인,866fcd 현황 사전등록,299a57 생성2026-10-27T10:14:51.9129041Z였다. root/temp/browser/downloads/results만 허용·최대30분/test60초/browser15초/retries0, 합성 자료만 사용했다.
34587f는 exact 생성시각/owner/nonlink·관련Node/Edge0을 확인 후230파일/82dir/16031760bytes를 개별 정리했다(2026-10-27T10:15:51.1565604Z). c416da 별도2026-10-27T10:16:01.7389410Z 조회 rootExists=false/process0/querySucceeded=true. 공유processkill/일괄recursive삭제·ACL변경0이다.
PNG는 docs/04_test_reports/AV3/UI08_REPORTED_ARTIFACT_DOWNLOAD_20261027.png,13297bytes/SHA256 86A1D8F07AADB044C250591EE38247D2DFB1B19D36386850652DA77639A016C7로 양쪽 문서에 보존했다. 테스트용 영역이며 실제 사용자 자료/계정은 없다.

## 미검증·후속·복구
실API/정식DB/served 전체App→승인화면 여정·사용자 원본·모바일·Agent 실행은 NOT_RUN이다. 상위 App→ApprovalsPage session은 type/정적실호출 대조이며 위젯 브라우저 검수를 실제 저장소 인수로 올리지 않는다. 기존 UI05의 멈춘 read 즉시취소 제한도 그대로다. 실제환경 복구 뒤 승인·문제→선택보고→원문확인→등록원본 다운로드를 확인한다. 전체 FN12 원인분류/계획은 미완료다.
rollback은 이번 소유 화면 연결/시험의 정상 revert다. 원문·DB·권한·승인/소비 이력/P03 동결 실행 후보를 지우지 않는다. 기존 보호untracked8 불변·계획 행만 보완하고 타업무 과거 기록의 원본간 차이는 덮어쓰지 않는다.


## 게시 index 대조
Main a64cbb exact10경로 stage·보호8불변·cached diff0. 제품/시험5 중 ReportedResultIssue와기존harness2는raw동일,나머지3은CRLF→LF만이며Git설정/workingbytes/기대값변경0이다. 게시 index SHA256: ApprovalsPage 011C0190B4C79554135D781EC165B869D4BD81F2ED3ECC09339D3FA47DB48B03; 신규DOM test 2FEDECDF505267A9294559E1B8BC61F62DB97CAD4B735FC5E79877288C9F9A72; 신규harness C4FFB88483C8C4B8EEDF965727F53A0BF9D2E5A1DAB0D5440FEAF93FD745E4B8. 나머지raw지문은표와동일하다. 의미동일EOL만이므로동일제품시험을재실행하지않는다.
