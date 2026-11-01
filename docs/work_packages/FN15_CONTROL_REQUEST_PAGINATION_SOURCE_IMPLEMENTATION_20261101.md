# FN15/UI12 인수 요청 목록 페이지 탐색 source 작업지시서

기준: fc5f0b5fdfcb9f3351ef956a0e67d77082ef895c / codex/av3-stage-b. 기존 Primary 구현, Main 검수·통합, 기존 Reviewer 읽기. 기존 ControlApi.list의 OWN/CONTROLLER 보호 GET·opaque signed cursor를 재사용하는 사용자 탐색 보완이다. FN16/FN06 미채택 결정을 대신하거나 실제 인수 수락·제어 이전을 추가하지 않는다.

## 단일 writer 허용2
- apps/web/src/features/control-handoff/ControlAccessPage.tsx — SHA256 F1AB74EB51D41E0AF72253094BDCA0392F6536FB4CE8A98BC5DF539B0582FF07
- tests/unit/UI12/control-access-pagination.test.ts — 신규, 부재 확인
서버/API/SQL·App/ControlBuffer/ControlScope helper·CSS·완료 화면/시험/보호 untracked3은 수정하지 않는다. Main 제품write0. 실제 DB·권한·키·서비스·Agent·실사용자/백업대상 조사0.

## 확인할 반례와 동작
실제 React Page→기존 ControlApi/decoder로 현재 상태·OWN 또는 CONTROLLER의 첫/다음 목록 정상 조회를 먼저 확인한다. 그 뒤 이전 페이지 복귀 버튼 부재, 실패한 같은 view/cursor 재조회 불가능을 행동 RED로 검증한다. 준비 오류를 제품 반례로 세지 않으며 반례가 없으면 제품 수정0이다.

성공 history/위치와 미성공 target {view,cursor}를 분리하고 성공 후에만 위치를 확정한다. OWN/CONTROLLER의 이력·현재 선택을 섞지 않는다. 이전/다음/같은 실패 페이지는 사용자 명시 동작으로만 기존 GET을 수행한다. 첫 cursor null로 복귀하면 새 관측일 수 있고 같은 snapshot을 보장하지 않는다.

페이지·view·문맥 전환이나 실패에서는 선택 요청 원문·요약을 즉시 숨기고 새 목록에서 명시 선택해야만 고정 GET을 연다. 원목록·요약을 현재 제어 권한/인수 수락 가능으로 승격하지 않는다. 기존 disabled 수락/수집·제어 전환은 그대로다.

## 제어 상태·명령 보호
현재 fail은 목록뿐 아니라 현재 제어 상태를 지우는 fail-closed 동작이다. 이 의미를 유지한다. 실패 target과 이력만 보존하며 cached state·목록 receipt로 현재 제어 상태를 되살리거나 write 버튼을 허용하지 않는다. 같은 실패 목록 재조회가 현재 상태를 요구하면 기존 state GET을 먼저 새로 확인하고 그 뒤에만 기존 권한 조건에 맞는 view/cursor GET을 수행한다. 이 두 GET은 하나의 명시 읽기 동작일 수 있으나 자동 재시도·권한 부재 무시·이전 control basis 복원은 금지한다.

정상 state 새로고침·내 요청 조회·현재 OWNER/HELD 제어자 목록 조건을 보존한다. 현재401/403은 기존 보호 의미를 유지하고 옛 응답/오류·JSON은 현재 프로젝트/사용자/client·CSRF·API/실transport 문맥에 반영하지 않는다. 관측 ABA·unmount·busy/중복 클릭도 확인한다. 새 인증/권한 정책이나 역할을 만들지 않는다.

App 소유 PENDING/UNKNOWN 원명령과 buffer bytes·binding/CAS·기존 send/prepareRequest/prepareSummary의 동작을 바꾸지 않는다. 목록 동작의 POST·onChange0. read 개선을 명령 재전송·승인 생성/소비·제어 이전으로 연결하지 않는다.

## 최소 검증·반환
신규 실제 React 메모리DOM 시험은 기존 Vite configFile:false/envDir:false/write:false 양식과 메모리 응답만 사용한다. 실제 App의 페이지/부모버퍼 경계를 보존하며 OWN/CONTROLLER 분리·왕복·양방향 실패target·성공 전 위치 확정0·원문/요약 숨김·상태 fail-closed/현재 권한 재조회·문맥/transport 폐기·UNKNOWN/PENDING 원형/POST0을 확인한다.

확인된 순수 tests/unit/UI12/control-api.test.ts만 직접 인접으로 검토해 선택한다. createServer/실설정 탐색·시험 이름필터를 통한 넓은 파일실행·기존 시험 기대값 변경0. 정확 root typecheck(-p tsconfig.base.json)·diff check를 실행한다. 실브라우저/레이아웃·실서버 서명/제어 전환·실DB·사용자인수는 미검증이다.

변경 전후 diff·정확명령/exit/선정수·실제 RED→GREEN·오류/미검증·시작끝2지문·QA/live0을 반환한다. 동결 후 Main fresh와 독립 최종 C/I를 확인하고 정확 소유 경로만 통합한다. 문서/commit/push는 Main이 맡으며 전체 FN15/WORK_PLAN 완료·main 병합은 주장하지 않는다.
