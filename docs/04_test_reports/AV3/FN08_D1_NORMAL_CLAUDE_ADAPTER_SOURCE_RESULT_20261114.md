# D1 normal Claude adapter 소스 검수

판정: 소스·합성 연결 단위 검수. 실제 Agent/전체 계획 완료 아님.
기준: main 68b03a96, codex/av3-d1-normal-adapter, 채택 P3 §3.1 단계3.

## 변경과 근거
신규 normal-start-wire와 시험2개, 기존 secondary/start-options 순수 params 검산 추출의 정확4경로다. 원 START·permit·localAttempt와 intake의 원 context/options를 검산해 model/maxTurns/maxBudgetUsd만 명시 driver에 전달한다. 기본값·새 admission·public endpoint·권한·SDK 호출을 추가하지 않는다. 기존 synthetic parser는 같은 검산을 소비한다.

기한/취소/자료/current 불일치는 호출을 차단한다. 최신 current의 짧은 기한으로 timer를 재결박한다. driver 진입 후 불명은 UNKNOWN이며 동일 adapter와 coordinator 재시작에서 추가 호출0이다. adapter 자체는 독립 admission이나 재시작 내구 원장이 아니다. 내구 시도·허가는 기존 coordinator가 소유한다. 응답은 검산된 공급자 관측 ref이며 실제 Agent 성공을 의미하지 않는다.

## 검증
- Primary: 신규 module 누락 RED 0P/2F→구현, 직접/인접14P. 짧은 current 기한 반례 RED1→timer 보완 GREEN1. root TypeScript noEmit exit0. diffcheck0, 신규 whitespace 진단0.
- Main: node --experimental-test-module-mocks --test --test-reporter=spec tests/unit/FN08/normal-claude-start-wire.test.ts tests/unit/FN08/normal-claude-start-wire-journey.test.ts tests/unit/FN07/claude-start-options.test.ts → exit0, 15P/0F/0SKIP,15422.8778ms. Experimental module mocking 경고 유지.
- 독립 d2_scope_audit: 동결4파일 C0/I0/M0, 실행 없이 정적 검수.

## 미검증·복구
제품 coordinator/intake/adapter를 사용하지만 current/driver/DB/파일시스템은 시험 대역이다. 실제 SDK·OS·native·DB·키·서비스·Agent 실행0. 실제 exe/cwd/argv/env/Secret·tool효과·SDK SID 공급자와 등록·UI 운영 연결은 미완료다. source만 일반 revert 가능하며 환경 rollback은 없다. 다음은 실제 driver 구성의 채택 범위와 미정 효과 계약을 분리해 진행한다.
