# FN08 normal SEND 명시 전달 source 검수 결과

## 판정
source·메모리 합성 범위 한정 수용. 실제 SDK/Agent 전달·작업 완료 및 전체 FN08/작업계획 완료는 아니다.
기준 main3ce883045554b8f56fe0d35d6e080471ff0c4d3a, 지시 ae635f4f3da1caa379db2517c93486988d052c63, branch codex/av3-fn08-send-wire. 시작 clean·private 동일. 기존 developer_primary 단일 writer, Main 검수·통합. WI SHA256 5A4CEDE8F1251DAC25C5966179C41DB809DCDB17346C6D6DAA25E6D5B4A17220.

## 변경과 동작
기존 prepare의 저장·역사 조회를 유지하고, 신규 permit의 strict-close 완료 후 원 결과 객체에만 명시 dispatch 자격을 결박한다. 원문·session·permit·원 current·최단 wall/monotonic 기한을 재검산하고 SEND_DISPATCH_ATTEMPTED를 append/sync/readback한 뒤 전용 adapter를 호출한다. 원 adapter instance/send를 검산하고 정확 관측 ref만 RESPONSE_RECORDED로 남긴다. 불명은 UNKNOWN이며 재시작은 추가 permit/driver 권위를 만들지 않는다. 실제 driver 기본 등록은 없다. 관측 저장은 SDK 수락·업무 완료가 아니다. START 제품 경로와 기존 준비 결과 형상은 보존한다.

## 검증과 오류 이력
- 최초 종단 RED: 새 모듈 부재 0P/1F exit1, 51633d. 기능 반례가 아닌 미구현 진입 확인. 구현 후 종단1P exit0, 3db172.
- 원 OS ref 변경/단조 만료 RED2→GREEN, close 기한 경과 RED1→GREEN. 타입 표기3진단 보정.
- 보완 전 직접·인접6파일56P/0F/0SKIP exit0 33466.2108ms(c08227), type0(425976). 최종 상태의 전체 PASS로 소급하지 않는다.
- 독립 spec C0/I2/M0, quality C0/I1/M0: 고유 Important2는 가짜 wire claim 우회와 verify 후 단축기한 timer 미반영. Main2bbcb7 대조 후 보정. 집중 RED3F(c66969)→GREEN3P(99152b). private WeakSet/원 메서드와 축소 timer 결박으로 해결.
- 최종 명령: `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-instruction-wire.test.ts tests/unit/FN08/normal-instruction-coordinator.test.ts tests/unit/FN08/normal-instruction-wire-journey.test.ts tests/unit/FN08/normal-instruction-durable-journey.test.ts`.
- 작성 중 Python 인코딩 오류는 도구 오류로 해소했으며 제품 실패와 구분한다.
- 최종 영향4파일49P/0F/0SKIP exit0 30955.7373ms(cc2be0). 기존 START 불변 인접11P는 앞선56P 증거를 재사용한다. 중복 집계하지 않는다.
- Main fresh `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-instruction-wire.test.ts tests/unit/FN08/normal-instruction-wire-journey.test.ts`:22P/0F/0SKIP exit0 28269.8232ms(d84a3a→c7c8c6), session32426 종료.
- 최종 `npm run typecheck` exit0(cc9932). coordinator-first/wire-first 새 프로세스 import 각각0(fd58fa/837457). Main `git diff --check`0(b1bc27), CRLF→LF 예고 경고 별도.
- spec/quality 재검수 C0/I0/M0·제품2지문 일치. timer 반례는 결정적 RAM callback 검증이며 실제 시간 정밀도 증거가 아니다. 수행자 live0·쓰기 반환, Main 제품 수정0.

## 미검증·후속·복구
실제 DB/권한/키/파일/서비스/SDK·Agent/C# 실행0. 실제 OS 내구성·전원장애·프로세스 종료·SDK SID/owner 및 사용자 인수는 미검증. spool/ACK/cursor는 이번 제외이며 다음 혼합 polling 연결 작업이다. 전체 WORK_CHECK 완료 체크는 변경하지 않는다. 이 단위 rollback은 해당 source 커밋 정상 revert이며 실제 DB rollback은 없다. 기존 원문/SQL/이력은 보존한다.

## 최종 작업 사본 SHA256
- `apps/connector/runtime/normal-instruction-coordinator.ts`: `3562D747D880D780A6CCD871543CB57495C587795B3CBF942C0E26B93C7ED130`
- `apps/connector/adapters/secondary/normal-instruction-wire.ts`: `FC1A19A7D8148E9EC68F44BF3EF84CC25940BD5B0F4DA98A60D022AD7AC1BDAF`
- `tests/unit/FN08/normal-instruction-coordinator.test.ts`: `69B8C802905142DDA7FEEB0D5575FFF999DFE926925D8397C3E36651E18B9658`
- `tests/unit/FN08/normal-instruction-wire.test.ts`: `76896FD2372FAA31B78CDE0D06B8A3751713C72B4D5FF7FA38D79B4628FF5798`
- `tests/unit/FN08/normal-instruction-wire-journey.test.ts`: `0D331AD327468C3C432CF6B8AFC00EFF57F01C1A30774CD8108A56E6D071125B`
- `tests/unit/FN08/normal-instruction-dispatch-fixture.ts`: `8D7B3F077A520B00F9BF11E882804DA01C8BE2DC0D31879E7295EA2E4B535D06`
