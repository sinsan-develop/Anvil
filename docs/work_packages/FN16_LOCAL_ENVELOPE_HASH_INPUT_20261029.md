# FN16 이식키 로컬 파일 지문 입력 연결
2026-10-29 · Main 어울 · 기준546be3125896b0773c447a5bd092169ad62e8bb8

## 목적·범위
승인5A6819E6 계약 §4.1/§5/§6.2·6.4의 기존 envelopeHash 수동 입력 옆에 사용자 선택 암호화 파일의 지문 입력을 연결한다. 새로운 공개 API/DTO/데이터 의미가 아니며 독립 preflight C0/I0다. 실제 키·DB·서비스·비밀번호/Secret 제출·KDF·복호화·설치/전체 백업 실행은 제외한다. 검증은 공개 합성 envelope만 사용한다.

## 정확 허용 4경로
- apps/web/src/features/backups/installation-resource-api.ts
- apps/web/src/features/backups/InstallationResourcePanel.tsx
- tests/unit/UI14/installation-resource-api.test.ts
- tests/browser/UI14/installation-resource-local-hash.spec.ts (신규)

기존 primary 단독 writer, Main 문서·검수·통합, 기존 reviewer 읽기 검수. 기존 SecretForm/download/runtime parser/App/SQL은 수정하지 않는다. 공용 파서의 Node 의존 제거 리팩토링이나 브라우저 Buffer polyfill은 하지 않는다.

## 구현 기준
- 기존 hash가 필요한 IMPORT/VERIFY/UNLOCK/REWRAP의 편집 중 초안만 파일 선택 가능. 암호화 envelope를 읽기 전 크기 1~16384 확인하고 읽은 실제 bytes와 size를 대조한다.
- UTF8 fatal/BOM거절, 정확 canonical JSON 바이트·닫힌 envelope/중첩 shape·고정 crypto parameter·정규 base64url/각 byte 길이·정상 UUID/version/UTC·현재 originProjectId를 기존 계약 그대로 검사한다. 서버 crypto 모듈은 가져오지 않으며 브라우저 기존 canonical/hash 도구와 작은 내부 검사로 구현한다. 같은 공개 literal fixture를 서버 parser와 대조한다.
- 반환·표시는 SHA256만. 파일 이름/경로/본문·파싱 객체를 App buffer/state/command/storage/로그에 보존하지 않는다. 입력 파일 value 즉시 비움, bytes best-effort zeroing·지역참조 해제. JS/OS 완전 소거 보장으로 표시하지 않는다.
- 선택은 POST0/키 인증0/보관 확인0. 명시 선택 성공만 기존 editInstallationResource로 hash 입력·acknowledged false. 기존 수동입력은 유지한다.
- 읽기·hash await 전후 session/client/transport/project/owner/local ticket·원buffer·action/선택 세대 대조. 이탈·ABA·늦은 결과·다른 편집·pending/UNKNOWN이면 반영0, 원command보존. 취소/실패는 새 hash/성공으로 대체하지 않으며 원값 보존 여부를 화면에서 명확히 구분한다.
- 오류는 고정 비밀 없는 INPUT_INVALID/CONTEXT_CHANGED이며 원 Error/file 이름·내용 비노출. SecretForm 활성화·비밀번호 UI·fulfill 연결0.

## 검수
TEST_ONLY 신규 unit부터 Main RED 확인 후 구현한다. 정상 literal hash/서버 형식 정합, BOM·초과·중복키/가변KDF/다른project·비정규base64·크기불일치, 늦은read/digest/이탈·원UNKNOWN 보존을 검증한다. 동일불변 crypto/native/DB검사 반복0.
UI는 Main 사전등록 신규30분 QA에서 실제App의 공개 파일 선택→hash만 입력→별도 명령 준비, POST0/본문비보존·취소/실패/전환을 합성 브라우저로 확인한다. 기존 설치 명령 준비의 직접 인접 회귀·type/build/diff와 독립 검수 후 정확4경로/문서만 게시한다.
실제 사용자 키·DB·served/운영 인수는 미검증으로 남긴다. rollback은 이 편의연결 source revert이며 원 파일/키/자료삭제0.
