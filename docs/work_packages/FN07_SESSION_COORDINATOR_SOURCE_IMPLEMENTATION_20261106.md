# FN07 원 세션 내부 조정·호출 경합 작업지시서

- 상태: MAIN_INTERNAL_REVIEW / SOURCE_GO0.
- 작성일: 2026-11-06
- 기준 HEAD: 5e677acf5025dc73494d24369a2384fb3b2885dd, 기존 codex/av3-stage-b.
- 범위: 내부 소스·메모리 합성 검증. 실제 Agent·DB·권한·키·서비스·사용자 전송 제외.

## 1. 목적과 계획 근거

WORK_PLAN FN07의 두 번째 Agent 연결을 이어간다. 현재 제품에는 factory가 만든 원 owner를 한 번 인계받아 원 SEND/관측/중지/정리를 같은 세션 수명으로 조정하는 caller가 없다. 기존 Primary와 읽기 담당자가 apps의 실제 호출점을 대조했고, Adapter 계약의 동일 context/session 연결과 분리된 내부 구현이 가능하다고 확인했다.

새 동작은 START 인계 전 SEND 거절, 원 context/등록/선언 세션 혼입 거절, 같은 owner 보관·원 지시 공급, 단절/close 경합·늦은 결과의 상태 덮어쓰기 차단이다. 단순한 메서드 이름 재노출이나 기존 receiver/factory/owner/bridge 재구현으로 진도를 대신하지 않는다.

기존 미채택 Claude SESSION claim과 실제 SID 보호 생산자는 별도다. 이번 모듈은 명시 합성 포트와 기대 SID/선언 sessionBindingRef만 소비하고 실제 SessionRef를 발급하거나 서버 권위를 만든다고 하지 않는다. 기존 인터페이스의 실제 SDK 6함수 검증·실제 도구 통제 완료로 표시하지 않는다.

## 2. 정확한 허용과 단일 writer

기존 Primary만 신규 두 경로를 작성한다.

1. apps/connector/adapters/secondary/session-coordinator.ts
2. tests/unit/FN07/claude-session-coordinator.test.ts

기존 factory/owner/bridge/codec/receiver·public/server/schema/SQL/package/native는 수정하지 않는다. 추가 경로가 꼭 필요하면 쓰기 전에 정확한 모순과 경로를 Main에게 반환한다. Main은 같은 제품을 수정하지 않고 문서·검수·통합만 맡는다. 다른 사람의 자료와 관련 없는 보호3·Main 문서를 되돌리지 않는다.

원 의존 지문:
- factory16133B/ACACF14DD16378F1EFD95DD241D190432E47D54C9F724D46BDF97F603E2B4F19
- owner14130B/1F032A5B653FAE5FB53344A614D389F0C42715335B8712CEDEF48444B072ACF9
- bridge11992B/760336ACB4D71B0855DEBF930463E914C996ACC234AEAE63BB391E7416052029

제품 GO는 이 WI의 사전검토 뒤 정확 hash에 대한 Main GO로만 발행한다. 새 branch·worktree·chat·자동화·실행기는 만들지 않는다.

## 3. 명시 합성 구성과 원 START 소유

SyntheticClaudeSessionCoordinator는 SYNTHETIC_ONLY로만 생성한다. 실제 START SyntheticMaterialReceiver, 원 START envelope, 기존 기대 SID, 선언 sessionBindingRef, 합성 driver/current, clock·timeout/bytes/identity 상한과 원 expiresAt을 고정한다. 선언 ref는 caller가 지정한 합성 일관성 값일 뿐 실제 SID/Anvil 세션의 보호 증거가 아니다.

실제 SyntheticClaudeSdkQueryFactory를 내부에서 한 번 만들고 한 START attempt만 관리한다. 호출 인자는 own 데이터/Proxy·getter를 거절해 복사·고정하며 envelope는 기존 bounded reader로 검산한다. driver/current는 명시 합성 포트 외 기본값을 두지 않는다.

start(attemptId,call)는 원 factory.open을 소비한다. 같은 시도의 pending/고정 결과를 유지하고 다른 시도·생성 불명 뒤 새 factory/Query를 만들지 않는다. owner는 OWNER_AVAILABLE인 원 결과에서 factory.takeOwner를 한 번만 소비해 private으로 보관한다. raw Query/iterator/owner를 일반 결과나 getter로 내보내지 않는다.

START 인계 전 SEND·observe는 호출하지 않고 실패 상태를 비밀 없이 반환한다. 인계 전 명시 중지는 원 owner interrupt를 호출할 수 없으므로 신규 작업을 닫고 조정자가 소유한 START를 취소한 뒤 같은 factory의 유한 close만 소비한다. 이를 실제 provider 중지·회수 성공으로 표시하지 않으며 이후 늦은 START가 활성 상태를 만들지 못하게 한다. UNKNOWN 또는 REJECTED인 START를 새 성공/새 SID/새 permit으로 복구하지 않는다. 늦게 도착한 open 결과가 이미 닫힌 세션을 READY로 되돌리지 못하게 한다.

## 4. 같은 owner의 SEND와 관측

send에는 실제 SEND receiver·원 SEND envelope·고정 선택 grantRef/expiresAt·caller signal/기한만 받는다. 원 START의 context 전체·등록·실행 세대와 같아야 하고 payload.sessionBindingRef도 고정 선언 ref와 같아야 한다. 원문이나 SID를 추측해 혼입을 맞추지 않는다. START 인계·원 포트·원 기한·세션 상태를 await 전후 다시 검사한다.

원 SyntheticClaudeInstructionBridge를 만들어 같은 private owner에 연결한다. 원 envelope/refs/수신 bytes/문장·중복 장부/UNKNOWN/원문 폐기 검사를 그대로 소비하며, user 메시지나 별도 장부를 다시 구현하지 않는다. 동일 시도/동일 원 결박의 재조회가 새 bridge/Query·수명 연장·입력 재공급을 만들지 않게 한다. bridge의 기존 같은 owner별 공유 장부도 유지한다.

관측은 owner.observe의 실제 구현을 소비한다. 기존 입력1·관측1의 병행 범위를 유지하며 새로운 병렬 호출이나 자동 관측 loop/polling·자동 prompt를 추가하지 않는다. init 전 prefix/init/후속 관측은 기존 단일 owner/iterator에 순서대로 남아야 한다. 관측을 마지막 지시의 답변·업무 완료로 임의 귀속하지 않는다.

SEND UNKNOWN은 원 owner의 새 입력 차단을 유지한다. 기존 owner가 허용하는 관측/정리까지 임의 성공·완료로 바꾸지 않으며, 불명 입력을 다른 command나 다른 factory로 재시도하지 않는다. owner 내부 input/observe/control 장벽을 우회하는 직접 Query 호출은 금지한다.

## 5. 중지·단절·close 경합

중지는 같은 owner.requestStop만 명시 호출한다. 새 입력을 닫고 원 상태/결과를 보존하며 중지 정착을 OS 회수·writer 해제로 표시하지 않는다.

disconnect와 close는 내부 신규 작업을 먼저 차단하고, 조정자가 소유한 진행 중 작업의 취소 신호를 전달한다. 이는 네트워크 감시기·서버 권한 회수·writer lease 해제 기능이 아니다. 원 factory.close를 통해 같은 Query/owner의 정리만 소비하며 별도 Query.close/owner.close를 중복 호출하지 않는다. 정리 호출의 별도 유한 기한과 원 caller 취소를 보존한다.

동시 close·disconnect·START/SEND/observe의 늦은 반환은 고정 종료/불명 상태를 덮거나 새로운 원 작업을 시작하지 않는다. underlying 작업이 정착하지 않았으면 원 점유가 끝났다고 보고하지 않고 새 세션 생성으로 우회하지 않는다. timeout을 성공·종료로 바꾸거나 자동 재시도·reconnect·새 SID 채택은 하지 않는다.

원 factory가 인계한 START/current/작업의 짧은 최소기한은 그대로 보존한다. coordinator가 긴 세션 수명을 발행하거나 private 만료값을 반복 탐색하지 않는다. SEND는 기존 bridge boolean 상계 검사를 소비하고, 입력/관측/정리의 최종 기한은 원 모듈이 검산한다.

## 6. 인자·상태·오류 경계

caller signal/expiresAt은 진입에서 검산·고정한다. 검사 후 원 call 객체를 microtask/await/listener 정리에서 다시 읽지 않는다. clock은 단조, timeout은 1~10000ms이고 원 envelope/선택/호출/원 모듈의 더 짧은 상계를 늘리지 않는다.

결과는 비밀 없는 내부 상태·필요한 ref/hash 및 false flags만 반환한다. actualExecutionVerified:false, executionAuthorized:false, dispatched:false, workAccepted:false, ownership:UNVERIFIED를 유지한다. READY는 내부 owner 인계 상태일 뿐 실제 세션/권위 검증이 아니다. 원 SDK 오류·SID·사용자 문장·Options·Query/원 owner가 일반 결과에 나오지 않도록 한다.

단절·close 후 과거 원 결과를 보관 조회하더라도 read-only 사실이며 새 작업 가능 상태로 되돌리지 않는다. 현재 접근/권위가 검증됐다고 표시하지 않는다. 실제 원문 파일·보호 capsule·서버 claim·내구 restart 장부는 만들지 않는다.

## 7. 실제 조립 시험과 직접 검증

시험은 실제 START receiver→Options→factory→private owner→실제 SEND receiver→bridge→원 Query 메모리 streamInput→prefix/init/후속 관측→중지/close를 이어야 한다. 기존 성공 메서드를 대체하거나 단순 helper 호출 여부만 세지 않는다. Query/current/driver와 저장 포트만 명시 합성으로 구성한다.

필수 정상과 중요한 실패:
- 원 START 한 번·takeOwner 한 번·동일 Query/iterator·원 SEND 문장과 false flags.
- START 전/실패/대기 중 SEND 거절, 다른 context/등록/세대/선언 sessionBindingRef/기대 SID 혼입 거절.
- 입력1/관측1의 허용 병행과 중복 관측/중복 시작·새 시도 거절.
- START HOLD 중 close/disconnect, 늦은 Query·늦은 START/SEND 결과가 종료/UNKNOWN을 성공으로 덮지 않음.
- SEND UNKNOWN 뒤 새 입력0·Query 재생성0, 가능한 원 관측/정리의 의미 유지.
- current 축소·원 기한·clock 역행·원 port/메서드 변경·caller 별칭/접근자·Proxy/가짜 객체.
- close 단발, 입력/관측/정리 HOLD·외부 유한 정착과 underlying 점유의 구분·타이머/listener 회수.
- 원문/SDK 오류 비반사·원 의존 지문 불변.

모듈 부재 RED는 구조적 준비 증거로 구분하고 실제 행동 RED/GREEN을 별도로 보존한다. 직접 검증은 신규 coordinator·직접 factory/bridge/owner/options 시험과 필요한 receiver 시험만 선택하며 typecheck/diff check를 실행한다. 바뀌지 않은 전수·브라우저·SDK/운영 검사를 반복하지 않는다.

## 8. 제출·인수·미검증

기존 Primary는 신규2의 원문 지문·시작/끝 HEAD·diff·정확 명령/exit/fail/skip·실제 RED/준비 오류·live/pending/cleanup·미검증과 rollback을 제출하고 writer를 반환한다. commit/push하지 않는다. Main의 독립 C/I0와 fresh 검증 후 정확 소유 파일만 로컬 통합한다.

실제 SDK/CLI import/install/query·OS child/native/compile·네트워크/listener·실사용자 자료 조회/전송·DB/권한/키/cert/서비스·유료/Agent·백업/실자료 파일·J3/P03 R3·Oracle/운영 실행0이다. 실제 SESSION claim/permit·도구/비용 권위·재개 가능성은 미완료로 남기고, 합성 내부 caller를 전체 FN07·Stage·계획 완료로 승격하지 않는다.

rollback은 신규2와 해당 기록의 정상 revert이며 실제 환경 변경은 없다.
