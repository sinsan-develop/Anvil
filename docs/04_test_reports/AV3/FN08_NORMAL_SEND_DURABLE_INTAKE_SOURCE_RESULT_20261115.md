# FN08 SEND 내구 수신·시도·permit 소스 검수 결과

## 판정
승인된 source-only 8경로 구현과 한정 검수 완료. 전체 FN08·작업계획·실제 Agent 실행 완료가 아니다.
기준 main93c85d78, WI 게시 cec10d2d, 작업 브랜치 codex/av3-fn08-send-durable-intake. 기존 developer_primary가 구현하고 Main이 검수·통합했다. 독립 spec C0/I0/M0, quality 최초 C0/I1/M0에서 보정 후 C0/I0/M0.

## 구현한 흐름
원 서버 START/SEND→혼합 페이지→보호 부분 GET→SEND 전용 MATERIAL/RECEIVED→SEND_ATTEMPTED→명령별 permit→PERMIT_RECORDED를 연결했다. SEND 자신의 승인 영수증·예산은 별도로 보존하고 원 공통 scope·세션·등록·자료·행 계보는 정확 비교한다. 기존 기록 조회와 현재 실행 권한을 구분하고 반환의 실행/dispatch flag는 false다.
기존 journal root와 채널을 사용하며 새 root·ACL·공개 API는 없다. 부분 저장·sync·재읽기·close 불명은 기록/lock을 보존한다. SEND typed adapter만 strict close를 적용하고 기존 START 경로 동작은 보존했다. 재시작에서 미완료 시도·UNKNOWN은 추가 permit을 만들지 않는다. wire·polling·cursor는 변경하지 않았다.

## 검증과 보정 이력
- 수행자 최초 전체 직접/START 인접 6파일 39P/0F/0SKIP exit0, 16418.4826ms(1f5e5f). 마지막 close 단발 단언 1P는 중복 합산하지 않는다.
- Main 첫 동결 직접4파일 28P/0F/0SKIP exit0, 16443.7ms(dd4b9b→97a399).
- 독립 I1: helper가 자료 수신 끝에만 검사해 중간 만료 후 추가 요청이 가능했다. 7건 RED→GREEN으로 보정했다. 진입/매 await/다음 요청/내구 저장 전후에 원 scope·descriptor와 시작 wall/monotonic, 원 명령/packet/부분의 최단기한을 검산한다.
- 최종 변경2파일 수행자16P/0F/0SKIP exit0, 17607.8436ms(bd07f9), Main fresh16P/0F/0SKIP exit0, 18055.1105ms(78b293→9c126f). 나머지6파일은 불변이다.
- 최종 npm run typecheck exit0(1a9cf6), Main diff check0·변경지문 일치(f31bcf). CRLF→LF 예고는 별도 경고다.
- Main 최종 명령: node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-instruction-intake.test.ts tests/unit/FN08/normal-instruction-durable-journey.test.ts
- 앞선 Main 직접4파일은 위2파일과 normal-instruction-coordinator.test.ts, normal-start-file-store.test.ts다. 수행자6파일은 여기에 normal-start-coordinator.test.ts와 normal-start-execution-journey.test.ts를 더했다. 모든 경로는 tests/unit/FN08 아래다.
- 최초 모듈 부재, fixture scope 오입력, attempt adapter 부재, accessor/abort, close 불명 성공 반환, 타입 추론11진단의 실패와 보정은 WORK_STATUS에 보존했다. 테스트 기준 완화나 실제 파일 생성으로 통과시키지 않았다.

## 미검증·다음·복구
실제 DB/TLS/키/권한/파일 내구성·서비스·SDK/Agent/C# 실행은 하지 않았다. current는 명시 RAM 대역이며 실제 OS 권위 생산자 완료가 아니다. directory fsync·전원손실 내구성도 미검증이다. 기존 START의 generic close 처리 의미는 이번 범위에서 변경하지 않았다.
다음은 기존 승인 범위의 SEND 전용 내부 wire 연결이다. 실제 SDK 세션/호출 방식은 확인되지 않았으므로 합성 표식을 NORMAL로 바꾸거나 실제 실행으로 승격하지 않는다.
rollback은 해당 소스 커밋 revert이며 DB rollback은 없다. 전체 작업계획은 계속 미완료다.

## 최종 working-byte SHA256
Git LF blob과 구분한다.

| 경로 | SHA256 |
|---|---|
| apps/connector/runtime/normal-instruction-intake.ts | 90FEFBE76A0FC5A28F683014230BE7DDEE33D4354C96EA109A45548BCF825F74 |
| apps/connector/runtime/normal-instruction-coordinator.ts | 93CE6274280A2E13C0F7AADD5CBCC72BAD2713A05B4FEF9F9F54A3AB69217672 |
| apps/connector/runtime/normal-start-file-store.ts | 6914F7CC851CE940C320FCFF6329FE88CA6F397390A15998CE22CC80FD9FB101 |
| tests/unit/FN08/normal-instruction-intake.test.ts | 9E107B6489F8F7B1E513B6F67A6BD53DFB26B7965B9A78C54E18A9F0D04EA160 |
| tests/unit/FN08/normal-instruction-coordinator.test.ts | BF56FAFF55A5D99551E861F9AEF7B1900399E5A60B17B0F4EFB572D844353BCD |
| tests/unit/FN08/normal-instruction-durable-journey.test.ts | 52F7E29B038AA00AECA38F6BE56AB5161576C93A3BC61F30F5870B8144B5032E |
| tests/unit/FN08/normal-start-file-store.test.ts | 1178D2B0F50085885A837BE3C5EE99737D9CA65812965A3B3E0A82E4B82E9A1C |
| tests/unit/FN08/normal-instruction-dispatch-fixture.ts | 7E7158A1AEB4662976A6D0E5DB7BCC22F64F367398F29B3C27BC6D8DC80A6447 |
