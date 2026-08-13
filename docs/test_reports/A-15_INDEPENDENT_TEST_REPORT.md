# A-15 Independent Test Report

- package: `A-15`
- tester role: independent read-only Tester
- tested HEAD / branch: `2c92b564fc049476e4bd766353e7816f7ca2ce08 / main`
- remote baseline: `origin/main = 2c92b564fc049476e4bd766353e7816f7ca2ce08`
- progress: sequence `181`, `TEST_REVIEW`, worker/write lease `null`
- assigned verification: `AV-UI-015`, `AV-STAT-041`, `AV-STAT-042`
- technical verdict: `READY_FOR_MAIN_ACCEPTANCE`
- user UX decision: `PENDING_USER_DECISION / REQUIRED`
- DIR-1: `NOT_REACHED`
- blocking technical findings: `0`

## 판정 -> 판단 이유 -> 조치

### 판정

A-15 static Artifact·§49 상태·API·UI trace 계약은 기술적으로 Main acceptance 준비가 됐다. current checkout과 별도 LF clean clone에서 full tooling이 각각 `282/282` PASS했고, focused A-15 `8/8`, A-11/A-13/A-14/A-15/project/G-07/Phase G standalone이 모두 PASS했다. 13개 required domain, `source_kind`와 `source_reference`, API mutation envelope, 화면 trace, 12개 hostile mutation, exact/raw/target/self-reference 계약이 fail-closed로 검증됐다.

이 기술 판정은 신산님의 UX 승인이 아니다. `A-15_USER_UX_APPROVAL_REQUEST.md`의 선택은 `승인 | 보완 | 반려`이며 현재 `PENDING_USER_DECISION`이다. Tester는 승인 record 또는 사람 decision Event를 생성하지 않았다. A-15는 아직 accepted가 아니고 DIR-1은 `NOT_REACHED`; A Gate는 `BLOCKED_PENDING_A15_ACCEPTANCE_AND_DIR1`이다.

### 판단 이유

1. artifact schema는 §49.1~49.17의 ProductValidation, Defect, ReleaseDecision, Apply/Deploy approval, DIR, worker/write fencing, budget reservation, DataEgressProfile, SecretRef, EvidenceManifest, ReleaseManifest, DeploymentRun, Monitoring aggregate와 enum·human-only·fail-closed 계약을 고정한다.
2. field trace matrix의 13개 required domain 행은 모두 `artifact_field`, `source_kind`, `canonical_source`, `source_reference`, API request/response, UI surface/state, permission, evidence/AV, runtime boundary를 포함한다. Monitoring만 명시적 `projection`이고 나머지는 canonical aggregate이며 화면 fixture/read model을 canonical source로 승격하지 않는다.
3. API draft는 same-origin `/api` 경계와 23개 endpoint를 제공하며 mutation envelope의 actor/role, `Idempotency-Key`, `If-Match`, expected version, target hash, permission, reason, audit Event를 고정한다. 사람 전용 endpoint는 `human_only=true`이고 실제 API 구현·호출 PASS가 아니다.
4. hostile fixture 12건은 missing source, invalid source kind, domain 누락, absolute localhost URL, forged human approval, premature DIR, aggregate 누락, DIR enum 변조, human endpoint guard 제거, mutation envelope target 제거, runtime PASS 위조, cross-environment evidence reuse를 각각 stable reason code로 거부했다.
5. UX decision contract는 `PENDING_USER_DECISION`, authenticated human required, agent propose-only, approval record absent를 유지한다. DIR은 `NOT_REACHED`이고 조기 `DIR_HOLD` mutation을 거부한다.
6. Developer evidence manifest는 SHA-256 `2AEEACFC...8B60`, exact paths 12, raw rows 11, self-reference false다. 독립 재계산 결과 canonical bytes `1328`, content bytes `55542`, target `34FCA32938AB9DE68EFFE1C9F0E3FB57E994C5D74E172717D027F871DB3309AE`로 manifest와 일치한다.
7. completion manifest SHA-256은 `91B3FDE42A669B806141D446713423D7110801A6C6222039D38AD363C3E1D906`, target은 `8CDEB35870A26D4CD3864C3297A38D9C8B4F23BD409548BD622D9A18773824CC`다. accepted=false, Tester pending, UX pending, DIR not reached, next gate blocked 상태를 유지한다.

### 조치

1. Main Agent는 이 기술 PASS를 검토하되 사람 UX 승인으로 승격하지 않는다.
2. 신산님에게 `A-15_USER_UX_APPROVAL_REQUEST.md`의 다섯 검토 항목과 `승인 | 보완 | 반려` 선택을 제시한다.
3. A-15 acceptance와 DIR-1 진입은 신산님의 UX 결정 및 Main projection 전까지 금지한다.

## fresh 검증 결과

| 환경 | 명령 / 범위 | 결과 |
|---|---|---|
| current | `python -m unittest tests.tooling.test_a15_artifact_state_api_ui_trace -v` | `8/8 PASS`, 0.230s |
| current | `python -m unittest discover -s tests/tooling -p 'test_*.py' -v` | `282/282 PASS`, 138.820s |
| current | A-11/A-13/A-14/A-15/project/G-07/Phase G standalone | 모두 exit 0 PASS |
| clean clone | A-15 focused | `8/8 PASS`, 0.229s |
| clean clone | full tooling | `282/282 PASS`, 137.304s |
| clean clone | A-11/A-13/A-14/A-15/project/G-07/Phase G standalone | 모두 exit 0 PASS |
| manifest | exact/raw/target/self-reference independent recompute | `12 paths / 11 raw / target match / errors 0` |

## no-write·미실행·종료 경계

- 시작 기준선은 clean `main = origin/main = 2c92b564...`였다. current와 LF clean clone은 테스트 전후 clean이었다.
- apps, packages, A-15 fixtures의 worktree/cached diff는 0건이다. 제품·fixture·권위·progress/HANDOFF·events·ledger·manifests·Git refs/index를 수정하지 않았다.
- Tester write는 이 보고서 한 파일뿐이다. commit/push, A-15 acceptance, DIR report/Event/checkpoint, A Gate 판정을 수행하지 않았다.
- disposable clone `C:\Users\cyhuh\AppData\Local\Temp\anvil-a15-clean-2c92b56`은 검증 후 제거했다.
- actual API/DB/browser/network/provider/secret/egress/WSL/production/deployment는 `NOT_EXECUTED`; static trace PASS를 runtime·production PASS로 승격하지 않는다.
- rollback: 이 Tester report만 제거하면 된다.
