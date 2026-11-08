# UI00 실제 App의 제어 UNKNOWN·상단401·동일 주체 인증 회복 직접 검증

- Main 어울 / 기존 Primary 단일 시험 writer.
- 기준 main `e3c7dd1abe69c3a966a419f63c661b72ba1ddef0`, 현재 branch `codex/av3-plan-completion-audit`.
- 근거: UI00 공통 오류/입력 보존, FN15 단독 제어·UNKNOWN 중복 방지, UI00_SHELL_PROJECT_ACCESS_READ_SOURCE_RESULT_20261107.md:18의 M2.

## 확인한 공백

기존 실제 App 시험은 상단401 뒤 미전송 프로젝트 이름을 보존한다. ControlAccessPage 시험은 호스트 소유 buffer의 응답 유실·재조회, pagination 시험은 미리 주입한 UNKNOWN을 다룬다. 실제 App controlStore와 상단 GET401/기존 세션 명시 재확인의 결합을 입증하는 현재 시험은 확인하지 못했다. 제품 결함이나 미구현으로 단정하지 않는다.

## 정확 범위

- 수정 가능: tests/unit/UI00/project-shell-access.test.ts 한 파일.
- 읽기 전용: 실제 App/AppShell/ControlAccessPage/state/api 및 기존 제어 계약/시험 fixture.
- Main은 이 WI/WORK_STATUS/결과 문서만 쓴다. 제품 변경이 필요한 실제 RED면 원인·정확 diff를 먼저 반환하고 별도 Main GO를 받는다.

기존 actual App 메모리 harness에서 필요한 정확 control-state GET과 requestControl POST의 합성 응답 유실·동일 actor/client 인증 회복 응답만 추가한다. 기존 다른 경로의404·fixture거절을 일반 성공 fallback으로 바꾸지 않는다. 제품 컴포넌트를 fake 화면으로 대체하거나 private export를 제품에 추가하지 않는다.

## 검수

1. 실제 화면에서 원 제어 요청 명령 생성→첫 POST 응답 유실→UNKNOWN을 관측한다.
2. 실제 상단 프로젝트 접근 GET401→같은 actor/client의 기존 세션 명시 재확인→원 제어 화면 복귀를 수행한다.
3. 첫 POST body/UUID와 복귀 후 원 pending command/body가 동일해야 한다. 조회·인증 회복만으로 새 명령/POST가 생기지 않아야 한다.
4. 다른 scope에서는 원 명령을 전송하지 못하고, 동일 scope의 명시 재확인만 같은 원 body를 사용할 수 있다. 새로운 명령으로 교체하거나 자동 재전송하지 않는다.
5. requestControl UNKNOWN은 영수증 미수신 상태다. 현 ControlPending에 없는 receipt 필드/저장 계약을 발명하지 않는다. 실제 존재하는 command/status만 검산한다.
6. 기존 프로젝트 이름 보존·401/scope 보호 시험은 유지한다. 테스트 준비DTO 누락과 실제 App store 유실·packet변형·자동 POST를 구분한다. source 실패를 숨기기 위한 기대값/skip 완화는 금지한다.

변경 파일과 직접 인접 시험만 선택하고 테스트 변경 후 타입/diff를 확인한다. 제품/UI가 불변이면 메모리 build와 무관 회귀를 반복하지 않는다. 실제 DB·권한·키·서비스·Agent/SSH·사용자 자료·브라우저 서비스 실행은 제외한다. 이 시험 완료를 새로운 기능 구현 진도나 전체 UI00/계획 완료로 표시하지 않는다.

정확 명령/exit/결과·원본 지문·오류·미검증·현재 handle을 반환하고 writer를 해제한다. 복구는 시험 변경 hunk 분리/통합 후 정상 PR revert이며 제품이나 실제 제어 상태는 바뀌지 않는다.
