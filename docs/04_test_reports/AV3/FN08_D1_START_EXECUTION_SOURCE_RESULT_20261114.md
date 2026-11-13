# D1 실행기 START 연결 source 검수

상태: source·합성 검증 완료 후보. 실제 DB·Agent 실행 및 전체 FN08 완료가 아니다.

## 범위와 동작

- 기준: main `12956ce332ca8c97295675f41cd39bea629a97f2`, branch `codex/av3-d1-start-execution`.
- 승인 근거: 채택 P3 결정안 §3.1 D1 3단계, WORK_PLAN Stage C FN06/FN08, FUNCTION_WORK FN08.
- 기존 단일 developer_primary가 runtime·시험을 구현하고 Main이 기록·검수·통합한다.
- normal 자료 수신의 맥락 원문과 모델 옵션을 검산해, 내구 시도 기록 → 기존 서버 permit → permit 내구 기록 → 현재성/기한 재확인 → 전송 포트 1회 → 결과 기록 → 관측/ACK로 연결한다.
- 실패·재시작 시 Agent 전송을 반복하지 않는다. 내구 기록은 남았으나 관측만 누락된 경우 같은 ref·시각으로 관측을 보충한다.
- POST는 정확 canonical 본문·경로에 서명을 결박하고 자동 재전송하지 않는다. ACK는 full snapshot hash·실행 세대·로컬 연속 digest·빈칸·저장 개수를 대조한다. ACK가 실제 작업 성공이나 writer 회수를 뜻하지 않는다.

## 현재 검증과 발견 사항

- Main 최종 영향 검사: 신규 POST·coordinator·file-store·spool·제품 여정 5개 파일, 22P/0F/0SKIP, 28343.6473ms. 명령은 `node --experimental-test-module-mocks --test --test-reporter=spec`에 해당 5개 `.test.ts`를 명시했다. 기존 intake 직접 인접4P는 구현자 제출이다. 중복된 중간 시험 수를 합산하지 않는다.
- 중간 I1: 서버가 생성할 수 없는 gap=max ACK 수락을 RAM 합성으로 재현했다. writer가 음성 RED→거절 GREEN으로 보완하고 독립 재검수에서 거절·추가 저장0을 확인했다.
- 중간 I1: 결과 내구 기록 후 관측 실패가 재시작에서 누락되는 경로. 기존 ref·시각으로 관측만 보충하며 permit/wire 재실행0을 확인했다.
- 추가 I2: ACK 저장집합 {1,3}→{1,4} 후퇴를 재현하고 신규·과거 ACK의 저장집합 포함관계를 검사하도록 보완했다. 독립 RAM 검증에서 후퇴 거절·정상 확대·과거 ACK 최신 유지 확인, 최종 두 검수 범위 C0/I0/M0.
- Main 중간 영향검사는 20P/1F/0SKIP(exit1)이었다. 같은 길이 변조 후 callback 오류에서 lock이 해제되는 문제를 보완한 뒤 최종 검사에서 통과했다. 이전 실패를 소급 PASS하지 않는다.
- POST 준비 중 caller 입력 변경과 무응답 signer 대기, fixture 정규식, wire 진입 시 정확 durable ref 단언을 함께 보완했다.

## 미검증·남은 작업

- 여정은 실제 제품 Fastify 핸들러·자료 공급자·실행기 코드를 사용하지만 SQL·현재성·HTTPS driver·파일·wire는 합성 대역이다. 실제 PG·TLS·OS 소유권·디스크 전원손실·Agent 동작 증거가 아니다.
- 실제 보호 파일 생성·키·DB·권한·서비스·Agent·native 컴파일은 실행하지 않는다.
- 실제 adapter, 최초 credential 교환과 보호 저장/사용, 동일 grant 재교환, normal SEND/STOP, 실제 공급자와 실행 여정은 남아 있다. 전체 D1 3단계 완료로 축소하지 않는다.
- 로컬 저장소의 directory fsync·전원 손실 내구성과 OS 보호는 별도 검증 대상이다. 코드상 파일 sync를 그 증거로 승격하지 않는다.
- 복구는 통합된 이 변경의 일반 revert이며 과거 worktree/WIP·공유 의존성은 삭제하지 않는다.

- Main 타입검사: 절대경로 typescript/bin/tsc --noEmit -p tsconfig.base.json exit0. 최종 제품/시험 동결 뒤 EOF 빈줄·시험행 공백만 정리했다.
