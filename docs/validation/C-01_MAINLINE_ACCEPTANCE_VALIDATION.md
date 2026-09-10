# C-01 Mainline acceptance 검증 경계

R4 writer 실행: C01MainlineAcceptance 관련 pytest exit0 `10 passed, 310 deselected in 24.13s`; live checker exit0 `PASS sequence=715 reporting=AUTO_CONTINUE`; comprehensive `R4_AUDIT_PASS`. generated7/checksum19/history272/seq1~700+새chain/parent/ancestry/private authority/exact20/cumulative28/epoch4/syntax5/diff PASS. 메타데이터·epoch literal 역변환 SHA로 R3 로직 보존을 검증하고 허위 full697→698 receipt 재해시도 strict reconstruction에서 거부했다. 최종 문서 재결박 뒤 live/audit를 반복한다. Main의 정정 후 재검증은 이 writer 실행과 별도다.

R4 현재 검증 대상은 비의미 WI 항목7 regression20→18 정정 및 epoch4/receipt metadata 재결박이다. 제품·테스트 판정 로직 변경0, exact20/cumulative28/history272/seq1~700 경계는 동일하다. current historical32/map OPS-R2 2, no-active를 유지한다.

Main full tooling R3 attempt2는 정정 전 exact20에서 exit0 `697 passed in 1661.64s (0:27:41)`였다. 부모 manifest SHA `D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F`와 당시 exact20 checksum snapshot으로 execution target을 식별한다. Reviewer final은 Main 전달 SPEC PASS / QUALITY APPROVED C0/I0/M1이며 Minor 오기1을18로 정정해 resolved했다. R4 후 full tooling 실행을 뜻하지 않는다. writer 관련 tests/live/checksum/determinism/history/exact/syntax/diff와 Main의 별도 focused/checker/checksum/determinism 재실행을 구분한다. 아래 R3/R2는 보존 이력이다.

R3 current는 projection exact20/cumulative28, manifest raw checksum19, epoch3 fencing이다. 기존18에 G07 checker/test 두 경로만 추가한다. no-active idNone/count0인 current historical32/map OPS-R2 2를 고정 ledger에서 도출한다. 역사seq1~700·ledger raw는 불변이다. count31/nonzero active와 map-only tamper를 거부하며 legacy object semantics와 generic ancestry guard를 유지한다.

Main full attempt1 `20 failed, 673 passed in 1675.07s` 및 `C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1`/`C01-GIT-MUTATION-ERA-EXPECTATION-v1` 각1을 보존한다. status-poll wrapper syntax error1은 non-product다. R3 검증은 최소 RED/GREEN, 실패20 exact node IDs, focused+seq699/700, 독립9, live/determinism/checksum/history/scope/syntax/diff다. Main full rerun은 별도 gate다. 아래 R2 수치는 당시 이력이다.

R3 Git3상태는 staged exact20 precommit, fix의 clean sole child exact20, `[BASE, projection]` 순서 merged main이며 누적28과 tree동일성을 요구한다. 제품chain·private authority·upstream·index/dirty guard를 완화하거나 재정렬하지 않는다.

AV-AGT-002는 Claude/Codex/Local deterministic fake에 대한 L2 opaque contract 관측이다. AV-AGT-003는 in-memory atomic reservation-before-call와 ordered E-EVT다. AV-OPS-011은 fake backend reference 계약 동일성이다. 실제 backend 교체 E2E나 DB 통합 판정으로 승격하지 않는다.

현재 R2 구현 검증은 TDD RED → minimal GREEN, live checker, exact18 index와 BASE 대비 cumulative26, 최초 product exact9와 fix exact2/각 sole parent, raw manifest checksum17, authority hash, seq1~700 byte prefix/semantic hash, 새 event previous hash chain, generated7 두 build/live 동일성으로 구성한다. product occurrence는9+2=11이지만 unique path는9다.

기존 Developer-test rerun18은 regression-only다. projection review Important `C01-ACCEPTANCE-INDEPENDENT-SCENARIO-MISSING-v1`는 design-first 독립9 scenarios로 해소했다. round1 8/1의 제품 결함 `C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1`와 round2 9/0을 보존한다. round2 kernel byte는 fix66c0e43에 결박하고 실제 Provider·Telegram·backend swap은 NOT_EXECUTED다.

Git 허용 상태:

| 상태 | 필수 조건 |
|---|---|
| precommit | HEAD=fix66c0e43, feature branch, development/main=BASE, staged exact18, unstaged/untracked 0 |
| clean feature | sole parent=fix66c0e43, diff fix..HEAD exact18, diff BASE..HEAD cumulative26, clean, development/main=BASE |
| merged main | HEAD=development/main, upstream=development/main, parents 순서=[BASE, projection], projection sole parent=fix66c0e43, merge tree=projection tree |

모든 상태는 BASE=e215c061 → 최초 product=f56ac251 → fix=66c0e43의 정확한 parent/ancestry·경로를 요구한다. 실제 feature commit/merge는 실행하지 않았으며 controlled Git receipt 테스트 범위다.

source code review와 independent test judgment는 각각 seq707·seq708이다. MAIN_PACKAGE_ACCEPTED의 manifest hash는 acceptance_basis 부분의 canonical digest임을 명시하고, 전체 manifest/digest/events 간 자기참조 순환을 만들지 않는다.

전체 tooling은 Main 담당이며 이 writer가 실행하지 않는다. 실제 Provider/Telegram/DB/API/browser/WSL/deployment는 NOT_EXECUTED다. focused 검증과 final live gate의 실제 출력은 결과 보고 및 WORK_STATUS에 남긴다.
