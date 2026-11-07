# FN07 동일 세션 내부 조정 소스 검수 결과

- 판정: 내부 소스·합성 단위 인수. 실제 Claude 기능·FN07 전체·계획 완료는 아님.
- 기준 WI: docs/work_packages/FN07_SESSION_COORDINATOR_SOURCE_IMPLEMENTATION_20261106.md
- WI SHA256: B24F090895249D4B31ED3428AAD05BAC83A10969204F8CCAB1883834F292AA9F
- 시작 HEAD: fae44a455c530c1446d806b27e3d73c1bacd002f, codex/av3-stage-b.
- 기존 Primary 구현, 기존 읽기 담당자 독립 검수, Main 직접 검증·통합.

## 변경과 증거

신규 coordinator는 실제 START receiver/Options/factory의 원 owner를 한 번 인계받아 private으로 보관한다. SEND receiver/bridge·관측·중지·정리를 같은 owner로 연결하고, 인계 전 입력·교차 context/등록/세대/선언 binding을 거절한다. 종료 뒤 늦은 결과는 활성 상태를 되돌리지 못하고 UNKNOWN 뒤 새 입력·새 Query를 만들지 않는다.

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/connector/adapters/secondary/session-coordinator.ts | 13360 | 96AA3134A080567212658D51E381A3EE6EF93CAF11CACAD970A5315DC3F72F85 |
| tests/unit/FN07/claude-session-coordinator.test.ts | 15889 | 119D57004F99729DD1909991766E1B9119636E5D74130CB5A9EF19E927445246 |

원 factory ACACF14D, owner 1F032A5B, bridge 760336AC는 불변이다. 기존 모듈·SQL·공개 계약·서버·화면은 수정하지 않았다. 원 owner/Query를 일반 결과로 내보내지 않으며 실행/수락 flags는 false, ownership은 UNVERIFIED다. 선언 sessionBindingRef/기대 SID는 실제 보호 세션 증거가 아니다.

## 실패·중단 이력

구조적 모듈 부재 RED eb054e는 준비 증거다. 제품 행동 결함 RED는 확인되지 않았으며 이를 만들었다고 보고하지 않는다. receiver 준비 실패3은 빈 sourceScopes가 원 계약을 위반한 원자료 오류였다. 시험 scope1 보강 뒤 Main 4674cd의 빈 목록 거절/정상 목록 수락 대조로 원인을 확인했고 guard를 바꾸지 않았다.

clock 역행 음성의 cleanup 기대 오류1은 정상 clock 복구 후 명시 cleanup과 분리해 정정했다. 앱 network permission revoked로 Primary가 종료돼 진행이 차단됐고, 미완료 정상1/타입·누락 검수는 중간 검수서와 현황 §308~310에 남겼다. 사용자 목표 재개 후 같은 Primary가 running으로 돌아와 실제 도구 실행·최종 음성 검증을 제출했다. 권한 설정 변경·우회·담당자 교체·Main 제품 구현은 없었다.

중간 검수서는 당시 미완료 기록으로 보존한다. 최종 시험은 신규11에서 해당 누락 조건을 검증하며, 이를 중간 시점의 PASS로 소급하지 않는다.

## Main 최종 검증

정확 명령:

node --test tests/unit/FN07/claude-session-coordinator.test.ts tests/unit/FN07/claude-sdk-query-factory.test.ts tests/unit/FN07/claude-instruction-bridge.test.ts tests/unit/FN07/claude-sdk-session-owner.test.ts tests/unit/FN07/claude-start-options.test.ts tests/unit/FN08/execution-material-receiver.test.ts

- d4c3aa: 84 PASS / fail0 / cancelled0 / skip0 / todo0 / 1586.7872ms / exit0.
- 8a9785: npm run typecheck exit0, git diff --check exit0.
- bbd439: 최종 신규2와 원 의존3의 지문·HEAD/index 대조.
- 독립 읽기 검수: 동결 신규2와 원 의존3의 시작·종료 지문 동일, C0/I0/M0. 별도 시험 실행은 하지 않았다.

84는 신규11+직접 인접73의 고유 합계다. 이전 factory/bridge 시험과 개발자의 선택 음성·중간 정상1을 더하지 않는다. 실행하지 않은 실제 SDK/브라우저/배포를 합격으로 표시하지 않는다.

## 미검증·다음 작업·복구

실제 SDK driver/query·process 입출력/종결 소유·도구 결정 공급·원 SID와 Anvil 세션의 보호 claim·계정/비용·서버/화면 연결·실제 사용자 인수는 미완료다. 내부 READY·입력 정착·interrupt/close 결과는 실제 실행 권위·업무 완료·OS 회수 증거가 아니다. 재시작 이후 내구 중복 방지는 없다.

실제 SDK/Agent·DB·권한·키·서비스·실자료·외부 배포 실행0이다. Primary live/pending0과 최종 명령 exit0을 확인했다. 로컬 checkpoint만 작성하며 private push·PR·main 통합·배포는 하지 않았다. 관련 없는 보호3은 보존한다.

다음은 추가 내부 래퍼가 아니라 실제 생성 시도/실행 대상·process 소유·도구 결정 receipt의 닫힌 상세 계약이다. 기존 채택 범위와 새 공개/권위/저장 의미의 차이를 증명한 뒤 진행한다. rollback은 신규2 및 이 단위 기록의 정상 revert이며 실제 환경 변경은 없다.
