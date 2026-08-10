# G-01 독립 Test Report

- package_id: `G-01`
- validation_id: `AV-CON-016`
- validation_method: `RV`
- tester: `g01_independent_tester_v2` (이전 review target 미사용)
- 검증일: `2026-08-10`
- 검증 revision: Git 미초기화 상태이므로 canonical content target `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C`
- 설계 기준선 SHA-256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- WorkInstruction SHA-256: `EC8314A2B957AB2AB490DED4A856862DD70E05A3458E50C234DB4530B70299DB`

## 판정

`PASS`

## 판단 이유

1. EvidenceManifest의 5개 artifact를 파일에서 독립 재계산한 결과 SHA-256과 bytes가 5/5 모두 등록값과 일치했다.
2. manifest 순서를 유지해 각 항목을 `path=UPPERCASE_SHA256`으로 만들고 UTF-8, LF 구분자, 마지막 LF 없음으로 직렬화한 548 bytes의 SHA-256은 `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C`였다. 이는 지정된 canonical target 및 manifest의 `target_hash`·`delivered_hash`와 모두 동일하다.
3. EvidenceManifest 실제 SHA-256은 `3C68E04B123C3961023F02EA9E6768F7DF5F8E621A0F15237BC4EEB990284D4B`, CompletionReport 실제 SHA-256은 `C5F76BA3424F243A355E1AA902A58598FA088382B29607A6800D8DBCE760DF09`로 고정 evidence와 일치했다.
4. BaselineRecord와 Source Inventory가 등록한 승인 기준선 8건, 선행 Anvil 핵심 파일 2건과 20파일 bundle manifest, Forge·LogicForge·OrcheFlow HEAD/tree/dirty count를 read-only로 대조했으며 기록값과 불일치가 없었다.
5. 설계서 2장 P16은 Claude Code/Codex의 coding loop 재구현을 금지한다. 45장은 참조별로 Anvil이 추가하는 고유 책임을 상태·권한·증거·조율·운영으로 한정하고, 47.1은 native coding loop·코드 탐색/수정·패치 생성을 Native Coding Agent 책임으로 명시한다. 47.15의 Adapter 계약도 capability probe, start, event 수집, checkpoint, steer, stop, result 수집으로 한정되어 내부 계획·코드 생성 loop를 복제하지 않는다. Native backend 부재 시 Minimal Kernel을 쓰는 예외도 낮은 capability 작업으로 제한되어 P16 경계와 모순되지 않는다.
6. Source Inventory는 참조 프로젝트를 canonical 구현이 아닌 contextual evidence로 분류하고 dirty/untracked 내용을 권위 근거에서 제외한다. 따라서 BaselineRecord의 `PASS_CANDIDATE` 근거는 설계 원문과 일치하며 `AV-CON-016`의 native coding loop 비복제 경계가 RV 방식으로 입증됐다.

## 조치

- Main Agent는 본 독립 Tester PASS를 검토한 뒤에만 G-01을 최종 `ACCEPTED`로 전환하고 progress/HANDOFF를 갱신한다.
- `G01-MISMATCH-001~004`와 `G01-DECISION-001`은 BaselineRecord에 기록된 상태와 다음 조치를 유지한다. 이 항목들은 숨겨진 실패가 아니라 G-01이 고정해야 할 공개 mismatch/후속 결정이며, 임의로 해소하거나 PASS로 치환하지 않는다.
- G-02는 G-01 최종 `ACCEPTED` 기록 전에는 시작하지 않는다.

## 진입 기준

| 항목 | 실제 확인 | 결과 |
|---|---|---|
| 지정된 WorkInstruction 존재·상태 | `WI-G-01-20260810-001`, `ACTIVE`, 실제 SHA가 progress 등록값과 일치 | PASS |
| CompletionReport 존재·Main 1차 판정 | `COMPLETED` / `PRELIMINARY_ACCEPT`, 지정 SHA와 일치 | PASS |
| 검증 대상 revision 고정 | 신산님이 새 canonical target, manifest SHA, CompletionReport SHA를 명시했고 실제 파일과 일치 | PASS |
| approval binding | `APPROVAL-20260810-INTEGRATED-BASELINE-001`, subject `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`; 승인 파일 SHA 일치 | PASS |
| 변경 경로 범위 | CompletionReport의 생성 파일 7건이 모두 WorkInstruction 허용 파일에 포함 | PASS |
| 현재 진행 상태 | `build-progress.json`: Phase G / G-01 / `TEST_REVIEW`, write lease 없음, next action=독립 Tester 검증 | PASS |
| 저장소·제품 경계 | root `.git` 없음; 제품 코드 생성·Git 초기화·서버/DB 작업을 수행하지 않음 | PASS |

G-01은 G-04의 표준 template 작성 전 bootstrap Package다. 따라서 Git SHA 대신 승인자가 고정한 content-addressed target과 outer evidence SHA를 검증 revision으로 사용했으며, 이를 일반 Git revision PASS로 확대하지 않았다.

## 명령 / 실제 결과

모든 명령은 `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil`에서 read-only로 실행했다.

| 명령 | 종료 코드 | 실제 결과 |
|---|---:|---|
| `Get-Content -Raw docs\work_orders\G-01_WORK_INSTRUCTION.md; Get-Content -Raw docs\completion_reports\G-01_COMPLETION_REPORT.md; Get-Content -Raw docs\evidence\manifests\G-01_EVIDENCE_MANIFEST.json` | 0 | 지정 세 파일을 먼저 읽음; target/manifest/report 기준값 확인 |
| `Get-FileHash -Algorithm SHA256 -LiteralPath <manifest artifact>; (Get-Item -LiteralPath <manifest artifact>).Length` (manifest 5건 반복) | 0 | SHA 5/5 일치, bytes 5/5 일치 |
| `$canonical = @($m.artifacts \| ForEach-Object { "$($_.path)=$($_.sha256)" }) -join "`n"; SHA256(UTF8($canonical))` | 0 | 548 bytes, `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C` |
| `Get-FileHash -Algorithm SHA256 docs\evidence\manifests\G-01_EVIDENCE_MANIFEST.json` | 0 | `3C68E04B123C3961023F02EA9E6768F7DF5F8E621A0F15237BC4EEB990284D4B`, 2898 bytes |
| `Get-FileHash -Algorithm SHA256 docs\completion_reports\G-01_COMPLETION_REPORT.md` | 0 | `C5F76BA3424F243A355E1AA902A58598FA088382B29607A6800D8DBCE760DF09`, 2908 bytes |
| `Get-FileHash`로 설계서·계획서·매트릭스·테스트계획·AGENTS·운영규칙·온보딩·MoaWorks 원본 8건 대조 | 0 | 8/8 등록 SHA와 일치 |
| `Get-FileHash`로 `Backup/Anvil` 핵심 2건 대조 및 top-level 20파일 `name=hash` canonical manifest 재계산 | 0 | 핵심 2/2 일치; 20건, bundle hash `5FFFEDFC941177F05E023BB61938169A2A81E53A37E68CBF4A7E60A920627B1E` 일치 |
| `git -C Backup\{Forge,LogicForge,OrcheFlow} rev-parse HEAD`, `rev-parse HEAD^{tree}`, `remote -v`, `status --short` | 0 | 세 저장소 HEAD/tree 일치; dirty count 4/4/103 일치; LogicForge remote 없음 확인 |
| `Test-Path -LiteralPath .git` | 0 | `False` |
| 설계서 line 130~175, 4204~4315, 4882~4955, 5537~5605 read-only 추출 | 0 | P16·45장·47.1·47.15 원문 대조 완료 |

### Manifest artifact 상세

| path | SHA-256 | bytes | 결과 |
|---|---|---:|---|
| `docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md` | `94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7` | 1966 | PASS |
| `docs/work_orders/G-01_WORK_INSTRUCTION.md` | `EC8314A2B957AB2AB490DED4A856862DD70E05A3458E50C234DB4530B70299DB` | 2459 | PASS |
| `docs/work_orders/G-01_INVOCATION_PROMPT.md` | `0BD97DF7B630B55522F87EF36CEE20DA990936A7EA89A49615A8780F02BB47DD` | 369 | PASS |
| `docs/baselines/G-01_BASELINE_RECORD.md` | `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B` | 5312 | PASS |
| `docs/baselines/G-01_SOURCE_INVENTORY.md` | `52CB7120E4726AB4B37555AB8439A01CA16A6387DF932402E9FB66D081745DEC` | 6693 | PASS |

## Findings

| ID | 심각도 | 판정 | 내용 |
|---|---|---|---|
| `G01-TST-001` | MAJOR 기준 검증 | PASS | `AV-CON-016`의 P16 비복제 계약이 45장·47.1·47.15와 일관되고 Adapter가 native coding loop 내부를 소유하지 않는다. |
| `G01-TST-002` | 무결성 | PASS | target과 delivered가 같은 독립 계산 hash이며 manifest artifact SHA/bytes가 전부 일치한다. |
| `G01-TST-003` | 기준선 | PASS | 승인된 local authority와 MoaWorks 원본 hash가 BaselineRecord/Source Inventory 등록값과 일치한다. |
| `G01-TST-004` | provenance | PASS | historical/reference snapshot의 hash·HEAD/tree·dirty 상태가 기록과 일치하고 dirty 내용은 권위 evidence에서 제외됐다. |
| `G01-TST-005` | 잔여 우려 | OPEN / non-blocking | 공식 URL 중 공개 revision marker가 없는 source는 URL·수집일만 고정되어 있다. 구현 dependency 선택 전 Source Inventory에 기록된 재조회가 필요하다. |

## 미검증 범위

- 공식 URL 18건의 현재 HTTP 상태와 본문 content hash는 이번 `AV-CON-016` RV에서 재호출하지 않았다. 이는 이번 할당 검증 ID의 PASS로 집계하지 않았으며, Source Inventory가 기록한 2026-08-10 metadata audit와 revision 한계를 그대로 유지한다.
- 제품 코드·단위/통합/E2E·브라우저·API·DB·배포 검증은 G-01 금지·비범위이므로 실행하지 않았고 PASS로 표시하지 않았다.
- Git commit/branch/worktree 검증은 root Git 미초기화 상태이므로 수행 대상이 아니다. 대신 지정된 canonical content target과 outer evidence SHA만 검증했다.
- 외부 참조 프로젝트의 dirty/untracked 파일 내용은 의도대로 authoritative evidence에서 제외했으며 설계 근거로 검증하지 않았다.

위 미검증 항목에는 `AV-CON-016`의 미판정·`SKIPPED`·`BLOCKED`가 없다. 본 판정은 고정 G-01 문서 target의 RV에만 한정한다.

## Target / Evidence Hash

| 구분 | SHA-256 | 대조 결과 |
|---|---|---|
| canonical target (독립 재계산) | `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C` | 지정값·manifest target·delivered와 일치 |
| EvidenceManifest | `3C68E04B123C3961023F02EA9E6768F7DF5F8E621A0F15237BC4EEB990284D4B` | 지정값과 일치 |
| CompletionReport | `C5F76BA3424F243A355E1AA902A58598FA088382B29607A6800D8DBCE760DF09` | 지정값과 일치 |
| approval subject | `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8` | WorkInstruction·BaselineRecord·manifest와 일치 |
| design baseline | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | actual file·승인 기록·progress와 일치 |
| WorkInstruction | `EC8314A2B957AB2AB490DED4A856862DD70E05A3458E50C234DB4530B70299DB` | actual file·manifest·progress와 일치 |

