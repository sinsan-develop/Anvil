# F-20 R1 재작업 WorkInstruction

- 발행자: Main Agent 어울
- Work Package: `F-20` (기존 seq1714 수락 증거 무효화 후 같은 Package 재작업)
- 기준: `Anvil_설계서_v2.md`, `Anvil_작업계획서_v1.md` §14, `Anvil_통합검증매트릭스_v1.md`, `Anvil_테스트계획서_v1.md`, `AGENTS.md`, `docs/04_test_reports/F-20_CONTROL_REWORK_PLAN.md`
- 승인 분류: 기존 계획 범위의 내부 재작업. 기능 범위·요구사항·중요 위험 변경 없음.
- 개발 환경: 로컬. 테스트 환경: Git push 후 `ssh WSL-server` pull. `ysna-server`/Production 제외.

## 이번 writer lease의 정확한 제품 범위

1. `packages/agent_team/worktree_writes.py`
2. `tests/agent_team/test_worktree_writes_e06.py`
3. `docs/04_test_reports/F-20_REWORK_R1_RESULT.md`

이 lease는 F-20 전 범위의 포괄적 write 권한이 아니다. 위 세 경로 외 mutation, DB schema·migration, secret·인증·권한, Production 배포는 금지한다. 11개 메뉴 기능 결함이 추가 코드 수정으로 이어지면 실제 파일·영향을 조사해 별도 exact-path lease를 발급한다.

## 작업과 검증

1. WSL 전체 suite의 최초 실패 `test_managed_object_fanout_redirect_is_rejected_before_foreign_write`를 재현한다. POSIX symlink fanout이 외부 write를 안전하게 거부하는 기존 동작은 보존하고, 공개 오류 형식을 계약상 `LeaseError`로 정합화한다. 해당 테스트를 RED→GREEN으로 실행한다.
2. 로컬 unit·관련 회귀·정적 검사를 실행하고 정확한 명령·종료 코드·결과를 보고한다. 완료한 코드는 같은 브랜치에 commit/push한다.
3. WSL-server에서 동일 SHA pull 후 전체 suite를 재실행한다. 과거 `1080 passed, 1 failed`는 미해결 기준선이며 신규 PASS로 재해석하지 않는다.
4. F-20 최종 완료 조건인 동일 ReleaseManifest의 11개 메뉴 기능 smoke, 중단·재개·복구, monitoring, ProductValidation, Defect, backup/restore, rollback, blocking defect 0 및 critical alert 0을 실제 WSL 브라우저·API·DB 증거로 별도 검증한다. `UNAVAILABLE` read-only 화면은 기능 PASS가 아니다.

## 완료·중단 경계

- 이번 lease의 성공은 Git 쓰기 오류 형식 회귀의 국소 수정만 증명한다. F-20 전체 acceptance, `P-01` 착수, main 병합은 4항 완료 전 금지한다.
- Secret·provider key 오류는 실측 결과로 기록하되 계획 범위 밖의 계정·키 변경을 요구하지 않는다.
- 동일 정식 실패 3회면 Main Agent가 lease를 회수하고 takeover를 수행한다. 내부 도구·환경 실패는 정식 실패 횟수에 넣지 않는다.
- 보고 형식: 판정 → 판단 이유 → 조치. 변경 파일/diff, RED/GREEN, WSL SHA, 미검증 범위, 잔여 위험, rollback을 포함한다.
