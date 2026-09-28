# F-20/U-01 R1 실제 Database readiness 표시 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical `WORK_INSTRUCTION_ISSUED` Event와 epoch10 dual lease 전에는 실행 불가.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`의 U-01 R1.
- 목적: 실제 OIDC host의 `0019_oidc_sessions` ready를 Dashboard Database 카드가 오판하지 않되, 미연결·미검증 상태를 READY로 승격하지 않는다.
- 환경: 개발 Windows 로컬, 검증은 local push의 정확한 SHA를 `ssh WSL-server`에서 pull한 격리 환경. 새 branch·ysna-server·Production 금지.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `docs/04_test_reports/F-20_U01_R1_READINESS_RESULT.md`

현재 R5e epoch9 write→worker 회수와 새 epoch10 worker/write exact3 lease의 G-05 PASS 전에는 위 파일을 수정하지 않는다. Main은 위 제품 파일을 동시에 수정하지 않는다.

## 구현과 검증

- 실패하는 실제 `classifyReadiness` 테스트를 먼저 추가한다: `status=ready`에 정확한 `0019_oidc_sessions` 또는 `0016_operations_recovery`만 READY; `0013_task_bootstrap_authority`·알 수 없는 head·`not_ready`·null은 NOT CONNECTED. 실패 원인이 0019 미지원인지 확인한다.
- READY 카드가 언제나 `Migration 0016_operations_recovery`라고 고정 표시하지 않도록 실제 서버 확인값과 화면 설명을 일치시킨다. 0019를 받았을 때 0016이라고 주장하지 않는 화면 테스트를 추가한다. 브라우저 요청은 기존 same-origin `/api/health/ready`만 사용한다.
- 최소 구현 후 지정 Node 테스트, web typecheck/lint/build, 현재 G-05를 로컬에서 실행한다. 전체 프로젝트 suite의 실행 범위와 실패/skip을 숨기지 않는다.
- Main은 독립 diff·회귀 검토 뒤 같은 branch에 commit/push한다. WSL-server exact SHA에서 동일 테스트/빌드와 격리 실제 API/DB/브라우저 응답·Network·화면을 검증하며 임시 자원을 정리한다.
- 결과보고서는 기준 hash/branch/HEAD/status, RED·GREEN 명령/exit, 변경 diff, 실제 API/브라우저 증거, 미검증 범위, C30 차단 사고, rollback(이 slice commit revert)을 기록한다.

## 금지·완료 경계

API/DB/auth 계약·Provider·운영 배포·다른 메뉴를 변경하지 않는다. R1 GREEN은 U-01 전체 수락이나 F-20 수락이 아니며 C30 CRITICAL `OPEN_BLOCKING`과 release `DEFER`를 유지한다.
