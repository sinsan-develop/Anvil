# F-20 R3 브라우저 API same-origin 경로 재작업 WorkInstruction

- 발행자: Main Agent 어울
- Work Package: `F-20/R3`; F-20 최종 수락 전 검증 재작업이다.
- 기준: 승인된 `Anvil_작업계획서_v1.md` F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `AGENTS.md`.
- 분류: 승인 계획 안의 기존 same-origin 계약·안전 정적 검사 회복. 공개 API·권한·요구사항·중요 위험을 변경하지 않는다.
- 개발: Windows 로컬의 현재 `codex/f18-wsl-ops`; 검증: 지정 원격에 push 후 `ssh WSL-server`에서 동일 SHA pull. ysna-server/Production 제외.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R3_RESULT.md`
2. `apps/web/src/api/c29-agent-console-client.js`
3. `apps/web/src/api/projects-client.js`
4. `apps/web/tests/c29-console-runtime.test.mjs`
5. `apps/web/tests/projects.test.mjs`

이 범위 외 제품 변경은 금지한다. R2 write·worker lease를 append-only로 회수하고 R3 worker·write token이 둘 다 유효하게 투영된 후 단일 writer가 수정한다.

## 작업과 완료 경계

- 현재 A14 `non-relative-fetch` 2건을 테스트 RED로 확인한다. 기존 `apiPath` 검증을 두 client의 네트워크 호출 지점에 적용한다. client가 외부·내부 절대주소, `//` 및 허용되지 않은 경로를 fetch하지 않음을 음성 테스트로 증명한다. 정적 검사를 약화하거나 예외 처리로 숨기지 않는다.
- 해당 Node 테스트, A14 브라우저 소스 검사, UI build/static 검사와 WSL-server 동일 SHA 검증을 수행한다. 가능하면 실제 브라우저 Network의 same-origin 요청도 확인한다. 실행하지 못한 항목은 미검증이다.
- 결과에 정확한 명령·종료코드·변경 diff·잔여 오류·rollback을 기록한다. 전체 suite 42건과 11개 메뉴 실제 기능을 R3 범위의 PASS로 승격하지 않는다.
- 이번 lease 완료는 F-20 수락, P-01 착수, main 병합을 허용하지 않는다.
