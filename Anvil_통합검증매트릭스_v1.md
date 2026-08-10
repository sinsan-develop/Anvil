# Anvil 통합 검증 매트릭스 v1.2

> 문서 상태: G-02 승인 반영 비의미 정규화본 / 독립 Tester 재검토 대기
> 작성일: 2026-08-10
> 작성 역할: Tester (독립 검증)
> 설계 기준선: `Anvil_설계서_v2.md` v2.6 / SHA-256 `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
> 계획 기준선: `Anvil_작업계획서_v1.md` v1.4 / 97개 Work Package
> 짝 문서: `Anvil_테스트계획서_v1.md` v1.3

---

## 0. 이 문서를 만든 이유

설계서 v2.6은 48장의 운영 헌법과 49장의 canonical 완성 계약을 포함하고, 작업계획서 v1.4는 이를 **8개 Phase Gate와 97개 Package 완료조건**으로 분해한다. 이 문서는 두 기준선의 검증 요구를 하나의 ID·Package·Gate 체계로 동기화한다.

- 계획서 13.3과 설계서 34.6은 "중대 미진 시 해당 차수를 다시 검증한다"고 규정하지만, **재검증 대상 집합이 어디에도 열거되어 있지 않다.**
- 같은 요구가 서로 다른 문장으로 4번까지 반복된다. 예: "SKIPPED/BLOCKED를 PASS로 처리 금지"는 설계서 P11, 22.4, 34.6, 47.18-14, 계획서 A Gate·C-14에 각각 존재한다. 어느 것이 정본인지 정의되지 않았다.
- §49.17의 20개 핵심 완성 시나리오, 승인 binding, EvidenceManifest, fencing, 원자 budget, Web/egress/secret 보안과 Git 전용 WSL-server→ysna-server 승격을 구현 Package와 Gate에 명시적으로 귀속해야 한다.

이 문서는 흩어진 검증 요구를 **단일 ID 체계**로 통합하고, 각 항목에 **책임 Package / 검증 레벨 / 필수 증거 / 심각도 / 판정 기준**을 부여해 Phase Gate 판정과 재검증 범위 산정을 집행 가능하게 만든다.

**이 매트릭스는 설계서를 대체하지 않는다.** 원천 조항과 충돌하면 설계서 49장의 canonical 계약, 48장, 47장, 46장, 36장, 각 상세 절 순으로 우선하며, 그 경우 이 문서의 해당 행을 결함으로 처리하고 revision을 올린다.

---

## 1. ID 체계

```text
AV-<도메인>-<3자리>
```

| 도메인 | 의미 | 주 원천 |
|---|---|---|
| `CON` | 설계 헌법 불변식 | 설계서 2장 P1~P21, 47.19 |
| `SAFE` | 안전·범위·권한·시크릿 | 설계서 10장, 18장, 22.2, 31.2, 39장, 46.9, 49.7~49.8 |
| `STAT` | 상태·영속·중단·재개 | 설계서 22.3, 26장, 27장, 47.8, 47.11, 48.3, 49.3~49.6 |
| `GATE` | 검증 Gate 엔진 | 설계서 11장, 22.4, 32장, 49.1~49.2, 49.10 |
| `AGT` | Main/Subagent 위임·실패·인수 | 설계서 46장, 48.1, 48.6, 계획서 4장 |
| `LRN` | Memory·Skill·Hook·학습 | 설계서 36장, 46.3~46.4, 47.10, 48.7~48.8 |
| `UI` | 화면 표준·상태 표현 | 설계서 15장, 22.5, 29장, 43장 |
| `OPS` | 운영·관측·배포 | 설계서 19장, 20장, 22.5, 49.11~49.13, 계획서 Phase F |
| `FLOW` | End-to-End 사용자 흐름 | 설계서 3장, 22.1, 33장, 47.18, 49.1~49.2 |
| `PLG` | Plugin 포장 | 계획서 Phase P |

번호는 재사용하지 않는다. 항목이 폐기되면 `DEPRECATED`로 표시하고 번호를 남긴다.

---

## 2. 검증 레벨

| 레벨 | 이름 | 정의 | 주 도구 |
|---|---|---|---|
| L1 | 단위 | 함수·reducer·validator 단독 검증 | pytest |
| L2 | 계약 | schema / OpenAPI / enum / hash 계약 검증 | pytest + JSON Schema, OpenAPI diff |
| L3 | 통합 | DB·Queue·Worker·Adapter 결합 검증 | pytest + 실 PostgreSQL |
| L4 | E2E | 브라우저 클릭부터 저장·재표시까지 | Playwright |
| L5 | 적대적 | 금지 동작을 **의도적으로 시도**해 차단을 확인 | pytest(negative) + 수동 |
| L6 | 장애·복구 | 프로세스/PC 강제 종료, quota 고갈, 네트워크 단절 주입 | 스크립트 기반 fault injection |
| L7 | 인수 | 사람이 직접 판정하는 기능검증·설계 부합성 | 수동, 증거 첨부 |

**L5는 Anvil의 핵심 레벨이다.** 이 제품의 가치 대부분(P1·P2·P4·P6·P11·P13·P18·P20)은 "무엇을 하는가"가 아니라 **"무엇을 막는가"** 로 정의되어 있다. 정상 경로만 통과하는 테스트 스위트는 Anvil을 검증하지 못한다.

---

## 3. 검증 방법 코드

| 코드 | 의미 |
|---|---|
| `AU` | 자동 단위·계약 테스트 |
| `AI` | 자동 통합 테스트 |
| `AE` | 자동 E2E(Playwright) |
| `AN` | 자동 negative/적대적 테스트 |
| `FI` | 장애 주입(fault injection) |
| `MI` | 수동 검사(문서·화면·정책 대조) |
| `MX` | 수동 탐색적 테스트 |
| `RV` | 설계·코드 리뷰 판정 |

---

## 4. 증거 유형

| 코드 | 필수 증거 |
|---|---|
| `E-GIT` | 작업 전후 `HEAD`, `git status`, 기준선 hash, 변경 후 hash |
| `E-CMD` | 실행한 정확한 명령 문자열 + exit code + 도구 version |
| `E-DIFF` | 실제 diff 전문 또는 artifact reference |
| `E-TEST` | 테스트 수 / PASS / FAIL / SKIP + skip 사유와 requirement 연결 |
| `E-SHOT` | Playwright screenshot (상태별) |
| `E-NET` | 브라우저 Network 기록(요청 URL 전체 목록) |
| `E-API` | request/response 원문 + OpenAPI contract diff |
| `E-EVT` | Event sequence dump (순서·중복·멱등 확인 가능) |
| `E-PRG` | `build-progress.json` / `BUILD_HANDOFF.md` 스냅샷 |
| `E-AUD` | audit log (actor, 시각, 승인 ID, hash) |
| `E-ART` | artifact hash 및 저장 경로 |
| `E-DEC` | 사람 판정 기록(판정·이유·조치·서명 역할) |
| `E-MAN` | `EvidenceManifest` 원문·manifest hash·실제 delivered target 대조 결과 |

---

## 5. 심각도

| 등급 | 정의 | 조치 | 재검증 범위 |
|---|---|---|---|
| `CRITICAL` | 헌법 위반, 데이터 손실 가능, 승인 우회, secret 노출, 미실행을 PASS 처리 | 즉시 Phase Gate 불합격, 별도 수정 WorkInstruction | 해당 Phase의 CRITICAL 전량 + 관련 MAJOR |
| `MAJOR` | 완료조건 미충족, 필수 Gate 실패, 회귀, 실제 evidence 없음 | 수정 WorkInstruction 발행 후 해당 Package 재검증 | 해당 Package + 직접 종속 Package |
| `MINOR` | 기능·필수 Gate 합격, 문구·정렬·관측성·비차단 UI 보완 | 다음 Package에 흡수 | 없음 |

**MINOR를 이유로 합격한 Package를 다시 열지 않는다**(설계서 34.6, 계획서 13.3).

---

## 6. 매트릭스 본문

### 6.1 CON — 설계 헌법 불변식 (21항)

헌법 항목은 그 자체로 실행 가능한 테스트가 아니라 **상시 불변식**이다. 각 항목은 하위 도메인의 구체 검증 ID로 집행되며, 모든 Phase Gate에서 재확인한다.

| ID | 불변식 | 원천 | 집행 검증 ID | 검증 시점 | 심각도 |
|---|---|---|---|---|---|
| AV-CON-001 | P1 인간 최종 결정권 — 명시 승인 없이 적용·배포·고위험 진행 불가 | 2장 P1, 48.1-1 | SAFE-001~006, SAFE-033, FLOW-012, 024~025 | 전 Phase Gate | CRITICAL |
| AV-CON-002 | P2 기존 자산 보존 — baseline 기록 후 수정 금지 범위 잠금 | 2장 P2, 22.2 | SAFE-010~015 | A Gate 이후 전 Gate | CRITICAL |
| AV-CON-003 | P3 상태 영속성 — 모든 전이가 Event·Checkpoint로 저장 | 2장 P3, 22.3 | STAT-001~010, 041~043 | B Gate 이후 | CRITICAL |
| AV-CON-004 | P4 중대 예외 시 정지 — 위험 상승·범위 이탈·검증 불가는 BLOCKED | 2장 P4, 27.2 | STAT-020~028, SAFE-020 | B Gate 이후 | CRITICAL |
| AV-CON-005 | P5 증거 기반 완료 — 코드/빌드/테스트/실사용 결과를 구분 표시 | 2장 P5, 11.3 | GATE-001~005, UI-008 | C Gate 이후 | CRITICAL |
| AV-CON-006 | P6 최소 변경 — 승인 밖 파일·심볼·목적 변경 자동 탐지 | 2장 P6, 32.3 | SAFE-016~019, GATE-012 | C Gate 이후 | CRITICAL |
| AV-CON-007 | P7 벤더·모델 중립 — 역할은 capability, provider는 Registry 매핑 | 2장 P7, 42장 | OPS-010~012, FLOW-019 | C Gate, F Gate | MAJOR |
| AV-CON-008 | P8 실행 위치 분리 — 오케스트레이션과 실행 backend를 계약 분리 | 2장 P8, 14장 | OPS-013, SAFE-011 | C Gate, F Gate | MAJOR |
| AV-CON-009 | P9 운영 화면 우선 — CLI·DB 직접 조작 없이 전 상태 확인·처리 | 2장 P9, 22.5 | UI-001~004, OPS-001~005 | A Gate, F Gate | MAJOR |
| AV-CON-010 | P10 브라우저 same-origin — 상대 경로만 호출 | 2장 P10, 11.4 | UI-010~012 | A Gate 이후 전 Gate | CRITICAL |
| AV-CON-011 | P11 Fail-closed — 미실행·오류·환경 부족은 PASS가 아님 | 2장 P11, 11.1 | GATE-001~008 | 전 Phase Gate | CRITICAL |
| AV-CON-012 | P12 감사 가능성 — 요청·판단·승인·실행·검증·적용 append-only | 2장 P12, 19장 | STAT-004, OPS-006~008 | B Gate 이후 | CRITICAL |
| AV-CON-013 | P13 방향 결정 비위임 — Agent끼리 범위·승인 대체 불가 | 2장 P13, 47.18-16 | AGT-020~022 | C Gate 이후 | CRITICAL |
| AV-CON-014 | P14 적응형 자동화 — 단일/병렬 선택 근거를 표시 | 2장 P14, 47.4 | AGT-030~033 | E Gate | MAJOR |
| AV-CON-015 | P15 증거 기반 재개 — 완료 단계만 skip, 미확정 부작용 재실행 금지 | 2장 P15, 27.4 | STAT-030~036, 041~043 | B Gate 이후 | CRITICAL |
| AV-CON-016 | P16 네이티브 능력 비복제 — 코딩 loop 재구현 금지 | 2장 P16, 47.1 | RV 판정 (설계 리뷰) | 각 Phase 설계 리뷰 | MAJOR |
| AV-CON-017 | P17 예산도 실행 자원 — 임계값 전 checkpoint 생성 | 2장 P17, 47.9 | STAT-024, AGT-034, 038 | E Gate | MAJOR |
| AV-CON-018 | P18 검증 산출물 동일성 — 검증 hash = 전달·적용 hash | 2장 P18, 47.18-13 | GATE-020~022, 025 | C Gate 이후 | CRITICAL |
| AV-CON-019 | P19 단계별 진행 파일 — 원자 교체 후 다음 단계 허용 | 2장 P19, 48.3 | STAT-011~016 | B Gate 이후 | CRITICAL |
| AV-CON-020 | P20 Main Agent 직접 인수 — 동일 fingerprint 유효 실패 3회 | 2장 P20, 48.6 | AGT-010~016 | C Gate 이후 | CRITICAL |
| AV-CON-021 | P21 통제된 지속 성장 — 승인된 version만 다음 작업에 적용 | 2장 P21, 48.7 | LRN-001~018 | D Gate 이후 | CRITICAL |

---

### 6.2 SAFE — 안전·범위·권한·시크릿 (30항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-SAFE-001 | 설계서·작업계획서 미승인 상태에서 write-capable Step을 시작할 수 없다 | 48.9, 48.1-1 | C-11 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-002 | 승인된 Design/WorkPlan/WorkInstruction의 content hash 1글자 변경 시 종속 승인이 자동 무효화된다 | 48.1-5, 47.18-12, B-04 | B-04 | L2 | AN | E-API, E-AUD | CRITICAL |
| AV-SAFE-003 | hash 변경 후 기존 승인으로 실행을 재개할 수 없다 | 48.9, 27.4 | B-04, B-10 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-004 | 승인 만료(기본 1시간)는 Run 실패가 아니라 `BLOCKED`이며 만료 후 자동 실행하지 않는다 | 10.4 | B-04 | L3 | AN | E-EVT | MAJOR |
| AV-SAFE-005 | Plan / Scope Change / Apply / Deploy / Destructive 5종 승인이 각각 독립 기록된다 | 10.3 | B-04, C-14 | L2 | AU | E-API, E-AUD | MAJOR |
| AV-SAFE-006 | destructive 작업은 별도 이중 확인 없이 실행되지 않는다 | 22.2, 10.3, C-10 | C-10 | L5 | AN | E-CMD, E-AUD | CRITICAL |
| AV-SAFE-010 | 기존 dirty/untracked 파일이 보존된다(변경·삭제 0건) | 22.2, 계획서 3.2, C-09 | A-13, C-09 | L3 | AN | E-GIT, E-DIFF | CRITICAL |
| AV-SAFE-011 | 승인 전 원본 작업공간을 수정하지 않는다(worktree 격리) | 22.2, C-09 | C-09 | L5 | AN | E-GIT | CRITICAL |
| AV-SAFE-012 | read-only onboarding이 파일·Git index·branch를 변경하지 않는다 | 계획서 A Gate, A-13 | A-13 | L5 | AN | E-GIT | CRITICAL |
| AV-SAFE-013 | protected path 접근 시 `PROTECTED_PATH_DENIED`로 Action이 차단된다 | 27.2, 31.2 | C-10 | L5 | AN | E-CMD, E-AUD | CRITICAL |
| AV-SAFE-014 | 허용 path 밖 write 시도가 0건 실행된다 | 32.3, C-10 | C-10 | L5 | AN | E-DIFF, E-AUD | CRITICAL |
| AV-SAFE-015 | 사용자 승인 없이 기존 브랜치·파일·DB를 삭제하지 않으며 force push가 차단된다 | 0.3, 10.1, E-10 | E-10 | L5 | AN | E-CMD, E-AUD | CRITICAL |
| AV-SAFE-016 | 위험도 판정 순서가 `결정론적 규칙 → 영향 분석 → LLM 설명`이며 LLM이 hard risk를 낮출 수 없다 | 10.1 | C-10 | L5 | AN | E-AUD | CRITICAL |
| AV-SAFE-017 | 결정론적 G2 위반을 LLM Reviewer가 PASS로 덮을 수 없다 | 32.3 | C-14 | L5 | AN | E-DIFF | CRITICAL |
| AV-SAFE-018 | 추가 위험 요소(5개 초과 파일, 루트/전역 설정, 테스트 삭제·완화, 검증 비활성화, 네트워크·패키지 설치, 운영 DB 부작용, dirty 충돌, 계획-diff 불일치) 8종이 각각 탐지된다 | 10.2 | C-10 | L5 | AN | E-DIFF, E-AUD | MAJOR |
| AV-SAFE-019 | 승인 계획과 실제 diff 불일치 시 `SCOPE_EXPANSION_REQUIRED`로 새 scope approval이 생성된다 | 27.2, 32.3 | C-11 | L3 | AN | E-EVT | CRITICAL |
| AV-SAFE-020 | 중대 예외(secret 접근·보호 경로·설계 변경)는 failure policy와 무관하게 전체 Run을 정지한다 | 47.18-8, E-07 | E-07 | L5 | AN | E-EVT | CRITICAL |
| AV-SAFE-021 | 실제 secret이 DB·브라우저·로그·LLM payload·artifact store의 5개 경계 어디에도 존재하지 않는다(reference만 저장) | 22.2, 18.4, F-02 | F-01, F-14, F-20 | L5 | AN | E-NET, E-AUD, E-ART | CRITICAL |
| AV-SAFE-022 | Subagent가 parent보다 넓은 권한을 획득하지 못한다 | 46.16-6, 39.2 | C-02, E-01 | L5 | AN | E-AUD | CRITICAL |
| AV-SAFE-023 | 두 Developer가 같은 path의 write lease를 동시에 획득하지 못한다(동시 lease 0건) | 46.16-7, 47.18-6, E-06 | E-06 | L5 | AN+FI | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-024 | 3회째 유효 실패에서 Subagent tool 권한과 lease가 회수된다 | 48.9, 46.16-9, C-13 | C-13 | L3 | AN | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-025 | 사용자의 안전 중단 요청 뒤 새 Tool Action이 예약되지 않는다 | 48.9, 27.3 | B-10 | L5 | AN+FI | E-EVT | CRITICAL |
| AV-SAFE-026 | Hook 중 하나라도 deny하면 Tool이 실행되지 않는다 | 46.16-4 | D-09 | L5 | AN | E-AUD | CRITICAL |
| AV-SAFE-027 | 변경된 Hook hash가 자동 신뢰되지 않는다 | 46.16-3, D-10 | D-10 | L5 | AN | E-AUD | CRITICAL |
| AV-SAFE-028 | Windows drive·WSL `/mnt`·case·symlink·junction·8.3 alias가 같은 `conflict_scope_key`로 정규화되어 이중 write lease가 거부된다 | 49.5, 49.17-6 | B-09, E-06 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-029 | CSRF token 또는 승인 Origin/Host 없이 Apply·Deploy mutation을 호출하면 실행 전에 거부된다 | 49.8, 49.17-9 | B-11, F-15 | L5 | AN | E-API, E-AUD | CRITICAL |
| AV-SAFE-030 | SSRF 방어가 Provider endpoint의 metadata IP·link-local·미승인 private range·redirect·DNS rebinding 연결을 차단한다 | 49.7, 49.17-10 | F-01, F-11 | L5 | AN | E-NET, E-AUD | CRITICAL |
| AV-SAFE-031 | revoke된 Secret version으로 Run을 재개하면 중단되고 Secret access audit가 남는다 | 49.7, 49.17-11 | F-01, B-12 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-SAFE-032 | `DataEgressProfile` 승인 경로 밖 code를 외부 Provider로 보내는 요청이 송신 전에 차단되고 profile 확대가 신산님 승인 없이 적용되지 않는다 | 49.7, 49.17-12 | F-01, F-02 | L5 | AN | E-AUD, E-NET | CRITICAL |
| AV-SAFE-033 | content hash 변경 시 기존 approval binding은 항상 무효화되고, `MAIN_RECONFIRMED_NON_SEMANTIC`은 root human approval 범위를 넓히거나 기능 범위·요구사항·중요 위험 변경에 사용될 수 없다 | 3.5, 48.1-5, 49.14 | B-04 | L5 | AN | E-API, E-AUD | CRITICAL |

---

### 6.3 STAT — 상태·영속·중단·재개 (39항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-STAT-001 | 27.1 정상 전이 11건이 정의된 조건에서만 발생한다(table-driven) | 27.1, B-01 | B-01 | L1 | AU | E-TEST | CRITICAL |
| AV-STAT-002 | 27.1 각 전이가 지정된 산출물(Task snapshot, Impact Map, ExecutionPlan, Approval, Workspace manifest, Patch, Gate report, Review report, Validation report, Apply result, Final report)을 생성한다 | 27.1 | B-01, B-06 | L2 | AU | E-ART | MAJOR |
| AV-STAT-003 | 금지 전이가 table-driven test로 전부 차단된다 | B-01, 27.2 | B-01 | L1 | AN | E-TEST | CRITICAL |
| AV-STAT-004 | 모든 상태 전이가 append-only Event로 기록된다(누락 0건) | 22.3, P12 | B-06 | L3 | AI | E-EVT | CRITICAL |
| AV-STAT-005 | 중복 Event가 멱등 처리된다(중복 Action·중복 적용 0건) | 22.3, B-06 | B-06 | L3 | AN | E-EVT | CRITICAL |
| AV-STAT-006 | 화면 이동만으로 상태가 변경되지 않는다 | B-06 | B-06 | L4 | AN | E-EVT, E-SHOT | MAJOR |
| AV-STAT-007 | optimistic version 충돌 시 409가 반환된다 | B-06, B-11 | B-11 | L2 | AN | E-API | MAJOR |
| AV-STAT-008 | 1 Step : N Attempt, Attempt : 0..1 Delegation 무결성이 DB 제약으로 강제된다 | B-05, 26장 | B-05 | L2 | AN | E-TEST | MAJOR |
| AV-STAT-009 | Delegation·StepAttempt·Step·Run·failure count·lease·progress export가 동일 Event sequence를 유지한다 | 46.16-17 | C-07, B-08 | L3 | AI | E-EVT, E-PRG | CRITICAL |
| AV-STAT-010 | 대형 log는 artifact로 저장되고 DB에는 hash/ref만 남는다 | B-07 | B-07 | L3 | AI | E-ART | MAJOR |
| AV-STAT-011 | 모든 Step 전이에 대응하는 progress file sequence가 존재한다(전이 수 = sequence 수) | 48.9, P19 | B-08 | L3 | AI | E-PRG, E-EVT | CRITICAL |
| AV-STAT-012 | progress/HANDOFF 파일이 원자 교체(atomic replace)된 뒤에만 다음 단계가 허용된다 | P19, B-08 | B-08 | L6 | FI | E-PRG | CRITICAL |
| AV-STAT-013 | transactional outbox의 `DB commit → 파일 replace → ack` 순서가 crash 중 어느 지점에서 끊겨도 복구된다 | B-08 | B-08 | L6 | FI | E-PRG, E-EVT | CRITICAL |
| AV-STAT-014 | 새 Session이 `progress.json`과 HANDOFF를 읽어 완료·실패·다음 행동을 **사람에게 먼저 보고**한다 | 48.9, 48.4 | B-12, G-05 | L7 | MI | E-PRG, E-DEC | CRITICAL |
| AV-STAT-015 | 개발 프로젝트 자체의 `build-progress.json`이 15장 최소 필드를 전부 포함한다 | 계획서 15장 | G-05 | L2 | AU | E-PRG | MAJOR |
| AV-STAT-016 | progress 갱신 시점 7종(Package 시작·완료·실패·중단·승인대기·재개 / 인계 / failure 수락·거부 / lease 발급·회수 / Phase Gate / commit·push·deploy)이 전부 기록된다 | 계획서 15장 | G-05 | L3 | MI | E-PRG | MAJOR |
| AV-STAT-020 | 차단 전이 9종의 `blocked_code`가 정확히 구분된다: BASELINE_CONFLICT / SCOPE_EXPANSION_REQUIRED / PROTECTED_PATH_DENIED / TOOLCHAIN_UNAVAILABLE / VERIFICATION_ENV_UNAVAILABLE / LLM_PROVIDER_UNAVAILABLE / BUDGET_OR_QUOTA_EXCEEDED / APPROVAL_EXPIRED / WORKER_INTERRUPTED | 27.2 | B-06, C-10 | L3 | AN | E-EVT | CRITICAL |
| AV-STAT-021 | 저장소 dirty 충돌 시 원본 보존 후 사용자 선택을 요청한다 | 27.2 | C-09 | L5 | AN | E-GIT, E-EVT | CRITICAL |
| AV-STAT-022 | 필수 도구 미설치는 `BLOCKED TOOL_NOT_INSTALLED`이며 PASS가 아니다 | 32.2, 27.2 | C-14 | L5 | AN | E-CMD | CRITICAL |
| AV-STAT-023 | 테스트 DB/서비스 부재 시 Gate가 `BLOCKED`이고 완료가 금지된다 | 27.2 | E-09 | L5 | AN | E-TEST | CRITICAL |
| AV-STAT-024 | provider quota 강제 소진 시 `PAUSED_QUOTA` + checkpoint + next action이 저장된다 | 47.18-9, 27.2, E-08 | E-08 | L6 | FI | E-EVT, E-PRG | CRITICAL |
| AV-STAT-025 | 한도 소진이 실패로 기록되지 않으며 무승인 fallback이 발생하지 않는다 | E-08, 47.19 | E-08 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-STAT-026 | Worker heartbeat 만료 시 lease 회수 전 재개가 금지된다 | 27.2, B-09 | B-09 | L6 | FI | E-EVT | CRITICAL |
| AV-STAT-027 | Worker 종료 후 orphan lease가 탐지되고 안전 회수된다 | B-09 | B-09 | L6 | FI | E-EVT, E-AUD | CRITICAL |
| AV-STAT-028 | 승인 만료·provider 실패가 각각 정책대로 처리된다(fallback 또는 중단) | 27.2 | E-08 | L3 | AN | E-EVT | MAJOR |
| AV-STAT-030 | 취소 처리 7단계(Event 기록 → 신규 Action 중지 → 정상 종료 신호 → 위험도 확인 후 강제 종료 → artifact 수집 → workspace 24시간 보존 → CANCELLED)가 순서대로 실행된다 | 27.3 | B-10 | L6 | FI | E-EVT, E-ART | CRITICAL |
| AV-STAT-031 | `CANCELLED`는 immutable terminal이며 같은 Run으로 재개되지 않는다 | 27.3, 계획서 B Gate | B-10 | L5 | AN | E-EVT | CRITICAL |
| AV-STAT-032 | 취소 후 계속 작업은 `prior_run_id`를 참조하는 **새 Run**으로만 가능하다 | 27.3 | B-10 | L3 | AI | E-EVT | MAJOR |
| AV-STAT-033 | `:resume`이 `PAUSED_USER` / `PAUSED_QUOTA` / `INTERRUPTED`에서만 허용된다 | 27.4 | B-10 | L5 | AN | E-API | CRITICAL |
| AV-STAT-034 | `success`가 기록된 부작용 Action은 재개 시 재실행되지 않는다 | 27.4, P15 | B-12 | L6 | FI | E-EVT | CRITICAL |
| AV-STAT-035 | 결과 미확인 Action이 `confirmed_success` / `safe_retry` / `manual_review`로 분류된다 | 27.4 | B-12 | L3 | AN | E-EVT | CRITICAL |
| AV-STAT-036 | 외부 요청 **전**과 **후** 각각의 중단을 재현해 중복 요청이 발생하지 않는다 | 47.18-11 | B-12, E-08 | L6 | FI | E-API, E-EVT | CRITICAL |
| AV-STAT-037 | 계획·baseline·정책 version 변경 시 재개 전 재승인이 강제된다 | 27.4 | B-10 | L5 | AN | E-AUD | CRITICAL |
| AV-STAT-038 | 앱·worker·PC 프로세스 강제 종료 후 새 Session이 완료 Step을 건너뛰고 중단 Step만 안전 재실행한다 | 47.18-10, B-12 | B-12 | L6 | FI | E-PRG, E-EVT, E-GIT | CRITICAL |
| AV-STAT-039 | 강제 종료 후 progress/HANDOFF와 DB가 **같은 Event sequence**로 복구된다 | 계획서 B Gate | B-12 | L6 | FI | E-PRG, E-EVT | CRITICAL |
| AV-STAT-040 | Session 재시작 후 Skill version·Hook trust·Agent thread·lease·실패 횟수가 복원된다 | 46.16-12 | D-07, D-10 | L6 | FI | E-PRG, E-AUD | CRITICAL |
| AV-STAT-041 | A-15·C-15·E-11 ACCEPTED 직후 자동 다음 Phase 예약이 `DIR_HOLD`로 차단되고 write lease가 회수된다 | 49.3, 49.17-1 | A-15, C-15, E-11 | L5 | AN | E-EVT, E-PRG | CRITICAL |
| AV-STAT-042 | `ALIGNED` DIR도 신산님의 direction Event 없이는 `CLEARED`·Gate 평가·Run 재개로 전이할 수 없고 DIR-1/2/3과 조건부 DIR-X가 각각 독립 기록된다 | 49.3, 49.17-2 | A-15, C-15, D-13, E-11 | L5+L7 | AN+MI | E-EVT, E-DEC, E-PRG | CRITICAL |
| AV-STAT-043 | Worker A lease 만료 후 Worker B가 증가 epoch/token으로 인수하면 A의 늦은 Step·Tool·Event·filesystem commit이 `STALE_FENCING_TOKEN`으로 거부된다 | 49.5, 49.17-5 | B-09 | L6 | FI | E-EVT, E-AUD | CRITICAL |

---

### 6.4 GATE — 검증 Gate 엔진 (26항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-GATE-001 | Gate 결과가 PASS/FAIL/SKIPPED/BLOCKED/ERROR 5종으로 구분 저장된다 | 11.1, 35장 | C-14 | L2 | AU | E-TEST | CRITICAL |
| AV-GATE-002 | SKIPPED/BLOCKED/ERROR가 완료 인정 계산에서 제외된다 | 11.1, 22.4, C-14 | C-14 | L5 | AN | E-TEST | CRITICAL |
| AV-GATE-003 | 필수 Gate를 임의로 제거할 수 없다 | 11.2 | C-14 | L5 | AN | E-AUD | CRITICAL |
| AV-GATE-004 | Docker·브라우저·계정 부재가 PASS가 아니라 BLOCKED/SKIPPED로 표시된다 | 47.18-14 | E-09 | L5 | AN | E-TEST, E-SHOT | CRITICAL |
| AV-GATE-005 | mock/fixture 결과에 실제 PASS badge를 사용하지 않는다 | 계획서 A Gate, 11.4 | A-12, A-14 | L4 | MI | E-SHOT | CRITICAL |
| AV-GATE-006 | G0에서 repository readable / branch·HEAD / dirty·untracked manifest / runtime 실제 version / 기존 테스트 상태 / backend health 6종을 모두 확인한다 | 32.1 | C-14 | L3 | AI | E-GIT, E-CMD | MAJOR |
| AV-GATE-007 | 기존 테스트가 시작부터 실패하면 `baseline_failure`로 신규 실패와 구분 기록된다 | 32.1 | C-14 | L3 | AN | E-TEST | CRITICAL |
| AV-GATE-008 | 사용자 승인 없이 기존 baseline 실패를 무시하지 않는다 | 32.1 | C-14 | L5 | AN | E-DEC | CRITICAL |
| AV-GATE-009 | G1은 Project Profile에 **탐지된 도구만** 실행한다 | 32.2 | C-14 | L3 | AI | E-CMD | MAJOR |
| AV-GATE-010 | 선언되었으나 미설치된 도구는 `BLOCKED TOOL_NOT_INSTALLED` | 32.2 | C-14 | L5 | AN | E-CMD | CRITICAL |
| AV-GATE-011 | G2 결정론적 검사 7종(경로 범위 / 파일 삭제 / test 삭제·skip 추가 / dependency·lockfile / public surface / secret pattern / formatter drift)이 각각 탐지된다 | 32.3 | C-14 | L5 | AN | E-DIFF | CRITICAL |
| AV-GATE-012 | G2 LLM Reviewer 검사 5종(완료조건·불필요 리팩토링·암묵 동작 변경·오류처리·유지보수성)이 별도 finding으로 기록된다 | 32.3 | C-14 | L3 | AI | E-DIFF | MAJOR |
| AV-GATE-013 | G3에서 수정 내용이 실제 입력·저장·응답·화면 결과에 반영되는지 assertion한다 | 32.4 | C-14 | L3 | AI | E-TEST | CRITICAL |
| AV-GATE-014 | mock만 통과한 테스트가 실제 경계 검증과 구분 표시된다 | 32.4 | C-14 | L3 | MI | E-TEST | CRITICAL |
| AV-GATE-015 | skip 항목이 사유와 requirement 연결을 갖는다(사유 없는 skip 0건) | 32.4 | C-14 | L2 | AN | E-TEST | MAJOR |
| AV-GATE-016 | G4가 함수 signature AST 비교만으로 PASS할 수 없다 | 32.5 | E-09 | L5 | AN | E-TEST | CRITICAL |
| AV-GATE-017 | G4 adapter 5종(API OpenAPI diff / DB migration up·down / Browser BFF route·Network / Module 호출자·import / External sandbox 분리)이 영향에 따라 선택된다 | 32.5 | E-09 | L3 | AI | E-API, E-NET | MAJOR |
| AV-GATE-018 | G5가 production 설정 build를 사용하며 개발 서버 실행 성공으로 대체되지 않는다 | 32.6 | E-09 | L5 | AN | E-CMD, E-ART | MAJOR |
| AV-GATE-019 | G6 시나리오가 6필드(사전조건·행동/입력·기대·실제·증거·판정)를 전부 갖는다 | 32.7 | E-09 | L2 | MI | E-DEC | MAJOR |
| AV-GATE-020 | 필수 Gate가 검증한 artifact hash와 전달·적용 hash가 동일하다 | P18, 47.18-13, C-14 | C-14 | L5 | AN | E-ART, E-GIT | CRITICAL |
| AV-GATE-021 | hash 불일치 시 완료가 차단된다 | 47.18-13 | C-14 | L5 | AN | E-EVT | CRITICAL |
| AV-GATE-022 | Apply Approval 없이 적용이 발생하지 않는다(D10 기준선) | 23장 D10, C-14 | C-14 | L5 | AN | E-AUD | CRITICAL |
| AV-GATE-023 | G7 회귀 대상 4종(Impact Map 관련 기능 / 핵심 smoke set / 공통 helper 소비자 / 인증·설정·라우팅 공유 경계)이 선정된다 | 32.8 | E-09 | L3 | AI | E-TEST | MAJOR |
| AV-GATE-024 | 전체 테스트 미실행 시 **실행 범위와 미검증 범위가 명시 표시**된다 | 32.8 | E-09 | L4 | MI | E-SHOT, E-TEST | CRITICAL |
| AV-GATE-025 | 다른 commit·image digest·DB migration head·config·policy·provider routing snapshot의 PASS EvidenceManifest를 현재 Release에 연결하면 `EVIDENCE_TARGET_MISMATCH`로 거부된다 | 49.10, 49.17-15 | E-09, F-20 | L5 | AN | E-MAN, E-AUD | CRITICAL |
| AV-GATE-026 | 검증 매트릭스·테스트계획이 설계 v2.6 hash, 작업계획 v1.4의 97개 Package, DIR-1/2/3·DIR-X와 Package 역색인을 일치시키며 구 기준선·미할당 ID가 0건이다 | 49.18, 계획서 G-07 | G-07 | L2 | AU+RV | E-ART, E-DEC | CRITICAL |

---

### 6.5 AGT — Main/Subagent 위임·실패·인수 (38항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-AGT-001 | DelegationPacket에 목표·허용·금지·완료조건·baseline hash 중 하나라도 누락되면 시작이 차단된다 | C-02 | C-02 | L5 | AN | E-AUD | CRITICAL |
| AV-AGT-002 | backend(Claude/Codex/Local) 교체 후에도 packet/result 계약이 동일하다 | C-01, 47.18-19 | C-01 | L2 | AI | E-API | MAJOR |
| AV-AGT-003 | 한 Step budget이 강제된다 | C-01, P17 | C-01 | L3 | AN | E-EVT | MAJOR |
| AV-AGT-004 | **M1** Main이 저장소 변경 없이 Developer를 시작·중지하고 결과를 자동 수신한다 | C-03 | C-03 | L3 | AI | E-GIT, E-ART | MAJOR |
| AV-AGT-005 | **M1** 사람이 실행 중 개입(steer/resume)하고 세션 중단 후 같은 Delegation을 복원한다 | C-04, 48.1-6 | C-04 | L6 | FI | E-EVT, E-PRG | CRITICAL |
| AV-AGT-006 | 사람 입력이 최우선 Event로 처리된다 | 48.1-6 | C-04, B-10 | L3 | AN | E-EVT | MAJOR |
| AV-AGT-007 | **M2** Result Envelope가 COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED 5종 schema를 강제한다 | C-05 | C-05 | L2 | AU | E-API | MAJOR |
| AV-AGT-008 | **M2** 원인·증거·변경 경로·잔여 작업·판단 요청이 없는 보고는 유효 실패로 집계되지 않는다 | C-06, 46.16-14 | C-06 | L5 | AN | E-EVT | CRITICAL |
| AV-AGT-009 | 무효한 `FAILURE_REPORT`가 Step을 `NEEDS_FIX`로 전이시키지 않는다 | 46.16-14 | C-06 | L5 | AN | E-EVT | CRITICAL |
| AV-AGT-010 | Subagent의 단순 중단·내부 명령 실패가 FAILURE_REPORT로 누적되지 않는다 | 46.16-8, 계획서 4.4 | C-06 | L5 | AN | E-EVT | CRITICAL |
| AV-AGT-011 | `INCOMPLETE`는 checkpoint로 재개하고 실패 횟수를 올리지 않는다 | 계획서 4.4 | C-06 | L3 | AN | E-EVT | MAJOR |
| AV-AGT-012 | `INCOMPLETE`의 reason code에 따라 `NEEDS_FIX / RETRY_WAIT / INTERRUPTED`가 구분된다 | 46.16-15 | C-05 | L2 | AU | E-EVT | MAJOR |
| AV-AGT-013 | `BLOCKED` Delegation의 Step이 `READY`로 남아 재예약되지 않고 Run이 `WAITING_DECISION / BLOCKED`로 전이한다 | 46.16-16 | C-07 | L3 | AN | E-EVT | CRITICAL |
| AV-AGT-014 | `BLOCKED`가 환경·권한·사람 결정으로 분류되어 필요한 항목만 상위 요청된다 | 계획서 4.4 | C-07 | L3 | AI | E-EVT | MAJOR |
| AV-AGT-015 | Delegation 결과가 canonical Step 상태·Event에 **1회만** 반영된다 | C-07 | C-07 | L3 | AN | E-EVT | CRITICAL |
| AV-AGT-016 | 모든 terminal result가 `DelegationOutcomeResolver`(46.8.1)를 거치며 Delegation과 Step 상태가 모순되지 않는다 | 48.9, 46.16-13 | C-07 | L3 | AI | E-EVT | CRITICAL |
| AV-AGT-017 | `REPORTING/COMPLETED`만으로 Step이 완료되지 않고, Result Validator와 필수 evidence 통과 후 **같은 transaction**에서 `Step.COMPLETED`가 된다 | 46.16-13 | C-07 | L3 | AN | E-EVT | CRITICAL |
| AV-AGT-018 | **M3** 같은 `(step_lineage_id, failure_fingerprint)`의 유효 보고만 1·2·3회로 누적된다 | C-12, 48.6 | C-12 | L3 | AN | E-EVT | CRITICAL |
| AV-AGT-019 | 1회 보완 방향 전달 / 2회 WorkInstruction revision / 3회 인수의 단계별 대응이 기록된다 | 계획서 4.4 | C-12 | L7 | MI | E-DEC | MAJOR |
| AV-AGT-020 | **M3** 3회째에 Developer가 강제 중지되고 순차 인수되며 **동시 write 0건**이다 | C-13, 46.16-9 | C-13 | L5 | AN | E-EVT, E-DIFF | CRITICAL |
| AV-AGT-021 | Main Agent가 최신 diff·test·checkpoint를 받은 뒤에만 인수 가능하다 | 46.16-10 | C-13 | L5 | AN | E-ART | CRITICAL |
| AV-AGT-022 | 3회 전 Main Agent 인수는 사용자 `HUMAN_OVERRIDE_TAKEOVER` Event 없이 시작되지 않는다 | 48.9 | C-13 | L5 | AN | E-EVT, E-AUD | CRITICAL |
| AV-AGT-023 | 인수된 Step에 Main Agent가 직접 수행했다는 actor 기록이 남는다 | 48.9 | C-13 | L2 | AU | E-AUD | MAJOR |
| AV-AGT-024 | Main Agent가 종료되거나 책임 주체가 없는 상태에서 Subagent만 계속 실행할 수 없다 | 48.9, 48.1-2 | C-11 | L5 | AN+FI | E-EVT | CRITICAL |
| AV-AGT-025 | Developer Subagent가 실행 중이거나 lease 보유 중일 때 Main Agent가 같은 경로를 동시 수정하지 않는다 | 계획서 4.1 | C-13 | L5 | AN | E-DIFF, E-AUD | CRITICAL |
| AV-AGT-026 | Subagent raw log가 Main context에 무제한 유입되지 않고 요약 + artifact reference로 전달된다 | 46.16-11, 47.18-17 | C-05, E-02 | L3 | MI | E-ART | MAJOR |
| AV-AGT-027 | artifact reference로부터 raw transcript를 복구할 수 있다 | 47.18-17 | E-02 | L3 | AI | E-ART | MAJOR |
| AV-AGT-028 | Subagent 메시지나 Agent 간 합의가 사용자 승인·설계 변경으로 처리되지 않는다 | 47.18-16, P13 | C-11 | L5 | AN | E-AUD | CRITICAL |
| AV-AGT-029 | 사용자가 각 Subagent의 역할·범위·권한·비용·현재 상태를 화면에서 확인하고 중단할 수 있다 | 46.17 | A-07, C-04 | L4 | AE | E-SHOT | MAJOR |
| AV-AGT-030 | Subagent마다 역할·scope·permission·budget·result schema가 다르게 적용된다 | 48.9, E-01 | E-01 | L2 | AU | E-AUD | MAJOR |
| AV-AGT-031 | 작은 변경은 Developer Subagent 1명만 사용하고 불필요한 추가 Subagent 없이 완료된다 | 47.18-4, 0.3 | C-15 | L4 | MI | E-EVT | MAJOR |
| AV-AGT-032 | 대규모 읽기 작업이 독립 Step으로 나뉘고 예산 내에서 병렬 실행된다 | 47.18-5, E-05 | E-05 | L3 | AI | E-EVT | MAJOR |
| AV-AGT-033 | 독립성이 없는 Step은 Single Worker로 자동 축소된다 | 계획서 E Gate | E-04 | L3 | AN | E-EVT | MAJOR |
| AV-AGT-034 | 병렬화가 Single 대비 품질을 낮추거나 비용만 높이면 활성화되지 않는다(benchmark 근거) | 계획서 E Gate, E-11 | E-11 | L7 | MI | E-DEC, E-TEST | MAJOR |
| AV-AGT-035 | 한 Step 실패 시 종속 Step만 차단되고 독립 Step은 계속되며 최종 상태가 성공으로 표시되지 않는다 | 47.18-7, E-07 | E-07 | L3 | AN | E-EVT | CRITICAL |
| AV-AGT-036 | 필수 Step 실패가 남으면 Run이 `SUCCEEDED`가 되지 않는다 | 계획서 E Gate | E-07 | L5 | AN | E-EVT | CRITICAL |
| AV-AGT-037 | DAG cycle이 차단되고 dependency 완료 전 claim이 금지된다 | E-04 | E-04 | L1 | AN | E-TEST | MAJOR |
| AV-AGT-038 | hard limit 직전 병렬 Provider 요청은 DB 원자 예약에 성공한 요청만 송신되고 예약 실패 요청은 Provider에 도달하지 않는다 | 49.6, 49.17-7 | E-08 | L5+L3 | AN+AI | E-EVT, E-API, E-AUD | CRITICAL |

---

### 6.6 LRN — Memory·Skill·Hook·학습 (28항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-LRN-001 | Memory 항목의 source·scope·expiry·충돌·용량 제한이 강제된다 | 36.6, D-01 | D-01 | L2 | AN | E-ART | MAJOR |
| AV-LRN-002 | 같은 Session의 새 Task도 새 snapshot을 받고, 진행 중 snapshot은 불변이다 | D-02, 36.4 | D-02 | L3 | AN | E-ART | CRITICAL |
| AV-LRN-003 | 현재 Run에 학습이 조용히 섞이지 않고 **다음 Task/Run snapshot부터** 적용된다 | 계획서 D Gate, 47.18-18 | D-02 | L5 | AN | E-ART, E-EVT | CRITICAL |
| AV-LRN-004 | 사용자 교정이 candidate로 생성되지만 승인 전 현재/다음 Run 행동을 바꾸지 않는다 | 47.18-18 | D-06 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-005 | 승인되지 않았거나 사전 신뢰 범위 밖인 Memory·Skill·Hook·Prompt 후보가 다음 Task/Run 행동에 영향을 주지 않는다 | 48.9 | D-06 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-006 | LearningSource의 commit/hash·기밀·제외범위가 고정된다 | D-03 | D-03 | L2 | AU | E-ART | MAJOR |
| AV-LRN-007 | private/외부 source의 기밀·license scope가 학습 항목과 다음 사용까지 유지된다 | 48.9 | D-03 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-008 | **검증되지 않은 자체 생성 코드가 positive exemplar로 자동 학습되지 않는다** | 48.9, D-04 | D-04 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-009 | 사용자가 지정한 code/symbol/document에서 CodePattern·Skill·Hook·Benchmark 후보가 source hash와 함께 생성된다 | 48.9, 36.14 | D-03, D-04 | L3 | AI | E-ART | MAJOR |
| AV-LRN-010 | 모든 terminal Run에서 LearningReview 또는 no-change reason이 생성된다(누락 0건) | 48.9, D-05 | D-05 | L3 | AN | E-ART | MAJOR |
| AV-LRN-011 | 후보가 없으면 "학습할 주요 내용 없음"을 **근거와 함께** 기록한다 | 48.9 | D-05 | L3 | MI | E-ART | MAJOR |
| AV-LRN-012 | source→candidate→activation→사용 Run 계보가 추적된다 | D-06 | D-06 | L3 | AI | E-AUD | MAJOR |
| AV-LRN-013 | 승인된 학습이 실제 다음 작업 context와 선택된 Skill/Hook/Prompt revision에 반영됐음을 provenance로 확인할 수 있다 | 48.9 | D-13 | L7 | MI | E-AUD | MAJOR |
| AV-LRN-014 | 잘못 학습한 항목 rollback 시 해당 version을 사용한 Run과 영향 범위를 추적할 수 있다 | 48.9, D-06 | D-06 | L3 | AI | E-AUD | CRITICAL |
| AV-LRN-015 | **M4** 암시 호출 대상이 아닌 Skill이 로드되지 않는다 | 46.16-1 | D-07 | L5 | AN | E-AUD | MAJOR |
| AV-LRN-016 | **M4** Skill 본문은 선택 후 전체 로드되고 reference는 필요할 때만 로드된다 | 46.16-2, D-07 | D-07 | L3 | AI | E-AUD | MAJOR |
| AV-LRN-017 | **M4** 새 Skill은 사람 승인 없이 활성화되지 않으며, 기존 저위험 patch만 trusted_auto가 된다 | D-08, 계획서 D Gate | D-08 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-018 | 사용자가 어떤 Skill이 왜 선택됐는지 화면에서 확인할 수 있다 | 46.17 | D-12 | L4 | AE | E-SHOT | MAJOR |
| AV-LRN-019 | **M5** Hook이 조언이 아니라 versioned deterministic rule로 저장된다 | D-09 | D-09 | L2 | AU | E-ART | MAJOR |
| AV-LRN-020 | **M5** 새 Hook program이 shadow·pilot·사람 trust 없이 실행되지 않으며 recursion이 차단된다 | 48.9, D-10 | D-10 | L5 | AN | E-AUD | CRITICAL |
| AV-LRN-021 | Hook timeout의 fail-open/fail-closed 정책이 화면과 audit에 일치한다 | 46.16-5 | D-09 | L3 | MI | E-AUD, E-SHOT | MAJOR |
| AV-LRN-022 | trusted_auto matcher **축소** patch 자동 적용 뒤 알림·version·rollback이 남는다 | 48.9 | D-10 | L3 | AI | E-AUD | MAJOR |
| AV-LRN-023 | 반복 수동 검사로부터 Hook 후보가 자동 생성되고 Event·Matcher·Program 계약과 source evidence가 연결된다 | 48.9, 48.7 | D-09 | L3 | AI | E-ART | MAJOR |
| AV-LRN-024 | 사용자가 어떤 Hook이 어떤 입력을 차단했는지 **재현**할 수 있다 | 46.17 | D-12 | L4 | MX | E-SHOT, E-AUD | MAJOR |
| AV-LRN-025 | 승인된 최종 diff가 다음 유사 작업에서 검색되고 필요한 ExampleReference만 로드된다 | 48.9 | D-13 | L3 | AI | E-AUD | MAJOR |
| AV-LRN-026 | Prompt/Model Benchmark가 동일 snapshot baseline 대비 품질·비용·회귀를 비교한다 | D-11 | D-11 | L3 | AI | E-TEST | MAJOR |
| AV-LRN-027 | LearningSource revoke·license 변경·secret 노출 후 파생 Skill·Hook·Memory의 신규 사용이 차단되고 진행 Run 영향이 격리·보고된다 | 49.9, 49.17-13 | D-03, D-06 | L5 | AN | E-AUD, E-EVT | CRITICAL |
| AV-LRN-028 | 동일 model ID라도 privacy·가격·capability snapshot이 바뀌면 새 Run이 `BLOCKED_CAPABILITY_DRIFT`로 중단되고 probe·benchmark·필요 승인을 다시 요구한다 | 49.9, 49.17-14 | D-11, F-02 | L5 | AN | E-AUD, E-TEST | CRITICAL |

---

### 6.7 UI — 화면 표준·상태 표현 (16항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-UI-001 | 1920×1080 기준 본문 12px 화면 표준을 준수한다 | 22.5, 15.1, A-02 | A-02 | L4 | AE | E-SHOT | MAJOR |
| AV-UI-002 | 설명은 tooltip/popover로 제공하고 상시 설명 박스를 두지 않는다 | A-02 | A-02 | L4 | MI | E-SHOT | MINOR |
| AV-UI-003 | 운영자가 CLI·DB 직접 조회 없이 상태와 문제를 확인한다 | 22.5, P9 | F-01 | L7 | MX | E-SHOT, E-DEC | MAJOR |
| AV-UI-004 | 운영자가 전체 흐름과 예외·재개 지점을 화면만 보고 설명할 수 있다 | 계획서 A Gate | A-14 | L7 | MX | E-DEC | MAJOR |
| AV-UI-005 | 모든 정상·거부·보완·중단·재개 경로가 화면에서 연결된다 | A-01 | A-01 | L7 | MI | E-SHOT | MAJOR |
| AV-UI-006 | 전 화면의 loading/empty/error/blocked/quota/cancel/reconnect 7상태가 설계·구현된다 | A-12 | A-12 | L4 | AE | E-SHOT | MAJOR |
| AV-UI-007 | **미실행·SKIPPED·BLOCKED가 PASS로 보이지 않는다**(색상·badge·문구 포함) | A-12, P11 | A-12 | L4 | AN | E-SHOT | CRITICAL |
| AV-UI-008 | 기술 PASS·사용자 기능판정·결함 심각도·재작업이 분리 표시된다 | A-08, 11.3 | A-08 | L4 | MI | E-SHOT | CRITICAL |
| AV-UI-009 | 계획과 결과의 차이가 화면에 표시된다 | 22.1 | A-08 | L4 | AE | E-SHOT | MAJOR |
| AV-UI-010 | 브라우저 Network에 `localhost`·내부 컨테이너 주소·내부 API 포트 직접 호출이 **0건**이다 | 11.4, 22.5, P10 | A-14, F-15, F-20 | L4 | AN | E-NET | CRITICAL |
| AV-UI-011 | 브라우저 코드가 `/api/...` same-origin 상대 경로만 사용한다 | 11.4, 25.2 | B-11 | L4 | AN | E-NET | CRITICAL |
| AV-UI-012 | 내부 API 주소가 BFF·route handler·reverse proxy에서만 사용된다 | 11.4 | B-11, F-15 | L3 | RV | E-API | CRITICAL |
| AV-UI-013 | 화면 버튼 클릭부터 API·저장 결과·화면 재표시까지 검증된다 | 11.4, 32.7 | E-09 | L4 | AE | E-SHOT, E-NET, E-API | CRITICAL |
| AV-UI-014 | 선언·mock·정적 화면이 실제 기능 검증 증거로 인정되지 않는다 | 11.4 | E-09 | L7 | MI | E-DEC | CRITICAL |
| AV-UI-015 | 화면의 모든 필드가 source artifact 또는 projection에 연결된다(trace matrix) | A-15 | A-15 | L2 | MI | E-ART | MAJOR |
| AV-UI-016 | SSE `Last-Event-ID` 재연결 시 이벤트 유실·중복이 없다 | B-11 | B-11 | L3 | FI | E-EVT | MAJOR |

---

### 6.8 OPS — 운영·관측·배포 (25항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-OPS-001 | Alert·Audit·비용·Worker·Queue를 화면에서 관리한다 | 22.5, F-13 | F-13 | L4 | AE | E-SHOT | MAJOR |
| AV-OPS-002 | 시스템이 이상을 **먼저 감지**해 원인·영향·next action을 표시한다 | A-11, F-13 | A-11, F-13 | L4 | FI | E-SHOT | MAJOR |
| AV-OPS-003 | Alert dedupe·ack·actor가 기록된다 | F-13 | F-13 | L3 | AI | E-AUD | MAJOR |
| AV-OPS-004 | 비용·quota 복구 이력을 조회할 수 있다 | F-13 | F-13 | L4 | AE | E-SHOT | MAJOR |
| AV-OPS-005 | 장애 후 마지막 안전 지점에서 화면에서 재개할 수 있다 | 22.3, 35장 | F-13, B-12 | L6 | FI | E-SHOT, E-PRG | CRITICAL |
| AV-OPS-006 | audit log에 actor·시각·승인 ID·hash가 전부 남는다 | P12, F-13 | F-13 | L2 | AU | E-AUD | CRITICAL |
| AV-OPS-007 | terminal Run의 학습·감사 계보가 backup/restore 후에도 보존된다 | 계획서 F Gate | F-14 | L6 | FI | E-AUD | CRITICAL |
| AV-OPS-008 | 백업본으로 project/run/approval/progress를 복구할 수 있다 | F-14 | F-14 | L6 | FI | E-PRG, E-EVT | CRITICAL |
| AV-OPS-009 | DB migration up/down이 새 DB와 기존 DB 양쪽에서 통과한다 | B-02, F-14 | B-02, F-14 | L3 | AI | E-CMD | MAJOR |
| AV-OPS-010 | Provider/Model capability registry가 역할 라우팅을 결정한다 | F-02, 42장 | F-02 | L3 | AI | E-AUD | MAJOR |
| AV-OPS-011 | Claude/Codex/Local adapter를 바꿔도 TaskGraph·permission·evidence·resume 계약이 유지된다 | 47.18-19 | C-01, F-02 | L3 | AI | E-API, E-EVT | MAJOR |
| AV-OPS-012 | 무승인 provider fallback이 발생하지 않는다 | E-08 | E-08 | L5 | AN | E-AUD | CRITICAL |
| AV-OPS-013 | Local development·WSL-server Test/Staging·ysna-server Production의 checkout·domain·DB·credential 경계가 구분된다 | 49.11, 계획서 F Gate | F-16, F-18 | L7 | MI | E-DEC | CRITICAL |
| AV-OPS-014 | Local production-like 환경에서 브라우저 Network 내부주소 직접 호출 0건 | F-15 | F-15 | L4 | AN | E-NET | CRITICAL |
| AV-OPS-015 | WSL-server 전환 후 migration·health가 통과하고 핵심 E2E·rollback이 검증된다 | F-16, F-17 | F-17 | L6 | FI | E-CMD, E-SHOT | CRITICAL |
| AV-OPS-016 | ysna-server에는 **WSL-server 합격 commit·digest만 Git으로 승격**된다 | 49.12, F-18 | F-18 | L7 | MI | E-DEC, E-GIT, E-MAN | CRITICAL |
| AV-OPS-017 | Local → WSL-server → ysna-server 각 단계에서 같은 API·화면 흐름과 same-origin Network가 검증된다 | 47.18-20, 49.11~49.13 | F-19, F-20 | L4 | AE | E-NET, E-SHOT | CRITICAL |
| AV-OPS-018 | 운영 smoke·관측성·backup/restore·rollback 최종 시나리오가 통과한다 | F-20 | F-20 | L6 | FI | E-SHOT, E-CMD, E-MAN | CRITICAL |
| AV-OPS-019 | Provider 요청 취소 뒤 upstream 요청이 계속되면 abort receipt·request ID·최종 usage를 기록하고 비용을 0으로 처리하지 않는다 | 49.6, 49.17-8 | E-08 | L6 | FI | E-API, E-EVT, E-AUD | CRITICAL |
| AV-OPS-020 | WSL-server에서 검증한 commit·digest와 다른 revision의 ysna-server 배포가 `DEPLOY_ARTIFACT_MISMATCH`로 차단된다 | 49.12, 49.17-16 | F-18 | L5 | AN | E-GIT, E-MAN, E-AUD | CRITICAL |
| AV-OPS-021 | dirty server worktree·server-local patch·`scp` source 복사 배포를 거부하고 승인 remote의 정확한 commit/tag만 checkout한다 | 49.12, 49.17-17 | F-16, F-18 | L5 | AN | E-GIT, E-CMD, E-AUD | CRITICAL |
| AV-OPS-022 | 데이터 손실 가능 migration rollback은 신산님 결정 없이 실행되지 않고 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 정지한다 | 49.12, 49.17-18 | F-14, F-20 | L5+L6 | AN+FI | E-EVT, E-DEC | CRITICAL |
| AV-OPS-023 | `envil.sinsan.kr` 실제 브라우저 Network에 내부 API·DB·OLLAMA 주소와 secret 노출이 0건이다 | 49.11, 49.13, 49.17-19 | F-20 | L4+L5 | AE+AN | E-NET, E-SHOT | CRITICAL |
| AV-OPS-024 | smoke PASS 후에도 MonitoringPolicy 관찰 종료와 신산님 확인 전 `RELEASED` 전이가 차단된다 | 49.13, 49.17-20 | F-20 | L6+L7 | FI+MI | E-EVT, E-DEC, E-MAN | CRITICAL |
| AV-OPS-025 | WSL-server PostgreSQL 15 PASS를 운영 호환성으로 재사용하지 않고 별도 격리 PostgreSQL 18 Release Candidate에서 migration·extension·query·backup/restore·rollback rehearsal을 수행한다 | 49.11 | F-17, F-20 | L3+L6 | AI+FI | E-CMD, E-TEST, E-MAN | CRITICAL |

---

### 6.9 FLOW — End-to-End 사용자 흐름 (25항)

47.18의 20개 시나리오를 정본으로 삼고 계획서 Phase 배치를 부여한다.

| ID | 시나리오 | 원천 | 실행 Phase·Package | 레벨 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|
| AV-FLOW-001 | **설계 전환** — 모호한 아이디어에 복수 대안이 제시되고 사용자 확정 전 실행이 열리지 않는다 | 47.18-1 | A-05, B-03 | L4+L7 | E-SHOT, E-EVT | CRITICAL |
| AV-FLOW-002 | **결정 계보** — 확정·보류·후속 확장이 다음 Iteration과 ProjectVersion에 정확히 전달된다 | 47.18-2 | B-03 | L3 | E-ART, E-AUD | MAJOR |
| AV-FLOW-003 | **작업지시 분리** — InvocationPrompt가 WorkInstruction 본문을 중복하지 않고 정확한 ID/hash를 참조한다 | 47.18-3, G-04 | G-04, B-04 | L2 | E-ART | MAJOR |
| AV-FLOW-004 | **Single Worker** — 작은 변경을 Developer 1명으로 완료 | 47.18-4 | C-15 | L4 | E-EVT, E-DIFF | MAJOR |
| AV-FLOW-005 | **동적 위임** — 대규모 읽기를 독립 Step으로 분할·병렬 실행 | 47.18-5 | E-05 | L3 | E-EVT | MAJOR |
| AV-FLOW-006 | **쓰기 충돌** — 같은 path 두 Step의 동시 lease 불가 | 47.18-6 | E-06 | L5 | E-EVT | CRITICAL |
| AV-FLOW-007 | **독립 실패 계속** — 종속 Step만 차단, 전체 성공 오표시 없음 | 47.18-7 | E-07 | L3 | E-EVT | CRITICAL |
| AV-FLOW-008 | **중대 예외 정지** — secret·보호 경로·설계 변경은 전체 Run 정지 | 47.18-8 | E-07 | L5 | E-EVT | CRITICAL |
| AV-FLOW-009 | **quota 소진** — 강제 한도 발생 시 PAUSED_QUOTA·checkpoint·next action 저장 | 47.18-9 | E-08 | L6 | E-EVT, E-PRG | CRITICAL |
| AV-FLOW-010 | **완전 종료 재개** — 프로세스 종료 후 새 Session이 완료 Step skip, 중단 Step만 재실행 | 47.18-10 | B-12 | L6 | E-PRG, E-GIT | CRITICAL |
| AV-FLOW-011 | **side effect 조정** — 외부 요청 전/후 중단 각각에서 중복 요청 없음 | 47.18-11 | B-12 | L6 | E-API, E-EVT | CRITICAL |
| AV-FLOW-012 | **승인 무효화** — Design/Baseline/WorkPlan/WorkInstruction/diff hash 변경 시 관련 승인 자동 무효화 | 47.18-12 | B-04 | L5 | E-AUD | CRITICAL |
| AV-FLOW-013 | **검증 동일성** — Gate 검증 hash ≠ 전달·적용 hash 이면 완료 차단 | 47.18-13 | C-14 | L5 | E-ART | CRITICAL |
| AV-FLOW-014 | **미실행 정직성** — Docker·브라우저·계정 부재는 BLOCKED/SKIPPED | 47.18-14 | E-09 | L5 | E-TEST, E-SHOT | CRITICAL |
| AV-FLOW-015 | **기능검증 독립성** — 자동 테스트 전부 PASS여도 사용자가 기능 미충족을 기록하면 Release 자동 승인 안 됨 | 47.18-15 | E-09 | L7 | E-DEC | CRITICAL |
| AV-FLOW-016 | **Agent 권한** — Subagent 메시지·합의가 사용자 승인·설계 변경으로 처리되지 않음 | 47.18-16 | C-11 | L5 | E-AUD | CRITICAL |
| AV-FLOW-017 | **context 절약** — 병렬 raw transcript 무제한 합류 없음, artifact reference로 복구 가능 | 47.18-17 | E-02 | L3 | E-ART | MAJOR |
| AV-FLOW-018 | **개인 학습** — 사용자 교정이 candidate로만 생성, 승인 전 행동 불변 | 47.18-18 | D-13 | L5 | E-AUD | CRITICAL |
| AV-FLOW-019 | **provider 교체** — adapter 교체 후 TaskGraph·permission·evidence·resume 계약 유지 | 47.18-19 | F-02 | L3 | E-API | MAJOR |
| AV-FLOW-020 | **운영 배포** — Local→WSL-server→ysna-server 각 단계 동일 API·화면·same-origin 검증 | 47.18-20, 49.11~49.13 | F-19, F-20 | L4 | E-NET, E-SHOT, E-MAN | CRITICAL |
| AV-FLOW-021 | **1차 수직 흐름** — 요청→요구사항 제안→Impact→계획→승인→실행→검증→적용/폐기 전체 재현 | 33장, C-15 | C-15 | L4+L7 | E-SHOT, E-API, E-DIFF | CRITICAL |
| AV-FLOW-022 | **전체 학습 E2E** — 후보 생성→승인→다음 Task 적용→rollback과 무변경 review 재현 | D-13 | D-13 | L4 | E-AUD | CRITICAL |
| AV-FLOW-023 | **제한 병렬 E2E** — 대규모 fixture migration·bug hunt에서 충돌 없는 병렬·독립 실패 격리·비용/속도/품질 비교 | E-11 | E-11 | L4+L7 | E-TEST, E-DEC | MAJOR |
| AV-FLOW-024 | 다른 target/delivered hash의 ProductValidation·ReleaseDecision을 현재 Run에 재사용하면 `RELEASE_SUBJECT_HASH_MISMATCH`로 거부된다 | 49.1, 49.17-3 | E-09 | L5 | E-API, E-AUD | CRITICAL |
| AV-FLOW-025 | 필수 ProductValidation 미완료·BLOCKED·UNSUITABLE 또는 blocking defect가 있으면 `ReleaseDecision.RELEASE`, Apply, Deploy가 모두 차단된다 | 49.1~49.2, 49.17-4 | E-09 | L5+L7 | E-EVT, E-DEC | CRITICAL |

---

### 6.10 PLG — Plugin 포장 (7항)

| ID | 검증 항목 | 원천 | 책임 Package | 레벨 | 방법 | 필수 증거 | 심각도 |
|---|---|---|---|---|---|---|---|
| AV-PLG-001 | **Plugin 없이도 Anvil 핵심 기능과 운영이 완전 동작한다** | 계획서 P Gate | P-01 | L4 | AE | E-SHOT | CRITICAL |
| AV-PLG-002 | 각 후보가 M1~M5·운영 Gate를 통과했고 포장 이유가 기록됐다 | P-01 | P-01 | L7 | MI | E-DEC | MAJOR |
| AV-PLG-003 | 설치 전 권한과 실행 프로그램이 표시되며 숨은 의존성이 없다 | P-02 | P-02 | L5 | AN | E-AUD | CRITICAL |
| AV-PLG-004 | Plugin 도입이 기존 승인·Skill·Hook·Tool 권한을 우회하지 않는다 | 계획서 P Gate | P-02 | L5 | AN | E-AUD | CRITICAL |
| AV-PLG-005 | install·upgrade·disable·uninstall·rollback이 기존 Skill/Hook/Run을 손상하지 않는다 | P-03 | P-03 | L3 | AN | E-AUD | CRITICAL |
| AV-PLG-006 | 설치·upgrade 실패와 비활성화 후에도 기존 프로젝트·Run·학습 계보가 보존된다 | 계획서 P Gate | P-03 | L6 | FI | E-AUD | CRITICAL |
| AV-PLG-007 | 별도 환경 파일럿에서 설치·version·trust·rollback·감사 계보가 검증되고 사람이 최종 승인한다 | P-04 | P-04 | L7 | MI | E-DEC | CRITICAL |

---

## 7. Phase Gate별 필수 통과 집합 (재검증 범위 정본)

**이 표가 계획서 13.3 / 설계서 34.6의 "해당 차수를 다시 검증한다"의 대상 집합이다.**

| Phase Gate | 신규 필수 통과 ID | 회귀 필수 재실행 |
|---|---|---|
| **G Gate** | AV-FLOW-003, AV-STAT-015, AV-STAT-016, AV-GATE-026, AV-CON-016(RV) | — |
| **A Gate** | AV-UI-001~015, AV-SAFE-012, AV-GATE-005, AV-FLOW-001, AV-STAT-041~042 | G Gate 전량 |
| **B Gate** | AV-STAT-001~016, AV-STAT-020~039, AV-STAT-043, AV-SAFE-002~005, AV-SAFE-025, AV-SAFE-028~029, AV-SAFE-033, AV-UI-016, AV-OPS-009, AV-FLOW-002, AV-FLOW-010~012 | A Gate 전량 + AV-UI-010~012 |
| **C Gate** | AV-SAFE-001, 006, 010, 011, 013, 014, 016~019, 022, 024, AV-GATE-001~003, 006~015, 020~022, AV-AGT-001~031, AV-FLOW-004, 013, 016, 021, AV-OPS-011 | B Gate CRITICAL 전량 |
| **D-Learning Gate** | AV-LRN-001~014, AV-LRN-027 | — |
| **D-Skill Gate** | AV-LRN-015~018 | D-Learning Gate 전량 |
| **D-Hook Gate** | AV-LRN-019~026, AV-LRN-028, AV-SAFE-026, AV-SAFE-027, AV-STAT-040 | D-Skill Gate 전량 |
| **D Gate** | 위 3개 내부 Gate 전량 + AV-FLOW-018, AV-FLOW-022 | C Gate CRITICAL 전량 |
| **E Gate** | AV-SAFE-015, 020, 023, AV-GATE-004, 016~019, 023~025, AV-AGT-032~038, AV-UI-013, 014, AV-OPS-012, AV-OPS-019, AV-FLOW-005~009, 014, 015, 017, 023~025, AV-STAT-041~042 | D Gate CRITICAL 전량 |
| **F Gate** | AV-SAFE-021, AV-SAFE-029~032, AV-OPS-001~025, AV-UI-003, 010, 012, AV-GATE-025, AV-LRN-028, AV-FLOW-019, 020 | E Gate CRITICAL 전량 |
| **P Gate** | AV-PLG-001~007 | F Gate CRITICAL 전량 |

**회귀 원칙**: 각 Gate에서 이전 Gate의 `CRITICAL` 항목은 전량 재실행한다. `MAJOR`는 변경 영향(Impact Map)에 걸린 것만, `MINOR`는 재실행하지 않는다.

**설계 의도 정합성 검토(DIR) 병행**: A / C / E Gate는 위 검증 ID 통과와 별개로 `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`를 완료해야 한다. `ALIGNED`도 신산님의 direction Event 없이는 Gate를 열 수 없다. D Gate에서 `AV-LRN-003~005` 중 하나가 동일 target hash에 대해 CRITICAL 실패하면 canonical `DIRX-LRN-CRITICAL`로 **추가 DIR-X**를 실행하고, E-11 뒤 DIR-3은 그대로 유지한다. 상세는 테스트계획서 §11을 따른다.

| DIR | 시점 | 누적 진척 | 차단 대상 |
|---|---|---:|---|
| DIR-1 | A-15 완료 후, A Gate 판정 전 | 22/97 | A Gate·Phase B |
| DIR-2 | C-15 완료 후, C Gate 판정 전 | 49/97 | C Gate·Phase D |
| DIR-X | D Gate에서 `DIRX-LRN-CRITICAL` 발생 시 추가 | 조건부 | Phase E; DIR-3 유지 |
| DIR-3 | E-11 완료 후, E Gate 판정 전 | 73/97 | E Gate·Phase F |

---

## 8. Work Package → 검증 ID 할당

책임 Package가 명시된 항목의 역인덱스다. 각 Package의 `docs/test_reports/{id}_test.md`는 여기 나열된 ID를 **전부** 판정해야 한다.

| Package | 할당 검증 ID |
|---|---|
| G-01 | (기준선 등록 — AV-CON-016 RV) |
| G-02 | AV-SAFE-033, AV-GATE-026 |
| G-03 | AV-SAFE-010, AV-CON-002 |
| G-04 | AV-FLOW-003 |
| G-05 | AV-STAT-014, 015, 016, 041, 042 |
| G-06 | AV-GATE-005(fixture 기준), AV-SAFE-010(fixture 준비) |
| G-07 | AV-GATE-026 |
| A-01 | AV-UI-005, AV-FLOW-001 |
| A-02 | AV-UI-001, 002 |
| A-03 | AV-UI-003, 004 |
| A-04 | AV-UI-004, 005 |
| A-05 | AV-FLOW-001 |
| A-06 | AV-SAFE-005, AV-FLOW-003 |
| A-07 | AV-AGT-029 |
| A-08 | AV-UI-008, 009, AV-FLOW-025 |
| A-09 | AV-LRN-018, 024 |
| A-10 | AV-OPS-010, AV-LRN-028 |
| A-11 | AV-OPS-002 |
| A-12 | AV-UI-006, 007, AV-GATE-005 |
| A-13 | AV-SAFE-010, 012 |
| A-14 | AV-UI-004, 010, AV-GATE-005 |
| A-15 | AV-UI-015, AV-STAT-041, 042 |
| B-01 | AV-STAT-001, 002, 003 |
| B-02 | AV-OPS-009 |
| B-03 | AV-FLOW-001, 002 |
| B-04 | AV-SAFE-002, 003, 004, 005, 033, AV-STAT-002, AV-FLOW-012 |
| B-05 | AV-STAT-008 |
| B-06 | AV-STAT-004, 005, 006, 020 |
| B-07 | AV-STAT-010 |
| B-08 | AV-STAT-009, 011, 012, 013 |
| B-09 | AV-STAT-026, 027, 043, AV-SAFE-028 |
| B-10 | AV-SAFE-003, 025, AV-STAT-030~033, 037, AV-AGT-006 |
| B-11 | AV-STAT-007, AV-UI-011, 012, 016, AV-SAFE-029 |
| B-12 | AV-STAT-014, 034, 035, 036, 038, 039, AV-OPS-005, AV-SAFE-031, AV-FLOW-010, 011 |
| C-01 | AV-AGT-002, 003, AV-OPS-011 |
| C-02 | AV-AGT-001, AV-SAFE-022 |
| C-03 | AV-AGT-004 |
| C-04 | AV-AGT-005, 006, 029 |
| C-05 | AV-AGT-007, 012, 026 |
| C-06 | AV-AGT-008, 009, 010, 011 |
| C-07 | AV-AGT-013~017, AV-STAT-009 |
| C-08 | AV-GATE-006, 009, 023 |
| C-09 | AV-SAFE-010, 011, AV-STAT-021 |
| C-10 | AV-SAFE-006, 013, 014, 016, 018, AV-STAT-020 |
| C-11 | AV-SAFE-001, 019, AV-AGT-024, 028, AV-FLOW-016 |
| C-12 | AV-AGT-018, 019 |
| C-13 | AV-SAFE-024, AV-AGT-020~023, 025 |
| C-14 | AV-GATE-001~003, 006~015, 020~022, AV-SAFE-017, AV-STAT-022, AV-FLOW-013 |
| C-15 | AV-AGT-031, AV-FLOW-004, 021, AV-STAT-041, 042 |
| D-01 | AV-LRN-001 |
| D-02 | AV-LRN-002, 003 |
| D-03 | AV-LRN-006, 007, 009, 027 |
| D-04 | AV-LRN-008, 009 |
| D-05 | AV-LRN-010, 011 |
| D-06 | AV-LRN-004, 005, 012, 014, 027 |
| D-07 | AV-LRN-015, 016, AV-STAT-040 |
| D-08 | AV-LRN-017 |
| D-09 | AV-LRN-019, 021, 023, AV-SAFE-026 |
| D-10 | AV-LRN-020, 022, AV-SAFE-027, AV-STAT-040 |
| D-11 | AV-LRN-026, 028 |
| D-12 | AV-LRN-018, 024 |
| D-13 | AV-LRN-013, 025, AV-FLOW-018, 022, AV-STAT-042(DIR-X trigger) |
| E-01 | AV-AGT-030, AV-SAFE-022 |
| E-02 | AV-AGT-026, 027, AV-FLOW-017 |
| E-03 | AV-AGT-002, 027, AV-OPS-011 |
| E-04 | AV-AGT-033, 037 |
| E-05 | AV-AGT-032, AV-FLOW-005 |
| E-06 | AV-SAFE-023, AV-FLOW-006 |
| E-07 | AV-SAFE-020, AV-AGT-035, 036, AV-FLOW-007, 008 |
| E-08 | AV-STAT-024, 025, 028, 036, AV-OPS-012, 019, AV-AGT-038, AV-FLOW-009 |
| E-09 | AV-GATE-004, 016~019, 023~025, AV-STAT-023, AV-UI-013, 014, AV-FLOW-014, 015, 024, 025 |
| E-10 | AV-SAFE-015 |
| E-11 | AV-AGT-034, AV-FLOW-023, AV-STAT-041, 042 |
| F-01 | AV-SAFE-021, 030~032, AV-OPS-010 |
| F-02 | AV-OPS-010, 011, AV-LRN-028, AV-FLOW-019 |
| F-03 | AV-OPS-010, 011, AV-FLOW-019(CEREBRAS) |
| F-04 | AV-OPS-010, 011, AV-FLOW-019(GROQ) |
| F-05 | AV-OPS-010, 011, AV-FLOW-019(MISTRAL) |
| F-06 | AV-OPS-010, 011, AV-FLOW-019(OPENROUTER) |
| F-07 | AV-OPS-010, 011, AV-FLOW-019(UPSTAGE) |
| F-08 | AV-OPS-010, 011, AV-FLOW-019(GEMINI) |
| F-09 | AV-OPS-010, 011, AV-FLOW-019(ANTHROPIC) |
| F-10 | AV-OPS-010, 011, AV-FLOW-019(OPENAI) |
| F-11 | AV-SAFE-030, AV-OPS-010, 011, AV-FLOW-019(OLLAMA) |
| F-12 | AV-UI-003, AV-OPS-010, AV-FLOW-019 |
| F-13 | AV-OPS-001~006 |
| F-14 | AV-OPS-007~009, 022 |
| F-15 | AV-OPS-014, AV-SAFE-029, AV-UI-010, 012 |
| F-16 | AV-OPS-013, 015, 021 |
| F-17 | AV-OPS-015, 025 |
| F-18 | AV-OPS-013, 016, 020, 021 |
| F-19 | AV-OPS-017, AV-FLOW-020 |
| F-20 | AV-OPS-017, 018, 022~025, AV-GATE-025, AV-UI-010, AV-FLOW-020 |
| P-01 | AV-PLG-001, 002 |
| P-02 | AV-PLG-003, 004 |
| P-03 | AV-PLG-005, 006 |
| P-04 | AV-PLG-007 |

---

## 9. 테스터 판정 — 계획 검토 결과

`판정 → 판단 이유 → 조치` 형식을 따른다.

### 9.1 v1.2 비의미 정규화 판정

- **판정**: `READY_FOR_G07_RETROSPECTIVE_VALIDATION`
- **판단 이유**: 설계 v2.6의 49.17 시나리오, approval binding, 97개 Package 역색인과 Gate 집합을 문서 기준선에 반영했다. 이는 제품 구현 PASS나 G Gate 합격을 뜻하지 않는다.
- **조치**: G-07에서 독립 Tester가 G-01~G-07을 이 revision으로 소급 검증하고, 모든 Package Test Report와 증거가 PASS일 때만 `ACCEPTED`를 기록한다.

### 9.2 G-07 필수 확인

1. 설계 v2.6 SHA-256과 작업계획 v1.4의 97개 Package가 실제 source와 일치한다.
2. §6의 모든 AV ID가 §8에서 하나 이상의 책임 Package에 할당된다.
3. DIR-1=A-15, DIR-2=C-15, DIR-X=조건부 추가, DIR-3=E-11 위치가 Gate와 테스트계획에서 일치한다.
4. §49.17의 20개 시나리오가 `AV-STAT-041~043`, `AV-SAFE-028~032`, `AV-AGT-038`, `AV-LRN-027~028`, `AV-GATE-025`, `AV-OPS-019~024`, `AV-FLOW-024~025`에 1:1 연결된다.
5. `AV-SAFE-033` approval binding, `AV-GATE-026` 문서 정규화, `AV-OPS-025` PostgreSQL 18 RC 검증이 별도 책임 Package와 증거를 가진다.
6. WSL-server→ysna-server는 Git commit/tag와 EvidenceManifest로만 승격되고 서버 직접 patch·source 복사는 적대적 테스트로 차단된다.

### 9.3 기존 미진의 처리

- 재검증 집합은 §7, Package 역색인은 §8을 정본으로 확정한다.
- Anvil 자체 테스트 스택과 target repository 검증 도구의 분리는 테스트계획 §2.3과 G-02 DecisionRecord로 관리한다.
- 승인 만료, 취소 Workspace 보존, formatter drift, baseline failure, build-progress 필드는 각각 기존 AV ID와 Package에 정식 할당되어 더 이상 provisional 항목이 아니다.

---

## 10. 매트릭스 통계

| 도메인 | 항목 수 | CRITICAL | MAJOR | MINOR |
|---|---:|---:|---:|---:|
| CON (불변식) | 21 | 15 | 6 | 0 |
| SAFE | 30 | 27 | 3 | 0 |
| STAT | 39 | 30 | 9 | 0 |
| GATE | 26 | 18 | 8 | 0 |
| AGT | 38 | 19 | 19 | 0 |
| LRN | 28 | 11 | 17 | 0 |
| UI | 16 | 7 | 8 | 1 |
| OPS | 25 | 18 | 7 | 0 |
| FLOW | 25 | 18 | 7 | 0 |
| PLG | 7 | 6 | 1 | 0 |
| **합계** | **255** | **169** | **85** | **1** |

CON 21항은 그 자체가 실행 테스트가 아니라 하위 도메인으로 집행되는 불변식이므로, **고유 실행 항목은 234개**다.

레벨별 분포(고유 실행 항목 기준 개략): L5 적대적 테스트가 약 60건으로 단일 최대 그룹이며, L6 장애·복구가 약 25건이다. **전체의 40% 이상이 "정상 동작"이 아니라 "차단·정지·복구"를 검증한다.** 이것이 Anvil 테스트 조직 설계의 가장 중요한 입력이다.

---

## 11. 이 문서의 변경 관리

- 설계서 또는 작업계획서의 content hash가 바뀌면 이 매트릭스를 재검토하고 revision을 올린다.
- 항목 추가·삭제·심각도 변경은 Tester가 제안하고 Main Agent 검토 후 신산님이 승인한다.
- Phase Gate 판정 결과는 이 문서가 아니라 `docs/test_reports/`에 기록하고, 이 문서는 **기준**만 유지한다.
