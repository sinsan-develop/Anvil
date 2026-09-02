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
