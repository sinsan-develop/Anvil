# F-19A 최소 등록·정확 pair grant WSL-server 실측 결과

## 판정

`AV-OPS-026=PASS`, `AV-SAFE-034=PASS`는 독립 Tester의 재판정 권고다. F-19A Package 전체는 아직 `NOT_ACCEPTED`다. 이 보고서와 작업현황의 canonical Git 결박·필수 회귀/G-05 재검증이 남았다. U-01 제품 write, Release GO, Production/ysna-server 검증은 수행하지 않았다.

## 대상과 실제 결과

- 개발은 로컬 단일 branch `codex/f18-wsl-ops`, WSL-server QA는 private Git에서 받은 clean SHA `73055ce3e8b08449cf53d371107c5bd326417ae3`로 했다. 공유 Web `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`, 공유 PostgreSQL `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c`는 접근·변경하지 않았다.
- 격리 PG15 `pgvector/pgvector:0.8.2-pg15`, 전용 DB/user `anvil_f19a_ee3c89b`, loopback `127.0.0.1:5546`, 전용 Docker network `d69d292b0d9b4c9f435ee45e1c858a25b2b8d750581c087f10010a00420c1643`, 합성 OIDC HTTPS `172.24.0.1:8444`, 격리 Chromium/Playwright로 실행했다. PG opt-in 통합 `tests/integration/test_f19a_oidc_pg15.py` 2 PASS, HTTP 집중 7 PASS, 로컬 집중 115 PASS/1 SKIP. WSL source의 변경은 0이다.
- 실제 PG15의 두 등록 pair와 grant/철회·비활성·미등록 교차 pair를 검사했다. 허용 목록 2→1→0 및 재활성/재grant 회복, 교차 `project-1/qa-2`·`project-2/wsl-qa`와 무 grant actor 거절, 동일 OIDC 세션의 Dashboard/Operations GET·ACK 권한 철회 다음 요청 403을 확인했다. 동일 Chromium same-origin의 pair ID/이름 목록 2→1→2에서 혼입 0이었다.
- 실제 HTTPS Chromium에서 `POST /auth/oidc/authorization` 200 → 합성 issuer code 302 → `POST /auth/oidc/callback` 200 → authenticated session을 확인했다. 새 세션의 granted/revoked phase 각각 `F19A_QA_BROWSER_GRANTED_PASS`, `F19A_QA_BROWSER_REVOKED_PASS` exit 0. 브라우저 `/api/` 요청은 same-origin이었다.
- 실제 PG15 Operations audit에 합성 Critical `WORKER_LEASE_EXPIRED`를 1회 탐지해 열린 알림 1건/감사 sequence 1을 만들었다. Chromium의 실제 OIDC 세션에서 해당 알림에 `x-csrf-token`, 정확 permission, `If-Match: 1`, evidence hash, idempotency key를 넣은 same-origin ACK POST 1회는 HTTP 200/`ack_sequence=2`를 반환했고, 다음 alerts GET은 `acknowledged`였다. DB 감사 sequence 1 `DETECTED` → 2 `ACKNOWLEDGED`, actor `f19a-qa-reader`를 확인했다. 첫 브라우저 harness 전체 exit 1은 이 성공 assertion 뒤 별도 `/api/operations/audit` 조회가 QA reader의 권한 밖이라 403이 된 것이다. 이를 전체 PASS로 바꾸지 않는다. 두 번째 같은 알림 ACK는 409 `ACK_CONFLICT`, 상태 `acknowledged` 유지였다.
- 실제 PG15 연결 후 read stall은 low-level deadline 3.011초, ASGI TestClient HTTP 503 10.030초, 기존 OIDC/Operations 경로의 table lock HTTP 503 약 10초와 unlock 후 200으로 재현했다. 잠금 동안 ACK audit 증가 0. 정확 PG 컨테이너 pause-after-handshake는 4.028초 bounded error/own connection closed, unpause 뒤 SELECT1 회복. Chromium HTTPS lock 상황에서도 alerts GET·ACK POST 각 약 10초에 기존 503 envelope, ACK 요청 1회·same-origin이었다.
- 원본 전용 DB의 custom dump SHA256 `ef025d84c8dcd578cd4f960a70cd7cf261534a5eaf27d0a4e3d8898f58e9282f`를 동일 전용 컨테이너의 shadow DB `anvil_f19a_ee3c89c`에 `pg_restore --exit-on-error`로 복원했다. head0020, 10개 테이블 전체 행의 정렬 JSON count/SHA가 동일했고 등록 actor·시각·active·exact FK·grant·audit 필드를 포함한다. 한 CHECK 제약의 문자열 렌더링은 ARRAY cast만 달랐으나 두 DB가 잘못된 permission을 같은 SQLSTATE23514로 거절했다.
- 독립 Tester는 실제 복원·두 pair·기존 route 철회·Chromium·OIDC/ACK 결과를 읽기 전용으로 재평가해 `AV-OPS-026=PASS`, `AV-SAFE-034=PASS`를 권고했다. 실제 물리 TCP 단절과 ACK COMMIT 응답 소실은 재현하지 않았으며 PG pause/table lock으로 대체해 PASS라 하지 않는다. Tester는 이를 현재 승인 WI에 명시된 필수 case가 아닌 잔여 미검증 위험으로 분류했다.

## 오류·환경 분리와 종료

- 합성 issuer의 JWKS/CA 및 앱 기동 설정 오류 각 1건, 첫 Chromium timed lock 해제 선행 1건, CHECK 문자열 지문 비교 1건, SQL 인용 진단 2건, browser ACK harness의 권한 밖 audit API 403 1건은 원인·영향을 분리했다. 제품 기능 확정 결함이나 정식 Developer `FAILURE_REPORT`로 합산하지 않는다.
- 전용 HTTPS Python PID `2142510`은 UID/cwd/venv/listener를 확인한 뒤 SIGTERM, 전용 PG container exact ID `8876c7f2776b4eb282191903019522746ea5fe15b577f2fbf6804c4cb3b68022`는 label/auto-remove를 확인한 뒤 stop했다. stop 직후 `docker inspect`는 auto-remove 경합으로 아직 존재해 cleanup command가 exit 1이었지만, 재조회에서는 no such object·label container 0이었다. 전용 network exact ID를 empty 확인 후 제거했다.
- `/home/daon/anvil-f19a-bounded-ee3c89b-{checkout,material,browser}`의 세 정확 path는 owner/realpath/mount, checkout SHA/clean을 확인한 뒤 제거했다. 최종 전용 container/network/경로·8444/5546 listener 잔여 0, 공유 Web/PG 위 exact ID·running 불변을 재확인했다. 합성 DB·issuer key·임시 snapshot/browser profile은 제거되어 복구되지 않으며 제품 source는 private Git에 남는다.

## 남은 통제

이 보고서와 `docs/WORK_STATUS.md`를 기준으로 canonical Event/progress/HANDOFF/digest 및 checker의 정확 successor 결박을 완료하고, 필수 회귀·G-05·private Git 동일 clean SHA를 확인한 뒤 Main이 F-19A 전체 수락을 판정한다. 기존 R48 인접 회귀 2 FAIL을 새 PASS로 바꾸지 않으며 필수 gate와의 관계를 따로 확인한다. 다음 branch 생성·main 병합·U-01 write는 이 판정 전에 하지 않는다.
