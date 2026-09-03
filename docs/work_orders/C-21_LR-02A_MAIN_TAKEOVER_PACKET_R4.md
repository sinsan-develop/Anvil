# C-21 / LR-02A Main Takeover Packet R4

- Lineage: `C-21/LR-02A`
- Fingerprint: `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`
- Valid failures: 3
- Classification: `MAIN_AGENT_TAKEOVER_REQUIRED`, scope/requirements/material-risk change 없음
- Frozen Developer result: R3 exact9; 외부 side effect 없음
- Main actor: `main-agent-eoul`

## 인수 범위

Main은 R3 exact9 중 다음 6개 구현·테스트 파일과 R3 progress/evidence만 순차 수정한다.

- `deploy/ysna/deploy.sh`
- `deploy/ysna/verify.sh`
- `deploy/ysna/rollback.sh`
- `tests/deploy/test_public_deploy_pipeline.py`
- `tests/deploy/test_ysna_deployment_contract.py`
- `tests/deploy/test_ysna_scripts_contract.py`
- `docs/04_test_reports/C-21_LR02A_R3_RUNTIME_READINESS_PROGRESS.md`
- `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_R3_EVIDENCE_MANIFEST.json`

완료 조건은 정상 deploy/verify/rollback 성공 경로의 실행형 fake-command harness, actual API/method, session cookie와 allowlisted SSE/Last-Event-ID, case-insensitive content type, atomic rollback pointer다. 외부 Docker/SSH/DB/NPM/deploy/Telegram/Provider 실행은 금지한다.
