# UI05 등록 산출물 원본 다운로드 — 소스·합성 검수 결과

## 판정
코드 연결과 합성 핵심 동작 확인. **실제 API/DB/served 연동은 미확인**이다. UI05/FN12·Stage C·전체 작업계획 완료는 아니다.
기준 branch codex/av3-stage-b / 시작 20a807dd28fa5f537f8ac06fa004902220b0b567. 단일 구현 담당 ui05_artifact_download, Main 어울 관리·검수·통합, p03_discovery_review 독립 읽기검수. Main 제품 직접 수정0.
WI UI05_RESULT_ARTIFACT_DOWNLOAD_WI_20261027.md SHA E66680EC19B363121807AEE779F3B08BDF5C794D6290C93A0148393766893291.

## 실제 바뀐 사용자 동작
이전에는 선택 결과의 등록 산출물을 UTF-8 텍스트/Markdown으로만 열 수 있었다. 이제 실제 ResultReviewSources에 session을 결박한 원본 다운로드 영역을 연결했다. PDF/이미지 등 binary와 빈 파일·20MiB 이내 원본을 명시 클릭으로 받으며, 원결과 snapshot/hash·단일 선언 fullref·수신 bytes SHA256을 대조한다. 파일명은 검증 UUID의 artifact-ID.bin이며 원헤더 파일명을 사용하지 않는다. 기존 보호 GET·현재 인증/회원·격리 검사를 소비하고 새 API/schema/권한은 만들지 않았다.
브라우저 요청 상태와 디스크 저장 성공을 구분한다. 원본 다운로드를 출처·실제 시험 PASS·검수 합격이나 Agent 실행 증명으로 승격하지 않는다. inline 미리보기/자동 실행/새 영구 저장·사용자 브라우저 변경0이다.
기존 텍스트 함수 raw prefix는 유지했다. 부모 화면은 import/criteria.session 연결 2줄의 의미 변경뿐이며, raw 역대조에서 기존줄 CRLF/LF 1byte 차이가 확인돼 비의미 EOL로 별도 기록했다. UI08 공유 소비·공용 ApiClient·서버·SQL·보호8·P03 동결 후보는 변경하지 않았다.

## 소스 지문과 전후 diff
| 파일 | 검수한 raw SHA256 |
|---|---|
| result-artifact-api.ts | 270611171E163610EE140B719EA27E0C84A38DB3625F0591B38D780D4B0ABCC1 |
| ResultArtifactDownloads.tsx | B5E7632A012F354F64F6D597F47C3DE306AA3E9BE8D301820DB5D33BB956BA0A |
| ResultReviewSources.tsx | D84BFBE51EB446C93D25216847D500494BBD6894BDBF029E54157218C7041AF4 |
| result-artifact-download-api.test.ts | 5FD12BBEA4AD22E481DA4A5B1735311B3085B4C330F38654E4370BB9EBEBE273 |
| result-artifact-download-dom.test.ts | 6A6E033D18359A6CD02DC21B2E70C9E1FCCF245E305B1F8A4C3C359246D6D259 |
| result-artifact-download-dom-harness.tsx | 79404B1220DB12E6268B67618AB1735A3E8F2AF661DAD4E510A4E3AA9BCED067 |
API는 readResultArtifactDownload를 추가하고 기존 text 본문은 수정하지 않았다. 새 component는 명시 버튼·진행/요청/오류·현재 session/client/transport/result/요청 epoch/unmount 보호와 Blob URL 회수를 맡는다. 부모는 새 import와 component 1곳 연결이다. Main1d2461의 git diff --unified=0으로 전후 변경을 확인했다. staged EOL이 달라지면 의미동일과 실제 index 지문을 별도로 확인하며 Git 설정이나 소스를 다시 바꾸지 않는다.

## 실제 검수 명령·결과
- 담당 TEST_ONLY11은 공개 함수 부재 RED, Main605902의 node --test tests/unit/UI05/result-artifact-download-api.test.ts도 해당 부재 assertion/exit1을 확인했다. 제품 작성 전이었다.
- Main be7a1d: node --test tests/unit/UI05/result-artifact-download-api.test.ts tests/unit/UI05/result-artifact-api.test.ts → 신규11+기존text3=14 PASS/0 FAIL/skip0/409.6125ms/exit0.
- Main f59b88: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json → exit0.
- Main68417c: 기존 Vite 설정을 사용한 write:false/emptyOutDir:false Web 메모리 build → outputs1/exit0. 제품 배포가 아니다.
- 독립 지정6파일 정적 C0/I0. 주체·선택/결과 ABA·권한거절·bounded20MiB·hash·실부모/기존text 보존을 읽기검수했다. 별도 CSS/PNG 추가절도 C0/I0다.
- Main46cfae: ANVIL_UI05_ARTIFACT_DOWNLOAD_DOM_QA=1 및 등록 TEMP/TMP에서 node --test tests/browser/UI05/result-artifact-download-dom.test.ts → **실제 Edge headless 1 PASS/skip0/3670.897ms/exit0**. 실제 ResultReviewSources/ApiClient·주입 합성 transport·Blob/download event/saveAs 원본 bytes hash를 검사했다. 401/403/404/412/type/hash/loss·선택 A→B→A·session/client/transport/result ABA·unmount 늦은 응답의 파일 생성 차단을 같은 시험 안에서 확인했다. calls는 상대 경로/GET/same-origin/no-store/redirect error/octet-stream뿐이고 예상외 요청·pageerror0이다. 실제 서버 Network/DB를 호출한 증거는 아니다.
- Main eebbe8: impeccable detect --json 변경 UI 2파일 → []/exit0. 실제 CSS2개를 메모리 적용한 등록 영역 PNG1개를 직접 확인했다. 원상태의 스타일·텍스트/버튼 겹침·잘림은 관측되지 않았다.

## QA 자원·보존 이미지·오류
등록 root D:/tmp/anvil-v3-stage-b/ui05-result-artifact-download-20261027-01, owner SINSAN/cyhuh. Mainccfa6c 부재/부모 nonlink·owner 확인, e769ac 09:37:30.6376139Z에 root/temp/browser/downloads/results만 생성했다. 최대30분/개별60초/browser15초·합성bytes만·실DB/서비스/Agent0이다.
9516de sandbox CIM 조회는 접근거부였다. 뒤에 출력된 relatedProcesses 빈배열을 부재 증거로 사용하지 않았다. 권한/설정 변경 없이 허용된 정확 읽기를 승격한696e83은 querySucceeded=true/관련process0·생성시각/owner 일치를 확인했다.
dd2219는 fresh scope/생성시각/owner/link/inventory·관련process0 뒤 186파일/61폴더·14618188bytes를 개별 회수했다(09:40:35.8403236Z). b49d3b 별도09:40:47.2142868Z 조회 rootExists=false·관련process0/querySucceeded=true. 공유 프로세스 종료/일괄 recursive delete/ACL 변경0이다.
검수 PNG1개는 docs/04_test_reports/AV3/UI05_RESULT_ARTIFACT_DOWNLOAD_20261027.png로 지문 확인 후 보존했다: 24142bytes/SHA5880D058FC1D354376A3481A17493D81B1CC9EFF3658988871BD2B3B9B6B3F8C. 합성 화면이며 실제 사용자의 산출물/계정/Secret은 없다.
담당 초기 타입5진단 및 DOM fixture undefined1은 최소 보정 후0, 경로 추정 읽기2건은 실제 목록 확인으로 정정했다. Main 부재 path 읽기2건과 서로 다른 PS 객체 컬럼 출력1건은 읽기/출력 오류이며 제품 실패가 아니다. Main643302의 parent raw 보존 assertion1은 1d2461에서 2줄 추가 외 CRLF/LF1byte만임을 확인했다. 제품/시험 기대값을 느슨하게 바꾸지 않았으며 같은 근본 원인 유효 제품 실패3회는 없다.

## 미검증·사용 확인·후속
현재 실행환경의 실제 auth/file API·정식 DB·served 화면·사용자 원본과 모바일/타브라우저는 NOT_RUN이다. 멈춘 reader.read의 즉시 취소는 검증하지 않았고, 현재는 다음 read 응답에서 이탈을 확인해 cancel/release한다. Source/합성 증거를 실제 저장소 전체/사용자 인수로 올리지 않는다.
정식 환경 복구 뒤 단계책임자·실행 상세→선택 보관 결과→등록 산출물 원본 다운로드에서 실제 등록 파일을 받아 확인한다. 그때 현재 권한·격리 거절과 실제 bytes/hash를 별도 대조한다. P03/FN16 정확 결정 질문은 중복하지 않으며 전체 계획을 계속 관리한다.
rollback은 이번 소유 제품3/시험3을 정상 revert하는 것이며 등록 원문·DB/권한·P03 승인/소비 기록을 삭제하지 않는다. WORK_STATUS/WORK_PLAN에 이 단위의 소스 연결·합성 확인과 실제 연동 미확인을 기록한다.


## Git index 지문·문서 보존 대조

Main6e827c는정확11경로/원문index5동일·source/test6은기존Git처리의CRLF→LF차이만/보호8불변/cachedcheck0를확인했다. Git설정·제품workingbytes·검사기대는바꾸지않았다. source기능은동일해완료검사를불필요하게반복하지않으며실제실행raw와게시index지문을구분한다.

| 파일 | 게시 index SHA256 |
|---|---|
| result-artifact-api.ts | 81AA054DDF657D1E78BDB88DD9E951FC8832CDBC84EB61F483271493D1814574 |
| ResultArtifactDownloads.tsx | 7656DDB2125CEA6489A83A0DE361894EC7DC98CAF429576C1FF5BB1132BFBEF5 |
| ResultReviewSources.tsx | 8EBD23B3EC937E10F1AF4CAE7DFD1F67FEED39A2F9260726AE72044A9F5D81B8 |
| result-artifact-download-api.test.ts | F9098578A4CE347063942274CCC04857734D35CC3D3063FF9B4955973AFE01DD |
| result-artifact-download-dom.test.ts | B52DE3DD7FAAC94C42293E5D4A8E82680876BDB9D1CBDCE377FE4D9501C23A65 |
| result-artifact-download-dom-harness.tsx | 82418298A5767FBB2AAFE3A618966474145D29E9E39755F8D3A79EBC47557DA5 |

문서작성45f55a의보존guard는RESULT양쪽생성후기존PLAN_COPIES_DIFFER로중단했다. 44fbd4는10/25 OS후보설명분리와UI06진도표현의기존차이2곳을확인했다. 타업무이력을복제/덮어쓰지않고양쪽에서동일한UI05행에만같은검수note를반영했다. 이번현재계약/완료조건변경0이다.
