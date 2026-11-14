# FN08 혼합 명령 polling·관측 ACK·cursor source 작업지시

기준: PR119 main62a0e16a0c36bf9742e00d17697770a86537d939, codex/av3-fn08-send-polling. 기존 developer_primary 단일 writer, Main 문서·검수·통합. P3 D1 §3.1 실행기 source와 채택 normal SEND/관측 계약의 미완료 내부 연결이다. 새 공개 API·enum·표·권한을 만들지 않는다.

## 허용 10경로
- apps/connector/runtime/normal-instruction-intake.ts
- apps/connector/runtime/normal-instruction-coordinator.ts
- apps/connector/runtime/normal-observation-spool.ts
- apps/connector/runtime/normal-start-polling.ts
- tests/unit/FN08/normal-instruction-intake.test.ts
- tests/unit/FN08/normal-instruction-coordinator.test.ts
- tests/unit/FN08/normal-observation-spool.test.ts
- tests/unit/FN08/normal-start-polling.test.ts
- tests/unit/FN08/normal-instruction-polling-journey.test.ts (신규)
- tests/unit/FN08/normal-instruction-dispatch-fixture.ts

공유 코드베이스에서 남의 변경을 되돌리지 않는다. 이 목록 밖 쓰기는 Main과 먼저 범위 대조한다. 실제 DB·권한·키·파일 조사/생성·서비스·SDK/Agent/C# 실행은 제외하고 RAM 포트만 사용한다.

## 연결·보존
1. intake/coordinator의 기존 원장 검산을 재사용해 원 ref·기록 시각·상태의 내부 observations 조회/수집을 연결한다. 원문/행/체인/세대/세션 불일치면 거절하며 현재 조회가 새 실행 권위를 만들지 않는다.
2. 기존 instruction-transport 의미만 재사용: RECEIVED→RECEIVED, SEND_ATTEMPTED→PREPARED, PERMIT_RECORDED→동명, RESPONSE_RECORDED→PROVIDER_RESPONSE_RECEIVED/UNVERIFIED_PROVIDER_CLAIM, UNKNOWN→UNKNOWN/RECORD_UNCERTAIN. SEND_DISPATCH_ATTEMPTED는 로컬 원장에 보존하며 새 공개 사건이나 START 사건으로 둔갑시키지 않는다. 원 관측의 ref·시각을 재생성하지 않는다.
3. polling은 선택형 SEND 포트와 명시 operation 분기를 추가한다. 기본 START 동작·정확 입력/기한·기존 시험을 보존한다. 미등록 SEND는 거절한다. 새 내구 시도 없음이 검산된 경우만 같은 coordinator에서 prepare의 원 결과 객체를 dispatch한다. 역사 RESPONSE는 추가 permit/driver 없이 관측을 복구한다. 역사 PERMIT_RECORDED·UNKNOWN·미완료 dispatch는 재실행/cursor 완료로 처리하지 않는다.
4. spool의 기존 append/sync/ACK 검산을 재사용해 원 관측 ref가 속한 실행전역 sequence와 ACK coverage를 검산한다. 최대200건 POST 성공만으로 해당 item의 모든 관측이 ACK됐다고 가정하지 않는다. 추가 batch는 명확한 sequence 진전과 유한 한도 안에서만 처리하며 무진전·오류·결과불명은 자동 재전송하지 않는다.
5. 해당 item의 필수 원 관측 전부를 ACK가 덮고 page 전체가 완료된 뒤에만 원 마지막 sequence/nextCursor 쌍을 승격한다. 일부 실패 시 page cursor 보존. 과거 ACK로 최신 상태 후퇴 금지. 기한/credential 변경은 기존 명시 갱신 계약을 따르고 원 sequence·중복 방지를 유지한다.
6. 응답 관측/ACK를 실제 SDK 수락·Agent 작업 완료·OS 내구성으로 표시하지 않는다. 모든 기존 보안·한도·UNKNOWN 보존 조건 유지. 필요 새 공개 의미가 발견되면 정확 delta만 분리하고 독립 구현은 계속한다.

## 검증과 제출
실제 제품 RAM handler의 START→SEND 혼합 page부터 자료 수신·permit·명시 RAM wire·원 관측 POST/ACK·cursor까지 목적 RED→GREEN을 확인한다. 두 번째 명령 실패의 cursor0, RESPONSE 뒤 부분 관측 실패 재시작 추가 driver0, 역사 permit driver0, ACK 유실/위조/부분 coverage/무진전, credential 명시 갱신·원 sequence 보존, 다른 세대/세션/기한·원장 변조를 검증한다. 기존 START polling 여정은 그대로 인접 검증한다. 변경 영향 시험·typecheck·diffcheck와 정확10지문/명령/실패이력/live0을 제출한다. 마지막 시험 추가 후 해당 최종 파일을 다시 검증한다. 실제 DB/브라우저/SDK 검증이나 전체 계획 완료는 아니다.
