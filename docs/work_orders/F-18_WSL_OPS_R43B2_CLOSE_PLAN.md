# F-18 R43B2 격리 runtime QA checkpoint 종료

- 테스트 Git SHA `91bdc617ae0c3d1096d173d1e64cbe4207c4022b`의 정확한 WSL-server checkout·전용 image·Compose에서 PG18 18.4/migration0019, API readiness, issuer 거부, TLS/Chrome same-origin을 실측했다. Worker는 제품 head0016 고정으로 exit1, OIDC authorization은 TLS proxy 신뢰 미설정으로 403이다. 따라서 B2와 F-18 인수는 불합격이며 F-19 차단/Production 미실행을 유지한다.
- Windows 임시 Chrome 프로필/프로세스·SSH 터널, WSL 전용 project 컨테이너/network/image·checkout·합성 material/credential·8444 listener의 잔여0을 확인했고 공유 `anvil-web`/`local-postgres` 및 PG18/MinIO cache를 보존했다. 자세한 명령·오류·scope는 B2 runtime report와 WORK_STATUS를 따른다.
- epoch29 Main 검증 worker lease 하나만 seq1656에서 회수한다. write lease/product scope는 전후 모두 공란이다. 기존 seq1~1655 event 원문을 보존한다. 뒤따르는 제품 보정은 새 exact WI·별도 Developer lease/G-05 PASS 후 시작하며 B2 과정에서 제품 파일을 수정하지 않았다.
- 종료 control exact 파일을 먼저 commit/push하고 clean 원격 HEAD에서만 materialize한다. B2 start manifest/event는 소급 수정하지 않는다.
