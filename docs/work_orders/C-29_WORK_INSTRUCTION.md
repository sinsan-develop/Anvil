# C-29 WorkInstruction — same-origin Console BFF/API connection

## 목적

C-28 mockup/interaction contract를 same-origin 상대 경로 BFF/API와 연결하고, Team/MoA/SNS/Daon User/adapter 메뉴의 projection·trace·permission/error/empty/offline/high-risk 상태를 실제 로컬 요청 계약으로 제공한다.

## 허용 범위

- same-origin GET/POST route handler와 browser client 연결
- C-22~C-27 결과를 read-only projection으로 매핑
- permission/error/empty/offline/high-risk 재확인 응답 계약
- parent/child trace와 evidence/deploy-readiness projection
- browser Network 계약을 위한 로컬 테스트
- DB/WSL/Provider/Telegram/Kakao/Oracle/deploy/실제 외부 호출은 실행하지 않음

## exact write scope

1. apps/web/server.mjs
2. apps/web/src/api/c29-agent-console-client.js
3. apps/web/src/app/c29-console-runtime.js
4. apps/web/src/styles/c29-console-runtime.css
5. apps/web/tests/c29-console-runtime.test.mjs
6. apps/api/anvil_api/routes/agent_console.py
7. apps/api/tests/test_agent_console_routes.py
8. docs/04_test_reports/C-29_COMPLETION_REPORT.md

## 완료 조건

RED→GREEN API/client tests, C-28 UI regression, same-origin route assertions, compile/diff-check, exact8 SHA와 C-30 handoff를 기록한다. 외부·운영 검증은 NOT_EXECUTED/NOT_INTEGRATED로 분리한다.
