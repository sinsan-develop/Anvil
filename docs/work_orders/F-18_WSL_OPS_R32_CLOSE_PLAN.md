# F-18 R32 OIDC trusted-directory writer 종료 계획

- 제품 exact5 commit `ca5f6597239fb8f031925ee5e1ffc8ee921a7075`의 독립 review는 Spec PASS, Task quality Approved, Critical/Important 0이다. Main 로컬 focused 83 PASS/PG opt-in 8 SKIP; 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다.
- WSL-server clean detached 동일 제품 SHA의 전용 PostgreSQL 18 tmpfs DB·비관리자 역할에서 focused 87 PASS/4 R31 PG SKIP, R32 PG 4건 PASS, wrapper exit0이다. SELECT-only reader INSERT는 SQLSTATE 42501로 거부됐다. 전용 container/checkout/port 잔류 0, 기존 서비스 ID/status 불변이다.
- 이는 trusted directory migration과 verified issuer+subject→서버 권한 read-only resolver 경계만 증명한다. 실제 issuer/session/API/browser·전체 F-18 미검증, Production `NOT_EXECUTED`, F-19 차단이다.
- canonical epoch16 write lease를 먼저, worker lease를 다음에 회수한다. 제품 추가 변경·새 branch·운영 작업 없이 control QA→revocation projection→G-05→상태 기록 순으로 수행한다.
