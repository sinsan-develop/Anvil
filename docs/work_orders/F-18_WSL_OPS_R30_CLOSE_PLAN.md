# F-18 R30 OIDC principal writer 종료 계획

- R30 제품 exact3 commit `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6`은 지정 branch에 게시됐고 독립 read-only review에서 Spec PASS/Task quality Approved, Critical/Important 0이다. 로컬 focused 185 PASS/기존 warning1, 전체 pytest는 기존 collection 13 ERROR라 전체 PASS가 아니다.
- WSL-server clean detached 동일 제품 SHA의 잠금 Python3.12.3 venv에서 신규+기존 OIDC/session/runtime focused 185 PASS였고, QA checkout·venv는 exact 확인 뒤 삭제되어 경로 잔류0이다. 기존 `local-postgres`·`anvil-web` ID/status와 R21 보존 checkout SHA는 불변이다. WSL 첫 시스템 Python의 의존성 부재 6 collection ERROR와 초기 uv Python3.14.3 선택, 삭제 전 검사 명령 quoting 오류는 모두 제품 실패와 구분해 WORK_STATUS에 기록했다.
- 이 증거는 순수 principal adapter의 로컬/WSL unit·contract 범위다. 실제 trusted resolver 저장·OIDC issuer·세션/API·브라우저·step-up 승인 endpoint/전체 F-18은 `NOT_VERIFIED`; Production은 `NOT_EXECUTED`, F-19는 차단이다. Minor 내부 공백/제어문자 거부 테스트는 다음 권한 매핑 Stage에 흡수한다.
- canonical epoch14의 write lease를 먼저 회수하고 worker lease를 다음에 회수한다. 제품 파일 추가 변경, 새 branch, F-19, Production·ysna 작업 없음. control QA commit을 기준으로 revocation event/snapshot/handoff/digest/manifest를 투영·push하고 G-05 및 로컬/원격 HEAD 일치를 확인한다. 그 후에만 다른 exact-path 제품 lease를 발행한다.
