# U-01 Task4 두 조합 WSL-server R6 격리 QA 계획

## 판정 경계

R5 네 phase는 해당 수직 절편만 PASS였다. 이번 R6는 같은 브랜치의 E-API/E-AUD 원장 결박과 비서울 브라우저 시간대 하네스를 새 clean exact SHA에서 실측한다. 네 phase 모두 통과해도 기존 R6 회귀, 최신 G-05 successor, 미충족 ID, 독립 인수 판정을 대체하지 않는다.

## 사전 등록 자원

- 접속은 `ssh WSL-server`만 한다. 원격 `development` branch의 정확 SHA를 새 `/home/daon/anvil-u01-two-pair-qa-r6-checkout`에 Git으로 수신한다. 별도 material/browser root는 같은 prefix의 `-material`/`-browser`, owner `daon`, mode 0700이다. Secret/trust는 각 전용 root 안의 0600 파일로 한정한다.
- run label `com.anvil.qa-run=anvil-u01-two-pair-qa-r6`, network `anvil-u01-two-pair-qa-r6-net`, PG15 `anvil-u01-two-pair-qa-r6-pg15`, issuer/API/Web `anvil-u01-two-pair-qa-r6-{issuer,api,web}`, browser `anvil-u01-qa-browser-<SHA 앞12>`로 식별한다. 전용 DB/user `anvil_u01_qa_<SHA 앞12>`를 tmpfs PG에 만들고 Alembic `0020_f19a_pair_grants`와 빈 등록·감사 원장을 확인한다.
- 외부 노출은 WSL loopback PG `127.0.0.1:5546`, HTTPS Web `127.0.0.1:8444`뿐이다. 브라우저의 합성 `anvil-f18-qa.local`은 전용 network Web IP로 해석한다. 공유 `/srv`, 기존 Web/PG, ysna/Production은 변경하지 않는다.
- 생성 전 remote SHA·세 literal root·container label/name·network·두 port 부재를 확인한다. 자원 최대 수명은 6시간이다.

## 검증·정리

같은 빈 DB 수명에서 `granted→revoked→restored→other`를 직렬 실행하고 각 phase의 pytest exit code, `db-api-audit.json`·Network JSON·PNG, pair/기간/UTC/observedAt와 원장 digest, 브라우저 `America/Los_Angeles`, same-origin 요청을 검사한다. 실패한 phase 뒤를 PASS로 승격하지 않는다. 증거 파일의 민감 표식을 검사한 뒤 원본과 로컬 SHA-256 일치로 보존한다.

종료 시 정확 ID·label·image revision·owner·realpath·내부 link·Git clean 및 보존된 증거를 확인한 후 전용 browser→Web/API/issuer→PG→network→이번 image tag→세 root만 제거한다. 전용 container/network/path/loopback 잔여0과 공유 Web/PG 불변을 기록한다. 기존 브랜치 유지, PR/main 병합·새 branch 생성은 필수 gate가 GREEN이기 전 금지한다.
