# F-18 R34 OIDC session coordinator writer 종료 계획

- 제품 exact3 commit `4bf30ebae255b9c094c72ce18f400bf4fd7bec99`과 보완 commit `03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4`의 독립 리뷰는 Important 1건 ADDRESSED, scoped Spec PASS/Task quality Approved, Critical/Important 0이다. Main 로컬 focused 220 PASS/PG opt-in 13 SKIP; 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다.
- WSL-server의 clean detached 동일 제품 SHA 전용 checkout에서 scoped 220 PASS/13 PG opt-in SKIP, wrapper `QA_EXIT=0`을 확인했다. 전용 checkout 잔여0, 기존 PostgreSQL/Web 서비스 ID/status 불변이다. Docker/DB/port는 만들지 않았다.
- 이는 signed-token flow→서버 권한→SQLite session coordinator와 매 인증 재조회·만료·철회의 경계만 증명한다. 실제 issuer 네트워크·PostgreSQL coordinator 결합·same-origin API/browser·정식 WSL 통합은 미검증, Production `NOT_EXECUTED`, F-19 차단이다.
- 제품 보고서와 상태 근거를 반영한 control QA 후 canonical epoch18 write lease를 먼저, worker lease를 다음에 회수한다. 제품 추가 변경·새 branch·운영 작업 없이 revocation projection→G-05→상태 기록 순으로 수행한다.
