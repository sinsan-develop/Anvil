# U-01 Task4 두 조합 WSL-server R5 전용 수직 QA 실행 계획

R4 clean exact SHA `3eb267c910422c6ee486ef664d16bd9a2f45db54`의 새 빈 DB에서 `granted→revoked→restored`는 각각 실제 OIDC/HTTPS/Chromium 2 PASS였다. `other`는 DB/API 접근 차단 뒤 브라우저의 잘못된 `status` accessible-name 선택자로 멈췄다. epoch106 Developer는 WI 허용 브라우저 하네스 한 파일만 `status` 텍스트 필터로 보완했고, Main 별도 DOM 진단과 로컬 검사에서 이를 확인했다. R4 전용 자원 잔여0 및 공유 Web/PG ID 불변이다. 이 계획·변경을 기존 단일 branch에 commit/push한 뒤의 **정확 clean SHA**만 R5 기준으로 사용한다.

## 전용 자원

- 접속은 `ssh WSL-server`만. 새 Git checkout `/home/daon/anvil-u01-two-pair-qa-r5-checkout`, material `/home/daon/anvil-u01-two-pair-qa-r5-material`, browser `/home/daon/anvil-u01-two-pair-qa-r5-browser`는 owner `daon`·0700, Secret/trust 0600. run label `com.anvil.qa-run=anvil-u01-two-pair-qa-r5`, network `anvil-u01-two-pair-qa-r5-net`, tmpfs PG15 `anvil-u01-two-pair-qa-r5-pg15`와 비관리자 DB/user `anvil_u01_qa_<새 SHA 앞12>`, issuer/API/Web `anvil-u01-two-pair-qa-r5-{issuer,api,web}`, browser `anvil-u01-qa-browser-<새 SHA 앞12>`. 충돌0/원격 SHA를 사전 확인한다.
- PG host loopback `127.0.0.1:5546`, Web HTTPS `127.0.0.1:8444`만 공개한다. PG15 version, Alembic `0020_f19a_pair_grants`, 5개 등록/감사 원장 빈 상태를 확인한다. 합성 issuer는 reader subject로 시작, 세 principal은 하네스가 seed한다. API 필수 Telegram 합성값은 전용 컨테이너만 갖는다. API/Web/issuer image revision과 checkout/원격 branch는 정확 SHA가 같다. 브라우저 내부 `anvil-f18-qa.local`은 전용 network Web IP로 해석되어야 하며 WSL 호스트의 외부 IP면 중단한다.
- 같은 DB 수명에서 `granted→revoked→restored`, issuer만 같은 합성 키/URL의 other subject로 바꾼 뒤 `other`를 실행한다. 각 단계의 DB 원장, OIDC/HTTPS/API/Chromium, 1920×1080, 서울 달력일, stale·503 복구, same-origin Network를 구분한다. 실패 후 다음 phase를 PASS처럼 계속하지 않고 seed DB를 빈 상태로 재사용하지 않는다.
- 각 phase screenshot/network JSON의 Secret·cookie·token·DSN 노출을 검사하고 SHA-256을 로컬 `docs/evidence/u01-task4-two-pair-r5/`에 보존한다. 기존 R6 실패, G-05 successor, E-SHOT/E-NET/E-API/E-AUD, 독립 Tester 판정은 실제 실행 증거로만 표기한다.
- 전용 자원 최대 수명 6시간. 결과 직후 정확 label/ID/network/image revision/owner/realpath/Git clean과 증거 보존을 확인한 뒤 browser→Web/API/issuer→PG→network→이번 image tag→세 root 순서로 제거하고 label/path/loopback 잔여0 및 공유 Web/PG ID·running 불변을 확인한다. 캐시 PG/Playwright 원본 image와 공유 자원은 보존한다.

네 phase 단독 PASS도 U-01 수락은 아니다. R6·G-05·필수 증거·독립 Tester가 GREEN이기 전 PR/main·branch 삭제·새 branch/U-02는 진행하지 않는다. ysna/Production은 작업 대상이 아니다.
