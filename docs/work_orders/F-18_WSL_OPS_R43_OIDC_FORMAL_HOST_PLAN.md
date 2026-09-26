# F-18 R43 OIDC 정식 WSL host 설계·실행 계획

## 판정과 경계

- R42의 OIDC process bootstrap은 로컬·WSL-server 동일 SHA의 scoped 회귀까지만 검증됐다. 현재 `compose.f18.yml`은 HTTP ingress와 COOKIE 기본값이며 OIDC 신뢰 파일·CA·Secret mount가 없다. R43은 승인된 F-18의 내부 구현 단계이며 F-18 인수나 F-19 착수가 아니다.
- 개발은 기존 `codex/f18-wsl-ops`의 Windows 격리 worktree에서만 한다. 새 branch/worktree를 만들지 않는다. 제품 commit을 `development` SSH alias로 push한 다음 WSL-server에서 정확한 SHA를 Git으로 받아 검증한다. `ysna-server`·Production·공개 도메인은 대상에서 제외한다.
- 기준 승인: `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 WorkInstruction, 설계서 §49.11~49.13, 매트릭스 AV-OPS-013/016/020/021. 기능·요구사항·중요 위험은 바꾸지 않고 WSL 전용 합성 QA 결선만 추가한다.

## 확인된 구조와 구현 방향

1. 기존 F-18 Compose와 운영 이미지의 HTTP 경로는 역사 검증에 사용되므로 그대로 유지한다. 정식 OIDC QA는 별도의 WSL 전용 Compose overlay와 Nginx 설정을 사용한다. 실제 `docker compose config` 출력에서 HTTP publish가 제거되고, HTTPS ingress만 WSL loopback에 게시되는지 검사한다. Compose tag/merge 지원 여부는 WSL-server 설치 버전의 실제 config 실행으로 판정한다.
2. Web은 `internal`+`ingress`, API·Worker·PG18·MinIO는 `internal`만 유지한다. QA issuer는 `internal` 전용 서비스로 둔다. issuer 자체의 host port·외부 egress·공개 DNS는 허용하지 않는다. Web의 HTTPS same-origin `/realms/anvil/` 경로가 내부 issuer로 프록시하고, `/api/`·`/auth/`는 기존 API로 프록시한다. API는 내부 Docker DNS의 Web HTTPS host를 통해 issuer token endpoint에 도달한다. 인증 URL과 callback origin이 실제 사용한 HTTPS host와 일치해야 한다.
3. R42 `ANVIL_F18_OIDC_TRUST_FILE`은 WSL 전용 read-only 합성 trust JSON을 가리킨다. CA·client Secret은 각각 별도 read-only 파일이다. issuer 공개키는 pinned JWKS로 결박한다. 실제 Secret/키 원문은 Git·로그·WORK_STATUS에 남기지 않는다. 브라우저는 기존 Chrome 프로필·탭·계정을 사용하지 않고, 승인된 임시 격리 프로필에서만 시험한다.
4. QA issuer 구현은 `tests/` 또는 `deploy/wsl/` 아래 시험 전용 artifact로 한정하고 제품 API/Worker 이미지에 포함하지 않는다. issuer의 발급 code/token, 역할·scope·만료·서명 거부는 F-18 테스트 전용 합성 주체만 사용한다. 실제 공급자 인증이나 운영 credential로 합격 처리하지 않는다.
5. R43은 먼저 Compose/TLS/issuer/trust 결선의 fail-closed 정적·config 계약을 RED→GREEN으로 만들고, 실제 WSL-server 실행은 사전 inventory와 exact 자원 이름·수명·정리 방법을 WORK_STATUS에 기록한 뒤 수행한다. 사용 가능한 runtime 또는 신뢰 경계가 확인되지 않으면 fixture PASS를 정식 OIDC PASS로 승격하지 않고 원인을 기록한다.

## 실행 순서와 검증

R43A는 HTTPS ingress·OIDC Compose 결선의 정적·정규화 계약, R43B는 QA issuer executable/image·합성 trust 자료·실제 WSL-server OIDC/PG18/브라우저 검증으로 나눈다. 둘 다 동일 F-18 작업 branch 안의 순차 Task이며 R43A 완료만으로 R43 또는 F-18을 합격시키지 않는다.

R43A의 제품 exact4는 `deploy/wsl/compose.f18.oidc.yml`, `deploy/wsl/nginx-f18-oidc.conf`, `tests/deploy/test_f18_oidc_formal_host_contract.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. 기존 base Compose·Dockerfile·`deploy/local/nginx.conf`는 수정하지 않는다. 내부·브라우저의 공통 QA hostname은 `anvil-f18-qa.local`, Nginx listener/WSL loopback publish/Windows SSH tunnel 포트는 모두 8444로 고정해 issuer·console origin이 일치하게 한다. 합성 인증서 SAN도 이 이름을 사용한다. issuer 서비스의 실행 artifact는 R43B에서 별도 exact lease로 추가한다.

1. Main이 R43 WorkInstruction에 정확한 제품 파일 목록·검증 기준을 고정하고 canonical worker/write lease 및 두 fencing token을 새 epoch으로 발급한다. G-05가 PASS하기 전에는 Developer 제품 write를 시작하지 않는다.
2. 단일 `developer-primary`가 허가된 경로만 TDD로 수정한다. 거부 테스트에는 HTTP 재노출, 비-loopback port, issuer host publish/ingress 연결, trust 파일 누락, Secret의 environment 원문 주입, CA/JWKS mismatch, COOKIE fallback을 포함한다. 기존 HTTP F-18과 Web/API/Worker role-image 계약은 회귀 검증한다.
3. Main이 diff·보안 경계를 독립 검토하고 로컬 테스트/build·`docker compose config`를 확인한다. 정확한 제품 SHA push 후 WSL-server의 전용 checkout에서 image build/digest·PG18 migration head0019·HTTPS `/auth/*`/OIDC 허용·거부·same-origin 요청을 검증한다. Windows Chrome 검증은 임시 프로필/프로세스/산출물을 종료·제거하고 Network 증거를 남긴다.
4. 전용 checkout·Compose project·컨테이너·network·DB/role·합성 파일의 owner/label/realpath를 확인한 후 해당 자원만 정리하고 잔류 0을 증명한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, 다른 프로젝트의 Docker/DB와 전역 설정은 변경하지 않는다.

## 완료/미완료 판정

- R43 정식 PASS에는 동일 SHA와 Web/API/Worker image ID, HTTPS ingress 실측, 실제 issuer HTTPS code exchange, PG18 영속 효과, 실패 거부, Secret 비노출, 브라우저 same-origin 및 전용 자원 잔류 0이 모두 필요하다. 하나라도 미실행이면 R43/F-18은 PARTIAL이며 F-19는 차단 유지한다.
- R42 단위·합성 loopback PASS나 새 정적 계약 PASS는 위 runtime 증거를 대체하지 않는다. 롤백은 승인된 이전 Git SHA/동일 role image로 전용 Compose만 되돌리며 데이터 손실 가능 DB downgrade는 실행하지 않는다.
