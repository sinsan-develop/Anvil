# FN03/UI06 문서 보관 작성·상태 주체 조회 결과

## 현재 판정

2026-10-28, 담당 fn05_share_request_impl. 기존 계획 내 source-only 소비선 구현과 Main 직접 검증을 마쳤다. API 독립품질 C0/I0/M0, 신규 unit 독립명세 C0/I0/M0다. **Page/DOM 독립정적검수도 C0/I0/M0·필수 보완0으로 접수되어 이번 source-only 한정 검수를 완료했다.** 실제 DB/서비스/Agent·정식 served·사용자 인수·전체 FN03/UI06/Stage/계획은 미완료다.

- 등록 source 기준은 WI/manifest의 a2ff8802ad648445b8c0869535efebb428dbf349, 기존 codex/av3-stage-b다. source 실행공간은 해당 등록 참조를 따른다. 새 branch/worktree/commit/push0, Main 제품 write0·단일 writer로 수행했다.
- WI: docs/work_packages/FN03_DOCUMENT_RECORD_PROVENANCE_IMPLEMENTATION.md, SHA256 8D7AE99BB9B28BA331D2203BEE6DBD79D699ACF00123A8502AF8AE6DF34F0507.
- manifest: docs/work_packages/FN03_DOCUMENT_RECORD_PROVENANCE_SOURCE_MANIFEST.json, SHA256 EFFBA0E043A78D3264E24C6DE613BA15D8180C62CC395C064685C73D8968A136.
- 허용6은 기존 제품2·신규시험3·본 결과서1이다. 신규 컴포넌트 파일/새 export0, 서버/API/SQL/권한 계약 추가0, 기존 시험 변경0이다. 준비 문서2는 정본과 등록 source에 동일 바이트로 작성했다. 본 결과서도 양쪽에 동일 작성한다.
- 근거는 WORK_PLAN FN03/UI06 및 FUNCTION_WORK의 작성 주체·상태·이력 조회, SCREEN_WORK UI06, INTERFACES getDocumentVersion의 기존 authorRef/createdAt/statusHistory다. FN17 새 의미결정·P03/FN16/CapabilityReport와 무관한 기존 소비 누락만 보완했다.

## 변경 전·후와 의미 경계

기존 서버는 인증된 저장 명령 주체인 authorRef={kind:'HUMAN',userId:actor.actorId}, createdAt 및 각 statusHistory.actorRef를 반환한다. Web DocumentVersion은 이를 타입/검증에 소비하지 않았고 화면은 이력 종류·이유·시각만 출력했다.

api.ts는 authorRef/createdAt/각 event.actorRef를 각각 optional로 추가했다. 미제공 자료와 기존 호출자는 유지하며, 필드가 제공됐을 때는 정확 HUMAN kind/userId UUID·추가키 없음과 서버 ISO 시각을 검증한다. present null/잘못된 형식/unsupported kind는 RESPONSE_INVALID로 거절한다. 없는 값을 현재 로그인 사용자·현재 시각·다른 이력에서 보충하지 않는다.

DocumentsPage.tsx는 기존 성공 고정 원문 조회/currentDownload guard를 재사용해 기본 접힘 ‘보관 작성·상태 주체’만 추가했다. 문서 ID/고정 버전, 작성 기록자·보관 작성 시각, 각 상태 변경 주체를 명시 열기로 표시한다. 기존 statusHistory 배열/순서·종류·이유·시각 문구는 그대로 유지했다. 펼치기에서 추가 GET/POST/저장·확정·버퍼 교체를 하지 않는다. 읽기 중·거절·다른 버전/주체/client/project/transport·늦은 응답에서는 새 상세를 숨긴다. CSS·설정·패키지·기존 본문/첨부·검토·확정 동작은 변경하지 않았다.

‘작성 기록자’는 저장 명령의 인증 주체이며 원문 내용의 실제 저자나 LLM 작성자라는 뜻이 아니다. 작성 기록자와 확정 이벤트의 행위자는 각 보관값으로 구분한다. 기존 contentHash는 title/formRef/stageNodeRef/content 대상이며 metadata를 해시에 추가하지 않았다. 따라서 본문 해시로 metadata 신원 무결성을 보장하거나 현재 권한·독립 검수를 증명한다고 표시하지 않는다.

## 최종 동결 제품·시험5 raw

| 파일 | SHA256 |
| --- | --- |
| apps/web/src/features/design-trace/api.ts | 1E91D1AC8E108739E0859A3E6B600200F0EA727B0FFEE3AEE81E847D860B9CEB |
| apps/web/src/features/design-trace/DocumentsPage.tsx | 3273F7C7E5C38837F830FA68EBDB3A918319A424DD79097DEB25DBAF9C6C204D |
| tests/unit/FN03/document-record-provenance.test.ts | 000F8D7096413617F98C443D231A53CF32FC7D67D95A4C3B51F7DBE9883FCD7A |
| tests/browser/UI06/document-record-provenance-dom.test.ts | 9B46C24DE6EFAD9CD6D5D992AD9BA1271E81A7A773C909B861FEC821D2F9C9ED |
| tests/browser/UI06/document-record-provenance-dom-harness.tsx | DC5AA6465CABE94A160ECBD7A31EFA50B065B96EF2071B600AC3E3E92F678ADB |

원 api.ts raw는 39F14ED64A63A2E5B85C82550277804E48D0339CE12CFEDC4A2E4A3993275282, Page는 4418525451859B712F0E34C24FA236B201D27A76272625BE31576C7E44F2A56E다. Main7484da는 TEST_ONLY 시 기존 제품2 불변을 확인한 뒤 API GO를 발행했다. 보호12는 준비 단계 실제 대조 및 Mainad2098 preflight에서 불변 확인됐다. 이후 담당은 제품2/시험3 동결을 제출했고 본 결과서 작성에서 추가 source/시험 검사는 수행하지 않았다.

## 명령과 실제 결과

아래는 등록 source 기준 상대 명령의 참고 raw 기록이다. author 제출과 Main 독립 실행을 분리한다.

신규 unit:

    node --test --test-reporter=spec tests/unit/FN03/document-record-provenance.test.ts

신규7+직접 기존13:

    node --test --test-reporter=spec tests/unit/FN03/document-record-provenance.test.ts tests/unit/FN03/document-confirmation.test.ts tests/unit/FN03/pinned-form-original.test.ts tests/unit/UI06/document-version-comparison.test.ts

초기 SSR만:

    node --test --test-reporter=spec --test-name-pattern=^SSR tests/browser/UI06/document-record-provenance-dom.test.ts

| 수행자·증거 | 선택 | 결과 |
| --- | --- | --- |
| author e0aa5c | 신규 unit7 | 4PASS3FAIL, skip0/cancel0/todo0, 198.6613ms, exit1. present authorRef/createdAt/event actorRef 검증 부재3 RED |
| Main 4e965f | 신규 unit7 | 4PASS3FAIL, skip0, 172.4827ms, exit1. 원 제품2 불변7484da와 함께 RED 독립 확인 |
| author bf7efb | API1 한정 구현 후 신규7 | 7PASS, skip0/cancel0/todo0, 212.7523ms, exit0 |
| author cec469 | npm run typecheck | exit0 |
| author da6e32 | 신규7+위 기존3파일13 | 단일20PASS, skip0/cancel0/todo0, 656.6811ms, exit0 |
| author 860006 | 초기 SSR 선택 | 1PASS, skip0/cancel0/todo0, 717.7406ms, exit0. 조회 후 상세 검증 아님 |
| author 99a3ac | Vite configFile:false/build.write:false, DOM harness IIFE 메모리 bundle | chunk1/CSS1/rootToken=true/appShell=true, exit0. dist/QA 생성0 |
| Main 0b1334 | 신규7+같은 기존13 | 단일20PASS, skip0, 511.796ms, exit0 |
| Main 3d05bf | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json | exit0 |
| Main 2e9ab0 | 기존 skill detect | [] |
| Main 2a7b9a | ANVIL_DOCUMENT_RECORD_PROVENANCE_DOM_QA=1 환경에서 node --test --test-reporter=spec tests/browser/UI06/document-record-provenance-dom.test.ts | SSR1+DOM부모1+하위2=4PASS, skip0, 3571.8502ms, exit0 |

신규 unit은 미제공 호환·상이한 저장 인증 주체/확정 주체와 과거버전·metadata 비해시·present exact DTO 거절·기존 본문 bytes/hash 거절·late active 중단을 실제 readDocument로 검증했다. 예외 음성은 ApiError 및 정확 code/status를 대조하며 예상외 오류를 정상 거절로 수용하지 않는다.

실제 DOM은 실제 React DocumentsPage에 virtual 합성 transport를 연결한 한정 증거다. 정상 고정 조회/파일 hash 완료 뒤 기본 접힘·명시 열기·상이한 기록자/행위자·시각·기존 이력 순서·optional 미제공·과거 버전을 확인했다. 중요 실패는 403 최종 렌더와 늦은 JSON의 actor/client/project/version 이탈 후 상세가 되살아나지 않는 것이다. 모든 JSON settled 및 digest started=done 뒤 2RAF 렌더 barrier를 거쳐 assertion했다. 기존 dirty 편집 buffer deepEqual/callback0·POST0·접힘 열기 추가 GET0·unknown0·외부요청0을 검사했다. 실제 서버/DB/정식 served 검증이 아니다.

## 내부 검증 순서 조정과 오류 보존

- Page의 opened는 내부 useState(null)이며 초기 SSR은 조회 후 상태를 렌더할 수 없다. Main은 기존 unit RED3와 f95be7/01db4a의 실제 UI 소비 누락 대조를 근거로 Page GO를 발행했다. source 문자열 존재 시험·내부 state 강제주입·새 export/컴포넌트를 만들지 않았다. 초기 SSR 자동GET0·로그인 주체 추정0의 양성1과 실제 DOM 조회 후 상세 검증을 구분한다. **조회 후 SSR RED/PASS라는 주장은 하지 않는다.** 이 순서 조정은 내부 검증방법의 비의미 변경이며 제품 범위/계약/검수 기대를 완화하지 않았다.
- author e3d3fd type 실패1은 신규 fixture 함수 document가 브라우저 document 전역을 가린 타입 오류였다. 함수명을 documentWire로만 바꿔 cec469 type exit0으로 확인했다. 제품 실패나 기능 RED로 계산하지 않는다. 기존 기대·timeout·skip·제품 기준을 바꾸지 않았다.
- UI 수정 직전 5b592b에서 impeccable SKILL 및 reference/craft-floor.md를 읽었다. Main의 기존제품 scoped context093e18을 따랐고 새 PRODUCT/DESIGN·CSS를 생성하지 않았다.
- API 독립검수 C0/I0/M0, 신규 unit C0/I0/M0는 접수됐다. **Page/DOM 독립정적검수도 C0/I0/M0·필수 보완0으로 접수됐다.** 정적 검수와 Main 실행 PASS의 증거 종류는 분리한다.

## Main QA 자원과 정확 정리

등록 root: D:/tmp/anvil-v3-document-record-provenance-dom-20261028-01. author의 실제 DOM/브라우저/QA 자원 생성은 0이며 Main만 실행했다.

- Main9a4c58: 생성 전 owner SINSANcyhuh, root 부재/link0/profile0 확인.
- Main2a7b9a: 위 합성 fullfile4PASS.
- Mainea5a89: 정상 close 후 소유185files/58dirs/14619729bytes·linkescape0/profile0 확인하여 등록 root 정확 회수.
- Main35ef5f: 별도 검사에서 root 부재/profile0 확인.

기존 인접 browser 경로 tests/browser/UI06/document-read.spec.ts와 document-version-comparison.spec.ts는 준비 단계 읽기 전용으로 확인했으며 이번에 전체 browser 회귀로 실행하지 않았다. 완료한 검색/업로드/공유·UI08 전체 회귀는 반복하지 않았다.

## 미검증·rollback·다음 조치

실제 DB/SQL/RLS·실서버/정식 served·운영 권한/승인 집행·서비스/Agent·사용자 인수는 NOT_RUN이다. 서버가 반환한 metadata의 독립 진위 인증이나 원문 실제 저자 검증도 아니다. 전체 FN03/UI06/Stage/계획은 미완료다. 새 API/서버/SQL/DDL/schema/권한/정책/Secret/인증서/비용/외부전송 실행0이다.

rollback은 Main이 이번 허용 경계만 대조하여 기존 제품2를 기준 a2ff8802의 위 원 raw로 복원하고 신규시험3/본 결과서를 같은 변경 경계에서 되돌리는 방식이다. 보호12·다른 dirty/완료 자료에 reset/clean/삭제를 하지 않는다. DB·정책·환경 변경은 수행하지 않아 해당 복구는 없다.

다음은 Main의 최종 diff·허용/기존시험/보호 확인 및 정확 checkpoint 통합 판단이다. 담당은 이 결과서 작성 뒤 동결하며 제품/시험/환경 추가 변경·검사 반복·Git 작업을 수행하지 않는다.
