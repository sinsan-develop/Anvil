# F-16 WorkInstruction — Git-only WSL Test/Staging와 서명 ReleaseManifest

## 정본·목적

- 승인된 `Anvil_작업계획서_v1.md` F-16, `Anvil_설계서_v2.md` §49.11~49.12 및 검증 ID AV-OPS-013/015/021만 수행한다. 기준 main `f2b124a4c8dfdcf15a61261912aab93728fc757c`, 유일한 작업 branch `codex/f16-wsl-staging-release-manifest`.
- Local 개발 산출물의 정확한 원격 Git commit/tag만 WSL-server(hostname SINSAN)에서 받아 별도 Test/Staging 격리 자원으로 배포하고, 실제 image digest·migration·config·evidence를 서명된 ReleaseManifest와 결박한다.
- 기존 `/srv/anvil-wsl/repo`의 root-owned detached checkout `a681e0c...`, 실행 중인 `anvil-web` revision `bb2ff437...`, 기존 `local-postgres`와 타 프로젝트 자원은 takeover 대상이 아니다. F-16은 /srv/anvil-wsl 아래 F16 전용 임시 경로/Compose project/DB role·database만 사용하고 검증 종료 후 정확히 정리한다. 정식 자원의 생성 전 이름·소유·수명·정리 방법을 WORK_STATUS에 남긴다.
- 운영 Oracle/ysna, F-17 PostgreSQL 18 RC, Provider 실호출, Telegram, 사용자 인수·최종 Release는 범위 밖이다. 0016 migration/health를 F-16에서 실측하되 AV-OPS-015의 전체 핵심 E2E·rollback 최종 합격은 F-17까지 별도다.

## 구조 판단

- 기존 `deploy/wsl/deploy.sh`, `candidate-manifest-guard.sh`, `FormalSingleRuntimeManifest.json`은 C-21/C-01 고정 SHA·환경·allowlist의 역사 계약으로 보존한다. F-16 제품은 새 파일에 작은 manifest 검증과 Git-only preflight를 둔다.
- `ReleaseManifest` subject는 `source_git_remote`, `source_commit`, `release_tag`, Web/API/Worker image digest, lockfile hash, SBOM ref, db migration head, config schema revision, provider adapter versions, evidence manifest hash, verification report hash를 필수로 가진다. canonical JSON SHA-256과 detached Ed25519 signature를 검증하며 공개키 fingerprint는 별도 신뢰 입력에 결박한다. 서명 불일치·필수 필드 누락·source/image/lock/migration 불일치는 실행 전 차단한다.
- 개발 단계 서명 테스트는 합성 일회성 staging 키만 사용한다. private key는 Git/문서/명령 출력에 기록하지 않고 보호된 임시 위치에 두며 검증 후 삭제한다. 이 키는 Production 신뢰키가 아니고 F-18의 인증·Secret 정책을 선결정하지 않는다.
- 서버 checkout은 SSH alias로 승인 개발 원격의 정확한 SHA를 fetch하고 clean detached만 허용한다. dirty worktree, server-local patch, 다른 remote/ref, source `scp`/archive 주입을 fail closed로 거부한다. public staging 도메인은 만들지 않고 loopback 또는 승인된 SSH tunnel만 사용한다.

## 제품 write lease 상한

- `packages/deployment/__init__.py`, `packages/deployment/release_manifest.py`
- `deploy/wsl/f16_staging.py`, `deploy/wsl/compose.f16.yml`
- `tests/deploy/test_f16_release_manifest.py`, `tests/deploy/test_f16_staging_git.py`, `tests/deploy/test_f16_staging_compose.py`
- `docs/04_test_reports/F-16_COMPLETION_REPORT.md`

경로 추가가 필요하면 mutation 전에 Main에 정확한 경로·이유를 보고한다. Main은 기능·요구사항·중요 위험이 바뀌지 않는 내부 배치만 revision/hash/lease로 재결박한다. 기존 C-21/C-01 배포 파일이나 운영 서버 파일을 수정하지 않는다.

## TDD 실행 계획

1. Manifest 단위: 유효한 synthetic Ed25519 detached signature를 검증하고 필드·canonical hash·공개키 fingerprint·image/lock/migration binding을 확인한다. 위조 signature/다른 공개키/누락·변조 subject는 실제 배포 이전에 실패하는 테스트를 먼저 작성하고 RED→GREEN으로 구현한다.
2. Git preflight 단위: disposable Git 저장소/원격 fixture에서 정확한 원격 SHA+clean detached만 허용하고 dirty, local patch, 잘못된 remote, 미게시 commit, branch 이동, source 파일 복사 유입을 각기 거부한다. 기존 배포 스크립트를 호출하지 않는다.
3. Compose·staging 경계: Web loopback 8300, API/Worker 내부 전용, same-origin reverse proxy, secrets env-only, PG15 전용 DB/role, 0016 head와 health, rollback 준비·정리 경계를 검증한다. 정적 검증은 실제 Docker/브라우저/DB PASS로 승격하지 않는다.
4. Main은 제품 checkpoint를 독립 검토하고 Git exact SHA를 WSL-server에서 fetch하여 F-16 전용 자원으로 migration/health·서명/manifest·공격적 Git preflight·browser Network·정리 잔류를 실측한다. shared `local-postgres`의 기존 전역 바인딩은 해결된 것으로 주장하지 않는다. 외부 DB 접근은 SSH tunnel/IP 제한 경계를 증명하기 전 허용하지 않는다.

## 완료보고

- 판정→근거→조치. 기준 문서 hash, 시작 branch/HEAD/status, 실제 변경 diff, exact 명령/exit/결과, 실패 횟수, browser/API/DB/Git/image/signature 증거, 미실행 범위, rollback과 정리 잔류를 기록한다.
- PR은 필수 검증 뒤 기존 `development` SSH alias와 PR Broker request tag로만 생성한다. Main이 병합·merged-main smoke·branch/worktree 정리까지 소유한다. 후속 F-17 branch는 그 후에만 만든다.
