# F-18 R45B WorkInstruction — 동일 artifact 격리 target QA

- 담당 Main 어울, 제품 write 없음. 시작 기준은 `codex/f18-wsl-ops@c655984e0e434223d0586f6ec8c97d46fac785dc`, canonical seq1675, worker/write lease=null, G-05 PASS. 신규 Main worker-only QA lease·G-05 PASS 이후에만 WSL 임시 자원을 만든다.
- `F-18_WSL_OPS_R45B_SAME_ARTIFACT_PLAN.md`의 경로·이름·수명·순서를 준수한다. 먼저 공개 QA ReleaseManifest 원본을 보존하며 Test/Staging을 다시 결박하고, 동일 SHA·세 image ID·동일 signed envelope만 target에서 검증한다. R45A의 삭제된 envelope를 재현했다고 주장하지 않는다.
- mismatched artifact, dirty/attached/unapproved Git, 누락 capability, 다른 environment/approval hash는 target mutation 전에 FAIL. 실제 PG18·OIDC·object/network·backup/restore/가역 rollback·브라우저 범위를 수행한 만큼만 PASS. 공유 WSL 서비스와 Production은 불변.
- 오류·변경 파일·정확한 명령/exit·실측 응답·미검증·정리 ID/잔여·rollback을 `docs/04_test_reports/F-18_R45B_SAME_ARTIFACT_REPORT.md`와 `docs/WORK_STATUS.md`에 기록한다. R45B 통과도 F-18 전체 인수는 별도 계획 gate다.
