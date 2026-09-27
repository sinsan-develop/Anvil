# F-18 R45A WSL-server Test/Staging artifact 보고서

## 시작 판정

`NOT_STARTED`. R44 checkpoint `dfdbdcb95be53ff15bec7224864f759982e83525`, canonical seq1669, lease=null, G-05 PASS. R45A는 현재 Git revision의 Web/API/Worker 세 digest와 PG15 일반·pgvector-PG18 RC·signed manifest를 WSL-server 전용 자원에서 실측한다. R43D runtime 결과는 이전 SHA의 역사적 증거다.

## 사전 자원·보존 경계

전용 checkout `/home/daon/anvil-f18-r45a-staging`, material `/home/daon/anvil-f18-r45a-material`, Compose `anvil-f18-r45a`. 공유 `anvil-web`/`local-postgres`/기타 project와 cached pgvector image는 보존한다. epoch33 사전 inventory는 checkout/material 부재, project container/network/volume 0, 8454 free, 공유 Web ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy와 PG ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running, pgvector-PG18 cache ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`였다. 첫 inventory 명령은 `local-postgres`에 Health map이 없는 것을 Docker template이 참조해 exit1; Health 없는 컨테이너의 Status만 읽도록 관측 명령을 한 곳 수정해 재실행 exit0/`R45A_COLLISION_FREE`. 제품/자원 실패가 아닌 Main QA 명령 오류 1회다.

QA tag `f18-wsl-r45a-qa` annotated object `973ac0ba719b076e91b279222abb6a48bc93960e`, peeled source SHA `d36de847842804ca93e405abe9bff687c1162a69`을 지정 원격에 게시·재확인했다. WSL-server `/home/daon/anvil-f18-r45a-staging`은 승인 SSH remote에서 exact tag로 clean detached 생성, owner `daon`, HEAD exact 확인; F-16 `verify_exact_checkout` 실제 호출 `F16_EXACT_CHECKOUT_PASS`/exit0. material·container·DB·Secret·브라우저는 생성0이다. PostgreSQL 15, MinIO, pgvector-PG18 cached image는 읽기 전용 ID만 관측했다.

실행 전 Compose source audit에서 최초 계획의 `8454`가 `compose.f18.oidc.yml`·Nginx·QA issuer의 고정 `8444`와 충돌함을 확인했다. Main 계획 오류 1회이며 임의 포트 우회나 서버 직접 patch 없이 내부 구현 방법을 8444로 비의미 수정하고 epoch33 worker를 회수→epoch34 새 WI hash/lease로 재결박한다. 위 Git checkout/tag는 exact 검증 후 같은 검증에 재사용한다. epoch34 G-05 PASS 전 image/DB/Secret/Compose 생성 금지. tag는 불변 검증 이력으로 보존한다.

## 결과·미검증

### epoch34 실제 R45A QA (2026-09-27)

- 지정 원격 `codex/f18-wsl-ops@5b92100d7342587f1f471f65d447244c5be127ca`, canonical seq1674, Main worker-only epoch34, write lease=null에서 실행했다. 제품 소스는 annotated tag `f18-wsl-r45a-qa`의 peeled commit `d36de847842804ca93e405abe9bff687c1162a69`이며 WSL-server checkout은 clean detached였다. tag는 재지정하지 않았다.
- exact Git archive image ID/revision: Web `sha256:3775418117136cb81d1ebc100daca9268be4fb66e1d5b79051f4353334d371ff`(UID101), API `sha256:a25c5678e155bb65eb57329b8dcaa82a399e0e3a2e718edfd4ad1b70b6a743c0`(UID10001), Worker `sha256:19827fae9441b8078ea7a4edae157bd305cdaa1d8fc89c880f136bce074d71db`(UID10001), 격리 issuer `sha256:40469c5e8dda2660f25f057e0594fd1e510cea39d184c0855ed16ef2a2d5db5d`(UID10001). 세 제품 image digest는 signed QA manifest에 정확히 결박했다.
- 전용 PG15 15.18/vector0.8.2는 host publish 0, 별도 internal network, 비관리자 `anvil_app` 소유 public 61 tables/Alembic `0019_oidc_sessions`, vector 차원3·거리1 쿼리 PASS. 별도 pgvector PG18 RC 18.4/vector0.8.2도 같은 비관리자·61 tables/head0019/쿼리 PASS 후 해당 전용 container/network만 제거해 잔여0을 확인했다. Compose PG18 18.4는 동일 head0019 및 합성 OIDC directory 각 1행을 확인했다. 기존 `local-postgres`에는 접속·변경하지 않았다.
- 실제 6-service Compose의 Web은 `127.0.0.1:8444`만 publish, API/Worker/DB/MinIO/issuer는 host publish 0이었다. Web `nginx -t` PASS, 합성 CA 검증 HTTPS `/`·`/api/health/ready`·issuer JWKS 각 200, API/Worker ready/head0019. HTTPS OIDC authorization 200→issuer 302→callback 200/Secure·HttpOnly cookie→session 200/authenticated→code replay 401. 비신뢰 내부 peer의 forwarded-header 위조는 403, OS trust에 없는 QA CA에 대한 curl은 exit60이었다. 실제 사용자 Chrome 로그인 동선은 이번 R45A에서 실행하지 않았다.
- F-16 CLI를 WSL checkout에서 실행한 결과 `F16_PREFLIGHT_PASS`, manifest subject hash `sha256:9ea0623f6b1426b457ed6b5d8eae773685a8c44aca219971acc2b98764849f40`, 세 image ID 일치, exit0. 같은 SHA의 F-16 테스트 42 PASS/exit0, 전용 pytest temp 잔여0. QA Ed25519 public fingerprint `sha256:70d55d4f7e794c338a4c2bc78f6e37abb51c0e03a43d189e3ae80791d2cfd807`이며 운영/인수 신뢰 키가 아니다.
- F-18 `validate_existing_checkout`의 QA 입력 결과: positive `READY_FOR_PRIVATE_REHEARSAL`, Web digest 변경 `DEPLOY_ARTIFACT_MISMATCH`, Web digest 누락 `WEB_IMAGE_NOT_VERIFIED`, commit 변경 `DEPLOY_ARTIFACT_MISMATCH`, environment 변경 `DEPLOY_APPROVAL_SUBJECT_MISMATCH`, 잘못된 checkout `GIT_CHECKOUT_NOT_VERIFIED` 모두 예상대로 반환(exit0). positive는 합성 `DeployApprovalSubject`와 QA 키로 본 검증기 동작일 뿐 신산님 실제 승인·Production 전환 근거가 아니다.
- QA 산출물: manifest envelope `sha256:5bb2c3a480c9029e99c2f90b45655358fdb03b34aa1ce828fa0fafb4b7fe5ffd`, application-only SBOM `sha256:93c7451dcf759ce67a2f44cdf94ddb58379576a7b50f7eb8399ef0a41a662b0d`, config revision `sha256:f38199ecfba3c763a9e71426424206b720053b1db5dd9c41f0b05efbc3797c3c`, evidence `sha256:ce7e007ad537348ffd4929f7e8f0ae86bd589634fab8eb15009c9c759a56d8eb`, verification `sha256:35efd87c93005a7c947448398a340ea8eb2f2523f71cfda2db4926a1572d0926`. provider adapter version은 각 adapter Git blob hash 유래의 QA 식별자이며 독립 공급망/OS SBOM 검증으로 승격하지 않는다.
- Main QA harness/input 오류: PG Docker Health 필드 관측, 최초 계획 8454 대 고정 8444, `client-secret` 후행 newline, 합성 identity의 `chat:user` 누락, tracked Nginx nonsecret 파일의 checkout mode600, seed 스크립트 import 순서, 초기 proxy placeholder의 OIDC 403, Docker format CLI 인용 오류를 각각 원인 확인·전용 QA 입력/권한/명령만 보정 후 재검증했다. 제품 소스·공유 자원 변경은 없고 정식 Developer `FAILURE_REPORT`는 0회다. 첫 실패들을 PASS로 지우지 않는다.

### 완료 경계·다음

R45A artifact/DB/OIDC/preflight 범위는 실측했지만, 위 SBOM과 서명은 QA 전용이다. R45B 동일 세 image ID의 격리 target·독립 capability evidence, backup/restore/rollback, issuer/nonce/CA negative, 실제 브라우저 로그인 및 전체 non-green 회귀는 미검증이다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`.

### 전용 자원 정리 판정

정리 직전 checkout/material의 realpath가 각각 정확한 `/home/daon/anvil-f18-r45a-staging`·`/home/daon/anvil-f18-r45a-material`, owner UID1000, root symlink0, 내부 symlink0, Git clean/detached exact `d36de847842804ca93e405abe9bff687c1162a69`임을 확인했다. Compose 6개 container ID·project label, 별도 PG15 ID `c132d1f420ff8b52fc8bed288708002a410fd18f4843888d6015ebd167499821`, 세 network ID/연결자, project volume0, 전용 image tag 4개의 단일 RepoTag/revision을 모두 기대값과 일치시켰다. `docker compose ... down --remove-orphans` → 해당 PG15 container/network → 해당 image tag 4개 → 해당 두 경로 순으로 제거했다(전체 명령 exit0). 전용 path/container/network/volume/image tag 및 8444 listener 잔여0을 읽기 전용 재확인했다. 공유 Web ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy, 공유 PG ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변이며 cached pgvector/MinIO image는 보존했다. 합성 키·credential·DB 내용은 정리와 함께 제거되어 복구되지 않는다. QA tag는 게시된 불변 source 이력으로 남는다.

동일 artifact R45B는 세 image ID를 재확인해야 하며 단순 동일 Git commit의 재빌드만으로 ID 일치를 추정하지 않는다. ID가 달라지면 기존 signed QA manifest를 재사용하지 않고 fail-closed로 새 artifact 절차를 밟는다. R45A 단계의 정확한 rollback은 공유 자원 변경 없이 전용 QA 자원을 종료한 현재 상태다.
