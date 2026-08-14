# APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001

- approver: `신산님`
- approval_recorded_at: `2026-08-14T23:58:00+09:00`
- approval_mode: `AUTHENTICATED_HUMAN_DIRECTION`
- owner_direction: `WSL에서 개발·통합 검증 후 동일 승인 Git commit을 ssh ysna-server의 ~/deploy/anvil에 localhost-only로 지속 실행하고 existing shared-db 안의 Anvil 전용 DB·role만 사용한다.`
- baseline_git_commit: `1519d8cce5e205bd9e20652cc380e65e9ca01e49`
- design_spec: `docs/superpowers/specs/2026-08-14-ysna-internal-production-deployment.md`
- design_spec_sha256: `862765B3F637C3AE451A5EAD3A2E61962430B6C7F2A282B63A2C015C04611C99`
- implementation_plan: `docs/superpowers/plans/2026-08-14-ysna-internal-production-deployment.md`
- implementation_plan_sha256: `B50B1DA49DAD346E67C745F0D4DCFB30DCEAEDA3A5D27A731B39C776FB51562D`
- affected_package: `B-04 start runtime-boundary rebind only`
- classification: `B-04 기능 목적·요구사항 불변; 배포 위치·DB 실행환경의 중요 운영 위험 변경은 본 human direction으로 명시 승인`

## 승인된 경계

- 개발·통합·migration·rollback·same-origin·보안 검증은 WSL에서 먼저 수행한다.
- WSL 합격과 동일한 full 40-character Git SHA만 `ssh ysna-server`의 `~/deploy/anvil`에 배포할 수 있다.
- 기존 `shared-db` PostgreSQL 18 서버 안에 전용 database `anvil`과 최소권한 전용 roles만 새로 사용한다.
- Web 최초 노출은 `127.0.0.1:4173` localhost-only다.
- Git 승인 commit checkout만 허용하며 server-local patch와 `scp` source overwrite를 금지한다.
- runtime secret은 server-only mode `0600` 파일에 두고 Git·로그·API·화면·EvidenceManifest에 기록하지 않는다.

## 금지 경계

- 기존 `shared-db` restart·recreate·image·volume 변경
- 기존 database·role·schema·data에 대한 migration 또는 application query
- 기존 컨테이너·네트워크·볼륨·reverse proxy·공개 DNS 변경
- `envil.sinsan.kr` 공개, 외부 트래픽 허용, Production Release 판정
- WSL 검증과 다른 commit/digest의 ysna 승격
- B-04 제품 구현 전 Main projection 단계의 원격·DB·배포 mutation

## B-04 재결박 판정

기존 B-04의 planning artifact·approval hash 계약 목적과 exact15 제품 allowlist는 바뀌지 않는다. 기준 commit과 runtime evidence 경계만 이 승인 및 최신 배포 설계·계획에 재결박한다. B-04 Developer는 WSL 격리 검증을 수행할 수 있으나 ysna 지속 배포 구현과 실제 배포는 별도 계획 단계 전에는 수행하지 않는다.
