# F-17 WorkInstruction — WSL 실제 기능·격리 PostgreSQL 18 RC

## 기준·목적

- 승인된 `Anvil_작업계획서_v1.md` F-17, `Anvil_설계서_v2.md` §49.11~49.12, `Anvil_통합검증매트릭스_v1.md` AV-OPS-015/025 및 `Anvil_테스트계획서_v1.md` §10.7의 범위다. 기준 main `3460d9768b039568022fd43e24577cc0e2402dea`, 유일한 branch `codex/f17-wsl-pg18-rc`.
- F-16 PR #32 exact merge의 Git/image 계보를 사용해 WSL-server에서 PG15 일반 통합과 별도 격리 PG18 RC를 비교한다. 동일한 지원 기능 E2E 시나리오를 두 환경에서 실행하고 migration·extension·query·backup/restore·rollback rehearsal 및 target-bound ProductValidation을 서로 다른 증거로 남긴다.
- F-14의 이전 Git SHA·PG15/18 실측은 회귀 설계 근거이지 F-17 exact source/image의 PASS 증거가 아니다. C-15 `tests/e2e/test_synthetic_e2e.py`는 합성 계약이며 실제 WSL·브라우저·DB·ProductValidation PASS로 승격하지 않는다.
- 현재 `ProductValidation` 공개 API는 registry에 선언돼 있어도 runtime port 미결선으로 501 경계다. F-17은 실제 결선된 project/task/run/events API와 DB 관측값을 동일 target hash의 criterion별 ProductValidation 검증 기록에 결박한다. 이것은 ProductValidation API·DB 지속화 PASS가 아니며 그 서비스의 신규 구현은 U-05 등 소유 Package를 앞당기는 범위 확장이다.

## 안전 경계

- WSL-server에는 `ssh WSL-server`로만 접근한다. Docker·PG15/18·브라우저·restart 검증은 WSL-server에서 실행하고 F-17 전용 임시 container/image/checkouts/profile/DB/role/credential을 완료 후 정확히 제거한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`의 기존 DB/role/설정·network/firewall와 타 프로젝트 자원은 변경하지 않는다.
- 기존 `local-postgres`는 0.0.0.0:5432로 노출돼 있다. PG15 일반 통합은 Anvil 전용 임시 DB·비-superuser app role과 WSL host loopback 또는 SSH tunnel 경계에서만 수행한다. 기존 전역 bind·pg_hba·방화벽을 완화하거나 다른 DB를 읽고 쓰지 않는다. 생성 전 DB/role 이름·소유·접속 방법·정리 방법을 Main이 기록한다.
- PG18은 `pgvector/pgvector:0.8.2-pg18` 등 정확한 image ID를 고정한 전용 container, tmpfs PGDATA, 단일 loopback 포트·전용 label·볼륨 0으로 격리한다. `local-postgres`와 데이터·role·network를 공유하지 않는다. 유자료 `0016` downgrade는 기존 차단 계약대로 거부되며 데이터 손실 rollback을 자동 수행하지 않는다.
- Git exact published commit/tag만 clean detached checkout한다. 서버 source 복사/patch, 기존 C-01/C-21 fixed-SHA 배포 스크립트 재사용, 운영 ysna/Oracle 배포, 실 Provider key·요청, 실제 사용자 인수는 제외한다. 키 오류를 무시하라는 지시는 Provider 인가 실패에 한정하며 서명·Git·DB 안전 검증 실패에는 적용하지 않는다.

## 제품 write lease 상한

- `deploy/wsl/f17_validation.py`, `deploy/wsl/compose.f17.yml`
- `tests/deploy/test_f17_validation.py`, `tests/integration/test_f17_runtime_e2e.py`
- `docs/04_test_reports/F-17_COMPLETION_REPORT.md`

Developer는 실행 전 위 경로만 대상으로 TDD RED→GREEN을 수행한다. F-14 opt-in 테스트를 재사용하되 기존 테스트의 격리 guard를 약화하거나 shared PG15에 그대로 실행하지 않는다. 경로 추가가 필요하면 mutation 전 Main에 정확한 이유를 전달하고, Main은 계획 범위 내부의 비의미 배치만 revision/hash/lease를 갱신한다.

## 필수 검증과 판정

1. 격리·Git·manifest·DB role·cleanup·유자료 rollback 차단을 단위/통합 테스트로 검증한다. 제품 정적 검사나 합성 E2E를 실제 환경 PASS로 주장하지 않는다.
2. Main은 exact published F-17 checkout에서 두 환경의 동일한, 현재 실제 결선된 project/task/run/events 핵심 E2E·health·restart를 실행한다. 합성 전용 세션의 owner/scope/CSRF/fencing을 확인하고 실제 HTTP와 DB 행을 대조한다. PG15 shared service의 새 전용 DB와 PG18 격리 instance를 명확히 구분하고, PG18 migration0016·vector version·query·version-matched dump/restore·6계보·rollback denial을 실측한다.
3. 동일 Git/image/migration/target hash, 환경별 DB version·extension·결과·blocking defect를 `F-17_RC_EVIDENCE_MANIFEST.json` 및 WSL 테스트 보고서에 고정한다. ProductValidation은 실제 관측 결과에서 생성하며 사용자 최종 ReleaseDecision으로 승격하지 않는다.
4. 브라우저 1920/390, same-origin Network, 비밀·내부주소 직접 노출 0건과 기존 정상 기능 유지 여부를 확인한다. 실행하지 못한 항목은 `NOT_EXECUTED`로 남긴다.
5. Main의 독립 검토·G-05, commit/push→PR Broker→main 병합→merged-main smoke→branch/worktree 정리 후에만 F-18 branch를 만든다.

완료보고는 판정→판단 이유→조치 순서이며 시작 HEAD/status, 실제 diff, 정확한 명령/exit, F-14 이전 증거와 F-17 새 증거의 분리, 미검증 범위, cleanup 잔류, rollback을 포함한다.
