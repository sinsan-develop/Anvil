# UI10 지시 부분계획 명시 조회 source 작업지시

기준 main 65a51ae2c09328e9021f205f52c7340ab6a34b2a, branch codex/av3-ui10-instruction-parts. 기존 채택 FN08_INSTRUCTION_PARTS_PLAN_ADDENDUM_CANDIDATE_20261115.md(SHA256 F3243D1411C4FF434F4548904B99A9B0BBA353EA171FAC0314F7D99353DD91DF)의 GET을 기존 UI10 원 지시 상세에서 소비한다. 새 공개 API·권한·DB 계약은 없다. 단일 제품 writer developer_primary, Main 문서·검수·통합.

## 허용 경로
- apps/web/src/features/knowledge/conversation-api.ts
- apps/web/src/features/knowledge/ConversationPanel.tsx
- tests/unit/UI10/instruction-parts-api.test.ts (신규)
- tests/browser/UI10/instruction-parts-render.test.ts (신규, RAM SSR/합성 경계만)

## 동작
선택한 USER_INSTRUCTION 원문 상세에 지시 부분계획 조회 버튼을 제공한다. 명시 클릭으로만 기존 same-origin GET을 호출하고 부분 수·총 bytes·접힌 참조를 표시한다. 자동 조회·SEND·승인·실행 버튼은 추가하지 않는다. 응답 exact shape와 원 instructionRef/sourceRef, bodyRef, UTF-8 원문·64KiB code point 경계·각 부분 hash/offset·총 bytes·limits·canonical plan hash/partsRef를 WebCrypto로 검산한다. 서버 원문 계획을 대체하거나 권한으로 간주하지 않는다. 서버 Node 의존 모듈을 브라우저에 import하지 않는다.

원 선택과 client/project/user/clientId/CSRF/controlGeneration, request/epoch를 결박하고 GET/JSON/digest 이후 현재성을 재검사한다. 선택 변경·닫기·unmount·주체 변경 시 이전 결과와 늦은 401을 폐기한다. 실제 요청 취소와 늦은 응답 폐기는 구분한다. 기존 조회·답글·정정 기능은 유지한다.

## 검증
먼저 핵심 RED, 이후 정상·다중바이트/경계·잘못된 원문/재해시 변조·다른 지시·추가필드·offset·오래된 응답/401의 API 합성시험을 GREEN으로 한다. 기존 FN05 conversation API 인접검사와 typecheck, Vite write:false SSR 또는 메모리 화면 구조 검사를 적용한다. 브라우저 프로필을 만드는 기존 DOM 시험은 실행하지 않는다. 신규 종속성·가짜 DOM 런타임을 만들지 않는다. SSR/합성 이벤트는 실제 React DOM 상호작용 PASS가 아니며 실제 클릭·레이아웃은 미검증으로 남긴다. 필요한 추가 경로는 쓰기 전에 Main에 근거를 보낸다.

## 제외·인계
실제 DB·권한·키·서비스·사용자 원문·Agent/SDK 실행·파일 조사·브라우저 프로필 생성 제외. 코드/시험 소유 4경로 외 변경 금지. 다른 작업자가 있으므로 타인 변경을 되돌리지 않는다. 완료 시 정확 diff/hash·명령·exit·실제 시험 수·실패 원인·미검증·live handle 0을 반환한다. Main 독립 검수 후 통합한다.
