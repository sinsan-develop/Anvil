# FN18 기존 수신 브리지의 화면·preload 타입 계약 연결 r2

## 근거와 책임

- FN18_DESKTOP_SHELL_IMPLEMENTATION_20261030의 데스크톱 타입 검증과 이미 채택·구현된 FN06 수신 화면/IPC 계약을 완성한다.
- 현 순수 desktop 타입 진단은 169건·exit1이며 원출력 SHA256 241145D004D9C824457667ED08D7646FB8E2DE55EEAAD898A63E02E8415325F6이다. 과거 169건과 개별 동일성은 원출력 부재로 미확인이다.
- settings.js의 trustApi 선언은 preload가 노출하고 화면이 이미 호출하는 nativeReceiveStatus/Begin/Refresh/Arm/Close를 빠뜨렸다. 해당 TS2339 5건을 먼저 보완했고, 같은 브리지의 preload TS7006 19건을 이어서 연결한다. 나머지 오류를 없었다고 표시하지 않는다.
- 같은 Stage E의 UI14 목록 재조회와 별도 소스 단위로 검수하고 한 Stage E 내부 보완 PR에 함께 통합한다. Main은 검수·통합, 기존 developer_primary는 단일 writer다. 다른 변경을 보존한다.

## 쓰기 범위

1. apps/desktop/src/settings.js — 기존 JSDoc 선언과 필요한 정적 typedef만.
2. apps/desktop/src/preload.cjs — 기존 JSDoc 매개변수 선언만.
3. docs/04_test_reports/AV3/FN18_RECEIVE_BRIDGE_DECLARATION_RESULT_20261116.md — 화면5건 결과 보존.
4. docs/04_test_reports/AV3/FN18_PRELOAD_RECEIVE_DECLARATION_RESULT_20261116.md — preload19건 별도 결과.

제품 실행문·IPC handler·설치 정의·TS config·package/lock·권한은 수정하지 않는다. 새 시험은 구현을 그대로 복제하지 않는다. 기존 시험에 실제 누락이 있으면 추가 경로 변경 전에 Main에게 근거를 반환한다.

## 보존과 검수

- 기존 preload·handler·native-first-receive-client의 인자 순서, nullable 범위, 참조 형상, 명확 성공/실패 응답을 원문에서 대조해 다섯 메서드의 선언을 연결한다. 확인한 응답 형상은 가능한 명시적 union/typedef로 표현한다. 새 any·index signature·ts-ignore/ts-nocheck·검사 제외/완화로 진단을 숨기지 않는다. 기존 any 전면 정리는 이번 범위가 아니다.
- JSDoc만 변경해 런타임 동작과 IPC 표면이 동일함을 diff로 확인한다. 새 메서드를 노출하거나 호출 경로를 추가하지 않는다.
- 같은 고정 TS7·desktop tsconfig·--noEmit 검사로 정확 다섯 TS2339 소실과 신규 진단0을 확인한다. 줄 이동은 별도로 구분하고 기존 나머지 진단은 파일/코드/메시지별 중복 건수로 대조한다. 164건이 남으면 전체 desktop 타입 검사는 계속 FAIL이다. 원진단은 QA 자료로 보관하고 Git에 사용자/환경 자료를 넣지 않는다.
- 기존 desktop-trust-registration의 해당 수신 화면 RAM 시험을 검사해 선택 실행한다. 실제 Electron·native 프로세스·SDK를 시작하는 시험은 실행하지 않는다. ROOT 타입과 main 대비 diff는 영향에 비례해 선택한다. 코드 불변의 UI14 시험을 다시 전수 실행하지 않는다.
- r2의 preload 범위는 수신 begin/status/refresh/arm/close의 기존 인자 17건과 onState 내부 리스너의 event·state 2건이다. 원 policy의 UUID/양의 epoch/정확 offerRef/version1/명시true/sender 검산에 맞는 타입을 원문으로 대조한다. listener 경계 값은 unknown을 사용하며 event를 전달하지 않는 기존 동작을 보존한다. 새 Electron 타입 import/shim·any·config 변경은 없다.
- 같은 검사에서 164개 기준의 정확 TS7006 19건 소실·신규0을 대조한다. 145개는 예상이며 실측 전 결과로 사용하지 않는다. electron TS2307은 별도 모듈 해석 실패로 남긴다. 기존 RAM IPC 5종 입력 검산과 화면→preload→main 시험을 선택 실행하고 JSDoc 외 실행문이 동일함을 증명한다. 이미 검증한 settings.js 제품과 결과는 보존한다.
- 결과서에 정확 명령/exit/건수·원진단 지문·사라진 진단과 잔여·변경 지문·실행문 동일성·미검증·복구를 기록하고 쓰기를 반환한다.
- 실제 FS/사용자/백업 조사·DB·권한·키·서비스·SDK/Agent/C#·Electron 설치/패키징/앱 실행·추가 SDK 조회·종속성 설치는 하지 않는다.
