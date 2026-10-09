# U-01 Task4 두 조합 WSL-server R3 전용 수직 QA 실행 계획

## 판정·기준

`READY_TO_PROVISION; FOUR_PHASE_NOT_EXECUTED`. 승인된 U-01 Task4와 epoch106 WI의 정확 두 하네스 파일을 사용한다. 직전 R2는 최종 브라우저 단일 `granted`를 직접 통과했지만 정식 네 phase와 E-SHOT/E-NET/E-API/E-AUD를 완료하지 못했다. R2 전용 컨테이너·network·세 root·loopback port의 잔여는 0이다. 현재 `codex/u01-dashboard-r2` local/development ref `04c30bf72c64789c0e2af6097053c9973721dc41` 일치·추적 clean(기존 `.pytest_cache` ACL 경고 보존). WSL-server 공유 `anvil-web` ID `f0107aada3b2`, `local-postgres` ID `99f3bf939d40` running, 전용 5546/8444 free를 읽기 전용 확인했다.

## 전용 자원·수명

- 이 계획과 `WORK_STATUS`를 기존 단일 branch에 commit/push한 **뒤의 최종 exact clean SHA**를 WSL-server가 `ssh WSL-server`와 Git fetch/checkout만으로 받는다. 로컬 개발, WSL-server 테스트이며 WSL 소스 patch·`scp` 배포·공유 checkout/DB·ysna-server/Production 사용은 금지한다.
- 전용 run label `com.anvil.qa-run=anvil-u01-two-pair-qa-r3`, checkout/material/browser root `/home/daon/anvil-u01-two-pair-qa-r3-{checkout,material,browser}`, 전용 network `anvil-u01-two-pair-qa-r3-net`, DB/user `anvil_u01_qa_r3`, PG15 container `anvil-u01-two-pair-qa-r3-pg15`, issuer/API/Web 이름 `anvil-u01-two-pair-qa-r3-{issuer,api,web}`, browser `anvil-u01-qa-browser-<final SHA 앞12>`. 새 root owner `daon`/0700, 임시 Secret/trust 0600. 네트워크·포트·경로 충돌을 다시 확인하고 생성 즉시 정확 ID/image revision/mount/label을 기록한다.
- PG15는 전용 tmpfs와 비관리자 DB/user, host loopback `127.0.0.1:5546`만 사용하고 migration head `0020_f19a_pair_grants` 및 등록/감사 원장 빈 상태를 검증한다. 합성 issuer/HTTPS Web/API/Playwright는 동일 전용 Docker network의 `anvil-f18-qa.local` alias를 사용한다. Web만 loopback `127.0.0.1:8444`; 브라우저 내부 DNS는 전용 Web IP여야 하며 WSL 호스트의 외부 동명 IP를 사용하면 즉시 중단한다. API·Web·issuer image의 revision label은 모두 위 최종 SHA와 일치해야 한다.
- 세 합성 principal과 두 정확 pair를 하네스가 seed한다. reader issuer로 `granted→revoked→restored`를 한 DB 수명에서 순차 실행하고, 같은 합성 키·URL의 다른 subject issuer를 별도 인스턴스로 바꾼 뒤 `other`를 실행한다. 각 phase의 pre/post DB 원장, OIDC/HTTPS, scoped API/화면/Network, 1920×1080, 서울 달력일, stale·503 회복, 철회/복원을 검증한다. 첫 실패 뒤 다음 phase를 PASS처럼 계속하지 않는다. 기존 R6 `STORED_ROW`는 별도 재현·원인 분리하며 새 하네스 결과로 덮지 않는다.
- 증거는 phase별 screenshot/network JSON 및 DB/API·검증 명령/exit를 Secret·cookie·token·원문 DSN 없이 수집한다. 브라우저 응답은 고정 stage/class/code만 외부로 전달한다. 증거 파일의 안전성·hash를 확인한 뒤 프로젝트 승인 경로의 결과보고와 manifest에 결박한다. 증거 보존 전에는 전용 root를 지우지 않는다.
- 전용 자원 최대 수명은 생성 후 6시간이며 성공·실패·중단 시 즉시 정리한다. 정확 container ID·run label·network ID·image revision·owner/realpath/mount/Git clean을 확인해 전용 browser→Web/API/issuer→PG→빈 network→이번 전용 image tag/volume→세 root 순서로 제거한다. loopback5546/8444, label/path 잔여0과 공유 Web/PG ID·running 불변을 확인한다. 캐시 Playwright/PG 원본 이미지와 다른 프로젝트 자원은 제거하지 않는다.

## 수락 경계

R3 단독 PASS가 U-01 수락은 아니다. 기존 R6 회귀, 최신 G-05 successor, 모든 필수 evidence와 독립 Tester 판정 전에는 U-01 `NOT_ACCEPTED`, Release `DEFER`; PR/main 병합·branch 삭제·새 branch/U-02·ysna/Production은 실행하지 않는다. 실패 또는 미실행은 `design_change.md`, `WORK_STATUS`, 결과보고서에 정확히 남긴다.
