# F-18 R31 OIDC pending-store writer 종료 계획

- R31 제품 exact5 commit `b0536b6d66530b8c6e12e68a8d129d435ba20dc8`은 지정 branch에 게시됐고 독립 review Critical/Important 0, Task quality Approved다. 로컬 focused 94 PASS/PG opt-in 4 SKIP; 전체 pytest 기존 collection 13 ERROR라 전체 PASS가 아니다.
- WSL-server clean detached 동일 제품 SHA의 전용 PG18 tmpfs DB·비관리자 역할에서 focused 98 PASS/1 기존 warning, 종료 코드 0이다. 첫 두 실행도 98 PASS였으나 Windows 파이프 끝 CR로 wrapper exit127; 세 번째에서 명시적 exit0으로 교정했다. 각 실행 후 전용 container/checkout 잔류 0, 기존 서비스 ID/status 불변이다.
- 이 증거는 pending-store migration/원자 일회성·경합·만료·downgrade 거부 범위다. 실제 OIDC issuer/trusted mapping/session/API/browser 및 전체 F-18은 미검증, Production `NOT_EXECUTED`, F-19 차단이다.
- canonical epoch15 write lease를 먼저, worker lease를 다음에 회수한다. 제품 파일 추가 변경·새 branch·운영 작업 없음. control QA commit 기준 revocation event/snapshot/handoff/digest/manifest를 투영·push한 후 G-05와 원격 HEAD 일치를 확인한다. 그 후에만 trusted mapping 후속 Stage를 준비한다.
