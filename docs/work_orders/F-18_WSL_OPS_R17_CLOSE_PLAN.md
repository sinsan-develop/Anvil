# F-18 R17 role-image writer lease closeout

- 범위: 승인된 F-18 R17 exact4 제품 commit `57653ee835d47c810a1f90d48d9fbe332fb3540c`와 WSL-server 세 이미지 실측·전용 자원 정리 후 canonical epoch11 `write_lease`와 `worker_lease`만 순서대로 회수한다.
- 근거: `docs/WORK_STATUS.md`의 `R17_THREE_ROLE_IMAGE_QA_PASS_BOUNDED`, 로컬 G-05 seq1566 PASS, clean/게시된 동일 branch. 이 검증은 이미지 artifact 분리만 입증하며 F-18 전체 acceptance·Production·F-19 시작을 허용하지 않는다.
- 통제: R17 시작 이력 prefix 1566 불변, seq1567 `WRITE_LEASE_REVOKED`, seq1568 `WORKER_LEASE_REVOKED`. R17 제품 SHA·control QA commit·fencing token 및 이전 active lease를 대조한다. `active_agent=main-agent-eoul`, 두 lease=None, `product_write_scope=[]`, F-18 IN_PROGRESS/accepted=false, F-19 BLOCKED, Production NOT_EXECUTED.
- 경로: 새 close overlay·거부 테스트·detached digest·manifest·progress/HANDOFF/WORK_STATUS와 과거 manifest checksum만. 제품 exact4·기존 서비스·DB·Secret·배포는 변경하지 않는다.
- 검증: 먼저 control-only QA commit/push → 기준 commit 고정 → seq1567~1568 materialize → manifest raw checksum 동기화 → close 테스트·G-05 → evidence commit/push → G-05 재실행. rollback은 마지막 검증된 원격 R17 seq1566 commit으로 재평가하며 force/reset을 사용하지 않는다.
