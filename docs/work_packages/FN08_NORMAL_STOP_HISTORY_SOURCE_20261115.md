# FN08 STOP 내구 이력·관측 ACK 소비 source 작업지시

기준 main f37d4e9673f5a4ab51f7d49461ec3efbfdb69734, branch codex/av3-fn08-stop-history. 직접 채택된 FN08_NORMAL_STOP_TARGET_PAGE_CANDIDATE_20261115.md SHA2562E6445077CDD2A02C00367EAEF08E40AE33E4DB46077EC4BC18785D1156CAC0F §4/5 중 미완료 소비를 한정 구현한다. 실제 normal START는 driver.send의 응답 참조만 반환하며 실제 Query/child owner 생산자는 없다. 그 사실을 바꾸지 않는다. Primary 단일 제품writer, Main 검수·통합·문서.

## 정확 허용 목록
제품3:
- apps/connector/runtime/normal-stop-coordinator.ts (신규)
- apps/connector/runtime/normal-start-file-store.ts
- apps/connector/runtime/normal-start-polling.ts
시험4:
- tests/unit/FN08/normal-stop-coordinator.test.ts (신규)
- tests/unit/FN08/normal-stop-polling-journey.test.ts (신규)
- tests/unit/FN08/normal-start-file-store.test.ts
- tests/unit/FN08/normal-start-polling.test.ts

## 구현
기존 readNormalStopItem/원 START 내구 기록으로 원 프로젝트·실행·세대·grant·세션·등록·target/hash/UUID를 검산한다. 기존 attempt-commandId 채널과 NormalJournalTransaction/strictClose를 사용하며 새 root·공개권한·owner factory를 만들지 않는다. STOP 전용 닫힌 역사 행 STOP_ATTEMPTED→STOP_UNCONFIRMED의 원 key/envelopeHash/target/ref/previousRef/시각을 검산한다. START/SEND 행으로 cast하거나 참조만으로 현재 owner를 인정하지 않는다.

역사 기록이 있으면 먼저 읽고 원 관측 ID·발생 시각으로 기존 spool.record/sync/coverage를 재사용한다. 원 기록 충돌/손상/부분 append/close 불명이면 UNKNOWN으로 보존하고 새 시도·interrupt로 fallback하지 않는다. STOP_UNCONFIRMED는 STOPPED/성공/해제 증거가 아니다. ACK 전 cursor 전진0, 뒤 page/혼합 START/SEND의 원 ACK 범위 유지. 기본 STOP옵션 미설정 동작은 보존한다.

현재 제품에 실제 normal owner 생산자가 없으므로 새 중지 요청은 명시 거절·interrupt0이다. 일반 verifiedCurrent/stop callback 또는 공개 capability 발급기를 normal 권위로 도입하지 않는다. 합성 owner·responseRef/processRef·PREPARED/ACTIVE를 실제 소유로 승격하지 않는다. 아직 생성할 수 없는 정상 STOP 이력은 RAM 형상/복구 시험으로만 확인하며 실제 정상 시도 저장·SDK 중지 양성이라고 보고하지 않는다. 시험 전용 순수 모형만 추가해 구현 진도로 대체하지 않는다.

## 검증과 종료
핵심 RED→GREEN: owner 없음·위조/교차 target·원 START/STOP 불일치·역사 관측 복구·부분기록/strictClose 불명·재시작 추가 호출0·ACK/cursor·START/SEND 회귀. 직접/인접·typecheck·diff와 정확지문을 제출한다. 실제 파일 지속성·DB·권한·키·서비스·SDK/Agent·실자료 조사0, RAM fakeFS만. 다른 작성자 파일을 되돌리지 않는다. 허용 경로 추가가 필요하면 쓰기 전 Main에 근거를 전달한다.

완료 표현은 STOP 내구 이력·관측/ACK 소비와 원 owner 부재 거절의 source 검수다. 실제 협력적 중지 기능/전체 계획 완료가 아니다. 정상 owner 생산·권위 전달 계약은 별도 미완료로 남긴다.
