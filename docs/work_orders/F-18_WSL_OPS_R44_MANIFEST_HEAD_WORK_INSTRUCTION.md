# F-18 R44 WorkInstruction — 현재 OIDC migration head의 서명 결박

- 담당 `developer-primary`, 관리 Main 어울. 상위 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, 설계 §49.12, 계획 F-18, R44 Plan에 종속한다. branch `codex/f18-wsl-ops`; 새 epoch의 canonical worker/write lease 두 fencing token과 G-05 PASS 전에는 제품 write 금지.
- 제품 exact3: `packages/deployment/release_manifest.py`, `tests/deploy/test_f16_release_manifest.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 제품/control/progress 파일은 수정하지 않는다. 정확한 범위가 부족하면 mutation 전에 Main에게 보고한다.
- RED에서 `0019_oidc_sessions` signed subject의 현재 거부를 재현하고, 기존 `0016` 허용·알 수 없는 head 거부·관측값 불일치 거부를 함께 고정한다. GREEN에서는 두 정확한 head만 허용한다. subject 필드, 서명/신뢰 검증, Git remote/tag, digest, lockfile, F-17 역사적 target 계약은 바꾸지 않는다.
- 관련 F-16/F-18 focused 및 회귀 테스트를 전용 `--basetemp`로 실행한다. 실제 WSL-server/DB/Docker/서명된 ReleaseManifest 발행·push는 Main 소유다. 로컬 fixture PASS를 실제 artifact 승격이나 F-18 인수로 표시하지 않는다.
- 시작 HEAD·status, 기준 문서 hash, 변경 diff, 명령/exit/결과, 미실행 범위·기존 기능 보존·rollback·보고서 갱신을 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 계약으로 보고한다.
