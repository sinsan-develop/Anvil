# F-18 R45A WorkInstruction — WSL-server Test/Staging exact artifact

- 담당 Main 어울, 제품 write 없음. R44 종료 seq1669·lease=null에서 R45A epoch33 worker lease/G-05 PASS를 받은 뒤에만 자원을 만든다. 사용자 추가 승인 대상이 아닌 기존 F-18 내부 QA다.
- 정확한 범위·자원·순서·cleanup·미검증은 `F-18_WSL_OPS_R45A_STAGING_ARTIFACT_PLAN.md`를 따른다. Windows local 개발·Git push→`ssh WSL-server`에서 승인 SSH Git fetch/test이며 로컬 WSL·ysna-server·Production·공유 DB/컨테이너 변경은 금지한다.
- source SHA, annotated tag, Git remote, clean detached 상태와 three-role image ID가 다르면 즉시 FAIL. 합성 ReleaseManifest와 독립 실제 관측을 구분하고 F-16/F-18 preflight의 mismatch 거부를 확인한다.
- 전용 PG15 일반 검증과 격리 pgvector-PG18 RC 검증을 구분한다. 실제 DB/extension/API/Worker/OIDC 응답을 수집하고 fixture/mock 결과로 대체하지 않는다. R45A 결과가 녹색이어도 R45B 동일 artifact 승격·복구/rollback·브라우저 사용자 동선은 미검증이다.
- 에러 횟수·실측 명령/exit·파일/SHA/digest·shared resource 전후·잔여물·다음 조치를 `docs/04_test_reports/F-18_R45A_STAGING_ARTIFACT_REPORT.md`와 `docs/WORK_STATUS.md`에 누적한다. 실패 시 exact 전용 자원만 정리하고 제품 수정은 새 exact-path lease로 분리한다.
