# FN07 동일 Query 후속 입력 연결 작업지시서

## 목적·기준·범위

WORK_PLAN Stage C/D FN07/FN08, 채택된 FN07 원 Query/출력 수명 계약86A461 및 FN08 LIVE_SEND_INPUT_YIELDED r2의 기존 포트를 연결한다. 기준 main9013faef, 현재 codex/av3-query-producer의 문서checkpoint5a9e320c. 실제 SDK 모듈/CLI/child 생산자 구현이나 실행 완료로 표시하지 않는다. 이번은 기존 원 source.create 소비와 후속 입력 포트의 내부 연결이며 새 API·권한·저장 계약을 만들지 않는다.

담당 developer_primary 단일 제품 writer. Main은 검수·통합·현황을 맡는다. 다른 작성자의 변경을 되돌리지 않는다. 허용 제품은 apps/connector/runtime/normal-owned-spool-profile.ts, apps/desktop/scripts/native-proof-runtime-entry.mts 두 파일, 시험은 tests/desktop/normal-execution-credential-owner.test.cjs 한 파일이다. 결과는 docs/04_test_reports/AV3/FN07_SAME_QUERY_LIVE_INPUT_RESULT_20261116.md. 그 밖의 변경이 필수면 정확 경로·이유를 Main에 먼저 반환한다. Git mutation은 Main 소유다.

## 기대 동작

- 등록 owner 내부에서 원 첫 prompt와 후속 명령의 입력 iterable을 하나의 유한한 대기 스트림으로 결합하고 원 source.create에는 한 번만 전달한다. 동일 원 Query 신원에만 LiveInputPort.provide를 결박해 forFirstSend의 세 번째 인자로 공급한다. 별도 Query나 출력 iterator를 추가 생성하지 않는다. 일반 source.create 주입을 실제 SDK 생산자로 바꿔 설명하지 않는다.
- 첫 입력과 서로 다른 본문의 후속 입력을 원 명령·worker·grant·세대·Query·signal·절대기한에 결박한다. 후속 provide는 해당 명령의 원 iterable에서 실제 메시지가 한 번 yield된 이후에만 기존 LIVE_SEND_INPUT_YIELDED 종단을 허용한다. 이는 SDK 수락·응답·업무 완료가 아니다. 원 iterable을 복제하거나 본문을 미리 뽑아 대체 입력을 만들지 않는다.
- 무한 backlog를 만들지 않는다. 활성 명령·소비/대기의 중복과 재진입을 기존 경계로 거절하고 후속 명령마다 재검산한다. SDK next/입력 pull 대기에는 물리 host·spool 잠금을 점유하지 않는다. 기존 첫 SEND 네 번째 행과 필수 관측/연속 ACK/cursor, 결과 불명 후 재실행 금지를 유지한다.
- 취소·기한·STOP·현재성/owner 상실·dispose 시 대기를 깨우고 늦은 pull/입력을 폐기한다. 소유하지 않은 Query는 닫지 않는다. original Query interrupt/close 및 기존 STOP 종단 의미를 바꾸지 않는다. 임의 SDK 설정/경로/env/callback을 신뢰 권위로 승격하지 않는다.

## 최소 검증·인수

등록된 동일 CJS owner→START→첫 SEND→후속 SEND의 실제 제품 함수 RAM 검증을 만든다. Query1·출력iterator1·각 원 입력yield1·서로다른본문·원종단/필수ACK/cursor를 관측한다. 미소비입력·교차Query·동시provide·기한·STOP/취소와늦은pull·dispose후재사용의 긍정종단0/추가Query0을 확인한다. 기존 시험 기준·기댓값을 느슨하게 바꾸지 않는다. 직접/인접 검사와 root/desktop 타입·메모리 closure·공백 검사를 선택하고 이전 spool 전수를 반복하지 않는다. 지문·정확 명령/exit·실패 이력·미검증·rollback을 결과에 기록하고 소스 동결·쓰기 반환한다. Main의 독립 C/I 검수 후 통합한다.

실제 SDK 설치/import/eval/query·Agent/C#/OS child 실행, 실제 사용자/백업 파일 조사·키·권한·DB·서비스 변경, 추가 SDK/SSH 조회는 모두 제외한다. RAM 합성 결과를 실제 SDK/Windows PASS나 전체 작업계획 완료로 승격하지 않는다.
