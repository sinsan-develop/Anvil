# F-18 R44 ReleaseManifest 현재 migration head 결박 계획

> 기존 승인 F-18의 내부 보정이다. 기능·요구사항·공개 subject 필드·Production 범위를 바꾸지 않는다.

## 목적과 기준

- 현재 branch `codex/f18-wsl-ops`, 시작 HEAD `838a7591fd63f641dfc9cdf4db147a4461320dd1`, canonical seq1664, 두 lease=null, G-05 PASS.
- R43D 실제 OIDC DB·Worker head는 `0019_oidc_sessions`였다. F-16 `ReleaseManifest` 검증기는 `0016_operations_recovery`만 허용해 현재 head의 서명 subject 생성 전 `MANIFEST_MIGRATION_INVALID`로 중단한다. F-17의 역사적 PG15/PG18 `0016` 증거를 현재 F-18 증거로 승격하지 않는다.
- 현재 설계 §49.12와 F-18 WorkInstruction의 environment·manifest·migration·rollback 결박을 구현할 수 있도록 이 한 가지 내부 불일치만 보정한다. 새 DB migration이나 schema, release subject 필드, 서명 방식은 변경하지 않는다.

## Task 1 — 정확한 두 migration head의 서명 계약

**제품 exact3:** `packages/deployment/release_manifest.py`, `tests/deploy/test_f16_release_manifest.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

1. RED: `0019_oidc_sessions`로 채운 기존 subject를 `canonical_subject_bytes`와 실제 서명·검증 경로에 넣어 현재 `MANIFEST_MIGRATION_INVALID`를 재현한다. `0016` 기존 양성, `0017`/임의·누락 head 거부 및 서명·관측 불일치 거부를 테스트로 고정한다.
2. GREEN: 허용 head를 **정확히** `0016_operations_recovery`, `0019_oidc_sessions` 두 값으로 제한한다. `ReleaseExpectations.db_migration_head`와 signed subject 일치, remote/tag/digest/lockfile 검증은 그대로 둔다. `deploy/wsl/f17_validation.py`는 F-17 역사적 `0016` target 계약이므로 수정하지 않는다.
3. focused F-16/F-18 deployment 테스트 및 관련 회귀, diff, G-05를 확인한다. 전체 Windows suite는 레거시 C-01 테스트가 로컬 `wsl -d Ubuntu`를 실행하므로 F-18 제품 PASS 증거로 사용하지 않는다. WSL-server 정식 실측은 후속 Main 전용 검증으로 분리한다.
4. Developer가 exact3와 RED/GREEN 명령·exit·결과·미검증·rollback을 보고한 뒤 Main이 diff/회귀를 독립 검토하고 같은 branch에 commit·push한다.

## 다음 검증과 판정 경계

- R44의 로컬 계약 PASS는 signed manifest **생성 가능성**만 증명한다. 실제 서명된 현재 manifest, 동일 SHA/digest Test/Staging→격리 target, pgvector PG18, OIDC 부정 사례, object store/network, backup/restore/rollback은 후속 WSL-server 검증이 필요하다.
- F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED. 새 branch·PR·main 병합은 하지 않는다.
- Rollback은 R44 exact3 commit의 정상 revert다. 기존 `0016` 계약과 R43D 제품·증거는 보존한다.
