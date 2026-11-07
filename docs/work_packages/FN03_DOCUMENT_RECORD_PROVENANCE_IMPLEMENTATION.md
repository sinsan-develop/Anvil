# FN03/UI06 문서 보관 작성·상태 주체 조회 구현 준비

## 권위와 현재 단계

Main이 승인된 WORK_PLAN FN03/UI06의 기존 GET 소비 누락을 다음 내부 구현 단위로 채택했다. FUNCTION_WORK FN03의 작성 주체·상태·이력 조회, SCREEN_WORK UI06의 버전·상태·과거 조회와 INTERFACES §10 getDocumentVersion의 authorRef/createdAt/statusHistory를 소비한다. 새 의미결정 FN17 producer 및 P03/FN16/CapabilityReport와 독립이다. 현재는 IMPLEMENTATION 준비 문서2만 작성한 단계이며 제품/시험/Git/환경 변경0이다. TEST_ONLY와 구현은 Main 별도 GO 뒤 진행한다.

기준은 Main386224/0683bf가 local/private 동일·tracked clean·보호8/main 불변으로 확인한 문서 checkpoint source a2ff8802ad648445b8c0869535efebb428dbf349 및 아래 실제 원코드 raw다. 이 준비에서 Git 명령은 실행하지 않았다. Main이 TEST_ONLY 전 현재 HEAD/dirty/보호 경계를 독립 확인한다. workspace는 C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil, 정본 문서는 D:/Project/Anvil에 동일 바이트로 둔다. 기존 codex/av3-stage-b 하나만 사용하고 branch/worktree/commit/push를 만들지 않는다.

## 정확 허용6

| 구분 | 경로 | 실제 존재/원 raw |
| --- | --- | --- |
| 제품 기존 | apps/web/src/features/design-trace/api.ts | 39F14ED64A63A2E5B85C82550277804E48D0339CE12CFEDC4A2E4A3993275282 |
| 제품 기존 | apps/web/src/features/design-trace/DocumentsPage.tsx | 4418525451859B712F0E34C24FA236B201D27A76272625BE31576C7E44F2A56E |
| 신규 unit | tests/unit/FN03/document-record-provenance.test.ts | 실제 부재 확인 |
| 신규 SSR/DOM test | tests/browser/UI06/document-record-provenance-dom.test.ts | 실제 부재 확인 |
| 신규 DOM harness | tests/browser/UI06/document-record-provenance-dom-harness.tsx | 실제 부재 확인 |
| 신규 결과서 | docs/04_test_reports/AV3/FN03_DOCUMENT_RECORD_PROVENANCE_RESULT.md | 실제 부재 확인 |

신규 표시 컴포넌트는 추가하지 않는다. 작은 접힘 상세는 기존 DocumentsPage 안에서 표시해 수정 표면을 제품2로 유지한다. 위 제품2/시험3/결과1 이외 source/시험은 수정하지 않는다. 본 WI와 FN03_DOCUMENT_RECORD_PROVENANCE_SOURCE_MANIFEST.json은 준비 문서2다. WORK_STATUS/WORK_PLAN은 Main 소유다. Main 제품 write0·동시 writer1(fn05_share_request_impl)이며 검수/실행 GO/통합은 Main 소유다.

## 기존 사실과 한정 구현

실제 project-documents.ts는 authorRef={kind:'HUMAN',userId:actor.actorId} 및 createdAt과 각 statusHistory.actorRef를 이미 반환한다. 작성 기록자는 저장 명령의 인증 주체이며 원문 내용의 실제 저자/LLM 작성자라는 뜻이 아니다. UI 명칭은 ‘작성 기록자’ 또는 ‘보관 작성 주체’, 상태 이력은 ‘상태 변경 주체’로 구분한다. 확정 이벤트의 주체는 해당 이벤트 값으로 표시하며 작성 기록자·현재 로그인 사용자와 같다고 추정하지 않는다.

Web api.ts DocumentVersion은 현재 이 metadata 타입/검증을 소비하지 않고, DocumentsPage의 저장 이력은 kind/reason/at만 표시한다. 기존 GET의 선택 하위필드 검증과 기본 접힌 상세 표시만 보완한다. authorRef/createdAt/각 event.actorRef는 각각 optional 미제공 호환을 유지한다. own property가 제공됐을 때 null/잘못된 타입/추가키/잘못된 UUID는 거절하고, 주체는 현재 서버가 반환하는 정확 {kind:'HUMAN',userId:UUID}만 수용한다. Agent/세션 등 새 DTO를 발명하지 않는다. createdAt은 string/유효한 시각을 엄격 대조하며 없는 값을 현재 시각으로 만들지 않는다. 미제공은 미제공으로 표시하고 현재 사용자/다른 이벤트에서 보충하지 않는다.

contentHash는 기존 title/formRef/stageNodeRef/content의 해시다. metadata를 해시 계산에 추가하지 않으며 metadata가 본문 hash로 신원 무결성을 보장한다고 표시하지 않는다. 기존 본문 bytes/hash·원문 다운로드/양식·첨부·검토·확정·저장 계약은 유지한다.

기존 statusHistory 배열·순서·kind/reason/at 문구는 그대로 보존한다. 새 기본 접힘 ‘보관 작성·상태 주체’ 상세에서 현재 고정 문서 ID/version/hash와 별도로 작성 기록자·보관 작성 시각·각 상태의 행위자를 연결해 보여준다. 확정과 초안 저장의 주체를 구분하고 과거 버전을 현재 head/현재 담당으로 치환하지 않는다. 원문 metadata를 새 권한/내용 진위/독립검수 증명으로 승격하지 않는다.

현재 Page에는 성공 readDocument의 scope/client/transport/project/actor/device/stage/cursor/refresh/요청세대/선택version을 검사하는 currentDownload/recordDownload 경계가 있다. 신규 상세는 이 성공 고정 조회와 동등한 현재성 guard를 재사용해 읽기 중·거절·다른 문서/버전·actor/client/project/transport ABA·늦은 JSON/파일응답 뒤 숨긴다. 전체 기존 원문 보기 구조를 리팩토링하지 않는다. 상세를 열어도 새 GET/POST·저장·확정·버퍼 교체를 하지 않는다.

## 시험·검수 순서

1. Main preflight 뒤 신규 unit1과 SSR/DOM test1+harness1만 TEST_ONLY로 작성한다. unit은 실제 readDocument를 사용해 정상 서로 다른 작성/확정 주체·과거버전/순서 보존·metadata 전부/일부 미제공·present 변조/추가키/unsupported kind·본문 bytes/hash 기존 검사를 대조한다. malformed wire는 fixture 구성단계 오류가 아니라 실제 reader의 정확 ApiError 거절에 도달해야 한다.
2. 신규 시험 동결·정확 hash/명령을 Main에 제출하고 Main fresh RED 전 제품2는 수정하지 않는다. SSR은 실제 Page 소비선을, DOM은 기존 GET/파일 원문 정상 조회 뒤 기본접힘·명시열기/주체구분과 중요한 401/403·현재성/늦은응답만 최소 선택한다. POST0·추가 metadata조회0·기존 buffer/pending 불변을 검사한다. 실제 완료 상태/전송 수를 관측하기 전에 다음 action이나 원값 비교를 하지 않는다. unknown 경로 blanket 허용·timeout 증가·skip·기대 삭제0이다.
3. Main GREEN GO 뒤 제품2만 구현한다. UI 수정 직전에 C:/Users/cyhuh/.codex/skills/impeccable/reference/craft-floor.md를 읽고 기존 tokens/app CSS와 details/summary·12px 표준을 따른다. Main impeccable context093e18은 기존제품 scoped fix이며 새 PRODUCT/DESIGN 생성0이다. 기존 CSS/설정/패키지를 바꾸지 않는다.
4. 집중 신규 unit/SSR·typecheck와 직접인접 중 필요한 검사만 Main이 고정한다. npm run typecheck 또는 실제 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json을 기록하며 build가 필요하면 write:false 메모리로만 검증한다. Main 사전등록/GO 전 실제 browser/QA root 생성0이다. Main 검증·독립 품질/명세·필요한 최소 실제 합성 DOM 및 정확 정리 후 결과서에 원 RED/fixture 오류/최종 hash·명령/미검증/rollback을 보존한다.

## 실제 기존 시험 경로 — 수정 금지

- tests/unit/FN03/document-confirmation.test.ts
- tests/unit/FN03/pinned-form-original.test.ts
- tests/unit/UI06/document-version-comparison.test.ts
- tests/browser/UI06/document-read.spec.ts
- tests/browser/UI06/document-version-comparison.spec.ts

이 목록은 실제 존재와 관련 소비 경계를 읽어 확인한 인접 후보이며 지금 시험 실행 허가가 아니다. 기존 내용/기대는 변경하지 않고 전체 회귀로 확대하지 않는다.

## 보호·제외·rollback

보호 existing4/untracked8은 source manifest에 기존 raw로 복사하고 실제 코드 workspace에서12 모두 불변 대조했다. 기존 테스트·완료 검색/share/newupload/correction·모바일 알림·다른 후보를 수정하지 않는다. 새 API/서버/SQL/DDL/schema/권한/정책·실제DB·서비스·Agent·Secret·인증서·비용·외부전송0이다. 새 QA는 별도 Main 사전등록 전0이다. 이번 한정 소스 검수는 실서버/정식served/DB·사용자인수·전체 FN03/UI06/Stage/계획 완료가 아니다.

rollback은 Main이 이번 정확 허용 경계만 되돌려 기존 제품2의 위 raw를 복원하고 신규시험/결과서를 같은 경계에서 되돌리는 방식이다. 다른 dirty·보호자료에 reset/clean을 사용하지 않는다. 실제 DB/정책/환경 변경이 없어 해당 복구는 없다. 범위 밖 변경이 필요하면 저장 전에 실제 근거와 최소 대안을 Main에 보고한다.
