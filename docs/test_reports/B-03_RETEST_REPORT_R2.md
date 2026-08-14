# B-03 Independent Retest Report R2

- role: `Independent Tester`
- baseline: `main = origin/main = 03c0d131693f5479f16aababcce385ca1c46aee6`
- progress: `event_sequence=233 / TEST_REVIEW / R2_PENDING / worker_lease=null / write_lease=null`
- developer manifest: `ADC773EF9C6D9A973B46660331AE1A9956ED010B11CC11D4A0C25ADAD472EC87`
- developer target: `A08847E8970706D49EAAC5181CE6743C1012145C151078E6D5390D4BB52B8ED8`
- verdict: `REWORK`
- blocking findings: `1`

## 판정 -> 판단 이유 -> 조치

**판정: REWORK.** B-03 R1의 `AV-FLOW-001` 실행 공백은 실제 local-only L4+L7 재검증으로 닫혔다. 그러나 필수 current checkout full tooling이 `281/282`여서 B-03을 READY로 승격할 수 없다.

**판단 이유:** 동일 commit의 명시적 LF clean clone에서는 tooling `282/282`가 통과하지만, 현재 Windows checkout에서 `tests.tooling.test_a13_repository_scan.A13RepositoryScanArtifactTests.test_evidence_manifest_has_raw_hashes_no_self_reference_and_exact_diff`가 실패한다. 내부 clean clone에 대한 A-13 successor 검증이 `EVIDENCE_ACTUAL_DIFF_MISMATCH`, `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`를 반환한다. 현재 checkout은 `git status --short`가 비어 있고 관련 tracked 파일은 `i/lf w/lf attr/text=auto eol=lf`이므로 단순 dirty 파일로 분류할 수 없다.

**조치:** `BLK-B03-R2-001-CURRENT-CHECKOUT-A13-INNER-CLONE-PORTABILITY`를 수정하고, 현재 Windows checkout의 기본 환경에서 full tooling `282/282` 및 새 LF clone `282/282`를 모두 다시 증명해야 한다. B-03 제품 runtime 범위나 actual browser 결과를 다시 열 필요는 없으며, portability/successor 검증 보완만 수행한다.

## Actual L4 + L7 browser/runtime retest

- in-app Chrome, explicit viewport `1920x1080`, URL `http://127.0.0.1:4173/design-flow`에서 실제 클릭했다.
- `NORMAL`: `Design baseline created`, `INTENT_RECORDED -> PROPOSALS_RECORDED -> DECISION_RECORDED -> SPECIFICATION_RECORDED -> BASELINE_APPROVED`의 sequence `1..5`, event id/type/UTC/actor를 실제 DOM에서 확인했다.
- `ERROR`: 단일 proposal로 실제 클릭했으며 `ambiguous intent requires multiple proposals`, event 1개만 표시되고 baseline은 생성되지 않았다.
- `BLOCKED`: 사람 decision 전 baseline을 실제 클릭했으며 `all baseline decisions must be confirmed`, intent/proposals/specification 3개 event만 표시되고 baseline은 생성되지 않았다.
- 독립 screenshot capture bytes는 NORMAL `60611`, ERROR `47092`, BLOCKED `55695`였다. Developer E-SHOT 3종도 원본 해상도로 시각 검토했고 각 상태·메시지·event가 일치했다.
- Developer E-SHOT SHA-256: NORMAL `19006C3AAAA5CA3E92AC29C67008E88046CE52F6CD7F3F878FFBCECE2C1DDB29`, ERROR `13036D9BCCC18170B1F4DE8415AE9079FBF8C0FED454CA5C813B5FA8E1511770`, BLOCKED `000E483FFF9595DBA331CB76B12B7EC1AAF33038E2F6D6924F288DC2EC198061`.
- Developer E-EVT SHA-256 `F55C50803E5CFAF94C3862B0359A83F736D31A7F1E28275D9DAFF4A27706FEB4`; service=`DesignLineageService`, ordered events `1..5`, UTC `+00:00`, actor/type/id/artifact를 확인했다.
- Python bridge는 `packages.api.design_runtime`에서 실제 `packages.design.service.DesignLineageService`를 호출한다. Python runtime `3/3`, Node same-origin runtime `2/2` PASS.
- hostile request: 변조 Host, hostile Origin, CSRF 누락이 각각 HTTP `403 / PERMISSION_DENIED`로 fail-closed였다. 브라우저 client는 `/api/design-flow/config`, `/api/design-flow/run` 상대경로만 사용한다.
- server PID `31984`를 종료하고 `4173 FREE`를 확인했다. 브라우저 viewport reset 및 tab finalize 완료.

## Static, manifest, regression evidence

- current: design `14/14`, domain `14/14`, persistence `7/7`, Python runtime `3/3`, B-03 Node runtime `2/2`, 기존 A-14 Workbench `5/5` PASS.
- current standalone: A-11, A-13(`fixtures=8 / zero_delta=8 / hostile=15`), A-14, A-15, project progress(`sequence=233`), G-07, Phase G 모두 PASS.
- fresh LF clone `C:\tmp\anvil-b03-r2-tester-03c0d131`: HEAD exact, clean, `core.autocrlf=false`, `core.eol=lf`; tooling `282/282`, design `14/14`, domain `14/14`, persistence `7/7`, Python runtime `3/3`, B-03 Node runtime `2/2`, A-14 Workbench `5/5`; standalone 7종 모두 PASS.
- current full tooling: `281/282`, failure 1. 이것이 유일한 blocker다.
- manifest actual SHA와 completion binding은 `ADC773...`; raw 14개와 exact write paths 15개, bytes/SHA/target canonical/content, `self_reference=false`가 일치했다.
- 독립 in-memory tamper: raw hash, target hash, self-reference, missing raw path 변조가 각각 `RAW_HASH`, `TARGET_HASH`, `SELF_REFERENCE`, `RAW_MISSING/EXACT_PATHS` 계열 오류로 거부됐다.

## No-write and scope boundary

- 제품, fixture, authority, progress/HANDOFF, Git refs/index를 수정하지 않았다. 이 Tester report 한 파일만 생성했다.
- 실제 provider, shared/WSL/production DB, external API, production/deployment, B-11 canonical registry/auth/SSE는 `NOT_EXECUTED`이며 완료로 주장하지 않는다.
- B-03 acceptance, B-04 시작, commit, push는 수행하지 않았다.

## Blocking finding

`BLK-B03-R2-001-CURRENT-CHECKOUT-A13-INNER-CLONE-PORTABILITY`

- expected: current clean checkout full tooling `282/282`.
- actual: `281/282`; A-13 inner-clean-clone successor/raw integrity test 1건 실패.
- control: 동일 HEAD의 explicit LF clone은 `282/282` PASS.
- effect: actual B-03 browser/runtime closure는 확인됐지만 package acceptance readiness는 `REWORK`.
