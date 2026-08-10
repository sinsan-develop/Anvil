# developer-primary 재온보딩 확인서

## 2026-08-10 A-01 책임 정합화 successor 재온보딩

> 판정: `PASS / READ_ONLY_READY / A-01_READY_NO_WORK_INSTRUCTION`
> 수행 역할: `developer-primary`
> 적용 범위: 아래 successor 기준선이 이 문서의 이전 온보딩 기준선을 대체한다. 이전 내용은 historical onboarding evidence로 보존한다.
> 쓰기 경계: 이 재온보딩·projection evidence 작성만 승인된 Task 3 범위다. A-01 제품 구현은 시작하지 않았고 active WorkInstruction·worker lease·write lease는 없다.

### 전체 읽기 및 exact-byte 증거

각 파일은 repository working tree의 raw bytes 전체를 읽고 SHA-256을 계산했다. 줄 수는 UTF-8 text의 LF 기준 전체 범위이며, 모든 active successor hash가 `BASELINE-A-01-PRECONDITION-DERIVED-20260810-001`과 일치한다.

| 문서 | 읽은 범위 | bytes | SHA-256 | 판정 |
|---|---:|---:|---|---|
| `AGENTS.md` | 1~146줄 전체 | 9,445 | `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246` | PASS |
| `Anvil_설계서_v2.md` v2.6 | 1~6,627줄 전체 | 309,195 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | PASS / unchanged |
| `Anvil_작업계획서_v1.md` v1.5 | 1~703줄 전체 | 65,637 | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` | PASS |
| `Anvil_통합검증매트릭스_v1.md` v1.3 | 1~642줄 전체 | 62,821 | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` | PASS |
| `Anvil_테스트계획서_v1.md` v1.4 | 1~851줄 전체 | 54,846 | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` | PASS |
| `docs/governance/ANVIL_OPERATING_RULES.md` v1.6 | 1~226줄 전체 | 19,031 | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` | PASS |
| `docs/agents/developer-primary.md` | 1~70줄 전체 | 4,019 | `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77` | PASS |
| `docs/approvals/APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001.md` | 1~32줄 전체 | 1,887 | `9D440C46B0CD8F0F44C46B3143FCB1B4DF7322BF9A7E0BD0A52BCE8D873FA18F` | PASS / human approval |
| `docs/baselines/A-01_PRECONDITION_DERIVED_BASELINE.md` | 1~51줄 전체 | 3,441 | `E5A6E3B64CAAF48F6CDE51A1E8431A553C2CA2E4EF66DC7E5EE085D6F017E008` | PASS / active derived baseline |

### 책임·검증·착수 경계 이해

- A-01은 `AV-UI-005`의 screen map·journey·Phase Rail 정적 연결성만 판정한다.
- `AV-FLOW-001` runtime 책임은 A-05·B-03과 A Gate에 유지되며, A-01의 fixture·mock·정적 화면은 runtime PASS가 아니다.
- Package 97, AV ID 255, 고유 실행 234, 역색인 97, 미할당 0 계약과 historical G-02/G-07/Phase G accepted evidence의 byte 불변을 유지한다.
- A-01은 `READY`지만 WorkInstruction과 두 lease가 모두 `null`이므로 제품 구현은 시작할 수 없다.
- 실제 Git 관측은 local `a843ca71c5c3cb3bb5cc9ca85901a9bd320f6cfd`, upstream `origin/main` `57703ffc3521287cdd7d54b07bfd7c9001928388`이다. 일치를 꾸미거나 과거 push로 소급하지 않으며 Main의 commit/push 전 `PUSH_PENDING_MAIN`으로 다룬다.

> 판정: `PASS / READ_ONLY_READY`  
> 재온보딩일: 2026-08-10  
> 수행 역할: `developer-primary` 독립 read-only Subagent 세션  
> 현재 write 권한: `WRITE_BLOCKED_PENDING_G03_WORK_INSTRUCTION`  
> 현재 기준선 상태: `G-02_REVISION_2 / AWAITING_INDEPENDENT_TESTER`  
> 대체 범위: 이 문서는 이전 온보딩 판정을 v2.6 / v1.4 / v1.2 / v1.3 / 운영규칙 v1.4 기준으로 대체한다.

## 1. 전체 읽기 증거

| 문서 | 읽은 범위 | 크기 | SHA-256 | 대조 결과 |
|---|---:|---:|---|---|
| `AGENTS.md` | 1~136줄 전체 | 8,332 bytes | `BFF4DB0D1C17EF0794666A56A3156C92A53E1EE1D54ADFFFEB462571AAEEE3EA` | 현재 운영 헌법 확인 |
| `Anvil_설계서_v2.md` v2.6 | 1~6,627줄 전체 | 309,195 bytes | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | 지정 hash 일치 |
| `Anvil_작업계획서_v1.md` v1.4 | 1~696줄 전체 | 64,945 bytes | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | 지정 hash 일치 |
| `Anvil_통합검증매트릭스_v1.md` v1.2 | 1~633줄 전체 | 61,741 bytes | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | 지정 hash 일치 |
| `Anvil_테스트계획서_v1.md` v1.3 | 1~847줄 전체 | 53,818 bytes | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | 지정 hash 일치 |
| `docs/governance/ANVIL_OPERATING_RULES.md` v1.4 | 1~212줄 전체 | 16,886 bytes | `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` | 지정 hash 일치 |
| `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md` | 1~51줄 전체 | 3,361 bytes | `232563E90F3AC06B165964A2C0D01D2DB10AAC63DD4B4DA5146E7FA65C3FDFA0` | `semantic_diff=NONE`·root approval 계보 확인 |

독립 Developer 세션은 파일을 수정하지 않았고 Git·코드·서버·DB 작업도 수행하지 않았다. 이 확인서는 해당 read-only ACK를 governance-decision-writer가 기록했다.

## 2. 프로젝트와 권위 체계 이해

- Anvil은 Hermes Agent의 지속 학습·메모리 동기화, Smolagents의 가볍고 투명한 코드 기반, LangGraph식 상태 머신, Claude Code·Codex의 코딩 능력을 **사람 승인·영속 상태·증거·안전 경계**로 운영하는 바이브코딩 Agent다.
- 신산님은 최종 결정권자다. Main Agent 어울은 설계·분할·기술 판단·조율·통합·commit/push·최종 보고 책임을 가진다.
- `developer-primary`는 승인된 WorkInstruction, 허용 path, 완료조건, 기준선 hash, 검증 계약과 유효 lease 안에서만 구현하고 기본 테스트·증거를 제출한다. 설계 변경·승인 대체·Release 결정은 할 수 없다.
- 충돌 시 권위 순서는 `신산님 명시 지시/승인 → 설계서 → 작업계획서 → 통합검증매트릭스 → 테스트계획서 → 운영규칙 → 승인된 WorkInstruction → progress/HANDOFF`다.
- hash·상태·실제 파일이 일치하지 않으면 임의로 덮어쓰지 않고 `RECONCILE_REQUIRED` 또는 `BLOCKED`로 Main Agent에게 보고한다.

## 3. 97개 Work Package와 단계 순서

| Phase | Package 수 | 범위 |
|---|---:|---|
| G | 7 | 기준선·운영 artifact·fixture·검증문서 정규화 |
| A | 15 | 전체 화면·Artifact 계약·읽기 전용 온보딩 |
| B | 12 | Durable State·Event·progress·복구·lease |
| C | 15 | Main + Single Developer, M1~M3, Gate, 첫 수직 흐름 |
| D | 13 | Learning → Skill → Hook의 통제된 성장 |
| E | 11 | 독립 Reviewer/Tester·DAG·제한 병렬·원자 budget |
| F | 20 | Provider·보안·운영·Git 전용 환경 승격·Monitoring |
| P | 4 | 안정된 기능만 Plugin으로 포장 |
| **합계** | **97** | canonical 순서 `G → A → B → C → D → E → F → P` |

MoaWorks 단계는 `M1 결과 전달(C-03~04) → M2 구조화 결과·상태(C-05~07) → M3 3회 인수(C-12~13) → M4 Skill(D-07~08) → M5 Hook(D-09~10) → Reviewer/Tester·병렬(E) → 운영(F) → M6 Plugin(P)` 순서다. 앞 단계가 증거로 안정되기 전에 뒤 단계를 당겨 구현하지 않는다.

통합검증매트릭스 v1.2는 G-01~G-07을 포함한 97개 Package 역색인을 이미 가진다. Package 97개, AV ID 255개(CON 21개·고유 실행 234개), DIR-1=A-15·DIR-2=C-15·DIR-3=E-11·조건부 DIR-X와 DIR-3 유지 계약을 확인했다. 각 Package는 할당 검증 ID와 EvidenceManifest를 독립 Tester가 PASS한 뒤에만 Main Agent가 최종 판정한다.

## 4. 승인과 설계 변경 규칙

1. 승인 대상 content hash가 한 글자라도 바뀌면 기존 subject hash의 approval binding은 항상 무효다.
2. 기능 범위·요구사항·중요 위험이 달라지면 실행을 멈추고 semantic diff·영향·대안을 신산님께 제시해 사람 재승인을 받는다.
3. 내부 구현 방법·작업 순서·파일 배치·문구·경미 기술 보완처럼 위 세 항목을 바꾸지 않는 변경은 Main Agent만 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 기준선으로 재확정할 수 있다.
4. 비의미 재확정에는 parent/root human approval, old/new hash, semantic diff, 영향, 근거, actor, 시각이 필요하며 원 승인 scope를 넓힐 수 없다. Developer가 이 판정을 만들거나 적용할 수 없다.
5. `Technical Verification → ProductValidation → DefectAssessment → 인증된 사람 ReleaseDecision → ApplyApproval/DeployApproval` 순서를 지킨다. 기술 PASS가 기능 판정이나 Release를 대신하지 않는다.
6. `SKIPPED`, `WAIT`, `DEFERRED`, `BLOCKED`, 미실행 또는 증거 없는 성공 주장은 PASS가 아니다.

## 5. lease·쓰기·실패 3회 규칙

- `worker_leases`와 증가하는 `lease_epoch`·`execution_fencing_token`이 Queue/Run/StepAttempt 실행 소유권의 canonical 원장이다.
- 제품 파일 mutation은 이에 종속된 `write_leases`의 `write_epoch`·`write_fencing_token`까지 함께 제출해야 한다. 만료·인수된 stale token의 Step·Tool·Event·filesystem commit은 거부된다.
- 동일 path는 한 writer만 보유한다. Developer가 lease를 보유한 경로를 Main Agent가 동시에 수정하지 않으며 Reviewer/Tester는 기본 read-only다.
- 경로 충돌 키는 repository identity + canonical relative path + case policy로 계산해 Windows/WSL/Docker alias·symlink·junction 우회를 막는다.
- 유효 `FAILURE_REPORT`는 동일 `(step_lineage_id, failure_fingerprint)`이고 원인, 재현 명령·exit code·로그/테스트, 변경 경로·diff·잔여 작업, 검토 대안, Main 판단 요청을 모두 포함해야 한다.
- quota, Tool/권한/환경 문제, Agent 응답 중단, 내부 재시도, 근거 없는 포기, `INCOMPLETE`, `BLOCKED`, DIR은 실패 횟수에 포함하지 않는다.
- 1회는 Main 원인 검토·보완 방향, 2회는 WorkInstruction revision과 필요 시 사람 승인, 3회는 Developer 중지·lease/Tool 회수·TakeoverPacket 작성 후 Main Agent의 순차 직접 인수다. 동시 write는 허용하지 않는다.

## 6. 진행 기록·세션 복구 규칙

- 권위 진행 파일은 `docs/progress/build-progress.json`과 `docs/progress/BUILD_HANDOFF.md`다.
- Package 시작·결과·판정·승인·중단·재개, handoff, lease 발급·회수, failure 수락·거부·인수, 기준선 revision, Gate, commit/push/deploy, DIR 전이를 Event와 함께 즉시 기록한다.
- 새 세션은 progress/HANDOFF, 실제 file hash, Git 상태, DB Event sequence를 대조하고 완료 Step만 건너뛴다. 결과 미확인 side effect는 `confirmed_success / safe_retry / manual_review`로 분류하기 전 재실행하지 않는다.
- DB commit → progress/HANDOFF atomic replace → ack 순서와 transactional outbox를 사용하며 불일치는 `RECONCILE_REQUIRED`다.
- quota 소진은 `PAUSED_QUOTA` + checkpoint + next action으로 저장하며 실패나 무승인 Provider fallback으로 처리하지 않는다.

## 7. DIR 강제 중단 이해

| DIR | canonical trigger | 누적 Package | 차단 대상 |
|---|---|---:|---|
| DIR-1 | A-15 `ACCEPTED` 직후 | 22/97 | A Gate·Phase B |
| DIR-2 | C-15 `ACCEPTED` 직후 | 49/97 | C Gate·Phase D |
| DIR-X | D Gate에서 동일 target hash의 AV-LRN-003~005 중 하나 이상이 CRITICAL인 `DIRX-LRN-CRITICAL` | 조건부 | Phase E; DIR-3 유지 |
| DIR-3 | E-11 `ACCEPTED` 직후 | 73/97 | E Gate·Phase F |

- 상태는 `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`다.
- DIR 도달 즉시 새 WorkInstruction·Subagent·제품 write·commit·push·deploy를 중단하고 lease를 회수한다. DIR report·감사 Event·progress/HANDOFF만 기록할 수 있다.
- 독립 Tester가 5개 축을 설계 원문과 누적 산출물에 대조한다. Main Agent는 DIR 판정자가 아니며 보고 원문을 수정하지 않고 신산님께 전달한다.
- `ALIGNED`나 `DRIFT_MINOR`도 자동 재개 근거가 아니다. 신산님의 direction Event가 영속화되고 `CLEARED`가 된 뒤에만 Gate와 다음 작업을 진행한다.
- DIR 대상 artifact, EvidenceManifest 또는 기준선 hash가 바뀌면 기존 DIR 판정·direction binding은 무효다.
- 설계 hash가 한 Phase에서 2회 이상 바뀌거나 기존 DIR이 `DRIFT_MAJOR/DIVERGED`인 경우 Tester는 추가 DIR DecisionRequest를 제안할 수 있지만 자동 DIR-X는 아니며 신산님 승인 없이 강제 중단점을 늘리지 않는다.

## 8. 환경·보안·배포 경계

| 단계 | 실행 위치 | DB | 핵심 조건 |
|---|---|---|---|
| Local development | 신산님 PC의 Web/API/Worker 프로세스 | WSL-server `local-postgres` pgvector PostgreSQL 15의 Anvil 전용 DB/role | 방화벽·IP 제한 또는 SSH tunnel 전에는 DB 연결 승인 금지 |
| Test/Staging | WSL-server | PG15 일반 통합 + 별도 격리 PostgreSQL 18 RC | PG15와 PG18 RC를 덮어쓰거나 공유하지 않음 |
| Production | ysna-server | `shared-db` pgvector PostgreSQL 18의 Anvil 전용 DB/role | 운영 도메인 `envil.sinsan.kr` |

- 브라우저는 same-origin 상대 `/api/...`만 호출한다. localhost, 내부 API/DB/컨테이너 주소, OLLAMA endpoint, secret을 브라우저에 노출하지 않는다.
- secret은 reference/version만 저장하고 DB·브라우저·로그·LLM payload·artifact store 5개 경계에서 원문 노출을 차단한다.
- Provider egress는 DataEgressProfile·SSRF 방어·capability/privacy/cost snapshot과 원자 budget reservation을 통과해야 한다.
- PG18 RC에서 migration, extension, query, backup/restore, rollback rehearsal을 별도로 통과해야 운영 호환성을 주장할 수 있다.
- 서버 승격은 승인 remote의 정확한 Git commit/tag와 immutable ReleaseManifest·EvidenceManifest로만 수행한다. `scp`, server-local patch, dirty checkout 배포는 금지다.
- 운영 smoke 뒤에도 MonitoringPolicy 관찰과 신산님 확인 전에는 `RELEASED`로 표시하지 않는다.

## 9. `[historical]` G-01 이해와 현재 G-02 차단조건

### 목표·입력

G-01은 당시 설계 v2.6, 계획 v1.3, 매트릭스/테스트계획 v1.1, 운영규칙 v1.3과 참조 source의 path·version·hash·권위·적용 범위를 등록한 **완료된 historical 기준선 artifact 작업**이다. 현재 활성 기준선은 이 문서 §1의 revision 2 hash 집합이다.

### 출력

- `BaselineRecord`
- source inventory와 우선순위·적용 범위·신뢰·승인 상태
- 실제 revision 불일치와 설계 §49 동기화 대상
- G-02에서 결정할 D1~D10·Q-01~Q-06과 검증 할당 상태
- progress/HANDOFF의 다음 안전 행동

### 완료조건

- 모든 source path/hash·우선순위·현재 revision 불일치가 기록된다.
- 다른 독립 Agent가 파일만으로 같은 기준선을 재구성할 수 있다.
- 제품 코드·Git·원문 권위 문서를 변경하지 않는다.
- 매트릭스 §8의 G-01 할당 검증 ID와 EvidenceManifest를 독립 Tester가 판정한다.
- Main Agent의 `PRELIMINARY_ACCEPT` 뒤 독립 Tester PASS와 증거 검증을 거쳐야 `ACCEPTED`로 표시한다.

### 현재 차단조건

1. 새 권위 문서 4개와 non-semantic binding의 실제 hash가 §1과 일치한다.
2. G-02 revision 2는 독립 Tester 재검토 대기이며 Main Agent 최종 판정 전이다.
3. Developer 상태는 `READ_ONLY_READY / WRITE_BLOCKED_PENDING_G03_WORK_INSTRUCTION`이다.
4. 현재 write lease가 없고 G-03 `WRITE_READY` 전환도 승인되지 않았다.
5. Anvil 디렉터리는 아직 Git 저장소가 아니며 G-02에서 Git 초기화 권한은 없다.
6. D1~D8·D10은 `HUMAN_CONFIRMED`, D9는 `BENCHMARK_POLICY_CONFIRMED`, Q-02는 `RESERVED_NOT_DEFINED`다.

따라서 G-02 독립 Tester PASS와 Main Agent 최종 판정 전에는 G-03 착수·WorkInstruction 실행·Git 초기화·scaffold·코드·서버·DB·commit·push·배포를 수행하지 않는다.

## 10. 이해도 자기점검 10문항

1. **Q: 최종 설계·Release 결정권자는 누구인가?**  
   **A:** 신산님이다. Main Agent·Tester·Developer는 제안하거나 증거를 제출할 뿐 사람 결정을 대체하지 않는다.
2. **Q: `PRELIMINARY_ACCEPT`가 Package 완료인가?**  
   **A:** 아니다. 독립 Tester PASS와 evidence 검증 후 Main Agent가 `ACCEPTED`를 기록해야 최종 완료다.
3. **Q: G-01부터 독립 Tester 없이 `ACCEPTED`가 가능한가?**  
   **A:** 아니다. G-01부터 매트릭스 할당 ID와 EvidenceManifest를 독립 검증한 뒤에만 `ACCEPTED`가 가능하며, G-07은 전체 기준선·역색인·회귀 집합을 다시 검증한다.
4. **Q: hash 변경과 사람 재승인은 항상 같은가?**  
   **A:** 아니다. 모든 hash 변경은 기존 binding을 무효화하지만 사람 재승인은 기능 범위·요구사항·중요 위험 변경에 한정된다.
5. **Q: Developer가 비의미 변경을 스스로 재확정할 수 있는가?**  
   **A:** 없다. `MAIN_RECONFIRMED_NON_SEMANTIC`은 Main Agent 권한이며 scope 확장과 semantic 변경에 사용할 수 없다.
6. **Q: 동일 실패 3회 전에 명령 오류나 quota를 횟수에 넣는가?**  
   **A:** 넣지 않는다. 동일 lineage/fingerprint의 증거 완비 `FAILURE_REPORT`만 센다.
7. **Q: 3회째 실패에서 Main과 Developer가 함께 같은 파일을 수정하는가?**  
   **A:** 아니다. Developer 중지와 lease/Tool 회수·인계가 끝난 후 Main Agent가 순차 인수한다.
8. **Q: DIR 판정이 ALIGNED면 자동으로 다음 Phase에 들어가는가?**  
   **A:** 아니다. 신산님 direction Event와 `CLEARED` 전에는 Gate·후속 작업이 계속 차단된다.
9. **Q: PG15 PASS만으로 production 호환성을 주장할 수 있는가?**  
   **A:** 없다. WSL-server의 별도 격리 PG18 RC 검증과 동일 Git/manifest 승격 증거가 필요하다.
10. **Q: 안정화 순서에서 Plugin이 Skill·Hook보다 먼저인가?**  
    **A:** 아니다. Memory/Learning → Skill → Hook → 독립 검증·운영 안정화 뒤 마지막에 Plugin으로 포장한다.

## 11. 현재 허용·금지 행동과 최종 판정

### 허용

- 현재 권위 문서·progress/HANDOFF의 read-only 분석
- Main Agent가 요청한 질문·충돌·위험·착수조건 보고
- 승인된 WorkInstruction과 유효 lease가 발행된 뒤 그 범위 안의 구현·기본 테스트·증거 제출

### 금지

- 사람 승인·WorkInstruction·lease 없이 제품 파일 수정
- 설계·계획·검증 기준선·승인·DIR·ReleaseDecision의 임의 변경 또는 대체
- 허용 path 밖 write, 동시 write, stale fencing token 사용
- 승인 없는 Git init/commit/push, 서버 접속·배포, DB 변경, secret 조회
- `SKIPPED/BLOCKED/미실행`을 PASS로 보고하거나 검증하지 않은 산출물을 적용·배포

**판정:** `PASS / READ_ONLY_READY`  
**판단 이유:** 현재 권위 문서 7개의 전체 범위와 실제 hash를 확인했고, revision 2 non-semantic binding과 97 Package·255 ID·DIR 계약이 일치함을 재검증했다. 승인·독립 검증·lease/fencing·실패 3회 인수·세션 복구·환경·보안·Git 전용 승격·G-02 차단 경계를 상위 문서와 모순 없이 설명했다.  
**조치:** 재온보딩은 완료로 보고한다. G-02 독립 Tester PASS와 Main Agent 최종 판정, G-03 WorkInstruction·유효 lease 전까지 모든 구현 권한은 `WRITE_BLOCKED_PENDING_G03_WORK_INSTRUCTION`이다.
