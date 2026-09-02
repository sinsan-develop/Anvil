# C-21 DeployApproval

- 승인자: 신산님
- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 커밋: `fda94392b03f69d1a21b1030b5425f14ee8a4d95`
- 대상 환경: `ysna-server` / `anvil.sinsan.kr`
- 승인 범위: `deploy/ysna/deploy.sh` 표준 절차에 따른 C-21 배포와 health/OpenAPI/Host 진단 검증
- 금지 범위: 추가 Telegram POST, NPM restart/config 변경, 비승인 DB 변경, secret 출력
- 롤백: `deploy/ysna/rollback.sh` 및 배포 전 `previous.sha` 사용

신산님은 “C-21 커밋 `fda9439`의 DeployApproval binding 생성과 표준 `deploy.sh` 배포를 승인한다.”고 명시했다. 이 문서는 해당 승인과 대상 hash를 결박한 DeployApproval 기록이다.

## 재승인 갱신

- 갱신일: 2026-09-02 (Asia/Seoul)
- 갱신 대상 커밋: `c7826ca20c25d4f5627b2995e4cab479f3ca7fc8`
- 갱신 승인 문구: “C-21 수정 커밋 `c7826ca`에 대한 DeployApproval binding 갱신과 표준 `deploy.sh` 재배포를 승인한다.”
- 갱신 binding ID: `APPROVAL-20260902-C21-DEPLOY-002`

## 인증 세션/SSE 재승인

- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 커밋: `9fd7c46db2d9314bd4ffed825f3fd9e2b656bfd0`
- 승인 범위: ysna `.env`에 C-21 `ANVIL_TEST_SESSION_*` 환경변수 생성·등록, 표준 `deploy.sh` 배포, authenticated SSE 및 `Last-Event-ID` 운영 검증
- 금지 범위: 추가 Telegram POST, NPM 설정 변경, Provider 호출, secret 값 출력
- 승인 문구: “`9fd7c46`을 ysna에 배포하고, C-21 검증용 `ANVIL_TEST_SESSION_*` 환경변수를 어울이 생성·등록한 뒤 authenticated SSE와 Last-Event-ID 운영 검증을 수행하는 것을 승인한다.”
- binding ID: `APPROVAL-20260902-C21-DEPLOY-003`

## 공개 인증 프록시 재승인

- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 runtime 커밋: `8ba679e72f53e20561e2063f3cdf01c10981a67b`
- 승인 범위: 표준 `deploy.sh` 배포, 기존 C-21 테스트 세션 환경변수 사용, `/auth/session` 발급·authenticated SSE·`Last-Event-ID` 재개 검증
- 금지 범위: Telegram POST, Provider 호출, NPM 설정 변경, secret 값 출력
- 승인 문구: “`8ba679e`를 ysna에 배포하고, 기존에 등록한 C-21 테스트 세션 환경변수로 `/auth/session` 발급, authenticated SSE, Last-Event-ID 재개를 검증하는 것을 승인한다.”
- binding ID: `APPROVAL-20260902-C21-DEPLOY-004`

## Unified Runtime 배포 및 조건부 internal 제거 승인

- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 runtime 커밋: `a962bdfb6ba0e9c057907be8ee88909793bbf6ce`
- 승인 범위: `anvil-web:3770` Unified Runtime 배포, UI·API·health·Telegram·SSE 검증, 성공 시 `anvil-internal-web-1` 제거와 잔여 확인
- 조건: UI·API·health·Telegram·SSE 수직 검증이 모두 성공한 경우에만 internal 컨테이너를 제거한다.
- 금지 범위: NPM/DNS 변경, secret 출력, 검증 실패 상태의 internal 컨테이너 제거
- 승인 문구: “Unified Runtime `a962bdf`를 `anvil-web:3770`에 배포하고, UI·API·health·Telegram·SSE를 검증한 뒤 성공 시 `anvil-internal-web-1`을 제거하는 것을 승인한다.”
- binding ID: `APPROVAL-20260902-C21-DEPLOY-005`

## Unified Runtime R3 최종 배포 및 조건부 internal 제거 승인

- 승인일: 2026-09-02 (Asia/Seoul)
- 대상 runtime 커밋: `cb3afcdd5971c7497b4c0044d3ee52479c59da59`
- 승인 범위: `anvil-web:3770` Unified Runtime R3 배포, UI·API·health·Telegram·SSE·`Last-Event-ID` 검증, 전 항목 성공 시 `anvil-internal-web-1` 제거
- 조건: 전 항목 실제 PASS 확인 전 internal 컨테이너 제거 금지
- 금지 범위: NPM/DNS 변경, secret 출력, Provider 호출
- 승인 문구: “Unified Runtime R3 `cb3afcd`를 `anvil-web:3770`에 배포하고 UI·API·health·Telegram·SSE·Last-Event-ID를 검증한 뒤, 모두 성공하면 `anvil-internal-web-1`을 제거하는 것을 승인한다.”
- binding ID: `APPROVAL-20260902-C21-DEPLOY-006`

## Canonical Run/Event migration·NPM override 제거·조건부 internal 제거 승인

- 승인일: 2026-09-02 (Asia/Seoul)
- binding ID: `APPROVAL-20260902-C21-DEPLOY-007`
- 배포 source commit: `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`
- 배포 release tag: `anvil-ui-preview-20260902.2` — 위 source commit 하나에만 결박해야 한다.
- 대상 환경: `ysna-server` / `anvil.sinsan.kr`
- runtime listener: `anvil-web:3770`
- 목표 migration head: `0012_run_authority`
- 승인 범위:
  - C-21 canonical Run/Event API의 권위·계보·멱등·동시성 migration을 운영 DB에 적용한다.
  - migration 전 `shared-db/anvil` 전체 backup, backup catalog 확인, container/host SHA-256 일치를 확인하고 현재 revision이 정확히 `0011_telegram_webhook_state`일 때만 `0012_run_authority`를 적용한다.
  - versioned Git 배포 절차로 exact source commit의 `anvil-web:3770` runtime을 배포한다.
  - NPM custom Telegram internal override를 exact hash로 확인하고 byte backup한 뒤 제거하며, `nginx -t` 성공 후 graceful reload를 수행한다. 실패 시 원본을 복원하고 다시 test/reload한다.
  - UI·API·health·Provider non-billing probe·Telegram signed POST·authenticated SSE·`Last-Event-ID` 재개를 실제 운영 경계에서 검증한다.
  - 위 수직 검증 전체가 실제 PASS인 경우에만 `anvil-internal-web-1`을 제거하고 잔여 상태를 확인한다.
- 조건 및 금지 범위:
  - 수직 검증 한 항목이라도 실패·미실행이면 `anvil-internal-web-1`을 보존한다.
  - migration 적용 뒤 자동 schema downgrade를 수행하지 않는다. 장애 시 backup을 보존하고 application rollback만 허용하며 `INCIDENT_HOLD`로 중단한다.
  - Provider는 비용이 발생하지 않는 health/capability probe만 허용하고 모델 생성·fallback은 금지한다.
  - Telegram signed POST는 승인된 검증 fixture 1회로 제한하고 secret·token·Authorization header 원문을 출력하거나 기록하지 않는다.
  - server-local patch, `scp` source overwrite, dirty checkout 배포, source commit과 다른 tag 사용을 금지한다.
- 승인 문구: “C-21 canonical Run/Event API를 위한 권위·계보·멱등·동시성 DB migration의 구현 및 적용과, NPM custom Telegram internal override를 백업 후 제거하고 `nginx -t` 및 graceful reload를 수행하는 것을 승인한다. 수직 검증 전체 성공 시에만 `anvil-internal-web-1`을 제거한다.”
- 현재 실행 상태: release tag 생성·push, 운영 DB backup/migration, runtime 배포, NPM 변경, Provider probe, Telegram POST, authenticated SSE/`Last-Event-ID`, internal 제거는 모두 `NOT_EXECUTED`다.
- 문서 계보: 이 승인과 ReleaseManifest를 기록하는 후속 문서 commit은 배포 source commit이 아니다. ReleaseManifest의 `source.commit`은 계속 `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`을 가리키며, 배포 시 후속 control/manifest commit에서 이 source commit을 승인한다.
