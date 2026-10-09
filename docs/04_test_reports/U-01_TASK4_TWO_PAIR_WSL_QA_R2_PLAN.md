# U-01 Task4 두 조합 WSL-server R2 격리 수직 QA 계획

## 판정·기준

`READY_TO_PREPARE; VERTICAL_NOT_EXECUTED`. 한 파일 재작업 C `3346252c058c21915e7a3258377f9d604f61a0a9`은 전용 세 QA 신원 단일 트랜잭션 seed와 source SHA에 결박된 Docker browser 명령을 추가했다. Main 독립 집중 27 PASS/1 opt-in SKIP, Ruff/diff PASS; 최초 Windows 기본 pytest temp ACL 1 ERROR는 새 전용 base에서 재실행하여 27 PASS/1 SKIP으로 분리했다. Developer 인접6은 146 PASS/2 opt-in SKIP이다. 실제 네 phase·R6 회귀·G-05 최신 route는 아직 통과하지 않았다.

`2026-10-09T17:14:16Z` WSL-server 읽기 전용 대조: 개발 원격 ref=C, 전용 `/home/daon/anvil-u01-two-pair-qa-3346252c-{checkout,material,browser}` 부재, run-label 컨테이너·전용 network 부재, loopback5546/8444 listener0, 공유 `anvil-web` ID `f0107aada3b2`·`local-postgres` ID `99f3bf939d40` running. WSL 호스트의 `anvil-f18-qa.local`은 **외부** `218.38.137.27`로 해석되므로 호스트 browser/issuer request로 시험하지 않는다.

## 생성·실행 경계

- 본 계획을 기존 branch에 push한 뒤 최종 local=development ref의 exact clean SHA만 전용 checkout에 Git clone한다. WSL 소스 patch·공유 checkout 사용 금지. Docker build는 이 Git SHA의 제한된 archive와 `deploy/wsl/Dockerfile.f18`(api/web), `Dockerfile.f18.oidc-qa`(issuer)로만 하고 각 image revision label과 SHA를 기록한다. worker/minio/별도 PG18은 이 QA에 기동하지 않는다.
- 전용 root 세 곳은 owner `daon`/0700, 합성 DB/OIDC/TLS 키와 trust는 `material`의 0600/필요 최소 읽기권한. 전용 run label `com.anvil.qa-run=anvil-u01-two-pair-qa-3346252c`, network `anvil-u01-two-pair-qa-3346252c-net`. PG15는 tmpfs·비관리자 DB/user `anvil_u01_qa_3346252c`, loopback `127.0.0.1:5546`; migration0020 및 빈 원장을 확인한다. 컨테이너·network·image·volume 생성 직후 ID/mount/label/포트를 기록한다.
- 합성 HTTPS Web/BFF는 같은 전용 network에서만 `anvil-f18-qa.local` alias와 loopback8444를 갖고 내부 `anvil-api` 및 `oidc-issuer`로 same-origin reverse proxy한다. API는 전용 PG15 컨테이너만 사용하고 고정 trust/CA/Secret은 read-only mount다. admin/reader/other role·subject·host scope가 정확한 trust/JWKS를 검증한다. 먼저 reader subject의 issuer로 `granted→revoked→restored`를 실행하고, 동일 키·issuer URL의 새 전용 issuer 인스턴스를 other subject로 교체한 뒤 `other`를 실행한다. 공유 서비스·실제 계정·Provider 호출은 금지한다.
- Playwright `v1.62.1` 격리 image는 캐시돼 있으나 Node 모듈은 포함되지 않아 전용 material에 같은 버전만 설치한다. Browser container 이름은 하네스 계약상 `anvil-u01-qa-browser-<최종 exact SHA 앞 12자리>`이고 전용 network 안에서만 실행한다. checkout `/workspace` read-only, 증거 폴더는 동일 절대경로 writable, module과 Chromium은 전용 경로에서 제공한다. `ANVIL_U01_QA_BROWSER_COMMAND_JSON`은 정확 Docker exec 5요소만 허용한다. 브라우저 내부에서 합성 도메인이 전용 Web IP로 해석되는지 먼저 확인하고 외부 IP면 즉시 중단한다.
- 네 phase마다 동일 Git clean SHA, 전용 DB head/ledger, OIDC/HTTPS/Network/1920×1080 화면, 두 pair·기간·철회·복원·other denial을 수집한다. 이전 phase 실패 시 다음 phase를 실행하지 않는다. 기존 R6 `STORED_ROW` AssertionError는 별도 재현·진단해 새 하네스 결과로 덮지 않는다. 비밀 원문·DSN·토큰/쿠키는 로그·Git·증거에 기록하지 않는다.

## 수명·정리·남은 통제

모든 자원은 생성 후 최대 6시간 또는 QA 종료 즉시 정리한다. 정확 ID/label/owner/realpath/mount/clean Git을 확인하고 전용 browser/issuer/web/api/PG→빈 network→전용 image tag/volume→세 root만 제거한다. loopback5546/8444, label/path 잔여0 및 공유 Web/PG ID·running 불변을 확인한다. 이미지 캐시 원본과 다른 프로젝트 자원은 지우지 않는다. 실패·SKIP은 PASS가 아니다. 최신 G-05의 epoch106 successor·독립 Tester 수락 전에는 PR/main·새 branch/U-02·ysna/Production은 실행하지 않는다.
