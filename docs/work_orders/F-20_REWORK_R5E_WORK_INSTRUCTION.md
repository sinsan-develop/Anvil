# F-20 R5e C30 원장 무결성 사고 WorkInstruction

- 발행자: Main Agent 어울; Work Package `F-20/R5e`.
- 기준: 승인된 Anvil 설계·작업계획 F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` R5e, 현재 G-05 seq1761.
- 분류: 이미 확인된 C30 Event raw 이력 변조의 append-only 사고 기록과 F-20 수락 차단 검증. 기능·공개 API·DB schema·권한·배포 범위 변경 없음.
- 개발은 Windows 로컬 기존 `codex/f18-wsl-ops`에서 수행하고 Main이 push한 정확한 SHA를 `ssh WSL-server`에서 pull해 검증한다. 새 branch, ysna-server/Production 금지.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R5E_RESULT.md`
2. `tests/tooling/test_project_progress.py`

R5d epoch8 write→worker lease를 append-only 회수하고 R5e epoch9 worker/write token·exact2 scope·만료·dispatch SHA의 G-05가 유효한 뒤 단일 writer가 위 두 경로만 수정한다. Main은 Event 사고 기록·control checker/overlay/G-05·상태 기록을 맡고 같은 제품 파일을 동시에 수정하지 않는다.

## 변경·검증 계약

- C30 `test_no_early_acceptance_or_lease_revoke` 기존 RED를 재현한다. 당시 C30 canonical 역사 projection의 조기 수락·lease 검사는 보존한다. 현재 Event seq1~1334 raw prefix와 역사 정본이 실제로 다르다는 사실을 숨기지 않는다. 원본 `C30_R2_PREFIX_BYTES/SHA`와 현재 확인된 bytes/SHA 및 `14c8c574` provenance를 결박한 CRITICAL/blocking `DEFECT_RECORDED` Event와 현재 F-20 acceptance 무효·release `DEFER`를 검증한다.
- 현재 원장·사고 Event·원본 Git blob·acceptance 상태 각각의 누락/위조를 거부한다. 과거 Event 객체, frozen manifest/hash, Git history는 덮어쓰거나 재직렬화하지 않는다. 기존 E09/C09~C13/current digest 검사와 G-05를 약화하지 않고 test skip/xfail을 사용하지 않는다.
- Main이 통제·원장 사고 Event를 발급한 뒤 단일 writer가 이 WI의 테스트와 결과보고서만 RED→GREEN으로 작업한다. 로컬 집중·G-05·diff 검사를 실제 실행해 명령/exit/결과/잔여 위험/rollback을 기록한다. Main이 commit/push 및 WSL-server 동일 SHA 집중·전체 suite를 수행한다.

## 완료 경계

R5e 테스트 GREEN은 원장 사고를 투명하게 기록하고 현재 수락을 차단한다는 뜻이지 변조된 과거 원문을 복원했다는 뜻이 아니다. F-20 전체 수락, 실제 DB/API/브라우저·11개 메뉴/backup/restore/rollback 또는 main 병합을 주장하지 않는다.
