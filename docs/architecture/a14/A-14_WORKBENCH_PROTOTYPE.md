# A-14 Clickable Workbench Fixture Prototype

## 목적과 범위

운영자가 1920×1080 기준 화면에서 프로젝트/fixture를 선택하고, A-13 read-only adapter를 서버측 BFF로 실행한 뒤 canonical Provider 실행 모드와 상태·증거·다음 행동을 확인한다. 이 prototype은 `ENV-LOCAL` fixture 범위이며 실제 Provider, Secret, DB, 사용자 저장소, 배포를 호출하지 않는다.

## 구성과 흐름

`index.html`은 Project/Repository 등록, Conversation, Current Task, Execution Mode, Evidence & Decision 영역을 제공한다. 브라우저 client는 상대 `/api/workbench/config`와 `/api/workbench/scan`만 호출한다. BFF는 Origin/Host, CSRF, role, project, fixture allowlist를 통과한 요청에만 disposable G-06 fixture를 materialize하고 `packages.repository_intelligence.scan_repository()`를 호출한다.

UI는 `NORMAL`, `LOADING`, `EMPTY`, `ERROR`, `BLOCKED`, `QUOTA`, `CANCEL`, `RECONNECT`, `PERMISSION_DENIED`를 구분한다. Fixture 결과 badge는 `FIXTURE`, 아직 실행하지 않은 영역은 `NOT EXECUTED`로 표시하고 실제 PASS로 계산하지 않는다.

## 보안과 운영 경계

- 브라우저 source에는 API 절대 주소와 내부 주소가 없다.
- CSP는 `connect-src 'self'`이며 inline script/style을 쓰지 않는다.
- 요청 body 크기와 allowlist를 검증하고 상세 exception, 서버 path, secret-shaped 값, raw Provider error를 응답하지 않는다.
- UI는 동적 문자열을 `textContent`로 렌더링한다.
- 서버 검증이 독립적으로 적용되어 disabled button이나 직접 요청으로 권한을 우회할 수 없다.

## 롤백

A-14 exact 17 paths만 제거하면 A-13 승인 코드와 기존 fixture·progress·authority에는 영향이 없다. Developer는 commit/push를 하지 않는다.
