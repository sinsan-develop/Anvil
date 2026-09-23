# C-28 WorkInstruction — Agent Console mockup and interaction contract

## 목적

Agent Team, MoA, SNS/Daon User, Telegram/Kakao 상태를 하나의 운영 Console mockup과 interaction contract로 정리한다. C-29에서 구현할 same-origin BFF/API와 화면 연결의 기준선을 제공한다.

## 허용 범위

- Console shell/menu mockup: Team, MoA, SNS/Daon User, adapter 상태
- permission/error/empty/offline/high-risk reconfirm 상태 표현
- C-22~C-27의 결과·권한·fail-closed projection을 화면 계약으로 매핑
- same-origin 상대 경로와 C-29 handoff contract만 정의
- 실제 BFF/API/DB/WSL/Provider/Telegram/Kakao/Oracle/deploy는 실행하지 않음

## exact write scope

1. apps/web/c28-agent-console-mockup.html
2. apps/web/src/app/c28-console.js
3. apps/web/src/styles/c28-console.css
4. apps/web/tests/c28-console.test.mjs
5. docs/evidence/ui/C-28_MOCKUP_EVIDENCE.md
6. docs/evidence/ui/C-28_INTERACTION_CONTRACT.json
7. docs/04_test_reports/C-28_COMPLETION_REPORT.md

## 완료 조건

RED→GREEN UI contract tests, mockup evidence, JSON contract validation, compile/diff-check, exact7 SHA와 C-29 handoff를 기록한다. 사용자 확인 evidence가 없으면 구현 연결을 시작하지 않는다.
