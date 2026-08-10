# G-01 BaselineRecord

- baseline_id: `BASELINE-G-01-20260810-001`
- package_id: `G-01`
- captured_at: `2026-08-10T10:44:16+09:00`
- approval_ref: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- work_instruction_id: `WI-G-01-20260810-001`
- repository_state: `NOT_INITIALIZED`
- product_code_state: `NOT_CREATED`

## 1. 권위 기준선

| 우선순위 | Artifact | Version | SHA-256 | 효력 |
|---:|---|---|---|---|
| 1 | 신산님의 현재 명시적 지시와 승인 기록 | 2026-08-10 | `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8` | 최종 사람 결정 |
| 2 | `Anvil_설계서_v2.md` | v2.6 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | 제품·운영 canonical 설계 |
| 3 | `Anvil_작업계획서_v1.md` | v1.3 | `A88FCA548143B4C5208E106EBDF6009E438806547513A7C89F50A9E922C5C335` | 97개 Package 실행 순서 |
| 4 | `Anvil_통합검증매트릭스_v1.md` | v1.1 | `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` | 255개 검증 ID·역색인 |
| 5 | `Anvil_테스트계획서_v1.md` | v1.1 | `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` | 검증 주체·환경·절차 |
| 6 | `docs/governance/ANVIL_OPERATING_RULES.md` | v1.3 | `71006092D9A1A6F97DD47ECB2436C5986A3632A27CC1C7942D921911490A8C74` | 작업·승인·실패·DIR 운영 |
| 7 | `AGENTS.md` | current | `BFF4DB0D1C17EF0794666A56A3156C92A53E1EE1D54ADFFFEB462571AAEEE3EA` | Agent 진입 규칙 |
| 8 | `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md` | live projection | Event마다 변경 | 실행 상태·재개 원장 |

진행 파일은 실행 Event에 따라 바뀌므로 승인 subject의 immutable artifact hash로 사용하지 않는다. 권위 기준선과 불일치하면 덮어쓰지 않고 `RECONCILE_REQUIRED`로 전환한다.

## 2. 승인 효력

- 통합 기준선, 작업계획, 운영규칙, 검증문서와 D1~D10 진행 기준은 신산님이 승인했다.
- D1~D8·D10은 설계서 23장의 권장안을 구현 기준으로 사용한다.
- D9는 특정 vector 제품이 아니라 benchmark 후 선택 정책이 승인됐다.
- 기능 범위·요구사항·중요 위험 변경만 신산님 재승인을 요청한다.
- 모든 content hash 변경은 기존 binding을 무효화하며 비의미 변경은 `MAIN_RECONFIRMED_NON_SEMANTIC` 계보를 요구한다.

## 3. 현재 환경 경계

| 단계 | 확정 환경 | 현재 G-01 판정 |
|---|---|---|
| Local development | 로컬 Web/API/Worker 프로세스 + WSL-server Anvil PostgreSQL 15 DB | 계약만 등록, 연결·변경 미실행 |
| Release Candidate | WSL-server 별도 격리 PostgreSQL 18 | 계약만 등록, 인스턴스 생성 미실행 |
| Test/Staging | `ssh WSL-server`, hostname `SINSAN` | 접속·배포 미실행 |
| Production | `ssh ysna-server`, `envil.sinsan.kr`, PostgreSQL 18 전용 DB/role | 접속·배포 미실행 |
| Deployment | Git 승인 commit/tag + ReleaseManifest | root Git 미초기화로 미실행 |

G-01은 환경을 변경하지 않는다. 실제 capability·보안·배포 증거는 해당 Package에서 별도 수집한다.

## 4. AV-CON-016 설계 리뷰

판정 질문: Anvil이 Claude Code·Codex·Hermes·Smolagents·LangGraph의 네이티브 코딩 loop를 복제하는가?

판정: `PASS_CANDIDATE`

판단 이유:

1. Native Agent Adapter는 코딩 loop를 재구현하지 않고 외부 runtime의 세션·도구·결과를 Anvil의 Task/Run/Step 계약으로 변환한다.
2. Anvil 고유 책임은 Workbench, Repository Intelligence, 승인·중단, durable progress, EvidenceManifest, ProductValidation·ReleaseDecision, 학습 승격과 운영 화면이다.
3. LangGraph·Smolagents 개념은 상태·최소 kernel 설계 패턴으로 사용하지만 특정 library에 제품 계약을 종속하지 않는다.
4. 참조 프로젝트의 코드는 이식 대상이 아니라 장점·실패를 확인하는 contextual evidence다.

조치: 독립 Tester가 설계서 2장 P16, 45장, 47.1, 47.15와 본 BaselineRecord를 대조하기 전에는 G-01을 `ACCEPTED`로 전환하지 않는다.

## 5. 현재 불일치·미확정

| ID | 상태 | 내용 | 다음 조치 |
|---|---|---|---|
| `G01-MISMATCH-001` | `OPEN` | root Anvil 디렉터리는 Git 저장소가 아님 | G-03 승인 WorkInstruction에서 초기화·branch·scaffold 결정 |
| `G01-MISMATCH-002` | `OPEN` | LogicForge 로컬 clone에 remote가 등록되지 않음 | G-03 이전 source provenance ADR에서 사용자 제공 URL과 commit 관계 확인 |
| `G01-MISMATCH-003` | `RECORDED` | Forge·LogicForge·OrcheFlow 로컬 worktree가 dirty | HEAD tree만 immutable contextual source로 사용하고 dirty 파일은 근거로 승격하지 않음 |
| `G01-MISMATCH-004` | `OPEN` | 일부 공식 문서는 공개 ETag·revision marker가 없음 | URL·수집시각을 고정하고 구현 dependency 선택 전 재검토 |
| `G01-DECISION-001` | `G-02` | Q-01·Q-03~Q-06과 남은 검증 할당 | G-02 DecisionRecord에서 신산님 결정 요청 |

## 6. 다음 안전 행동

Source Inventory와 EvidenceManifest를 완성한 후 별도 Tester 세션에 `AV-CON-016` RV 검증을 요청한다. Tester PASS 전에는 G-02를 시작하지 않는다.
