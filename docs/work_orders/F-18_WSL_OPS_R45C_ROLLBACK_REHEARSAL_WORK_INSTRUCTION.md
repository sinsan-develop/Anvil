# F-18 R45C WorkInstruction — 격리 QA rollback rehearsal

- 담당 Main 어울. 시작 기준은 `codex/f18-wsl-ops@da187871091219e8aee1dd62be85399c75284905`, canonical seq1678, worker/write lease=null, 마지막 clean G-05 PASS였다. 감사·계획 문서 checkpoint `301e871e7547eccb9b008d48999a7e561068f069`이 지정 원격에 게시됐고 현재 R45B checksum gate는 non-green이다. R45C 새 worker-only lease/G-05 PASS 이전에는 WSL 자원을 생성하지 않는다.
- 기준 문서: `F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_PLAN.md`, `F-18_R45C_ROLLBACK_ARTIFACT_AUDIT.md`와 승인된 F-18 설계·계획·매트릭스·테스트계획. parent approval `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, `MAIN_RECONFIRMED_NON_SEMANTIC`. 제품 write scope는 비어 있다.
- 정확한 전용 경로·Compose project·image tag·DB/role/port/backup의 사전 부재와 공유 Web/PG ID를 `WORK_STATUS`에 기록한 뒤 `ssh WSL-server`에서만 실행한다. 로컬 source를 서버로 복사하지 않고 지정 Git SSH alias의 exact commit/tag를 clean detached checkout한다.
- R21은 역사적 QA-only 이전 artifact로만 쓴다. 재서명한 QA manifest와 각 image ID를 공개 원본에 결박하고, 별도의 현행 artifact도 Test/Staging 합격 후 같은 ID로 target에 전달한다. mismatch·dirty·잘못된 environment/approval/head는 mutation 전에 차단한다.
- 합성 PG18 데이터의 old0016 backup/별도 restore와 new0019 migration, Web/API/Worker code/container rollback을 분리 관측한다. 데이터 손실 가능한 in-place downgrade는 하지 않는다. OIDC 없는 R21로의 기능 회귀는 숨기지 않는다. 기존 R21 checkout/image와 공유 서비스·DB·Production은 수정하지 않는다.
- 증거는 정확한 명령/exit, Git/image/manifest hash, DB/head/건수, Web/API/Worker/브라우저 해당 범위, negative 거부, 임시 자원 ID/정리 잔여, 미검증·rollback을 감사 보고서와 `WORK_STATUS`에 누적한다. QA-only PASS를 F-18 accepted나 실제 승인 릴리스 rollback으로 승격하지 않는다. F-19 blocked, Production NOT_EXECUTED.
