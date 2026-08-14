# Anvil ysna-server 내부 전용 지속 운영 배포 설계

## 목적과 승인 경계

Anvil을 WSL에서 개발·통합 검증한 뒤 동일한 승인 Git commit을 `ysna-server`의 `~/deploy/anvil`에 지속 실행한다. 기능과 운영 안전성이 검증되기 전에는 외부 도메인에 공개하지 않는다. 신산님의 2026-08-14 지시에 따라 WSL 복구 후 개발·검증에는 WSL을 우선 사용하고, 지속 배포에서는 `ysna-server`와 `shared-db` PostgreSQL 18 컨테이너를 사용한다.

이 결정은 배포 위치와 DB 실행환경을 변경하지만 다음 권한을 포함하지 않는다.

- 기존 `shared-db`의 `postgres` 데이터베이스, 기존 role, 기존 schema 또는 데이터를 재사용·변경하는 권한
- 기존 운영 컨테이너, 네트워크, 볼륨, reverse proxy 또는 공개 도메인을 변경하는 권한
- `envil.sinsan.kr` 공개, 운영 Release 판정 또는 다른 서비스 중단 권한

## 선택한 접근

### 지속 실행 경로

- Git 승인 commit만 `~/deploy/anvil`에 checkout한다.
- 서버 직접 patch, `scp` 기반 소스 덮어쓰기, dirty checkout 실행을 금지한다.
- 배포 프로세스는 Docker Compose로 관리하고 컨테이너 이름, 네트워크, 포트에 `anvil` namespace를 사용한다.
- 최초 단계는 `127.0.0.1`에만 bind한다. 외부 reverse proxy와 공개 DNS는 연결하지 않는다.

### 데이터베이스 격리

- 기존 `shared-db` 컨테이너의 PostgreSQL 서버를 사용한다.
- 전용 database `anvil`과 전용 login role을 새로 생성한다.
- 전용 role은 `anvil` database에 필요한 최소 권한만 가진다. superuser, replication, role creation, 다른 database connect 권한은 부여하지 않는다.
- migration은 승인된 Alembic revision만 전용 database에 적용한다.
- 기본 `postgres` database와 다른 서비스의 database/schema에는 migration이나 application query를 실행하지 않는다.
- credential은 서버 전용 환경 파일에 저장하고 파일 권한을 `0600`으로 제한한다. Git, 로그, 화면, API 응답과 EvidenceManifest에는 평문 secret을 기록하지 않는다.

## 배포 흐름

1. WSL에서 승인 commit의 migration·API·화면·same-origin·보안·rollback을 격리 DB로 검증하고 EvidenceManifest를 고정한다.
2. `ysna-server`의 hostname, Git, Docker, 디스크, 기존 컨테이너·네트워크·포트, `shared-db` 상태를 읽기 전용으로 기록한다.
3. WSL에서 합격한 것과 동일한 full Git SHA인지 확인하고 `~/deploy/anvil`에 checkout한다.
4. 전용 DB·role 존재 여부를 확인한다. 없을 때만 생성하고, 이미 있으면 owner와 privilege가 설계와 일치하는지 검증한다.
5. migration 전 현재 revision과 rollback 가능성을 기록한 뒤 `upgrade`를 수행한다.
6. Anvil 서비스는 localhost-only 포트로 시작한다.
7. health, migration head, same-origin API, 인증 전 접근 거부, Host/Origin/CSRF, secret 비노출을 실제 요청으로 확인한다.
8. 상태와 실패 사유는 운영자가 화면과 API에서 확인할 수 있어야 한다. CLI 결과만으로 운영 완료를 선언하지 않는다.
9. 검증이 끝나도 공개 proxy 연결은 하지 않는다. 공개는 별도 설계·검증·승인을 거친다.

## 실패 처리와 rollback

- migration 실패 시 서비스를 공개하거나 정상 상태로 표시하지 않는다.
- application 시작 실패 시 새 컨테이너만 중지하고 기존 운영 컨테이너는 건드리지 않는다.
- rollback은 이전 승인 Git commit checkout과 검증된 migration downgrade 또는 forward-fix 중 사전에 선택된 절차만 사용한다.
- 데이터 삭제, database drop, role drop은 자동 rollback에 포함하지 않는다.
- `shared-db` 자체 restart, image 교체, volume 변경은 금지한다.

## 보안·운영 검증

- 비밀정보 hard-code 및 Git 추적 0건
- browser에서 localhost, Docker hostname, 내부 DB 주소 직접 호출 0건
- state-changing API의 인증·권한·CSRF 검증
- Host·Origin allowlist와 CORS deny-by-default
- 오류 응답의 stack trace·credential·connection string 노출 0건
- localhost-only listener와 기존 포트 충돌 0건
- 기존 운영 컨테이너·네트워크·DB 객체의 예상 밖 변경 0건
- 배포 전후 Git HEAD, container inventory, DB object/privilege, health evidence 기록

## 완료와 공개의 구분

`~/deploy/anvil`의 localhost-only 지속 실행과 전용 DB 검증은 내부 운영 배포 완료 조건이다. 이는 `envil.sinsan.kr` 공개, Production Release, 사용자 트래픽 허용을 의미하지 않는다. 외부 공개는 전체 기능·보안·rollback 검증과 별도 신산님 승인을 요구한다.
