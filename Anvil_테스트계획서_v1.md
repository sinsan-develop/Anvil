# Anvil 테스트 계획서 v1.6

> 문서 상태: 작업계획 v1.7의 2026-09-25 Local·WSL-server 운영 유사 검증 revision / Production 검증 제외
> 작성일: 2026-08-14
> 작성 역할: Tester (독립 검증)
> 최종 승인자: 신산님
> 설계 기준선: `Anvil_설계서_v2.md` v2.8 (현재 hash는 범위 승인 기록에 결박)
> 계획 기준선: `Anvil_작업계획서_v1.md` v1.7 (현재 hash는 범위 승인 기록에 결박) / 108개 Package
> 검증 기준선: `Anvil_통합검증매트릭스_v1.md` v1.5 (현재 hash는 범위 승인 기록에 결박; 검증 항목 255건 / 고유 실행 234건 / U overlay 11건)
> A-01 파생 기준선: `docs/baselines/A-01_PRECONDITION_DERIVED_BASELINE.md` / 승인 `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`

---

## 1. 목적과 문서의 지위

이 문서는 Anvil 개발 프로젝트의 **검증 실행 방법**을 정의한다. *무엇을* 검증하는지는 통합검증매트릭스가, *어떻게·언제·누가·무슨 증거로* 검증하는지는 이 문서가 정한다.

| 문서 | 정의하는 것 |
|---|---|
| `Anvil_설계서_v2.md` v2.8 | 제품이 무엇이어야 하는가 (검증 요구의 원천) |
| `Anvil_작업계획서_v1.md` v1.7 | 무엇을 어떤 순서로 만드는가 (108개 Package·공통 모듈/API 우선·11개 메뉴 직렬) |
| `Anvil_통합검증매트릭스_v1.md` v1.5 | **무엇을** 검증하는가 (AV-* ID 255건 + U overlay 11건) |
| **`Anvil_테스트계획서_v1.md` v1.6** | **어떻게·언제·누가·무슨 증거로** 검증하는가 |

설계서와 충돌하면 설계서가 우선한다. 이 계획의 변경에는 신산님 승인과 revision 갱신이 필요하다.

---

## 2. 테스트 대상 범위

### 2.1 검증 대상

| 대상 | 범위 |
|---|---|
| Anvil 제품 코드 | `apps/web`, `apps/api`, `packages/*`, `domain/*` 전체 |
| Anvil 도메인 계약 | Task/Run/Step/Delegation/Approval enum·전이·Event·hash 계약 |
| Anvil 운영 산출물 | `docs/progress/build-progress.json`, `BUILD_HANDOFF.md`, work_order/completion/test report |
| 실행 환경 | Local → WSL-server Test/Staging → WSL-server 격리 운영 유사 target 3단계; ysna-server Production 제외 |
| Agent 동작 | Main Agent·Developer/Reviewer/Tester Subagent의 권한·실패·인수·학습 동작 |

### 2.2 비대상

| 비대상 | 이유 |
|---|---|
| Claude Code / Codex 내부 코딩 품질 | 설계서 P16 — 네이티브 능력을 재구현하지 않으므로 재검증하지 않는다. Anvil은 **그 위의 상태·권한·증거·조율**만 검증한다 |
| LLM 생성 코드의 절대 품질 | 통계적 품질은 D-11 Benchmark의 상대 비교 대상이지 합격/불합격 판정 대상이 아니다 |
| 외부 참조 프로젝트(Forge/LogicForge/OrcheFlow) | 설계서 0장 — 코드·DB·화면을 이관하지 않으므로 회귀 대상이 아니다 |
| 대상 저장소(target repo)의 비즈니스 로직 정확성 | Anvil이 검증 **절차를 올바르게 실행했는지**만 검증한다 |

### 2.3 명시적 경계 — Anvil 테스트 스택 vs 대상 저장소 검증 도구

계획서 2.2와 설계서 25.1의 `pytest + Playwright` 표기가 두 축을 구분하지 않고 있다(매트릭스 §9.2 T-02). G-02 승인 결정에 따라 두 축을 다음과 같이 확정한다.

| 축 | 내용 | 도구 | 확정 상태 |
|---|---|---|---|
| ① Anvil 자체 테스트 스택 | Anvil 제품 코드를 검증하는 도구 | pytest + Playwright + JSON Schema + OpenAPI diff | `HUMAN_CONFIRMED` |
| ② 대상 저장소 검증 도구 | Anvil이 target repo에 실행하는 Gate 도구 | Project Profile 탐지 기반 가변(ruff/mypy/npm lint/typecheck 등) | `HUMAN_CONFIRMED` |

②는 **Anvil이 도구를 올바르게 선택·실행·판정하는지**가 검증 대상이지, 도구 자체의 품질이 아니다.

---

## 3. 테스트 조직과 독립성

### 3.1 역할

| 역할 | 책임 | 코드 쓰기 권한 |
|---|---|---|
| 신산님 (Owner) | 기능검증 최종 판정, Release 승인, 중대 결함 조치 결정 | 필요 시 직접 개입 |
| Main Agent 어울 | 결과 검토, `ACCEPT/REWORK/BLOCKED/CARRYOVER/REJECT` 1차 판정 | 3회 인수 시에만 |
| **Tester (본 문서 작성자)** | **독립 시나리오 작성, 실제 검증 실행, 회귀·미검증 판정, 결함 보고** | **기본 read-only. 승인된 테스트 fixture만 write** |
| Developer Subagent | 구현 + 기본 테스트(자체 검증) | 자신의 lease 범위 |
| Reviewer | 독립 context에서 diff·설계 부합성 검토 | read-only |

### 3.2 독립성 규칙

1. **Developer가 작성한 테스트는 Tester의 합격 근거가 되지 않는다.** Developer의 테스트는 "구현자가 의도한 동작"을 증명하고, Tester의 테스트는 "설계서가 요구한 동작"을 증명한다. 두 집합은 별도로 관리한다.
2. Tester는 **설계서와 매트릭스만 보고** 시나리오를 작성한다. 구현 코드를 먼저 읽고 시나리오를 만들지 않는다(구현 편향 방지).
3. Tester는 Developer의 completion report를 **증거로 인용하되 근거로 삼지 않는다.** 보고된 PASS는 재실행으로 확인한다.
4. 자동 테스트 전부 PASS여도 Owner의 기능검증 판정이 우선한다(AV-FLOW-015).
5. Reviewer/Tester 위임 검증(E-01~E-03)이 병렬 write 검증(E-04~E-06)보다 **먼저** 완료된다(계획서 E Gate).

### 3.3 Phase E 이전의 Tester 운영

Reviewer/Tester Subagent 자동화는 E-01에서 구현된다. **Phase G~D 구간에서는 개발 작업과 분리된 독립 Subagent 세션이 Tester 역할을 수동 수행한다.** 이 기간의 독립성은 도구가 아니라 절차로 보장한다.

- 검증 세션은 구현 세션과 **다른 대화 세션**에서 시작한다.
- 검증 세션은 WorkInstruction·설계서·매트릭스만 입력으로 받고, 구현 세션의 대화 내용을 받지 않는다.
- 검증 세션의 첫 행동은 `git status` + 기준선 hash 확인이며, 결과가 completion report와 다르면 즉시 `REJECT`다.

---

## 4. 테스트 레벨과 유형

### 4.1 레벨 정의 (매트릭스 §2와 동일)

| 레벨 | 이름 | 실행 주체 | 실행 시점 |
|---|---|---|---|
| L1 | 단위 | Developer + Tester | Package 내부, 매 commit |
| L2 | 계약 | Developer + Tester | Package 완료 시 |
| L3 | 통합 | Tester | Package 완료 시 |
| L4 | E2E | Tester | Phase Gate |
| L5 | 적대적 | **Tester 전담** | Package 완료 + Phase Gate |
| L6 | 장애·복구 | **Tester 전담** | Phase Gate |
| L7 | 인수 | Owner + Tester | Phase Gate |

### 4.2 적대적 테스트(L5)를 최우선으로 두는 이유

매트릭스 234개 고유 실행 항목에서 Anvil의 핵심 가치는 "무엇을 하는가"만큼 **"무엇을 막고 어떻게 증명하는가"** 로 정의되어 있다.

- 설계 헌법 21개 중 P1·P2·P4·P6·P10·P11·P13·P18·P20 **9개가 금지 규칙**이다.
- 27.2 차단 전이는 9종, 10.1 prohibited 등급, 10.2 추가 위험 요소 8종이 모두 "발생하면 안 되는 일"이다.

따라서 **정상 경로 테스트가 100% 통과해도 Anvil은 검증되지 않는다.** 각 금지 규칙마다 "규칙을 의도적으로 위반하는 입력"을 만들어 차단을 확인하는 것이 이 프로젝트 테스트의 본체다.

### 4.3 적대적 테스트 작성 규칙

| 규칙 | 내용 |
|---|---|
| AT-1 | 모든 L5 케이스는 **위반 시도 → 차단 확인 → audit 기록 확인**의 3단 검증을 갖는다. 차단만 확인하고 기록을 확인하지 않으면 미완이다 |
| AT-2 | "에러가 났다"는 차단 증거가 아니다. **의도한 `blocked_code` 또는 정책 거부 사유**가 기록되어야 한다 |
| AT-3 | 우회 경로를 최소 2개 시도한다. 예: protected path를 직접 write / symlink 경유 / 상대경로 escape |
| AT-4 | LLM 판단으로 차단되는 항목은 L5로 인정하지 않는다. **결정론적 규칙으로 차단**되어야 한다(설계서 10.1, 32.3) |
| AT-5 | 각 L5 케이스는 "이 방어가 없었다면 무엇이 파괴되는가"를 한 문장으로 기록한다 |

---

## 5. 테스트 환경

### 5.1 환경 정의

| 환경 | 용도 | 대상 Phase | 데이터 |
|---|---|---|---|
| `ENV-LOCAL` | 개발자 로컬 + Tester 로컬 | G~E | fixture repo only |
| `ENV-LOCAL-PROD` | production-like Docker + reverse proxy | F-15 | fixture repo + 합성 운영 데이터 |
| `ENV-WSL-STAGING` | WSL-server 운영 유사 검증 | F-16~F-17 | pgvector PostgreSQL 15, 전용 role/schema + 익명화 데이터 |
| `ENV-WSL-PG18-RC` | PostgreSQL 18 호환성 Release Candidate 검증 | F-17, F-20 | **공유 DB와 분리된** PG18 fixture/복제 데이터 |
| `ENV-WSL-OPS` | WSL-server 격리 운영 유사 검증(Production 아님) | F-18~F-20 | 기존 개발 DB와 분리된 PostgreSQL 18 전용 role/schema + 합성·익명화 데이터 |

### 5.2 포트·경계 (설계서 25.2)

| 프로세스 | 포트 | 브라우저 노출 | 검증 |
|---|---:|---|---|
| Web Console dev | 8300 | 예 | — |
| Control API | 8301 | dev proxy 경유만 | AV-UI-010~012 |
| Worker | 없음 | 아니오 | — |
| PostgreSQL | 5432 | 아니오 | AV-SAFE-021 |

**every E2E 실행 시 브라우저 Network 전체 요청 URL 목록을 캡처해 `localhost:8301` 직접 호출 0건을 확인한다.** 이 검사는 A Gate부터 P Gate까지 모든 Gate에서 반복한다.

### 5.3 환경 격리 원칙

- Tester는 Developer의 worktree를 재사용하지 않는다. **별도 clone 또는 별도 worktree**에서 검증한다.
- L6 장애 주입은 **전용 환경**에서만 실행한다. 다른 세션이 진행 중인 DB에 fault injection을 하지 않는다.
- `ENV-WSL-OPS` 검증은 `ENV-WSL-STAGING` 합격 Git revision과 동일한 artifact digest에 대해서만 수행한다(AV-OPS-016, 020). `ENV-PRODUCTION` 실측은 현재 계획 밖이며 PASS로 집계하지 않는다.
- 배포는 Git 이력만 사용하며 서버의 dirty worktree·직접 patch는 즉시 차단한다(AV-OPS-021).

---

## 6. Fixture와 Golden Set 전략

G-06이 fixture repository와 golden acceptance set을 만든다. 이 계획은 그 요구사항을 정의한다.

### 6.1 필수 fixture repository

| ID | 구성 | 검증 용도 |
|---|---|---|
| `FIX-PY-CLEAN` | Python, 테스트 전부 통과, dirty 없음 | 정상 경로 baseline |
| `FIX-PY-DIRTY` | Python, **dirty + untracked 파일 보유** | AV-SAFE-010, AV-STAT-021 |
| `FIX-PY-REDFAIL` | Python, **기존 테스트가 처음부터 실패** | AV-GATE-007 baseline_failure 구분 |
| `FIX-TS-CLEAN` | TypeScript, lint/typecheck 도구 선언·설치 | AV-GATE-009 |
| `FIX-TS-NOTOOL` | TypeScript, **도구 선언은 있으나 미설치** | AV-GATE-010 BLOCKED |
| `FIX-PROTECTED` | protected path·secret 패턴 포함 | AV-SAFE-013, 021 |
| `FIX-LARGE` | 다수 모듈·순환 의존 포함 대규모 | AV-AGT-032, AV-FLOW-023 |
| `FIX-CONFLICT` | 동일 path를 두 Step이 노리는 구조 | AV-SAFE-023, AV-FLOW-006 |

### 6.2 Golden acceptance set

각 fixture에 대해 **기대 결과를 사전 고정**한다.

```yaml
golden_case:
  case_id: GC-PY-DIRTY-01
  fixture: FIX-PY-DIRTY
  action: "src/calc.py 에 함수 추가"
  expected:
    changed_paths: ["src/calc.py"]
    forbidden_changed_paths: []          # dirty/untracked 파일 목록
    gate_results:
      G0: PASS
      G1: PASS
      G2: PASS
      G3: PASS
    dirty_files_preserved: true
    untracked_files_preserved: true
  fail_if:
    - "dirty 파일의 mtime 또는 content 변경"
    - "SKIPPED/BLOCKED가 완료 인정에 포함됨"
```

**golden set은 구현 전에 확정한다.** 구현 결과를 보고 기대값을 조정하면 검증 가치가 소멸한다. 기대값 변경에는 Owner인 신산님의 승인을 요구한다.

### 6.3 fixture 무결성 검사

모든 검증 실행 **전후**에 fixture repository의 전체 파일 hash 목록을 비교한다. read-only여야 하는 검증에서 hash가 하나라도 바뀌면 그 Package는 즉시 `REJECT`다(AV-SAFE-012).

---

## 7. 진입·종료 기준

### 7.1 Package 단위

**진입 기준 (Tester가 검증을 시작할 조건)**

- [ ] Developer의 `docs/completion_reports/{id}_completion.md`가 존재하고 계획서 14장 YAML 필드를 전부 포함한다
- [ ] `design_baseline_hash`와 `work_instruction_hash`가 현재 승인 hash와 일치한다
- [ ] `changed_paths`가 WorkInstruction의 허용 path 안에 있다
- [ ] 승인 이벤트의 `approval_id`, `target_type/id/hash`, `scope`, `expires_at`이 실제 실행 대상과 일치한다
- [ ] Main Agent 1차 판정이 `ACCEPT` 또는 `CARRYOVER`다 (`REWORK`/`REJECT`는 Tester 검증 대상이 아니다)
- [ ] 검증 대상 revision이 고정되어 있다(작업 중인 브랜치가 아님)

**하나라도 미충족이면 Tester는 검증을 시작하지 않고 `BLOCKED`로 반환한다.** 미완성 산출물을 검증하는 것은 자원 낭비이며, 검증 이력을 오염시킨다.

**종료 기준 (Package 합격 조건)**

- [ ] 매트릭스 §8의 해당 Package 할당 ID를 **전부** 판정했다 (미판정 0건)
- [ ] 할당 ID 중 `CRITICAL` 전부 PASS
- [ ] `MAJOR` 실패 0건, 또는 실패 항목이 Owner 승인으로 `CARRYOVER` 처리됨
- [ ] `SKIPPED`/`BLOCKED` 항목마다 사유와 재검증 시점이 기록됨
- [ ] 필수 증거 유형(매트릭스 §4)이 전부 첨부됨
- [ ] 적용·배포·릴리스 Package는 `EvidenceManifest`의 검증 대상과 전달 대상이 byte-identical이다
- [ ] `docs/test_reports/{id}_test.md` 작성 완료

### 7.2 Phase Gate 단위

**진입 기준**

- [ ] 해당 Phase의 모든 Package가 `ACCEPTED`
- [ ] 매트릭스 §7의 해당 Gate "신규 필수 통과 ID" 전량이 Package 단계에서 최소 1회 PASS
- [ ] 이전 Gate의 `CRITICAL` 회귀 스위트가 실행 가능한 상태

**종료 기준**

- [ ] 매트릭스 §7 신규 필수 통과 ID **전량 PASS**
- [ ] 이전 Gate `CRITICAL` 회귀 **전량 PASS**
- [ ] 계획서 각 Phase Gate 서술 조건 전부 충족
- [ ] L7 인수 항목에 대해 Owner의 `판정 → 이유 → 조치` 기록 존재
- [ ] **A / C / E Gate에 한해: DIR 상태가 `CLEARED`이고 Owner의 명시적 방향 지시가 존재** (§11). `ALIGNED` 판정만으로 진행하지 않는다
- [ ] Phase Test Report 작성 및 신산님 승인

### 7.3 중단 기준 (테스트를 즉시 멈추는 조건)

다음 중 하나라도 발견되면 남은 검증을 중단하고 즉시 보고한다. 이후 항목은 신뢰할 수 없다.

| 조건 | 근거 |
|---|---|
| dirty/untracked 파일 변경 확인 | P2 위반 — 이후 모든 baseline 비교가 무효 |
| secret이 로그·DB·브라우저·context에 노출 | P2/18.4 위반 — 노출 확산 방지 |
| SKIPPED/BLOCKED가 PASS로 집계됨 | P11 위반 — 이후 모든 Gate 결과가 무효 |
| 승인 없이 write Step 실행 | P1 위반 |
| Event sequence와 progress 파일 불일치 | P19 위반 — 이후 재개 검증이 무효 |
| 검증 hash ≠ 적용 hash | P18 위반 — 검증 대상 자체가 불명 |
| 만료·오대상 approval 또는 승인 scope 밖 실행 | P1 위반 — 승인 binding 무효 |
| stale Worker의 fencing token으로 commit 성공 | §47.18-5 위반 — 이중 실행 결과 오염 |
| 예산 원자 예약 실패 후 provider 송신 | §47.18-7 위반 — hard limit 우회 |
| Apply/Deploy CSRF, metadata IP·redirect·DNS rebinding SSRF, 미승인 egress | §49.17-9~12 위반 — 보안 경계 붕괴 |
| 폐기 secret으로 resume하거나 secret이 5개 경계에 노출 | §49.17-11, 19 위반 — 자격증명 확산 |
| `EvidenceManifest`의 target/digest/migration 증거 불일치 | §49.17-3, 15 위반 — 검증하지 않은 산출물 전달 |
| WSL Test/Staging 합격 commit과 격리 운영 유사 target 배포 commit 불일치 또는 서버 dirty patch | §49.17-16~17 위반 — Git-only 승격 파괴 |

---

## 8. 증거 표준

### 8.1 증거 없는 PASS는 FAIL로 처리한다

설계서 22.4와 P11의 직접 귀결이다. "확인했다", "정상 동작한다"는 서술만 있고 매트릭스 §4의 필수 증거 유형이 첨부되지 않은 항목은 **PASS로 집계하지 않는다.**

### 8.2 증거 유형별 최소 요건

| 유형 | 최소 요건 |
|---|---|
| `E-GIT` | 작업 전 `git rev-parse HEAD` + `git status --porcelain` 전문, 작업 후 동일 명령 결과, 두 결과의 diff |
| `E-CMD` | 실행 명령 문자열 그대로 + exit code + `--version` 출력. "테스트를 돌렸다"는 무효 |
| `E-DIFF` | `git diff` 전문 또는 artifact hash. 요약만 있는 것은 무효 |
| `E-TEST` | 총 수 / PASS / FAIL / SKIP 4개 숫자 + skip 각각의 사유 + requirement ID 연결 |
| `E-SHOT` | 상태별 screenshot. 정상 화면 1장만은 무효 — 최소 정상/에러/BLOCKED 3종 |
| `E-NET` | 브라우저 Network의 **전체 요청 URL 목록**. "문제 없음" 서술은 무효 |
| `E-API` | request/response 원문. status code만은 무효 |
| `E-EVT` | Event sequence 전체 dump (id, type, 시각, actor 포함) |
| `E-PRG` | `build-progress.json` 전문 + `BUILD_HANDOFF.md` 전문, 검증 전후 2벌 |
| `E-AUD` | actor, 시각, 승인 ID, 대상 hash 4개 필드 필수 |
| `E-ART` | artifact hash + 저장 경로 + 크기 |
| `E-DEC` | 판정 / 판단 이유 / 조치 3단 + 판정한 역할 |
| `E-MAN` | `manifest_id`, 검증 target hash, Git commit, artifact/image digest, migration set hash, 환경·DB profile, 검증 ID/result/evidence hash, 생성자·시각·서명과 전달 대상 비교 결과 |

### 8.3 증거 보존

- 모든 증거는 `docs/test_reports/{package_id}/evidence/` 하위에 저장하고, test report에서 상대 경로로 참조한다.
- 대용량 로그는 artifact store에 저장하고 report에는 hash + 경로만 남긴다(설계서 B-07 원칙 준용).
- 증거는 해당 Phase Gate 통과 후에도 삭제하지 않는다. 회귀 판정 시 기준선으로 사용한다.

---

## 9. 결함 관리

### 9.1 보고 형식 (고정)

```markdown
### DEF-{연번} · {한 줄 요약}

- **판정**: CRITICAL | MAJOR | MINOR
- **위반 검증 ID**: AV-SAFE-013
- **위반 원천 조항**: 설계서 27.2, 31.2
- **판단 이유**: (관측한 사실 → 기대와의 차이 → 왜 이 등급인가)
- **재현 절차**: 1) … 2) … 3) …
- **증거**: evidence/DEF-007/*.log, screenshot 3장
- **조치**: (수정 WorkInstruction 발행 | 다음 Package 흡수 | Owner 결정 요청)
- **재검증 범위**: 매트릭스 §7 기준 (해당 Package + 종속 Package | 해당 Phase CRITICAL 전량)
```

### 9.2 심각도 판정 기준 (설계서 34.6 + 계획서 13.3 통합)

| 등급 | 판정 조건 (하나라도 해당) |
|---|---|
| `CRITICAL` | 안전 원칙 위반 / 데이터 손실 가능성 / 승인 우회 / 필수 사용자 흐름 단절 / **테스트가 실제 기능을 검증하지 않음** / same-origin 위반 / BLOCKED·SKIPPED를 PASS 처리 / secret 노출 |
| `MAJOR` | 완료조건 미충족 / 공개 동작·데이터·보안·승인 계약 위반 / 필수 Gate 실패 / 회귀 발생 / 실제 evidence 없음 |
| `MINOR` | 기능과 필수 Gate는 합격, 문구·정렬·보조 설명·관측성·비차단 UI 일관성 보완 |

**"테스트가 실제 기능을 검증하지 않음"이 CRITICAL인 점에 주의한다.** mock만 통과한 테스트를 실기능 증거로 제출하는 것은 이 프로젝트에서 기능 결함과 동급이다(설계서 32.4, 11.4).

### 9.3 재검증 범위

| 결함 등급 | 재검증 범위 |
|---|---|
| `CRITICAL` | 해당 Phase의 매트릭스 CRITICAL 전량 + 결함 Package의 할당 ID 전량 |
| `MAJOR` | 결함 Package 할당 ID 전량 + 직접 종속 Package(계획서 "선행" 컬럼 역방향) |
| `MINOR` | 없음. 다음 Package에 흡수 |

**MINOR를 이유로 합격 Package 전체를 다시 열지 않는다**(설계서 34.6, 계획서 13.3).

### 9.4 결함 수명

- 결함은 수정 후 **Tester가 재실행**해서 닫는다. Developer의 "수정했음" 보고로 닫지 않는다.
- CRITICAL 결함은 닫힌 후에도 **회귀 스위트에 영구 편입**한다. 같은 결함의 재발은 등급을 한 단계 올려 처리한다.
- 결함 상태는 `OPEN → ACCEPTED → FIXING → READY_FOR_RETEST → CLOSED`를 기본으로 하고, Owner 결정으로만 `DEFERRED` 또는 `REJECTED`가 될 수 있다.
- `ProductValidation=PASS`여도 blocking CRITICAL·MAJOR 결함이 하나라도 열려 있으면 `ReleaseDecision=BLOCKED`다. 둘은 서로 대체할 수 없다.
- Phase Gate 통과 시점에 열린 CRITICAL·MAJOR 결함이 0건이어야 한다. MINOR는 다음 Phase로 이월 가능하되 목록으로 인계한다.

---

## 10. Phase별 테스트 실행 계획

### 10.1 Phase G — 기준선·운영 준비

| 항목 | 내용 |
|---|---|
| 검증 ID | AV-FLOW-003, AV-STAT-015, AV-STAT-016, AV-GATE-026, AV-CON-016(RV) |
| 주 레벨 | L2, L7(RV) |
| 특이사항 | 코드가 거의 없다. 검증 대상은 **문서·템플릿·진행 파일 계약**이다 |

**핵심 검증**: G-04 template이 "본문 중복 없이 ID/hash 참조"를 실제로 강제하는지. 이를 확인하려면 **WorkInstruction 한 건을 파일만 읽고 다른 세션이 정확히 재구성**하는 실험을 수행한다(계획서 G Gate). Tester가 재구성한 결과와 원본의 의미 차이가 있으면 template 결함이다.

**G-06 fixture 검토**: Tester는 §6.1의 8개 fixture가 전부 준비되었는지, golden set이 구현 전에 고정되었는지 확인한다. **fixture가 부족한 채로 G Gate를 통과하면 이후 모든 L5 검증이 불가능해진다.** 이것이 Phase G에서 Tester가 가장 강하게 보는 지점이다.

**G-07 문서 정규화 successor**: 108개 Package가 매트릭스 역색인에 정확히 1회 이상 배정되고, U-01~U-11이 메뉴 순서대로 직렬이며, §49.17의 20개 시나리오가 모두 개별 AV ID와 Gate를 가져야 한다. 누락·구 Package 수·구 배포 대상·중복 메뉴 책임이 하나라도 있으면 B-05를 시작하지 않는다(AV-GATE-026).

위 108개는 **v1.6 당시 G-07 historical 판정의 모집단**이다. 현재 v1.7 계획의 고유 123개와 문서 successor 후보 F-19A를 포함한 124개를 새 작업에 검증할 때는 매트릭스 §6.12의 추가 16개 역색인을 합쳐 판정한다. 과거 G-07 accepted evidence를 124개 검증으로 승격하거나 소급 변경하지 않는다.

### 10.2 Phase A — 화면·계약·읽기 전용 온보딩

| 항목 | 내용 |
|---|---|
| 검증 ID | AV-UI-001~015, AV-SAFE-012, AV-GATE-005, AV-FLOW-001, AV-STAT-041~042 (+ G Gate 회귀) |
| 주 레벨 | L4, L5, L7 |
| 도구 | Playwright + Network 캡처 |

**최우선 3건**

1. **AV-SAFE-012 (read-only 무결성)** — A-13 실행 전후 fixture 전체 파일 hash 비교. 1건이라도 변경되면 즉시 중단.
2. **AV-UI-007 (미실행이 PASS로 안 보임)** — A-12 상태 카탈로그의 7상태를 실제 렌더링하고, SKIPPED/BLOCKED badge가 PASS와 **색·문구·아이콘 모두** 구분되는지 확인. 색만 다르고 문구가 같으면 결함이다.
3. **AV-UI-010 (same-origin)** — 모든 화면을 순회하며 Network 전체 URL 캡처. 이 검사는 이후 모든 Phase에서 반복한다.

**주의**: Phase A는 mock/prototype 단계다. **mock 결과에 PASS badge를 쓰면 CRITICAL**(AV-GATE-005). 프로토타입이라는 이유로 완화하지 않는다 — 오히려 이 시점의 UI 관용이 이후 전체 제품의 정직성 기준을 결정한다.

**A-01 책임 경계**: A-01은 `AV-UI-005`에 필요한 screen map·journey·Phase Rail의 정상·거부·보완·중단·재개 연결성을 문서 artifact로만 확인하는 `STATIC_ONLY` 단계다. 브라우저 클릭·영속 Event·승인 guard가 아직 없으므로 runtime 결과는 `RUNTIME_DEFERRED / NOT_EXECUTED`로 기록한다. `AV-FLOW-001`의 L4+L7 runtime PASS는 A-05·B-03에서 실제 `E-SHOT`·`E-EVT`로 판정하며 A Gate 회귀에서도 유지한다. fixture·mock·정적 화면을 runtime PASS로 승격하지 않는다.

**DIR-1 강제 중단**: A-15 trace 완료 후 A Gate를 `DIR_HOLD`로 전환한다. Tester 보고와 Owner 방향 지시가 Event로 영속화되어 `CLEARED`가 되기 전에는 B-01 lease를 발급하지 않는다(AV-STAT-041~042).

### 10.3 Phase B — Durable State (테스트 비중 최대)

| 항목 | 내용 |
|---|---|
| 검증 ID | 46건 (매트릭스 §7) |
| 주 레벨 | L1, L3, **L6** |
| 도구 | pytest + 실 PostgreSQL + fault injection 스크립트 |

**Phase B는 전체 계획에서 Tester 작업량이 가장 큰 구간이다.** L6(장애·복구) 25건 중 대부분이 여기 있다.

**필수 fault injection 시나리오**

| ID | 주입 지점 | 확인 |
|---|---|---|
| FI-01 | DB commit 직후 / 파일 replace 직전 kill | AV-STAT-013 |
| FI-02 | 파일 replace 도중 kill | AV-STAT-012 원자성 |
| FI-03 | 파일 replace 직후 / ack 직전 kill | AV-STAT-013 |
| FI-04 | Worker heartbeat 중단 | AV-STAT-026, 027 |
| FI-05 | 외부 요청 송신 **직전** kill | AV-STAT-036 |
| FI-06 | 외부 요청 송신 후 응답 수신 **직전** kill | AV-STAT-036 |
| FI-07 | PC 전체 강제 종료(전원 차단 시뮬레이션) | AV-STAT-038, 039 |
| FI-08 | SSE 연결 강제 절단 후 재연결 | AV-UI-016 |

각 시나리오는 **최소 3회 반복**한다. 1회 성공은 타이밍 우연일 수 있다.

**Agent 없이 검증한다**: 계획서 B Gate는 "Agent를 연결하지 않아도 전 흐름을 상태·Event·checkpoint로 재현"을 요구한다. Tester는 LLM 호출을 stub으로 대체한 상태에서 전체 Run 흐름을 구동해 상태 머신만 독립 검증한다. **여기서 통과하지 못하면 Phase C의 어떤 실패도 원인을 분리할 수 없다.**

**추가 적대 검증**: stale Worker commit은 fencing으로 거부하고(AV-STAT-043), Windows/WSL 대소문자·junction·symlink alias는 하나의 canonical resource로 잠겨야 한다(AV-SAFE-028). Apply/Deploy는 CSRF 토큰 없이 실행되지 않으며(AV-SAFE-029), 승인 대상 hash·scope·만료가 어긋난 요청은 거부·감사 기록한다(AV-SAFE-033).

### 10.4 Phase C — Main + Single Developer

| 항목 | 내용 |
|---|---|
| 검증 ID | 61건 |
| 주 레벨 | L3, **L5** |
| 특이사항 | M1 → M2 → M3을 **각각 독립 검증**한다. 묶어서 통과시키지 않는다 |

**M 단계별 게이트**

| 단계 | Package | 통과 전 금지 | Tester 확인 사항 |
|---|---|---|---|
| M1 | C-03~04 | Skill·Hook·다중 Developer | Developer 1명·read-only·결과 자동 수신만으로 동작하는가 |
| M2 | C-05~07 | FAILURE_REPORT 자동 인수 | **무효 보고가 횟수에 집계되지 않는가**(AV-AGT-008~010) |
| M3 | C-12~13 | 병렬 write | 3회째 lease 회수와 **동시 write 0건**(AV-AGT-020, 025) |

**M2가 이 Phase의 최대 위험 지점이다.** "유효 실패"의 판별이 느슨하면 3회 인수 규칙(P20)이 무의미해진다. Tester는 다음 4종 무효 보고를 각각 투입해 전부 미집계되는지 확인한다.

1. 원인 없는 실패 보고
2. 증거 없는 실패 보고
3. 변경 경로 미기재 실패 보고
4. Agent 응답 중단(타임아웃)을 실패로 위장한 보고

**C-14 Gate 엔진 검증**: G0~G3 각각에 대해 PASS / FAIL / SKIPPED / BLOCKED / ERROR 5종 결과를 **인위적으로 발생**시켜 완료 인정 계산에서 PASS만 집계되는지 확인한다(AV-GATE-001, 002).

**DIR-2 강제 중단**: C-15 완료 후 D-01 lease 전까지 DIR 상태가 `CLEARED`여야 한다. `ALIGNED` 보고만 있고 Owner direction Event가 없으면 진행은 차단된다(AV-STAT-041~042).

### 10.5 Phase D — Learning·Skill·Hook

| 항목 | 내용 |
|---|---|
| 검증 ID | 31건 (내부 Gate 3개 포함) |
| 주 레벨 | L3, L5 |
| 특이사항 | 내부 Gate 3개(Learning → Skill → Hook)를 **순서대로** 통과시킨다 |

**핵심 검증 — "조용한 학습" 탐지**

Phase D의 최대 위험은 승인되지 않은 학습이 다음 Run 동작을 몰래 바꾸는 것이다(AV-LRN-003~005). 이를 검증하려면 **동일 입력 재현 테스트**가 필요하다.

```text
1. 기준 Task T를 실행하고 전체 Event·선택 Skill·Prompt revision을 기록 (baseline B0)
2. 사용자 교정을 발생시켜 learning candidate를 생성 (승인하지 않음)
3. 동일 입력으로 Task T를 재실행 → 결과가 B0과 동일해야 함
4. candidate를 승인
5. 동일 입력으로 Task T를 재실행 → 이번에는 달라져야 하고, provenance에 활성화된 version이 기록되어야 함
6. rollback 후 재실행 → B0으로 복귀해야 함
```

3단계에서 결과가 달라지면 **CRITICAL**(P21 위반)이다.

**AV-LRN-008 (미검증 코드의 positive exemplar 자동 학습 금지)**는 별도 강조한다. 이 방어가 없으면 Anvil이 자기가 만든 나쁜 코드를 다음 작업의 모범으로 학습하는 **품질 붕괴 루프**가 생긴다. Tester는 검증 실패한 Run의 diff를 의도적으로 학습 대상에 투입해 거부되는지 확인한다.

학습 원천이 폐기되면 파생 Skill·Hook·예제도 사용 차단되고 provenance가 남아야 하며(AV-LRN-027), provider/model drift는 새 Run을 차단한다(AV-LRN-028). D Gate에서 AV-LRN-003~005가 같은 대상에 CRITICAL이면 **canonical DIR-X를 추가**하되 DIR-3의 E-11 위치는 유지한다.

### 10.6 Phase E — 독립 검증·DAG·제한 병렬

| 항목 | 내용 |
|---|---|
| 검증 ID | 29건 |
| 주 레벨 | L3, L5, L7 |
| 특이사항 | **Tester 자동화가 이 Phase에서 구현된다.** 자기 자신을 검증하는 구조에 주의 |

**자기 검증 함정**: E-01이 Tester Subagent를 구현한다. 이 Package의 검증을 Tester Subagent로 수행하면 순환 논증이 된다. **E-01~E-03은 사람 또는 외부 독립 세션이 검증한다.**

**병렬 write 충돌 검증(AV-SAFE-023, AV-FLOW-006)**은 경합 조건이므로 1회 성공이 증거가 되지 않는다. `FIX-CONFLICT`에서 **동시 lease 요청을 최소 100회 반복**하고 이중 획득 0건을 확인한다.

**AV-AGT-034 (병렬화 가치 판정)**은 L7이다. 병렬이 Single 대비 품질을 낮추거나 비용만 높이면 Tester는 `활성화 보류`를 권고한다. 이는 결함 보고가 아니라 **제품 결정 권고**이며 최종 판단은 Owner에게 있다.

예산은 송신 전 원자 예약되고 abort 후에도 provider receipt 기반 실제 비용이 확정되어야 한다(AV-AGT-038, AV-OPS-019). `ProductValidation`과 `ReleaseDecision`은 분리하고 target hash와 blocking defect를 각각 검사하며(AV-FLOW-024~025), E-11 뒤 DIR-3이 `CLEARED`되기 전에는 F-01을 시작하지 않는다.

### 10.7 Phase F — 운영 capability·배포 기반

| 항목 | 내용 |
|---|---|
| 검증 ID | 매트릭스 F Gate 신규 필수 ID 전량 |
| 주 레벨 | L4, L6, L7 |
| 환경 | ENV-LOCAL-PROD → ENV-WSL-STAGING/ENV-WSL-PG18-RC → ENV-WSL-OPS |

**환경 승격 규칙**: 각 환경에서 **동일한 E2E 스위트**를 실행한다. 환경별로 다른 시나리오를 쓰면 승격 비교가 불가능하다. 환경 간 차이는 결과에서 드러나야지 시나리오에서 감춰지면 안 된다.

**AV-SAFE-021 (secret 미노출)** 검증 절차:

1. DB 전체 테이블을 secret 패턴으로 grep → 0건
2. 애플리케이션 로그 전체 grep → 0건
3. 브라우저 Network 응답 본문 전체 grep → 0건
4. LLM 요청 payload 로그 grep → 0건
5. artifact store 전체 grep → 0건

5개 중 하나라도 히트하면 CRITICAL이며 즉시 중단한다.

**보안·승격·운영 계약**:

- provider endpoint는 metadata IP, redirect, DNS rebinding을 모두 차단하고 미승인 code/data egress도 차단한다(AV-SAFE-030, 032).
- 폐기 secret으로 resume할 수 없고 감사 Event를 남긴다(AV-SAFE-031).
- `EvidenceManifest`의 Git commit, image digest, migration set hash가 실제 전달 대상과 다르면 적용·배포·릴리스를 차단한다(AV-GATE-025).
- WSL-server Test/Staging 합격 Git commit만 WSL 격리 운영 유사 target에 Git으로 승격하며 서버 dirty worktree·직접 patch를 금지한다(AV-OPS-020~021). ysna-server 승격은 현재 계획 밖이다.
- pgvector PostgreSQL 15 개발/일반 검증과 격리 PostgreSQL 18 운영 유사 검증을 분리하고, PG18 RC는 별도 격리 인스턴스에서 수행한다(AV-OPS-025).
- 데이터 손실 가능 migration rollback은 자동 수행하지 않고 사람 결정으로 전환한다(AV-OPS-022).
- WSL 격리 운영 유사 target에서 내부 주소·secret 노출 0건과 `MonitoringPolicy`의 health/error/budget/failure 관찰을 확인한다. `envil.sinsan.kr` 실측과 `RELEASED` 전이는 현재 계획 밖이며 WSL PASS로 대체하지 않는다(AV-OPS-023~024).

F-01~F-19는 provider·관측·보안·환경 승격 capability를 준비한다. **F-20 최종 WSL 운영 유사 검증은 U-11 acceptance 뒤에만 실행**하며, U-01~U-11 전 메뉴의 동일 ReleaseManifest·same-origin·smoke·rollback evidence를 포함해야 한다. F-20 완료도 Production Release가 아니다.

**F-19A/U-01 문서 successor 선행 검증**: 기존 F Capability Gate의 historical 판정은 소급 변경하지 않는다. U-01 제품 write 전에 후보 F-19A를 독립 Tester가 `AV-OPS-026`·`AV-SAFE-034`로 수락해야 한다. 등록/비등록·비활성 Project→Environment 정확 pair, 서로 허용된 독립 ID의 미허용 교차 조합, actor/permission 철회 다음 요청, scope별 cache 격리, 기존 고정 Dashboard GET/Critical ACK 호환을 각각 실패·정상 경로로 검증한다. 등록 원본·grant·감사·backup/restore 범위를 API/DB 증거로 분리하고, 실제 제품/API/인가/DB 구현 및 migration은 별도 승인 전 `NOT_EXECUTED`다. 로컬 PASS와 동일 clean SHA의 WSL-server PG15/OIDC/HTTPS/Chromium/Network PASS를 혼용하지 않는다. 필요 시 PG18 RC는 격리 실행하며 Production/ysna는 범위 밖이다.

### 10.8 Phase U — 메뉴별 순차 수직 검증

| 순서 | Package | 메뉴 | 핵심 실제 검증 |
|---:|---|---|---|
| 1 | U-01 | Dashboard | 인가된 정확 Project·Environment pair의 선택·철회·새로고침, Asia/Seoul 오늘 포함 1/7/30 달력일→UTC `[start,end)`, 현재 상태/기간 발생 분리, 완전 원본 결손 시 `UNAVAILABLE`, 미해결 Critical·Next Action 상시 노출, 상태·경고·승인대기와 실제 read model 일치 |
| 2 | U-02 | Workbench | 어울 대화·지시·중단·재개·결과·승인 계보를 실제 클릭으로 확인 |
| 3 | U-03 | Projects | intent→baseline→iteration→WI→승인 hash trace와 invalidation 표시 |
| 4 | U-04 | Runs | Step/Attempt/Delegation/Event·pause/resume·checkpoint 흐름 |
| 5 | U-05 | Reviews | ProductValidation·Defect·ReleaseDecision 분리와 blocking 상태 |
| 6 | U-06 | Quality | G0~G3·diff·policy·test·evidence·coverage와 미실행 정직성 |
| 7 | U-07 | Knowledge | candidate→approval→activation→rollback provenance |
| 8 | U-08 | Agents & Automation | worker/lease/fencing/delegation/takeover 및 활성화 상태 |
| 9 | U-09 | Environments | Local·WSL·ysna 경계, health, migration, ReleaseManifest 일치 |
| 10 | U-10 | Operations | queue·worker·alert·audit·cost·backup/restore·monitoring |
| 11 | U-11 | Settings | 9 provider·model·routing·credential 상태·execution mode |

**각 U Package 공통 인수 절차**

1. 이전 U Package가 `ACCEPTED`인지 확인하고 동시에 활성인 메뉴 write lease가 0건인지 검사한다.
2. 1920×1080·기본 12px·tooltip/popover 설명 표준과 키보드·접근성을 실제 브라우저에서 검사한다.
3. loading/empty/error/blocked/quota/cancel/reconnect 7상태를 실제 또는 결정론적 장애 주입으로 확인하고 미실행·BLOCKED를 PASS로 표시하지 않는지 검사한다.
4. 메뉴의 주요 정상·거부·중단·재개 흐름을 실제 클릭하고 `E-SHOT`, `E-NET`, `E-API`, 관련 `E-EVT/E-AUD/E-MAN`을 수집한다.
5. Network 전체 URL에서 브라우저의 `localhost`, `127.0.0.1`, Docker 내부 호스트명·포트, `NEXT_PUBLIC_*` 내부주소 직접 호출과 secret 노출이 0건인지 확인한다.
6. backend 단위·계약 PASS를 화면 PASS로 승격하지 않고, 독립 Tester가 메뉴별 매트릭스 §6.11·§8 ID를 전부 판정한 뒤에만 acceptance한다.
7. 다음 메뉴는 직전 메뉴 acceptance commit과 동일한 clean baseline에서 시작한다.

**U Gate 종료 조건**: U-01~U-11이 순서대로 모두 `ACCEPTED`, 공통 navigation·권한·상태표현 회귀 PASS, cross-menu same-origin Network/secret 위반 0건이어야 한다. 이 조건 전에는 F-20 최종 release 검증을 시작하지 않는다.

**U-01 successor 실제 시험**: `AV-SAFE-034`, `AV-OPS-027`, `AV-UI-017`과 기존 §10.8/매트릭스 §6.11 ID를 독립 판정한다. 서울 자정 전후·월말·윤일의 `[start,end)` 중복/누락, 오늘 포함 7·30일, 브라우저 로컬 timezone 변경, 기간 밖 미해결 경고, 부분 Alert 페이지, 원본 지연/결손, 응답 순서 역전·scope 전환·권한 철회 뒤 stale 결과를 실패 주입한다. Health·실행 중·승인 대기·BLOCKED·Next Actions·Critical의 현재 상태와 기간 발생 수가 서로 다른 basis임을 API/화면으로 증명한다. source completeness가 없는 카드의 `0` 또는 PASS 표기는 FAIL이다. E-API·E-AUD·E-SHOT·E-NET을 같은 scope/시간 경계에 결박하고 실제 클릭·same-origin Network를 별도 확인한다. 미실행·mock·fixture는 실제 브라우저/DB PASS가 아니다.

### 10.9 Phase P — Plugin

| 항목 | 내용 |
|---|---|
| 검증 ID | AV-PLG-001~007 |
| 주 레벨 | L5, L6, L7 |

**AV-PLG-001이 이 Phase의 전제조건이다.** Plugin을 전부 비활성화한 상태에서 Anvil 핵심 E2E가 완전 통과해야 한다. 통과하지 못하면 Plugin이 이미 필수 의존이 된 것이고, 이는 계획서 P Gate 위반이다.

---

## 11. 설계 의도 정합성 검토 (DIR — Design Intent Review)

### 11.1 Phase Gate와 무엇이 다른가

| | Phase Gate | **DIR** |
|---|---|---|
| 방향 | Bottom-up (Package → Phase) | **Top-down (설계서 → 누적 산출물 전체)** |
| 질문 | "지시한 것을 만들었는가" | **"만들어진 것이 여전히 설계서가 의도한 제품인가"** |
| 기준 | WorkInstruction 완료조건 | 설계서 0장·1.2·2장·24장·45장·47.19·48.1 |
| 대상 | 해당 Phase 산출물 | 그 시점까지의 **누적 결과 전부** |
| 판정자 | Main Agent + Tester | **Tester 작성 → Owner 최종** |

**두 질문은 독립이다.** 108개 Package가 전부 `ACCEPTED`여도 제품이 설계 의도에서 벗어날 수 있다. 각 Package는 자기 WorkInstruction에만 충실하면 되고, 그 누구도 전체를 보지 않기 때문이다.

드리프트의 특징은 **단일 위반이 아니라 누적**이라는 점이다. 어느 Package도 잘못하지 않았는데 합이 틀린다. Package 단위 검증은 구조적으로 이것을 잡을 수 없다.

### 11.2 시점 결정

**결론: DIR-1 = A-15 직후 / DIR-2 = C-15 직후 / DIR-3 = E-11 직후. DIR-X는 조건부 추가이며 DIR-3을 이동·대체하지 않는다.**

| | 시점 | 선행 Package | 누적 진척 | 다음 Phase |
|---|---|---|---:|---|
| **DIR-1** | A-15 완료 후, A Gate 승인 **직전** | 22 / 108 | 20% | B (Durable State) |
| **DIR-2** | C-15 완료 후, C Gate 승인 **직전** | 49 / 108 | 45% | D (Learning) |
| **DIR-X** | D Gate에서 AV-LRN-003~005가 같은 대상에 CRITICAL인 경우 **추가** | 조건부 | — | E 착수 전 |
| **DIR-3** | E-11 완료 후, E Gate 승인 **직전** | 73 / 108 | 68% | F (운영·배포) |

### 11.3 시점 선정 근거

DIR의 가치는 **드리프트 발생 확률 × 늦게 발견했을 때의 비용**이다. 비용은 시간에 대해 단조 증가하므로 늦출수록 나쁘고, 확률은 **설계서가 기계적으로 검증 불가능한 구간**에서 높다. 해석 여지가 클수록 드리프트가 생긴다.

| Phase | 산출물 성격 | 기계 검증 가능성 | DIR 필요도 |
|---|---|---|---|
| G | 문서·템플릿 | 산출물이 곧 설계 자체 | 낮음 — 검증할 제품이 아직 없다 |
| **A** | 화면·흐름·UX·Artifact 계약 | **낮음 — 해석 여지 최대** | **높음** |
| B | 상태머신·enum·hash 계약 | 높음 — 27장 표 대비 table-driven | 낮음 |
| **C** | Agent 실행·제품 감각 | **낮음 — P16 위반은 코드에 안 보인다** | **높음** |
| D | 학습·Skill·Hook | 중간 — 내부 Gate 3개가 이미 강제 | 중간 |
| **E** | 워크플로 판단·활성화 결정 | **낮음 — 제품 결정이 섞여 있다** | **높음** |
| F | 배포 | 높음 | 낮음 — 이미 늦다 |
| P | 포장 | 높음 | 낮음 |

세 지점이 24% / 56% / 85%로 거의 3등분되는 것은 결과이지 목적이 아니다. **각 지점은 "싸게 되돌릴 수 있는 마지막 순간" 직전에 배치했다.**

#### DIR-1 — A Gate 직전

A-15가 artifact·상태·API·화면 필드 trace를 고정한다. B부터 F까지 전부 이 계약 위에 올라간다.

이 시점에는 **mock과 prototype만 존재한다.** DB schema도 migration도 Agent도 없다. 제품의 형태를 바꾸는 비용이 사실상 0인 마지막 지점이며, B가 시작되는 순간 계단식으로 오른다.

**A Gate 안이 아니라 직전에 두는 이유**: A Gate는 "화면을 다 만들었는가"를 묻는다. DIR-1은 "이 화면들이 1.2의 문제 10개를 실제로 푸는가"를 묻는다. 후자를 전자에 섞으면 전자에 흡수되어 사라진다. 이건 절차 설계상 흔한 실패이므로 분리를 고집한다.

#### DIR-2 — C Gate 직전

C-15가 첫 완전 수직 흐름이다. **제품이 처음으로 실재하는 시점**이고, 설계서 33장(1차 수직 흐름 예시)·24장(4대 핵심)을 처음으로 실물과 대조할 수 있다.

결정적인 이유는 따로 있다. **P16(네이티브 능력 비복제)은 이 시점에만 판정할 수 있다.** C 이전에는 판정할 실행이 없고, D 이후에는 Skill·Hook이 그 위에 쌓여 되돌리기 어렵다. Anvil이 "Claude Code를 다시 감싼 wrapper"로 변질되는 드리프트는 여기서 놓치면 못 잡는다. 설계서가 0장·45장·47.1에서 반복해 경계하는 것이 정확히 이것이다.

또 하나. **D는 학습으로 행동을 바꾸는 Phase다.** 어긋난 기준선 위에서 학습을 시작하면 드리프트가 학습되어 고착된다. D 착수 전 정합성 확인은 선택이 아니다.

#### DIR-3 — E Gate 직전

F는 현재 범위에서 Local→WSL-server Test/Staging→WSL-server 격리 운영 유사 검증이다. 동일 commit·digest·migration·격리 자원에 결박한 뒤의 방향 변경은 비용이 급증한다. **Production 실측과 구분해 싸게 되돌릴 수 있는 마지막 지점이다.**

동시에 이 시점에 47.18의 E2E 20개와 48.9 헌법 검증조건이 전부 실행 가능해진다. 즉 **47.19 최종 불변식 9개를 처음으로 전량 판정할 수 있는 최초 시점**이기도 하다.

그리고 E Gate 자체가 기술 판정이 아닌 **제품 결정**을 포함한다 — 병렬화를 활성화할 것인가, 외부 검증 자동 연결을 계속 보류할 것인가. 이런 판단은 Gate 통과 여부와 별개로 방향 문제이므로 DIR과 함께 다루는 것이 맞다.

### 11.4 왜 B와 D에는 두지 않는가

**B**: 상태머신은 설계서 27.1·27.2 표와 table-driven test로 기계 검증된다. 여기서 생기는 것은 해석 드리프트가 아니라 구현 오류이고, 이미 AV-STAT-001~040이 커버한다. DIR을 넣어도 새로 발견될 것이 거의 없다.

**D**: 드리프트 위험은 실재한다(P21). 그러나 ① D-Learning / D-Skill / D-Hook 3개 내부 Gate가 이미 승인·pilot·rollback을 강제하고, ② **DIR-2가 D 착수 직전, DIR-3가 D 종료 한 Phase 뒤에 놓여 D를 앞뒤로 감싼다.** 3회 예산에서 D를 넣으려면 A나 C를 빼야 하는데, 둘 다 D보다 비싸다.

**조건부 예외**: D Gate에서 AV-LRN-003~005(조용한 학습)가 같은 대상에 CRITICAL 실패하면 D Gate 직후 **DIR-X를 추가**한다. DIR-X가 추가되어도 E-11 뒤 DIR-3은 그대로 수행한다. 학습이 이미 행동을 오염시킨 상태에서 E를 진행하면 병렬 실행이 오염을 증폭하기 때문이다.

### 11.5 수행 주체

| 주체 | 역할 |
|---|---|
| **Tester (본 문서 작성자)** | 증거 수집, 설계서 원문 대조, 드리프트 판정 초안, DIR Report 작성 |
| 신산님 (Owner) | 설계 변경이 필요한 항목의 최종 결정 |
| Main Agent 어울 | **수행 주체가 될 수 없음** |

Main Agent를 배제하는 이유는 능력이 아니라 위치다. 어울은 설계서와 작업계획서의 작성자다. **자기 의도에 대한 충실도를 자기가 감사하면 드리프트를 드리프트로 인식하지 못한다.** 자기 해석이 곧 기준이 되기 때문이다. 이건 설계서 1.3의 역할 분리와 P13(방향 결정 비위임)의 직접 귀결이다.

Tester의 권한 경계도 같은 논리로 제한된다. **Tester는 드리프트를 제시할 뿐 설계를 고치지 않는다.** 설계서를 고칠지 산출물을 고칠지는 P1에 따라 Owner 결정이다.

### 11.6 검토 대상 — 5개 축

각 축은 설계서 원문과 1:1 대조한다. "그런 것 같다"는 판정 근거가 아니다. **조항 번호와 실물의 위치를 지목**해야 한다.

| 축 | 대조 대상 | 확인 방법 | DIR-1 | DIR-2 | DIR-3 |
|---|---|---|:-:|:-:|:-:|
| **축1 제품 정체성** | 24장 4대 핵심(Workbench / Repository Intelligence / Safe Execution / Evidence-based Verification) | 각각이 실물로 존재하고 서로 대체되지 않았는가 | 화면 | 실물 | 실물 |
| | 45장 최종 제품 정의 문장 | 문장의 각 절에 대응하는 실물을 지목할 수 있는가 | 부분 | 부분 | 전량 |
| | 45장 고유성 표 10행 | "Anvil이 더하는 고유 기준"이 참조 제품 복제로 퇴화하지 않았는가 | — | O | O |
| **축2 문제 해결** | 1.2 해결하려는 문제 10개 | 각각에 대해 "현재 산출물의 어디가 이것을 푸는가"를 지목. **지목 불가 = 드리프트** | O | O | O |
| **축3 범위** | 0.2 범위 8항 | 축소되지 않았는가 | O | O | O |
| | 0.3 비범위 5항 | 침범되지 않았는가 (특히 "모든 작업을 여러 Subagent로 나누지 않는다") | — | O | O |
| | 23장 D1~D10 | 결정이 여전히 유효한가, **무언의 변경**이 없었는가 | O | O | O |
| **축4 헌법·불변식** | 2장 P1~P21 | 각 항이 "설계 문장"이 아니라 **실행되는 강제**인가 | 해당분 | 해당분 | 전량 |
| | 47.19 최종 불변식 9개 | — | — | 부분 | **전량** |
| **축5 사용자 방식** | 48.1 여덟 규칙 | 절차로 살아있는가 | 해당분 | O | O |
| | 0.1.2 MoaWorks 원칙 | 역할 유지 / 단일 작성자 / 구조화 결과 / 3회 인수 / 단계 적용 | — | O | O |

**축2가 가장 강력한 드리프트 탐지기다.** 설계서 1.2는 Anvil이 존재하는 이유 그 자체다. 문제 10개 중 하나라도 "현재 산출물의 어디가 이것을 푸는지" 지목할 수 없다면, 그 기능은 만들어지지 않았거나 다른 것으로 대체된 것이다.

### 11.7 판정

| 판정 | 조건 | 조치 |
|---|---|---|
| `ALIGNED` | 5개 축 전부 실물 대응 확인 | 다음 Phase 진행 |
| `DRIFT_MINOR` | 대응은 하나 표현·강조·우선순위가 설계 의도와 어긋남 | Gate 통과. 다음 Phase WorkInstruction에 보정 지시 포함 |
| `DRIFT_MAJOR` | 축 중 하나가 실물로 존재하지 않거나, 비범위 침범, 또는 D1~D10 무언의 변경 | **Gate 차단.** 보정 Package 발행 후 DIR 재실행 |
| `DIVERGED` | 축1(제품 정체성) 위반 — 만들고 있는 것이 설계서의 제품이 아님 | **Gate 차단 + 신산님께 설계서 재검토 상신** |

`DIVERGED`는 "구현이 틀렸다"는 뜻이 아닐 수 있다. **설계서가 현실과 맞지 않았을 가능성이 같은 무게로 존재한다.** 어느 쪽인지는 Owner가 판단하며, Tester는 관측한 차이만 제시하고 단정하지 않는다.

DIR 런타임 상태는 `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`다. Tester의 `ALIGNED`는 보고 판정일 뿐 자동 해제가 아니다. Owner가 방향 지시를 명시적으로 남기고 그 Event가 영속화되어야 `CLEARED`가 된다. `DRIFT_MAJOR`·`DIVERGED`는 보정 또는 설계 변경 승인 전까지 Hold를 유지한다.

### 11.8 산출물

`docs/test_reports/dir_{n}_design_intent.md`

```markdown
# DIR-{n} 설계 의도 정합성 검토

- 시점: {Phase} Gate 직전 / 선행 Package {마지막 ID} 완료
- 설계 기준선 hash: {sha256} (검토 시점)
- 검토 대상 EvidenceManifest hash: {sha256}
- 누적 검토 대상: Package {n}건, 검증 ID {n}건, test report {n}건
- 수행: Tester / 검토 일시: {ts}

## 1. 축별 대조

### 축1 제품 정체성
| 설계 조항 | 요구 | 실물 위치 | 대응 | 비고 |
|---|---|---|---|---|
| 24장-1 Workbench | 사용자가 목적·범위·결과를 이해하고 결정하는 공간 | `apps/web/features/workbench` + 화면 스크린샷 | O | |
| 24장-2 Repository Intelligence | 수정 전 기존 시스템 이해 | C-08 impact map 산출물 | △ | symbol까지만, test 연결 미흡 |
| ... | | | | |

(축2~축5 동일 형식)

## 2. 드리프트 목록
### DRIFT-{n} · {요약}
- 등급: DRIFT_MINOR | DRIFT_MAJOR | DIVERGED
- 설계 조항: 설계서 1.2-7
- 설계가 의도한 것:
- 현재 산출물이 하고 있는 것:
- 차이가 생긴 지점(추정 Package):
- 증거:
- **판단 요청**: (구현 보정 / 설계 갱신 중 어느 쪽인지 Owner 결정 필요 여부)

## 3. 판정
- **판정**: ALIGNED | DRIFT_MINOR | DRIFT_MAJOR | DIVERGED
- **판단 이유**:
- **조치**:
- **Gate 차단 여부**:

## 4. Owner 결정 요청 항목
(설계 변경 여부를 Tester가 결정하지 않는다 — 목록으로 상신)

## 5. Owner 방향 지시 binding
- direction_event_id:
- dir_report_hash:
- evidence_manifest_hash:
- decision: CONTINUE | CORRECT_IMPLEMENTATION | CHANGE_DESIGN | STOP
- scope / expires_at:
```

DIR report 또는 EvidenceManifest가 변경되면 기존 direction binding은 무효이며 다시 승인받는다.

### 11.9 비용

각 DIR은 **반나절~1일 규모**다. 새 테스트를 실행하지 않는다. 입력은 그 시점까지 이미 생성된 test report·evidence·화면·diff이며, DIR이 하는 일은 **기존 증거의 재해석**이다. 새 코드를 돌리지 않으므로 환경 준비도 필요 없다.

3회 총 비용은 최대 3일이다. Phase C 이후 드리프트를 되돌리는 비용과 비교하면 무시할 수 있다.

### 11.10 조건부 4회차

원칙은 3회다. 다음 중 하나에 해당하면 Tester가 추가 1회를 신산님께 상신한다.

| 조건 | 추가 DIR 시점 |
|---|---|
| 설계서 content hash가 한 Phase 안에서 2회 이상 변경 | 해당 Phase Gate 직전 |
| 어느 DIR이든 `DRIFT_MAJOR` 이상 판정 | 보정 Package 완료 직후 (재실행) |
| D Gate에서 AV-LRN-003~005가 같은 대상에 CRITICAL 실패 | **DIR-X 추가**. DIR-3은 E-11 뒤 유지 |
| Owner가 특정 Phase에서 방향 의문을 제기 | 즉시 |

---

## 12. 회귀 전략

### 12.1 회귀 스위트 구성

| 스위트 | 구성 | 실행 시점 | 목표 시간 |
|---|---|---|---|
| `RS-SMOKE` | 각 Phase의 CRITICAL 중 L1/L2만 | 매 commit | 5분 이내 |
| `RS-CRITICAL` | 누적 CRITICAL 전량 (L1~L5) | Package 완료 시 | 30분 이내 (`HUMAN_CONFIRMED`) |
| `RS-FULL` | 매트릭스 전량 + L6 fault injection | Phase Gate | 시간 제약 없음 |
| `RS-DEFECT` | 과거 CRITICAL 결함 재현 케이스 | Package 완료 시 | RS-CRITICAL에 편입 |

### 12.2 회귀 원칙

- 각 Phase Gate에서 **이전 Gate의 CRITICAL은 전량 재실행**한다. 샘플링하지 않는다.
- `MAJOR`는 Impact Map에 걸린 것만 재실행한다.
- 전체 회귀를 실행하지 못한 경우 **실행 범위와 미검증 범위를 명시**한다(AV-GATE-024). "시간이 없어 일부만 돌렸다"를 침묵하지 않는다.
- CRITICAL 결함이 발생했던 케이스는 영구 회귀 대상이다.

### 12.3 회귀 실행 시간이 한계를 넘을 때

Phase E 이후 `RS-CRITICAL`이 30분을 초과할 것으로 예상된다. 이때의 대응 순서는 다음과 같으며, **범위 축소는 마지막 수단이다.**

1. 병렬 실행 (pytest-xdist, Playwright worker)
2. fixture 준비 캐싱
3. L1/L2와 L3 분리 실행
4. (마지막) Owner 승인 하에 범위 축소 — 축소 범위를 test report에 명시

---

## 13. 리스크와 대응

| ID | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R-01 | **Phase E 이전 Tester 자동화 부재** — G~D 구간 검증이 전부 수동 | 검증 품질이 사람 집중력에 의존, Phase B의 L6 25건이 특히 취약 | §3.3 별도 세션 절차 강제 + fault injection 스크립트를 G-06에서 미리 확보 |
| R-02 | **Developer와 Tester가 같은 LLM** — 같은 맹점을 공유 | 같은 오해를 양쪽이 반복해 결함을 놓침 | E-03 ExternalVerifierAdapter 조기 활용, CRITICAL 항목은 설계서 원문 인용을 강제해 재해석 여지 제거 |
| R-03 | **golden set을 구현 후에 확정** | 기대값이 구현에 맞춰져 검증 가치 소멸 | §6.2 — golden set 변경에 Owner 승인 요구. 구현 후 변경 이력을 test report에 기록 |
| R-04 | **경합 조건 검증의 위양성** — 1회 통과가 안전을 뜻하지 않음 | lease 이중 획득 같은 CRITICAL 결함이 잠복 | 100회 반복 규칙(§10.6), 반복 횟수를 증거에 기록 |
| R-05 | **적대적 테스트 누락** — 정상 경로만 통과시키고 Gate 통과 | Anvil 가치의 40%가 미검증 | Phase Gate 종료 기준에 L5 항목 개수 확인 포함. L5 미실행 Gate는 통과 불가 |
| R-06 | **증거 형식주의** — 증거는 첨부됐으나 내용이 검증되지 않음 | PASS의 신뢰도 붕괴 | §8.2 최소 요건 강제, Tester가 증거를 재해석해 판정. "첨부됨"이 아니라 "확인함"을 기록 |
| R-07 | **Phase B 작업량 과소평가** | 일정 압박으로 L6 축소 → 재개 기능 미검증 | Phase B 테스트 공수를 별도 산정. L6는 축소 불가 항목으로 고정 |
| R-08 | **설계서 hash 변경 시 매트릭스 미갱신** | 검증 기준이 설계와 어긋남 | 매트릭스 §11 — hash 변경 시 재검토 강제. Phase Gate 진입 시 hash 일치 확인을 진입 기준에 포함 |
| R-09 | **과거 미할당 5건의 배정 회귀** | 매트릭스 개정 시 확정된 Package·AV ID 연결이 누락될 수 있음 | G-02 확정 배정과 매트릭스 §8 역색인을 G-07에서 대조. 불일치 시 G Gate 불통과 |
| R-10 | **자기 검증 순환**(E-01 Tester Subagent) | 검증 도구가 자기 결함을 은폐 | §10.6 — E-01~E-03은 사람/외부 세션 검증 고정 |
| R-11 | **DIR의 형식화** — 축별 표를 채우되 "대응함"으로 일괄 통과 | 드리프트 탐지 기능이 소멸하고 Gate 지연만 남음 | §11.6 — 각 축에 **설계 조항 번호 + 실물 위치**를 지목하도록 강제. 지목 불가는 그 자체로 드리프트. 특히 축2(1.2 문제 10개)는 10개 전부 지목 없이는 판정 불가 |
| R-12 | **DIR-2 시점의 P16 판정 난이도** — "wrapper인가"는 정성 판단이라 결론이 흐려지기 쉬움 | Anvil의 가장 큰 전략적 드리프트를 놓침 | DIR-2에서 P16을 단일 질문으로 환원: **"Anvil을 걷어내고 Claude Code만 썼을 때 잃는 것을 3개 이상 구체적으로 지목할 수 있는가."** 지목 불가 시 `DIVERGED` 후보로 상신 |

---

## 14. 테스트 산출물

### 14.1 산출물 목록

| 산출물 | 경로 | 작성 시점 | 작성자 |
|---|---|---|---|
| Package Test Report | `docs/test_reports/{package_id}_test.md` | Package 검증 종료 | Tester |
| 증거 묶음 | `docs/test_reports/{package_id}/evidence/` | 검증 중 | Tester |
| Phase Test Report | `docs/test_reports/phase_{X}_test.md` | Phase Gate | Tester |
| **DIR Report** | `docs/test_reports/dir_{n}_design_intent.md` | **A / C / E Gate 직전 및 조건부 DIR-X** | **Tester** |
| **EvidenceManifest** | `docs/test_reports/manifests/{target_id}.json` | 적용·배포·Release 판정 전 | 검증 파이프라인 |
| 결함 대장 | `docs/test_reports/defects.md` (Markdown 정본) | 상시, 관련 기능 구현 후 DB·화면으로 이관 | Tester |
| 회귀 스위트 정의 | `tests/regression/` | Phase마다 갱신 | Tester |
| golden set | `tests/fixtures/golden/` | G-06, 이후 갱신 | Tester + Developer |
| fault injection 스크립트 | `tests/fault/` | G-06 준비, Phase B 확장 | Tester |

### 14.2 Package Test Report 템플릿

```markdown
# {package_id} Test Report

- 검증 revision: {git sha}
- 설계 기준선 hash: {sha256}
- WorkInstruction hash: {sha256}
- 검증 일시 / 환경: {ts} / ENV-LOCAL
- 검증자: Tester ({세션 식별})

## 1. 진입 기준 확인
| 항목 | 결과 |
|---|---|
| completion report 필드 완비 | O/X |
| hash 일치 | O/X |
| changed_paths 범위 내 | O/X |
| Main Agent 1차 판정 | ACCEPT |

## 2. 검증 결과
| 검증 ID | 레벨 | 방법 | 결과 | 증거 | 비고 |
|---|---|---|---|---|---|
| AV-SAFE-013 | L5 | AN | PASS | evidence/safe-013/ | 우회 3경로 시도 |
| ... | | | | | |

- 판정 대상: {n}건 / PASS {n} / FAIL {n} / SKIPPED {n} / BLOCKED {n}
- SKIPPED·BLOCKED 사유 및 재검증 시점: …

## 3. 결함
(DEF 형식, §9.1)

## 4. 미검증 범위 명시
(실행하지 못한 항목과 이유 — 침묵 금지)

## 5. 판정
- **판정**: ACCEPT | REWORK | BLOCKED | CARRYOVER | REJECT
- **판단 이유**:
- **조치**:
- **재검증 범위**:
```

---

## 15. G-02 승인 결정

`APPROVAL-20260810-G02-DECISIONS-001`에 따라 다음 결정을 반영한다. Q-02는 원문에 정의가 없으므로 요구사항을 추가하지 않는다.

| ID | 항목 | 승인 결정 | 상태 |
|---|---|---|---|
| Q-01 | Anvil 자체 테스트 스택과 대상 저장소 검증 도구의 분리 | ①=`pytest + Playwright + JSON Schema + OpenAPI diff`, ②=Project Profile 기반 가변 도구 | `HUMAN_CONFIRMED` |
| Q-02 | 원문 미정의 항목 | 새 요구사항을 발명하지 않음 | `RESERVED_NOT_DEFINED` |
| Q-03 | Phase E 이전 Tester의 수행 주체 | 개발 작업과 분리된 독립 Subagent 세션 | `HUMAN_CONFIRMED` |
| Q-04 | `RS-CRITICAL` 목표 시간 | 30분 유지 | `HUMAN_CONFIRMED` |
| Q-05 | golden set 기대값 변경 승인 주체 | Owner인 신산님 | `HUMAN_CONFIRMED` |
| Q-06 | 결함 대장의 도구 | Markdown 정본, 관련 기능 구현 후 DB·화면 이관, provenance와 ID 보존 | `HUMAN_CONFIRMED` |

---

## 16. 변경 관리

- 설계서·작업계획서·통합검증매트릭스 중 하나라도 content hash가 바뀌면 이 계획을 재검토하고 revision을 올린다.
- 테스트 레벨 정의, 심각도 기준, 종료 기준의 변경은 신산님 승인 대상이다.
- 시나리오 추가·상세화는 Tester 재량으로 수행하고 test report에 기록한다.
- `[historical]` v1.1 SHA-256은 `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8`, v1.2 SHA-256은 `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A`다.
- v1.3은 `APPROVAL-20260810-G02-DECISIONS-001`의 subject hash `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`를 root human approval로 상속한 `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md`에 binding된다. 변경 후 SHA-256은 해당 binding과 EvidenceManifest에서 고정한다.
- v1.2 content hash의 binding은 content 변경으로 무효화된다. v1.3 변경은 활성 기준선 상태·revision·hash 참조만 정규화하며 테스트 범위·ID·레벨·심각도·종료 기준을 바꾸지 않는다.
- v1.4는 `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`과 `docs/baselines/A-01_PRECONDITION_DERIVED_BASELINE.md`에 binding된다. A-01은 `STATIC_ONLY / RUNTIME_DEFERRED`, A-05·B-03과 A Gate의 `AV-FLOW-001` runtime 책임은 유지한다.
- v1.5는 신산님의 2026-08-14 작업 순서 재편 지시와 작업계획 v1.6 content hash에 binding된다. 기존 검증 레벨·심각도·증거 계약은 유지하고, U-01~U-11의 실제 메뉴별 수직 인수 절차와 F-20 후행 조건을 추가한다.

### v1.7 successor test overlay (구현 전 예약)

설계서 51.x와 작업계획 C-22~C-30의 검증 순서는 `mockup/user-confirm → common contract → API/BFF → screens/menu → local unit/contract/integration → WSL formal DB/container/entity/E2E → independent review/PR`로 고정한다. 각 WorkInstruction은 RED/GREEN, focused/regression/real integration, `NOT_EXECUTED/NOT_INTEGRATED`, rollback을 별도 기록한다. C-28은 mockup artifact와 신산님 확인 evidence 없이는 READY가 될 수 없고, Kakao 외부 계약 미확정 시 C-27은 contract-only다. Oracle 운영 검증은 이 계획에 포함하지 않는다.
