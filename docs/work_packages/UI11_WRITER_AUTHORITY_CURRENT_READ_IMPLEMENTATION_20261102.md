# UI11 프로젝트 writer 원장 수동 조회 구현 계획·작업지시서

2026-11-02 / Main 어울 / 기존 승인 소비 구현 / TEST_FIRST

> 기존 Primary가 subagent-driven-development·TDD로 아래 업무를 구현한다. Main은 설계 범위·검수·통합을 관리하고 기존 Reviewer는 읽기 전용이다. 같은 경로의 code writer는 한 명이다.

**목표:** UI11에서 이미 채택·구현된 프로젝트 writer current GET을 사용자가 명시적으로 조회하고, 원장 단계·기한·미확인을 실행 허가와 구분해 확인한다.
**구조:** 기존 ConnectionsPage 안의 접힘 읽기 영역·브라우저 전용 reader·현재 응답의 닫힌 검산만 추가한다. 기본 서버 미등록/정책·원 writer 모델·SQL은 보존한다.
**기술:** 기존 React/TypeScript·ApiClient.get·WebCrypto·Node 단위/메모리 ReactDOM 검수. package/lock/의존성 변경0.
**설계 근거:** SCREEN_WORK UI11 134~138, 설계 §11.12 696~698, 채택 B docs/contracts/FN06_ACTUAL_WRITER_AUTHORITY_DELTA_CANDIDATE.md §5:98 및 직접 승인63C7EECF. 기존 GET은 코드77352ea8/최신 게시d6f0eb30bb55c162517757c70688ed0891671ba7에 있다. 기존 Reviewer의 범위 사전 대조 C0/I0로 새 공개 계약/실행 권한이 아닌 기존 UI11 소비로 확인했다.

## 1. 범위·정확 파일·담당

기존 Primary만 아래5경로를 수정/생성한다.
1. 기존 apps/web/src/features/connections/ConnectionsPage.tsx: 패널 진입만 연결. 기존 버퍼·명령·선택·승인/정책을 수정하지 않는다.
2. 신규 apps/web/src/features/connections/writer-authority-current-api.ts: 상대 GET·응답 검산과 필요 시 패널이 실제 사용하는 요청 수명 helper.
3. 신규 apps/web/src/features/connections/WriterAuthorityCurrentPanel.tsx: 수동 조회·조회 중/오류/결과·닫기와 정확 사용자 문맥 보호.
4. 신규 tests/unit/UI11/writer-authority-current-api.test.ts.
5. 신규 tests/unit/UI11/writer-authority-current-panel.test.ts: 기존 메모리 ReactDOM/Vite write:false 패턴을 이 시험 안에서 필요한 범위만 사용한다. 실제 클릭/effect를 검사하며 SSR만으로 클릭 PASS라 하지 않는다.

Main은 이 WI·WORK_PLAN·WORK_STATUS·결과 문서만 관리한다. 기존 source/시험·보호 untracked3/Backup·Git 설정·다른 화면·package/lock·DB/SQL/서버/실행기 변경0. 새 파일/의존성이 필요하면 쓰기 전에 정확한 이유를 Main에 반환한다. 새 agent/chat/branch/worktree/예약0.

## 2. 사용자 동작과 비범위

- 기존 Agent·환경·권한 화면에 프로젝트 단위의 접힘 보조 영역을 둔다. 사용자에게 writer 원장 상태를 수동으로 확인하는 기능임을 알린다. 이 위치/배치는 Main의 기존 화면 안 구현 판단이며 새 Dashboard나 제품 개념 변경이 아니다.
- 화면 진입/접힘 열기만으로 GET하지 않는다. 사용자가 조회 버튼을 누를 때만 기존 ApiClient.get으로 /api/v1/projects/:projectId/writer-authorities/current를 요청한다. 자동 폴링/재시도/POST/establish/revoke/정책 부여0. 기존 기본 서버 등록도 열지 않는다.
- pending 때 이전 결과를 숨기고, 오류/닫기/권한 상실/문맥 변경 때 해당 조회 결과만 제거한다. 다른 후보/환경/승인 작성 입력과 보존 명령을 건드리지 않는다. 명시 재조회/닫기는 허용하되 유실 결과를 성공으로 재생하지 않는다.
- head:null은 현재 head 기록 없음이다. writer 없음·안전한 새 writer·회수 성공으로 해석하지 않는다. tip은 최신 append 참조이며 currentEventRef와 다를 수 있다.
- phase는 저장된 원장 단계로만 표시한다. ACTIVE도 실제 Agent 실행/쓰기권한 사용 가능으로 번역하지 않는다. 실제 권위/실행/회수 표식4false와 원장 조회의 한계를 결과에 분명히 표시한다. 상세 fullref/hash·등록/범위hash는 접힘 상세로 제공하고 제공되지 않은 source 경로·원 사건·등록제품 정보를 추론하지 않는다.
- 기한·expired는 응답 기준 정보로 표시한다. 남은 시간/자동 활성 가능·실시간 유효성을 계산해 권한을 주지 않는다. 404/503은 조회 미연결/미확인으로 표시하고 합성 정상 응답으로 대체하지 않는다. 401은 기존 onAuthenticationLost를 호출하고,403은 본 결과를 회수한다. 오류는 기존 고정 ApiError 코드만 보여주고 원문 예외/Secret를 노출하지 않는다.

## 3. 기존 응답의 정확 검산

기존 GET 응답은 정확7필드 head,tip,expired,executionAuthorized,dispatchPerformed,actualAuthorityAvailable,writerReleaseVerified다. 뒤4개는 전부 false, expired는 boolean이다. 추가/누락/불일치·2MiB 초과·잘못된 숫자/문자열을 거절한다. head없음에서 expired:true는 거절한다. 없는 자료를 채우지 않는다.

head는 기존 WriterHead exact ref/snapshot이다. 기존 schema와 같은 목적/필드/phase·UUID·양의 안전 정수·fullref/hash·lease/execution 명시null 규칙을 브라우저에서 검산한다. 요청 projectId와 snapshot.projectId 일치, ref.id=headId·ref.version=headGeneration, snapshot canonical SHA256=ref.contentHash를 WebCrypto로 대조한다. head있음에서 tip은 fullref여야 한다. tip도 정확 fullref 문법으로 검산하되 hash만으로 소속 project나 실제 원 사건 진위를 확인했다고 하지 않는다. tip=currentEventRef를 강제하지 않는다.

브라우저에서 서버 모듈 또는 node:crypto를 runtime import하지 않는다. 기존 브라우저 ordered/canonical 방식·WebCrypto/순수 ref 검사만 사용하고 새 전체 parser framework를 도입하지 않는다. 응답 검산 전후 비동기 JSON/hash 단계마다 현재 요청 문맥을 다시 확인한다.

## 4. 수명·미확인 보호

조회 문맥은 projectId·session.user.id·clientId·csrfToken·ApiClient 인스턴스/transport와 요청 세대다. 문맥이 A→B→A로 바뀌거나 transport/클라이언트가 교체되면 옛 응답/늦은 오류가 새 상태에 나타나지 않아야 한다. 닫기/unmount/새 조회도 이전 pending을 무효화한다. POST나 서버 제어권 변경으로 복구하지 않는다. 실제 세션/제어/정책 현재성은 서버 GET 검사가 책임지며 화면만으로 검증했다고 하지 않는다.

Main 검수 초점: (1) head없음/ACTIVE를 안전·허가로 오인하는 표시 (2) 외부/다른 project·해시변조를 정상으로 렌더 (3) JSON/hash 지연과 A→B→A/닫기 뒤 본문 누출 (4) 인증/404/503 실패를 빈 정상으로 처리 (5) 새 패널이 기존 작성 버퍼·조회·메뉴를 바꾸거나 자동 요청/POST를 발생시키는 회귀.

## 5. 한 업무의 구현·검수 순서

- [ ] 기존 연결 화면과 GET 응답을 읽고 기준HEAD·dirty 소유권을 확인한다. 완료 writer 서버/SQL 검사를 재실행하지 않는다.
- [ ] 정상 응답·해시변조/다른project·네false 위반·headnull/expired 및 상대GET을 먼저 시험한다. 실제 누락된 소비/검산 반례 RED를 확보하고 구현한다. module/loader 부재나 시험 준비 오류는 기능 RED와 구분한다.
- [ ] 실제 패널의 수동 조회→결과→재조회/닫기와401/403/404/503·지연·문맥 ABA를 메모리 ReactDOM에서 시험하고 ConnectionsPage 진입 연결을 확인한다. 모의 GET/메모리 DOM의 범위를 명시한다.
- [ ] 기존 ConnectionsPage의 직접 인접 선정1파일, 새2시험, typecheck·메모리Web build(write:false)·diff를 수행한다. 의미/코드 불변 전체 검사·실브라우저/기기 전수·DB/서비스·Agent·키 생성0. 시험 대역은 이 화면의 합성 head만 만들고 실제 사용자/등록 파일을 읽지 않는다.
- [ ] 정확 파일/diff/hash·명령/exit·RED/GREEN·준비/정식 오류·미검증·handle0·writer 반환을 보고한다. Main fresh·독립 Critical/Important0 뒤 허용 branch checkpoint/private 게시로 통합한다.

## 6. 종료 조건·미검증·복구

기존 GET과 사용자 클릭 소비가 source에서 연결되고 선택한 정상/실패/지연 조건을 확인한 범위만 검수한다. 실제 서버미등록·실PG/served/브라우저보안/시각·권위공급자/실제 Agent·사용자 인수 및 전체UI11/FN06/FN08/계획은 미완료로 유지한다. actual fact/permit schema·발급/OS 실행의 새 계약을 이 작업으로 채택하지 않는다. 복구는 정확 diff의 정상 revert 검토이며 서버/DB/실자료를 되돌리는 작업은 없다.