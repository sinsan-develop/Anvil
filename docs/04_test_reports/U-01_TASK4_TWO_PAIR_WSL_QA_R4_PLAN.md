# U-01 Task4 두 조합 WSL-server R4 전용 수직 QA 실행 계획

## 기준·범위

R3 exact SHA `56b66b513b378b0f7865f4801ac8acae6da87128`의 새 빈 DB `granted`는 실제 브라우저 2 PASS와 E-SHOT/E-NET 파일을 얻었으나, `revoked`는 하네스의 1조합 `30d` 대 무조건 `7d` 단언에서 실패했다. epoch106 Developer가 WI 허용 한 파일만 최소 보완했고 Main 독립 로컬 31 PASS/1 opt-in SKIP, JS 자체·구문·diff check PASS다. R3의 container/network/세 root/두 loopback listener 잔여0과 공유 Web/PG ID 불변을 확인했다. 이 계획을 기존 단일 branch에 commit/push한 **뒤의 정확 clean SHA**만 R4 입력으로 사용한다. 새 branch/worktree, WSL 소스 patch, 공유 DB·서비스, ysna/Production은 범위 밖이다.

## 전용 자원·실행 순서

- `ssh WSL-server`에서 충돌0을 다시 확인하고 Git remote의 정확 SHA를 `/home/daon/anvil-u01-two-pair-qa-r4-checkout`으로 수신한다. 전용 material/browser root는 각각 `/home/daon/anvil-u01-two-pair-qa-r4-material`, `/home/daon/anvil-u01-two-pair-qa-r4-browser`, owner `daon`·0700, Secret/trust 0600. Docker run label `com.anvil.qa-run=anvil-u01-two-pair-qa-r4`, network `anvil-u01-two-pair-qa-r4-net`, DB/user `anvil_u01_qa_<새 SHA 앞12>`, PG15 container `anvil-u01-two-pair-qa-r4-pg15`, issuer/API/Web `anvil-u01-two-pair-qa-r4-{issuer,api,web}`, browser `anvil-u01-qa-browser-<새 SHA 앞12>`를 사용한다.
- PG15는 tmpfs·비관리자 DB/user·host loopback `127.0.0.1:5546`만 쓴다. migration head `0020_f19a_pair_grants`, PG15 server version, 등록/환경/grant/등록감사/운영감사 빈 원장을 DB 쓰기 전에 검증한다. 합성 issuer는 초기 reader subject `f19a-qa-reader`이고, 세 principal은 하네스가 seed한다. API 필수 Telegram 합성 환경 3개는 전용 컨테이너에만 둔다. Web HTTPS는 loopback `127.0.0.1:8444`와 전용 Docker network alias `anvil-f18-qa.local`/전용 고정 IP를 사용한다. 브라우저 내부 DNS가 WSL 호스트 외부 IP로 향하면 즉시 중단한다. API/Web/issuer image revision과 WSL checkout/원격 branch는 모두 같은 SHA여야 한다.
- 동일 DB 수명에서 `granted→revoked→restored`를 순차 실행하고, issuer만 같은 합성 키·URL의 other subject로 교체한 뒤 `other`를 실행한다. 각 phase의 출구코드·PG 원장·실제 OIDC/HTTPS/API/Chromium/Network·1920×1080 screenshot을 별도 수집한다. 앞 단계가 실패하면 뒤 phase를 PASS처럼 진행하지 않고 실패 원인·재개 조건을 기록한다. 같은 seed DB에 `granted`를 재실행하지 않는다.
- 각 phase screenshot/network JSON의 Secret·token·DSN 노출 여부와 SHA-256을 검사한 후 로컬 `docs/evidence/u01-task4-two-pair-r4/`에 보존한다. E-SHOT/E-NET/E-API/E-AUD 및 기존 R6 실패, 최신 G-05 successor, 독립 Tester 판정은 각각 실제 근거로만 표시한다.
- 전용 자원 최대 수명 6시간. 결과가 나면 정확 container ID·label·network ID·image revision·mount/owner/realpath·Git clean을 확인하고 browser→Web/API/issuer→PG→network→이번 image tag→세 root 순서로 즉시 제거한다. label/path/loopback5546·8444 잔여0과 공유 Web/PG 기존 ID·running 불변을 확인한다. 캐시 PG/Playwright 원본 이미지는 보존한다.

## 수락 경계

R4 네 phase가 통과해도 기존 R6 회귀, G-05, 필수 evidence와 독립 Tester가 GREEN이기 전에는 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main 병합·branch 삭제·새 branch/U-02를 실행하지 않는다. 실패·미실행은 `design_change.md`, `WORK_STATUS`, 결과보고서에 누적 기록한다.
