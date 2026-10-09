# U-01 Task4 R7 전체 API URL·origin 증거 WSL-server QA 계획

R6 네 phase DB/API/AUD count·digest 결박과 비서울 브라우저 timezone 절편은 PASS였으나, Network JSON이 전체 URL/origin을 보존하지 않아 독립 E-NET 감사를 수행할 수 없었다. epoch106 WI의 허용된 두 하네스 파일에 안전한 `/api/` 전체 URL·origin과 request origin 검사를 추가했다. 이 변경을 기존 단일 branch의 clean/private exact SHA로 게시한 뒤에만 R7을 실행한다. 기존 Foundation R6, G-05 successor와 U-01 전체는 미수락이다.

## 사전 등록 자원

- `ssh WSL-server`에서 새 Git checkout `/home/daon/anvil-u01-two-pair-qa-r7-checkout`, 합성 material `/home/daon/anvil-u01-two-pair-qa-r7-material`, browser/evidence `/home/daon/anvil-u01-two-pair-qa-r7-browser`만 생성한다. 세 root는 owner `daon`·0700, Secret/trust는 0600이다. 정확 private SHA·경로 부재·label/name·loopback port 충돌0을 생성 전 확인한다.
- run label `com.anvil.qa-run=anvil-u01-two-pair-qa-r7`, network `anvil-u01-two-pair-qa-r7-net`, tmpfs PostgreSQL 15 `anvil-u01-two-pair-qa-r7-pg15`, issuer/API/Web `anvil-u01-two-pair-qa-r7-{issuer,api,web}`, Chromium `anvil-u01-qa-browser-<SHA 앞12>`, 비관리자 DB/user `anvil_u01_qa_<SHA 앞12>`다. QA Web/API/issuer 이미지는 해당 Git SHA의 제한 archive에서 만들고 revision label을 확인한다. 기존 cache PG15/Playwright/Node 원본 이미지는 보존한다.
- host 공개는 WSL loopback `127.0.0.1:5546` PG, `127.0.0.1:8444` HTTPS Web뿐이다. 브라우저 `anvil-f18-qa.local`은 전용 network Web IP로만 해석한다. 공유 `/srv`·Web/DB·ysna/Production은 변경하지 않는다. 최대 수명 6시간이다.

## 검증·정리

새 빈 PG15/migration0020·합성 OIDC/HTTPS/Chromium에서 같은 DB 수명 `granted→revoked→restored→other`를 순서대로 실행한다. 각 phase의 실제 pytest exit, pair/기간/UTC/observedAt, Network의 full API URL/origin·HTTPS·userinfo/fragment/비허용 query 0, 정적/OIDC 요청의 origin 요약·민감 query 값 비보존, DB/API/AUD digest·count, 1920×1080 PNG를 확인한다. 민감 표식0과 WSL/로컬 SHA-256 일치로 필요한 증거만 보존한다. 실패한 phase 뒤를 PASS로 승격하지 않는다.

증거 복사 후 컨테이너 정확 ID/name/label/revision, network label/연결 수, Git clean SHA, root owner/realpath/link를 확인한다. R7 전용 browser→Web/API/issuer→PG→network→이번 image tag→세 root만 제거하고 label/path/port 잔여0 및 공유 Web 불변을 확인한다. 임시 Secret/DB/profile은 함께 폐기한다. 네 phase PASS도 기존 Foundation R6·G-05·전체 E-NET/API/AUD·U-01 acceptance를 자동 통과시키지 않는다. 필수 gate GREEN 전 PR/main·branch 삭제·새 branch/U-02는 금지한다.
