# F-18 WorkInstruction — WSL-server 격리 운영 유사 target

## 기준·판정 경계

- 기준 main `69247977e4e51781401e45348fd3a290d8393c36`, 유일한 작업 branch `codex/f18-wsl-ops`. 신산님 2026-09-25 직접 범위 변경과 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, 설계서 v2.8 §49.11~49.13, 작업계획서 v1.7 F-18, 매트릭스 AV-OPS-013/016/020/021 및 테스트계획서 §10.7에 결박한다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`.
- F-17의 역사적 PASS는 `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`와 당시 image의 증거다. 이번 F-18에 사용할 현재 Git revision·Web/API/Worker 세 digest의 Test/Staging 검증을 다시 수행하고, 그 **동일 commit·digest**만 격리 target에 사용할 수 있다. 과거 image ID, 합성 서명, 순수 함수 PASS를 현재 runtime 증거로 재사용하지 않는다.
- `ysna-server`, `shared-db`, `envil.sinsan.kr`, 공개 도메인, Production DeployApproval·Release·`RELEASED`는 작업 대상이 아니다. F-18 WSL 합격 후에도 Production은 `NOT_EXECUTED`, ReleaseDecision은 `DEFER`다. F-19는 F-18 인수 전 착수하지 않는다.

## 역할·실행 순서

Main은 WorkInstruction·canonical worker/write lease와 fencing token을 발급·검증하고, 단일 writer에게 명시된 제품 경로만 위임한다. 이전 lease는 모두 `None`이며 재사용하지 않는다. Main takeover를 수행하더라도 동일한 유효 token 두 개와 exact path scope가 필요하다. 단계 중 필요한 경로 변경은 제품 mutation 전에 Main이 revision/hash·lease를 재결박한다.

1. **동일 artifact 기준선:** 로컬에서 F-16 서명 ReleaseManifest의 신뢰 입력·source Git/tag·lockfile/SBOM·migration/config/provider revision과 F-17 E2E를 확인한다. 변경을 안전한 commit으로 push하고 WSL-server가 승인 Git SSH alias에서 clean detached exact commit을 받는다. WSL Test/Staging에서 Web/API/Worker image digest 각각을 실제 image ID로 고정하고 PG15 일반 통합·격리 PG18 RC의 현재 revision 핵심 HTTP+DB E2E를 실행한다. 세 digest 또는 Git revision이 다르면 `DEPLOY_ARTIFACT_MISMATCH`, Web digest가 없으면 `WEB_IMAGE_NOT_VERIFIED`로 중단한다.
2. **운영 유사 adapter:** 기존 F-16 `verify_exact_checkout`, `verify_release_manifest`와 F-18 `validate_existing_checkout`·`DeployApprovalSubject`를 재사용한다. WSL target의 environment ID, 서명된 manifest envelope hash, migration plan hash, rollback plan hash를 실행 전 결박한다. 다른 remote/tag, dirty/attached checkout, stale approval, 다른 digest, 누락 capability는 배포 부작용 전에 거부한다. 기존 `deploy/ysna`와 C-21 고정-SHA 스크립트는 수정·실행하지 않는다.
3. **인증·저장소·network capability:** QA 전용 OIDC issuer 또는 설계서가 허용한 동등한 인증으로 issuer/audience/서명·만료·역할·승인 scope의 허용/거부를 실제 API에서 확인한다. `LocalTestSessionService`만으로 이 항목을 PASS 처리하지 않는다. F-17의 Web-only `/auth/session` 405는 QA 게이트웨이만의 PASS로 숨기지 않고, 운영 유사 target의 제품 ingress에서 `/auth/*` same-origin 라우팅을 실제 확인한다. `ArtifactStore`의 object-storage adapter를 WSL 전용 MinIO 등 격리 서비스에 연결해 content hash, immutable read, collision, 권한 거부, credential 미노출을 확인한다. Web은 ingress-only, API/Worker/PG18/object storage는 지정 내부 network와 최소 권한이며 외부 egress·host bind·container capability를 관측한다. 실제 Secret 값은 Git·문서·로그에 기록하지 않는다.
4. **비공개 rehearsal:** WSL-server의 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, 타 프로젝트 container/DB/network는 보존한다. 새 전용 Git checkout `/srv/anvil-wsl/f18-ops-rehearsal` 및 Compose project `anvil-f18-wsl-ops`, 전용 PG18 DB/role, 합성·익명화 entity와 전용 credential만 사용한다. 생성 전 exact 이름·owner·image·포트·수명·정리 명령을 `docs/WORK_STATUS.md`에 기록하고 read-only inventory와 충돌을 재확인한다. 현재 inventory에서는 target 경로·8310/8311/32770/8444 포트가 비어 있었으나 실행 직전 재확인한다. 실제 생성·배포는 로컬 push→WSL Git fetch/checkout 이후에만 한다.
5. **실제 증거:** Test/Staging과 운영 유사 target에서 동일 핵심 API/E2E를 실행하고, 두 환경의 Git commit·Web/API/Worker digest·migration head·DB version/role·OIDC·object store·network·same-origin 브라우저 요청을 각각 target-bound EvidenceManifest로 비교한다. PG18 backup/restore와 가역 code/container rollback을 별도 격리 데이터로 rehearsal한다. 데이터 손실 가능 migration downgrade는 자동 실행하지 않고 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단한다. 실패·중단에도 다른 자원을 건드리지 않고 전용 자원만 exact 경로·label·ID 검사 뒤 정리해 잔류 0을 증명한다.

## 제품 write lease 상한과 기본 검증

- 개발 후보 경로: `packages/deployment/`의 기존 preflight 관련 파일과 새 WSL adapter, `packages/api/`의 운영 유사 인증 연결, `packages/artifacts/`의 object storage adapter, `deploy/wsl/`의 F-18 전용 Compose/검증 스크립트, 이 기능의 `tests/deploy/`, `tests/api/`, `tests/artifacts/`, `tests/integration/`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 실제 write lease는 Task별 **exact 파일 목록**으로 더 좁혀 발급한다. 이 상한 자체가 포괄적 쓰기권은 아니다.
- 각 기능은 거부 사례를 먼저 테스트해 RED를 관측하고 최소 구현 뒤 GREEN으로 만든다. 서명·OIDC·object store·network·DB·rollback 각각 독립적으로 fail-closed 테스트를 포함한다. 로컬에서 관련 단위·통합, 타입/정적·build와 diff를 확인하고 게시된 같은 code SHA를 WSL-server에서 다시 검증한다. fixture PASS는 WSL 실제 기능 PASS가 아니다.
- Main은 코드·diff·runtime/evidence/cleanup을 독립 검토해 Critical/Important 0과 G-05 통과를 확인한다. 계획상 필수 검증에 SKIP·미해결 항목이 있으면 F-18은 `PARTIAL`이고 F-19는 계속 `BLOCKED_PENDING_F18_ACCEPTANCE`다. 모두 충족된 뒤에만 PR Broker로 병합하고 merged-main smoke 및 작업 branch 삭제를 수행한다.

## 시작 상태·복구

- 시작 main/branch는 위 SHA, branch 생성 직전 격리 checkout은 clean이었다. 2026-09-25 WSL read-only inventory: `/srv/anvil-wsl/repo`는 기존 별도 checkout `a681e0c0a97bdb67956a0a50aa208bd38982a545`로 clean, `anvil-web`은 healthy, `local-postgres`는 Up; 새 `/srv/anvil-wsl/f18-ops-rehearsal` 부재. 이 값들은 실행 시 다시 측정한다. Git safe.directory는 명령별 read-only 옵션만 사용했고 전역 설정을 변경하지 않았다.
- 실패 시 작업 branch의 마지막 게시 commit을 복구 ref로 둔다. 새 전용 자원은 소유·경로·label·ID 검증 후에만 제거하며 기존 서비스/DB/전역 설정을 rollback 대상으로 삼지 않는다. 삭제한 synthetic credential/tmpfs 자료는 복구하지 않는다.
