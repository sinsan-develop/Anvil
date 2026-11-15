# FN07 첫 SEND 정착 후 출력 수집 소스 지시서

## 기준과 책임

- 채택 기준: FN07_NORMAL_QUERY_OUTPUT_OWNERSHIP_CANDIDATE_20261116, SHA256 86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E.
- 기준 main a86705e5, branch codex/av3-fn08-live-stop-consumer. 검수된 STOP r2의 변경은 보존한다.
- Main은 위임·검수·통합, developer_primary는 단일 제품 writer다. 타인의 변경을 되돌리지 않는다.
- 목적은 첫 SEND의 정상 정착 이후에도 원 Query의 같은 출력 iterator를 계속 읽는 누락 연결이다. 새로운 API·자료 계약·권한·채널 활성화는 없다.

## 쓰기 범위

1. apps/connector/runtime/normal-first-send-owner.ts
2. apps/connector/runtime/normal-sdk-session-output.ts
3. tests/unit/FN07/normal-first-send-owner.test.ts
4. tests/unit/FN07/normal-sdk-session-output.test.ts
5. docs/04_test_reports/AV3/FN07_POST_INIT_OUTPUT_DRAIN_SOURCE_RESULT_20261116.md

## 구현과 보존 조건

- 첫 SEND의 4행 append·sync·재판독·정상 거래 닫힘 후 commit만 단일 비공개 수집을 예약한다. 후행 현재성 검사와 기존 abandon이 끝난 뒤 원 lease·LIVE·기한·원 생명 신호를 다시 검사한다. 정착 실패·역사 재생·재시작에서는 수집 시작 0회다.
- Query와 iterator는 원 객체 하나씩만 사용한다. 같은 iterator의 동시 next는 최대 1개다. 정착·정산을 마친 뒤 다음 읽기를 한다. 즉시 완료되는 중복 출력이 이어져도 STOP·취소 처리를 굶기지 않는다.
- 최악 용량 예약은 SDK 대기 동안 유지하되 저장 잠금은 점유하지 않는다. 예약 후 짧은 첫 거래에서 원 prefix 전체와 정상 닫힘을 검산한다. 잠금 밖에서 next 한 번을 기다린다. 반환 자료는 즉시 기존 bounded plain-data/canonical 규칙으로 고정한다. 같은 예약의 두 번째 거래에서 prefix 전체를 재검산한 뒤 기존 codec·append·sync·재판독·정상 닫힘·정산을 따른다.
- 두 거래 각각 body 실행·holdId·rows·tail을 검산한다. 첫 거래 닫힘 불명은 next 0회, 두 번째 거래 닫힘 불명은 추가 next 0회와 최악 예약 보존이다. prefix·본문·tail 변경은 UNKNOWN이며 덮어쓰기·자동 재시도하지 않는다.
- 취소·만료·현재성 소실·UNKNOWN은 늦은 반환의 append와 후속 읽기를 막는다. 원 객체만 기존 정리 경로로 처리하며 STOP의 단발 선점·시도행 정착·interrupt 의미를 보존한다.
- 일반 출력은 SESSION_ONLY이며 격리 원문은 일반 영수증을 만들지 않는다. DONE은 출력 끝일 뿐 OS 종료·writer 해제·명령 응답·지시 수락·업무 완료가 아니다. 기존 ACK·cursor와 공개 관측은 바꾸지 않는다.
- 실제 root/profile·CURRENT·SDK 생산자가 없으면 기존 차단을 유지한다. 임의 콜백을 실제 권위로 표시하지 않는다.

## 검수

- 먼저 누락 호출과 공유 잠금 반례를 RAM 시험으로 재현한다. 정상 첫 commit 뒤 assistant/result 전체 보관과 한 iterator·단일 next를 확인한다.
- 출력 next가 대기 중일 때 같은 RAM 잠금의 STOP 시도행이 정상 닫히고 원 interrupt 1회가 먼저 도달해야 한다. 이를 위해 출력 도착을 먼저 강제하지 않는다.
- 정착 전 실패·재생, 양 거래의 닫힘/본문/꼬리 불명, 예약/정산 불명, 중복·격리, 늦은 취소·만료·현재성 소실을 확인한다. 기존 원 객체 충돌과 타 owner 보호 단언을 유지한다.
- 직접 2파일, 영향받는 STOP·첫 SEND 여정, 루트 타입, 메모리 46 source 빌드, main 대비 diff를 검증한다. 불필요한 전체 회귀는 반복하지 않는다. 실행 명령·종료 코드·건수·소스 지문·오류·미검증·복구를 결과서에 기록하고 쓰기를 반환한다.
- 실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C# 실행·추가 SDK 조회·P03 실행은 금지한다. 메모리 빌드는 실제 SDK 실행이 아니다.
