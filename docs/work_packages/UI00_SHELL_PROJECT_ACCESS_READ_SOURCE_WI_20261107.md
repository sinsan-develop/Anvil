# UI00 공통 작업틀의 프로젝트 접근 상태 조회 지시서

- 상태: MAIN_INTERNAL_SOURCE_GO / UI00 기존 카드의 미연결 소비자 보완. 기준 9c1530e00d385bcdb364ce52e5552f1dabf61d37, SCREEN_WORK.md UI00의 현재 역할·제어권.
- 기존 Primary 한 명만 코드 writer. 다른 작업자 변경·보호3·기존 권한/DB/API·App의 원명령/입력/이동 처리를 보존한다.
- 정확3: apps/web/src/App.tsx, apps/web/src/shell/AppShell.tsx, 신규 tests/unit/UI00/project-shell-access.test.ts. 나머지 파일은 읽기만 가능하다. Main은 문서·독립 검수·통합만 맡는다.

## 실제 동작

프로젝트가 선택되고 현재 로그인 문맥일 때 상단에 ‘프로젝트 접근 상태 확인’의 명시 행동을 연결한다. 기존 readProjectAccessSummary와 같은 same-origin 보호 GET만 사용한다. 진입 자동 조회/폴링·새 endpoint·권한·POST·제어 획득/실행0이다. 해당 프로젝트의 기존 participation/controlState를 이해 가능한 한글로 표시하고, 받은 시각은 서버 변경 시각/현재 권한 단정과 구분한다. 실제 단계·Agent/실행 가능을 추정하지 않는다. 원 user/client ID·경로·비밀·readiness 원문은 새 상단에서 노출하지 않는다. 표시된 제어 기록은 실제 명령 검사를 대체하지 않는다고 짧게 안내한다. 기존 로그아웃·선택 메뉴·키보드·탐색은 보존한다.

보호 결과는 프로젝트·현재 Session 객체/클라이언트·transport의 문맥과 각 요청 세대에 결박한다. 같은 프로젝트 화면 이동에서 선택한 조회는 유지하고, 다른 프로젝트·로그아웃/로그인·transport 교체·ABA·unmount에서는 결과와 늦은 응답을 폐기한다. 초기 상태/로딩/재조회/권한 거절·연결 오류를 구분한다. 실패 시 예전 성공값을 현재 접근 상태로 남기지 않는다. 유효한 접근 확인을 위해 오류 뒤 사용자 재조회가 가능해야 한다. 기존 인증 오류와 미전송 입력은 보존한다. 새로운 상태는 shell 조회 전용이며 다른 화면의 대기 명령이나 오류를 지우지 않는다. 가독성/키보드와 aria 상태를 기존 shell 구조에서 확보하고 불필요한 패널/스타일 개편을 하지 않는다.

## 검수와 반환

기존 소스에서 실제 App의 조회 동작이 없는 RED를 먼저 확보한다. 실제 React App DOM과 기존 API 소비선/명시 합성 transport에서 로그인·선택 전 요청0→상단 클릭→상태/수신시각→같은 프로젝트 내 이동→명시 재조회/성공·실패를 검증한다. 프로젝트 A→B→A, Session/transport 교체와 HOLD/늦은 JSON, 401/403의 본문 비노출, POST/제어/실행0을 확인한다. 프로젝트 목록/로그아웃 등 직접 인접만 필요 시 검사한다. 합성 DOM·typecheck·빌드/diff를 실제 browser/DB/서비스 인수로 승격하지 않는다.

실제 DB·권한·키·서비스·Agent/SDK·실자료 조사·J3/P03 R3·원격/PR/병합 금지. 단일 writer로 정확 diff와 지문·실행/오류·미검증/잔여0을 반환하고 동결한다. 추가 파일/의미가 필요하면 Main에 반환하며 임의 확장하지 않는다.
