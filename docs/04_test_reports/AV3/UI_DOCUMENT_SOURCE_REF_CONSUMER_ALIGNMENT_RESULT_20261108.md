# UI07·UI06 문서 출처 소비 정합화 결과

## 판정·기준
기존 DocumentContent.sourceRefs 4종을 소비하지 못한 UI07 변경요청/보관문서 및 UI06 import 사용문서 조회의 소스·합성 검수 인수다. 실제 부모 화면 클릭/served 브라우저·서버 출처 재검산/DB·사용자 인수·전체 Stage 완료는 NOT_RUN/미완료다. baseline main e9d0c132816eb54ef3554a8d2fc8071da41016d0, branch codex/av3-document-source-consumers, safeHEAD e5166d063ed7de72a474005ba3f901189a8f7e6d. WI UI_DOCUMENT_SOURCE_REF_CONSUMER_ALIGNMENT_WI_20261108.md SHA7e16f1bdebde9725f848a16ba5dd6b1110c38640b4c31f822b3a86051c6255b9. 기존 Primary 단일 writer·Main 검수/통합·독립 읽기 분리.

## 변경·기존 보호
제품3은 readChangeRequestDocumentSource/storedChangeDocumentSource의 빈배열 강제 조건만 제거하고, readImportUsageDocument의 빈배열 강제/빈배열 hash 투영을 실제 content.sourceRefs로 바꿨다. 역치환 시 HEAD 제품3 전체 본문 동일을 확인했다. 기존 readDocument strict4종·분리열·원문 검산, 전체 canonical hash, 정확 요청/source/version/hash 귀속·candidate ID/선택 이력/원본첨부·양식·active 검산을 유지한다. 변경요청에는 명시 선택한 DOCUMENT_VERSION 한 건만 붙이며 문서 하위 출처를 펼쳐 합치지 않는다. 미채택 ImportCandidate 자체 sourceRefs 필드를 가정하지 않는다. 새 API/필드·SQL·권한·실행·공통화0이다.

기존 시험 본문/오염 단언과 [] 양성을 유지하고 fixture 선택 옵션에만 정상4종 content/분리열과 정확 hash를 함께 추가했다. 보관 요청은 문서→변경요청→영향 원장 hash를 재산출해 실제 소비자 거절을 확인했다. hash-valid 종류/추가키/분리열 오염·문서 hash·원 귀속·late/ABA·403을 거절하며 단순 length 조건 삭제로 오염까지 허용하지 않았다.

## 검증
- RED5297ac exit1/3FAIL: 정상4종 정확 hash인데 기존 IMPORT_USAGE_INTEGRITY_FAILED / DOCUMENT_INTEGRITY_FAILED / DESIGN_CHANGE_SOURCE_CHANGED. 제품3 원바이트 시점이다. 최소 보완 GREEN8c90f9 exit0/3PASS.
- node --test --test-name-pattern='정상4종' tests/unit/UI07/change-request-document-source.test.ts tests/unit/UI07/stored-change-document-source.test.ts tests/unit/UI06/import-usage-source-refs.test.ts — 위 RED/GREEN의 정확 명령.
- node --test tests/unit/UI07/change-request-document-source.test.ts tests/unit/UI07/stored-change-document-source.test.ts tests/unit/UI06/import-usage-source-refs.test.ts — Primary f66e47 19PASS/skip0/exit0. Main a526f7 같은 집중 명령19PASS/skip0/fail0/exit0/1240.2994ms.
- node --test tests/unit/UI07/design-change-request.test.ts tests/unit/UI07/stored-change-sources-view.test.ts tests/unit/UI06/import-api.test.ts — 4d2c88 11PASS/skip0/exit0. view 표시 검산을 실제 클릭이라고 하지 않는다.
- npm run typecheck — a69685/session67796→4d0f35 exit0. git diff --check — df9b54 exit0.
- Main node --input-type=module -e "const {build}=await import('vite');await build({configFile:'apps/web/vite.config.ts',build:{write:false}})" — 789968,520modules/1.26s/exit0. 이후 제품 불변.
- 독립4fbdb5→8e58ea 시작/끝 개별6SHA동일, 전체manifest1be46176c3e74c05709e148105bcc48fc3618ff977342115b45f6f88fcc4b08d/제품3manifest8be899a00d0ff2d2fc49ccb874d97a217c22df6c8faabd6703bb95d1640dcc50 직접 재현 C0/I0/M0. 독립 시험 재실행0.

## 정리·미검증·다음
실 ApiClient와 helper를 합성 GET transport로 소비했다. active/epoch 시험을 실제 부모 DOM의 안전 증거로 승격하지 않는다. 준비 오류/동일 원인 반복 실패·추가경로쓰기0, 알려진 live handle0·writer반환이다. 실제 DB·권한·키·서비스·Agent·사용자자료 조사0. IX01 별도 승인 범위의 연결 사전검산336340 exit1(Connection refused)은 WORK_STATUS에 별도 기록했고 이 소스시험 성공과 혼합하지 않았다.

기존 호출선은 DesignChangeRequest→첫helper, StoredChangeSources→보관helper, MaterialLibrary→import사용helper다. 서비스 반영/실사용가능 완료 URL은 제공하지 않는다. 정확 commit/private push→PR 필수검증→main 병합→merged 한정 smoke·정리 뒤 UI06 충돌 조정의 같은 소비 누락과 늦은 응답 보호를 다음 단일 writer로 수행한다. 후속 WI는 미배정으로 보존했다. 회귀는 이 소스 변경의 정상 revert, 원문/기존 이력 보존이다.

## 통합 확인
PR70 source c96ef375fb4dff5c8c2888f9712c4c05b07051b5는 Broker42438140141 success/da305f exit0로 main39f159a59a6dc315bcdf7c2892eb24142a42ab37에 병합됐다. parent e9d0c132·source/merge tree f2a4d3bdc2a2ccb774c04f2e7c6fbf9fde639683 동일이다. 7084ca 정상FF 뒤 집중3파일19PASS/skip0/fail0/exit0/510.5676ms를 확인했다. 5ae9f6은 main local/private동일·clean·완료remote branch/tag부재·PR70복구ref c96ef375를 확인하고 정상-d/-dr정리했다. 이후 새 목적branch만 최신main에서 생성·즉시게시했다. squash 경고는 위 PR/tree/ref 증거와 보존하고 force0이다.
