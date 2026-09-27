# F-18 R45B QA 종료 통제 계획

- 대상은 기존 `codex/f18-wsl-ops` 단일 branch의 R45B Main worker-only epoch35/seq1677 회수와 공개 QA 증거 checkpoint다. 제품 write scope는 비어 있으며 F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED를 유지한다.
- 전제: target/staging 전용 Compose·image tag·3 Git checkout·합성 material/backup 및 Windows 격리 Chrome/SSH tunnel 잔여0, 공유 Web/PG ID 불변, 공개 target evidence SHA `1000aa91819cef0fdc4f0512fa32d46042a3c900` 지정 원격 게시, WSL-server Git 재수신·과거 서명 검증 PASS.
- 현재 branch/remote clean SHA와 `development/main` 기준선이 유지되면 seq1678 `WORKER_LEASE_REVOKED` 단일 감사 event를 발행한다. event reason은 `R45B_TARGET_QA_PARTIAL_PASS_RESIDUE_ZERO_F18_PENDING`, source SHA는 `d36de847842804ca93e405abe9bff687c1162a69`, 공개 증거 SHA는 위 commit으로 고정한다. `worker_lease=null`, `write_lease=null`, `next_safe_action=PREPARE_F18_EXACT_ROLLBACK_ARTIFACT_RECOVERY`로 두고 종료 manifest/digest/WORK_STATUS/HANDOFF를 재결박한다.
- Test: 종료 projection 테스트 RED→최소 구현 GREEN, direct control test 2개, `git diff --check`, 정확한 파일만 commit/push 후 원격 SHA 확인, G-05 PASS 및 lease-null. 일반 전체 pytest는 기존 non-green/로컬 pytest 미설치와 구별해 미검증으로 보고한다.
- 미충족: 이전 exact code/container rollback artifact·공개 signed manifest를 확보하지 못해 rollback 미실행이다. 브라우저 사용자 로그인 UI와 전체 공급망 SBOM도 미검증. F-18 인수·F-19 착수·main 병합은 하지 않는다.
