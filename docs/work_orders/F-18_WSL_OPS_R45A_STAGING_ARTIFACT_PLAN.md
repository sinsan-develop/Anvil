# F-18 R45A WSL Test/Staging artifact 검증 계획

> 승인된 F-18 WorkInstruction의 첫 실제 검증 구간이다. 새 기능·요구사항·운영 배포가 아니다. 본 단계의 결과만으로 F-18을 인수하지 않는다.

## 기준·범위

- 시작 기준 `codex/f18-wsl-ops` checkpoint `dfdbdcb95be53ff15bec7224864f759982e83525`, canonical seq1669, worker/write lease=null, G-05 PASS. 이후 control QA checkpoint를 지정 `development` Git SSH alias에 push한 exact SHA만 검증 대상으로 쓴다.
- 설계 §49.11~49.12, 작업계획서 F-18, `F-18_WSL_OPS_WORK_INSTRUCTION.md`, AV-OPS-013/016/020/021, 테스트계획서 §10.7에 결박한다. 기존 R43D OIDC runtime PASS는 당시 SHA의 역사적 범위이며 R45A의 새로운 PG15/pgvector-PG18/manifest PASS가 아니다.
- Main 전용 read-only/QA worker lease epoch33만 발급하고 제품 write lease/scope는 비운다. 제품 문제 발견 시 실패 응답과 자원 정리를 기록한 뒤 별도 exact-path Developer 수정 지시로 전환한다.

## 자원 사전 계획

- 대상은 `ssh WSL-server`만. Windows local은 계획·기록·Git push용이고 로컬 `wsl.exe`, `ysna-server`, 공유 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, 다른 container/DB/network, 기존 Chrome/계정/OS 설정은 변경하지 않는다.
- 전용 clean detached Git checkout `/home/daon/anvil-f18-r45a-staging`, Git 밖 합성 material `/home/daon/anvil-f18-r45a-material`, Compose project `anvil-f18-r45a`를 사용한다. 두 경로 owner `daon`, symlink 불가. 합성 material의 Secret/키는 Git·보고서·로그에 원문을 남기지 않는다. 첫 epoch33에서 이미 생성한 checkout은 정확한 tag/HEAD/remote/clean/owner를 다시 확인한 뒤 epoch34에서 재사용하고, 재생성하거나 복사하지 않는다.
- Test/Staging 전용 PG15와 RC 전용 pgvector-PG18은 각각 독립 container/volume/role/schema를 사용한다. `local-postgres` 0.0.0.0:5432에는 접속·변경하지 않는다. 전용 Web만 WSL loopback `127.0.0.1:8444`에 publish하고 API/Worker/DB/object store는 host port 0, ingress/internal network 분리·최소 권한을 확인한다. 실제 `compose.f18.oidc.yml`·Nginx·QA issuer의 고정 8444 계약과 일치하며 새 포트 설정이나 서버 직접 patch를 도입하지 않는다. 이미지 4종(Web/API/Worker/OIDC QA)과 pgvector PG18 cache는 exact SHA/tag·image ID를 기록하고, 공유 cache image는 지우지 않는다. 필요 시 PG15/MinIO cache 사용 전 ID를 기록한다.
- Windows 브라우저가 필요한 단계가 되면 별도 사전 기록 후 임시 격리 Chrome profile과 `127.0.0.2:8444` SSH tunnel만 만든다. R45A 최초 artifact/DB 검증에서는 Windows 브라우저 자원 생성0이다.
- 수명은 R45A 한 차례. 생성 직전 exact 경로·project label·8444 port 부재, 공유 서비스 ID/status를 읽기 전용 확인한다. 종료 전 realpath/owner/HEAD/dirty, container/network/volume/image tag와 연결자를 확인하고 전용 Compose `down` 및 전용 경로·tag만 삭제한다. 게시된 annotated QA tag는 검증 이력으로 보존하며 강제 이동·삭제하지 않는다. 전용 볼륨은 백업/복원 증거가 저장된 뒤에만 정확히 제거한다. 공유 image/cache와 서비스는 보존하며 잔여0과 공유 ID/status 불변을 확인한다.

## 실행·판정

1. 지정 원격의 exact QA SHA를 검증하고 annotated QA tag `f18-wsl-r45a-qa`를 그 SHA에 게시한다. 2026-09-27 사전 확인에서 로컬·지정 원격 모두 이 tag가 부재했다. WSL-server는 승인 Git SSH URL에서 tag를 fetch해 clean detached checkout을 만든다. source `scp`·서버 직접 patch는 금지한다. tag/remote/HEAD/dirty negative preflight를 실행한다.
2. 동일 checkout의 Git archive에서 Web/API/Worker 및 격리 OIDC QA image를 빌드하고 `org.opencontainers.image.revision`·image ID·nonroot를 확인한다. Web/API/Worker 세 image ID를 `ReleaseManifest` subject와 Test/Staging evidence에 고정한다. lockfile, SBOM ref, config/provider revision, migration head `0019_oidc_sessions`의 실제 관측값을 결박한다.
3. 별도 PG15 일반 통합과 pgvector-PG18 RC를 각각 비관리자 role로 migration/schema·`CREATE EXTENSION vector`·version/query·핵심 API/Worker/OIDC HTTP+DB를 검증한다. PG15와 PG18 결과는 섞지 않는다. 현재 revision에서 필수 테스트가 실패하면 정확한 응답과 원인을 기록하고 PASS로 승격하지 않는다.
4. 합성 ephemeral Ed25519 키로 현재 subject를 서명하고 별도 전달한 public key fingerprint와 독립 관측값으로 F-16 preflight 및 F-18 promotion preflight를 실행한다. 이 키는 QA 전용이고 Production trust가 아니다. 다른 digest, tag, commit, dirty checkout, 다른 environment/approval hash와 누락 Web digest를 부작용 전에 거부해야 한다.
5. Test/Staging evidence manifest에 정확한 SHA·세 digest·DB image/version/extension/head·API/Worker/브라우저 여부·실행 명령/exit·미검증을 기록한다. `R45A_PASS`는 다음 R45B 격리 target에 동일 artifact를 사용해볼 수 있다는 뜻일 뿐 F-18 accepted가 아니다.

## 미검증·rollback

- R45B 동일 artifact 격리 target, backup/restore/rollback, OIDC issuer/nonce/CA negative 및 브라우저 사용자 로그인은 R45A에서 PASS로 주장하지 않는다. Production `NOT_EXECUTED`, F-19 blocked 유지.
- 테스트 실패 시 전용 자원을 정리하고 보고서를 남긴다. 데이터 손실 가능 migration downgrade는 실행하지 않는다. 코드 rollback은 이 브랜치의 검증된 이전 commit으로 정상 revert/재배포하며 `main`·공유 DB를 조작하지 않는다.
