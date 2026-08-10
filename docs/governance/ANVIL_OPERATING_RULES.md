# Anvil 프로젝트 운영규칙 v1.5

> 상태: v1.5 — 신산님 자동 진행·보고 경계 명시 승인 반영
> 적용 범위: Anvil 설계·개발·검증·학습·배포 전 과정  
> 설계 책임자: Main Agent 어울  
> 작업 담당자: Primary Developer Subagent `developer-primary`

## 1. 운영 목적

이 규칙은 Main Agent가 전체 설계와 조율 책임을 유지하면서 Developer Subagent가 승인된 작업을 안전하게 수행하고, 세션이 끊겨도 설계·결정·진행·실패·증거가 복구되도록 한다.

## 2. 문서 기준선

| 문서 | 현재 기준선 | 변경 처리 |
|---|---|---|
| `Anvil_설계서_v2.md` | v2.6 / `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | 신산님 승인본에서 P1 정합성 4건을 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 재확정 |
| `Anvil_작업계획서_v1.md` | v1.4 / 실제 hash는 `build-progress.json`에서 관리 | v2.6의 97개 Package 비의미 기준선 정규화본 |
| `Anvil_통합검증매트릭스_v1.md` | v1.2 / 실제 hash는 `build-progress.json`에서 관리 | v2.6·v1.4·97개 Package 기준 정규화 |
| `Anvil_테스트계획서_v1.md` | v1.3 / 실제 hash는 `build-progress.json`에서 관리 | 동일 기준 실행 절차 비의미 정규화 |
| 이 운영규칙 | v1.5 | 확정 계획 자동 진행, 기능 범위·요구사항·중요 위험 변경 또는 DIR 도달 시 신산님 보고 |

운영규칙 자체 hash는 자기참조 순환을 피하기 위해 `docs/progress/build-progress.json`의 `operating_rules_baseline`과 승인 BaselineRecord에서 관리한다. 실행 시점의 실제 hash가 등록 hash와 다르면 자동 수정하지 않고 `WAITING_APPROVAL`로 전환한다.

## 3. 의사결정과 책임

| 구분 | 신산님 | Main Agent 어울 | developer-primary |
|---|---|---|---|
| 목표·범위·우선순위 | 최종 결정 | 선택지·영향 보고 | 임의 변경 금지 |
| 설계·작업계획 | 승인 | 작성·revision·추적 | 읽고 구현 영향 보고 |
| WorkInstruction | 기능 범위·요구사항·중요 위험 변경 시 승인 | 작성·hash 고정·승인 경로 분류 | 확정본 실행 |
| read-only 분석 지시 | 위 세 항목 변경 시 승인 | 작성·범위 통제 | 허용 범위에서 읽기·분석 |
| 구현 방법 | 위 세 항목 변경 시 승인 | 그 외 기술 판단·충돌 조정 | 범위 내 조사·구현 |
| 테스트 | 결과 확인 | 범위·증거 검토 | 기본 테스트 실행·보고 |
| 완료 | 최종/Phase 승인 | `판정→이유→조치` | 완료 주장과 증거 제출 |
| commit·push·배포 | 중요 경계 승인 | 수행·보고 | 기본 금지 |

## 4. 작업 착수 Gate

Developer는 다음이 모두 참일 때만 시작한다.

1. Work Package가 `READY`다.
2. 선행 Package와 Phase Gate가 합격했다.
3. 설계·계획·WorkInstruction hash와 revision이 기준선에 등록되어 있고, 기능 범위·요구사항·중요 위험 변경이 있으면 신산님 승인 기록과 일치한다.
4. 목표, 포함·제외 범위, 허용·금지 파일, 완료조건과 검증 명령이 있다.
5. 기존 dirty·untracked 상태와 보호 경로가 기록됐다.
6. canonical worker lease의 `execution_fencing_token`과 종속 write lease의 `write_fencing_token`, Agent·경로·만료·baseline hash가 고정됐다.
7. 필요한 사람 승인과 환경 capability가 충족됐다.

하나라도 충족하지 않으면 `BLOCKED` 또는 `WAITING_APPROVAL`이며 추측으로 진행하지 않는다.

## 5. 한 Work Package의 표준 흐름

```text
DRAFT
→ READY
→ ACTIVE
→ RESULT_REVIEW
→ TEST_REVIEW
→ PRELIMINARY_ACCEPT | WAITING_APPROVAL | DIR_HOLD
→ ACCEPTED | REWORK | BLOCKED | CANCELLED
```

1. Main Agent가 기준선·선행작업·현재 상태를 확인한다.
2. Main Agent가 WorkInstruction과 짧은 InvocationPrompt를 작성한다.
3. 변경을 기능 범위·요구사항·중요 위험과 내부 기술 보완으로 분류한다. 앞의 세 항목이 바뀌는 경우에만 신산님 승인을 받고 subject hash를 고정한다.
4. developer-primary에게 좁은 permission과 write lease를 발급한다.
5. Developer가 조사→구현→기본 검증→구조화 보고를 수행한다.
6. Main Agent가 범위·diff·증거·기존 기능·설계 영향을 검토해 `PRELIMINARY_ACCEPT` 또는 부정 판정을 기록한다.
7. 모든 Package를 독립 Tester가 검증한다. Phase G~D는 사람 또는 구현 대화와 분리된 독립 Agent 세션이 수동 수행하고, Phase E 이후 자동화된 Tester를 사용하되 E-01~E-03은 외부 독립 주체가 검증한다.
8. Tester `PASS` 뒤에만 Main Agent가 `판정→판단 이유→조치`와 최종 `ACCEPTED`를 기록한다.
9. 합격 시 progress/HANDOFF를 갱신하고 승인된 경계에서 commit·push한다.

검증 매트릭스 v1.2는 G-01~G-07을 포함한 97개 Package 역색인을 가진다. G-01부터 일반 검증 절차를 적용하며 각 Package는 할당 ID와 EvidenceManifest의 독립 Tester PASS 뒤에만 `ACCEPTED`가 된다. G-07은 기준선 hash·역색인·255개 ID·§49.17 시나리오와 G Gate 회귀 집합을 독립 재검증한다.

## 6. 사람 개입과 승인

- 신산님은 언제든 `pause`, `steer`, `cancel`, 재작업, 범위 변경, 직접 작업, Agent 교체를 지시할 수 있다.
- `pause`는 안전 지점에서 checkpoint·diff·현재 명령 상태를 기록한 뒤 write lease를 유지 또는 회수한다.
- **신산님에게 승인 요청을 보내는 조건은 기능 범위, 요구사항 또는 중요 위험이 변경되는 경우로 한정한다.**
- 중요 위험은 보안·권한·개인/운영 데이터·데이터 손실, 공개 API 호환성, 운영 배포·복구 불능, 외부 side effect 또는 승인된 비용 한도에 중대한 영향을 주는 변경이다.
- 내부 구현 방법, 작업 순서, 파일 배치, 비공개 interface, 테스트 보완, 오탈자·설명 정정처럼 위 세 항목을 바꾸지 않는 변경은 Main Agent가 판단한다. 변경 이유·영향·revision·hash는 progress/HANDOFF와 audit에 기록한다.
- content hash 변경 자체만으로 신산님 승인을 요청하지 않는다. Main Agent가 semantic diff를 분류하고, 기능 범위·요구사항·중요 위험이 바뀐 경우에만 `WAITING_APPROVAL`로 전환한다.
- hash가 바뀌면 기존 subject hash에 묶인 승인은 항상 무효화한다. 다만 새 revision을 누가 재확정하는지는 별개다. 기능 범위·요구사항·중요 위험 변경은 신산님이 재승인하고, 그 밖의 내부 구현·순서·문구·경미 기술 보완은 Main Agent가 근거와 새 hash를 기록해 재확정한다.
- Main Agent 재확정은 `MAIN_RECONFIRMED_NON_SEMANTIC` binding으로 기록하며 `parent_baseline_id`, `root_human_approval_id`, old/new hash, semantic diff, 영향·근거·actor·시각을 가진다. 원 승인 범위를 넓힐 수 없다.
- 승인 요청에는 변경된 기능 범위·요구사항·중요 위험, 선택지, 영향 범위, 미결 위험, 권고안과 subject hash를 포함한다.
- 파괴적 명령이나 외부 시스템 쓰기에 대해 실행 플랫폼이 요구하는 권한 확인은 프로젝트 변경 승인과 구분되는 안전 절차다.

### 6.1 자동 실행과 보고 제한

- 승인된 설계서·작업계획서 안의 Work Package는 Main Agent가 WorkInstruction 작성→Developer Subagent 실행→독립 Tester 검증→필요한 scoped rework→최종 판정→commit·push 순서로 자동 진행한다.
- 작업계획서 내용, Package별 시작·완료, 정상적인 테스트 결과, 내부 기술 판단, 비의미 revision은 신산님에게 진행 보고하거나 계속 지시를 요청하지 않는다. 상세 내용은 progress/HANDOFF, EvidenceManifest, TestReport와 Git 이력에만 남긴다.
- Main Agent가 자동 진행을 중단하고 신산님에게 보고하는 조건은 아래 두 가지다.
  1. 기능 범위·요구사항·중요 위험 변경으로 신산님의 승인 또는 선택이 필요한 경우
  2. `DIR-1`·`DIR-2`·`DIR-3` 또는 canonical `DIR-X`에 도달한 경우
- 동일 단계 동일 실패 3회는 Main Agent가 직접 인수해 계속 해결한다. 3회 도달만으로 신산님에게 보고하지 않으며, 인수 중 위 두 조건이 발생할 때만 중단 보고한다.
- 기술적 실패·REWORK·독립 Tester 결함은 승인 범위 안에서 해결 가능한 동안 Subagent fix loop로 자동 처리한다.
- 신산님은 자동 진행 중에도 언제든 `pause`, `steer`, `cancel`, 범위 변경, 직접 인수 또는 Agent 교체를 명시할 수 있고 Main Agent는 즉시 반영한다.

## 7. write lease와 동시성

- Phase C까지 Developer는 `developer-primary` 한 명뿐이다.
- 한 경로에는 하나의 write lease만 존재한다.
- Main Agent는 Developer 작업 중 같은 경로에 쓰지 않는다.
- Developer가 정식 실패 3회로 중지되면 lease와 write Tool을 먼저 회수한다.
- Reviewer/Tester는 기본 read-only이며 Phase E Gate 이후에만 제한 병렬화를 검토한다.
- 병렬 write는 독립 worktree, 완전히 분리된 경로, conflict group 검증, 별도 lease가 모두 있을 때만 허용한다.
- merge, migration, 배포, 최종 판정은 항상 순차 수행한다.
- `worker_leases`가 실행 소유권의 canonical 원장이고 기존 `run_leases`·workspace lease 컬럼은 projection이다. Step·Tool·Event commit에는 현재 execution fencing token이, 제품 파일 mutation에는 현재 write fencing token도 필요하다.

## 8. 결과·실패·인수

### 8.1 결과 상태

개발 결과는 Subagent 종료·중단 Event에서 자동 수집한다. 수집기는 Result Envelope, 변경 파일·diff, 실행 명령과 종료 코드, 테스트, evidence, checkpoint를 저장하고 다음 세 상태를 우선 구분한다.

```text
성공          → COMPLETED
정식 실패보고 → FAILURE_REPORT
불완전 중단   → INCOMPLETE
```

`BLOCKED`와 `CANCELLED`도 별도 상태로 보존한다. 자동 수집이나 상태 분류는 자동 완료 승인이 아니며, Main Agent가 schema와 evidence를 검증한 뒤 Work Package 판정을 내린다. evidence가 부족한 성공 주장은 `INCOMPLETE` 또는 보완 요청으로 처리하고, 유효성 조건을 충족하지 않은 실패 주장은 정식 실패 횟수에 포함하지 않는다.

| 상태 | 의미 | 다음 처리 |
|---|---|---|
| `COMPLETED` | 완료조건과 필수 증거 충족 주장 | Main 검토·독립 검증 |
| `FAILURE_REPORT` | 해결하지 못한 동일 문제의 유효한 정식 보고 | 1·2·3회 규칙 적용 |
| `INCOMPLETE` | 작업·보고가 미완성이나 재개 가능 | checkpoint에서 같은 작업 재개 |
| `BLOCKED` | 권한·환경·사람 결정·선행조건 필요 | 필요한 결정만 요청 |
| `CANCELLED` | 사람 또는 정책으로 중단 | terminal 기록·같은 Run 재개 금지·새 Run 생성 |

`CANCELLED` 뒤 계속해야 하면 `prior_run_id`와 허용된 checkpoint/artifact를 참조하는 새 Run을 생성한다. 기준 문서 hash가 바뀌면 새 revision을 등록하되, 기능 범위·요구사항·중요 위험이 바뀐 경우에만 신산님 승인을 요청한다.

### 8.2 유효 FAILURE_REPORT

다음 필드가 모두 있어야 횟수에 포함한다.

- `step_lineage_id`, `failure_fingerprint`, 문제명
- 실패 단계와 확인된 원인
- 재현 명령·종료 코드·로그·테스트 등 판정 가능한 증거
- 변경 파일·현재 diff·남은 작업
- 검토한 대안과 선택하지 않은 이유
- Main Agent에게 필요한 구체적인 기술 판단

내부 재시도, 예기치 않은 응답 종료, quota, Tool/권한/환경 문제, 근거 없는 포기는 횟수에 포함하지 않는다.

### 8.3 3회 인수

| 횟수 | 처리 |
|---:|---|
| 1 | Main이 원인·증거를 검토하고 보완 방향을 같은 Developer에게 전달 |
| 2 | 설계 가정·코드 현실·범위 충돌 재검토 → WorkInstruction revision 발행 → 기능 범위·요구사항·중요 위험 변경이면 `WAITING_APPROVAL`, 아니면 Main Agent 판단으로 재작업 |
| 3 | Developer 중지 → lease/Tool 회수 → diff/test/checkpoint 수집 → TakeoverPacket → Main 직접 구현 |

사용자 조기 인수는 별도 `HUMAN_OVERRIDE_TAKEOVER`로 actor·사유·범위·시각을 기록한다.

## 9. 진행 기록과 세션 복구

권위 진행 파일:

```text
docs/progress/build-progress.json
docs/progress/BUILD_HANDOFF.md
```

다음 Event마다 즉시 갱신한다.

- Package 시작·결과·검토·승인·중단·재개
- Developer↔Main handoff
- write lease 발급·회수
- 실패보고 수락·거부·인수
- 설계·계획 revision
- Phase Gate, commit, push, 배포
- DIR-1·DIR-2·DIR-3 도달·독립 판정·신산님 보고·계속 지시

새 세션은 이 파일, 실제 파일 hash, Git 상태를 대조한 뒤에만 작업을 재개한다. 불일치는 덮어쓰지 않고 `RECONCILE_REQUIRED`로 보고한다.

## 10. DIR 강제 중단과 신산님 보고

| DIR | 중단 시점 | 중단 후 금지 |
|---|---|---|
| `DIR-1` | A-15 완료 후, A Gate 전 | A Gate 판정·Phase B 착수 |
| `DIR-2` | C-15 완료 후, C Gate 전 | C Gate 판정·Phase D 착수 |
| `DIR-3` | E-11 완료 후, E Gate 전 | E Gate 판정·Phase F 착수 |

D Gate에서 동일 검증 hash의 `AV-LRN-003~005` 중 하나가 CRITICAL 실패로 확정되는 `DIRX-LRN-CRITICAL`이 발생하면 긴급 DIR-X를 D Gate 직후 추가한다. E-11 뒤 DIR-3은 생략하지 않는다. 그 밖의 추가 DIR은 Tester가 DecisionRequest로 제안하고 신산님이 결정한다.

DIR 도달 Event가 기록되면 Main Agent는 즉시 새 작업의 dispatch를 막고 write lease를 회수하며 `build-progress.json`과 HANDOFF를 `DIR_HOLD`로 고정한다. 독립 Tester는 read-only로 설계 의도 5개 축을 누적 산출물과 대조하고 DIR Report·감사 Event·progress/HANDOFF만 쓸 수 있다. DIR 상태는 `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`다. Main Agent는 DIR 판정을 대신하거나 수정하지 않고, 판정·근거·누적 진척·열린 결함·미검증 범위·위험·Owner 결정 항목·다음 안전 행동을 신산님께 반드시 보고한다.

판정이 `ALIGNED` 또는 `DRIFT_MINOR`여도 자동 재개하지 않는다. 신산님의 계속 지시가 있어야 `DIR_HOLD`를 해제하고 Gate 판정을 진행한다. `DRIFT_MAJOR`는 보정 Package와 재검토, `DIVERGED`는 설계 재검토가 선행한다. DIR 대상 artifact나 evidence manifest hash가 바뀌면 기존 판정은 무효이며 다시 수행한다. DIR 의무 보고는 승인 요청 범위를 확장하지 않지만, 기능 범위·요구사항·중요 위험 변경이 포함되면 별도 승인을 요구한다.

## 11. Skill·Hook·Plugin 성장 규칙

- 작업 후 모든 주요 결정·사용자 교정·재사용 가능한 성공·실패 복구·검증·잔여 위험을 LearningReview 후보로 정리한다.
- 현재 Run에는 학습 결과를 소급 적용하지 않고 다음 Task/Run의 frozen snapshot부터 사용한다.
- 초기 설계·계획 절차는 versioned prompt/template이며, 반복 성공과 replay/pilot을 통과한 뒤 Skill 후보가 된다.
- 신규 Skill은 최소 3개 대표 작업 검증과 사람 승인 후 활성화한다.
- Hook은 반복적으로 관찰된 **기계적으로 판별 가능한 Event→Program 규칙**만 후보로 만든다.
- 새 executable, deny 동작, 권한 확대 Hook은 shadow·pilot·sandbox와 사람 승인을 통과해야 한다.
- Hook은 Subagent를 직접 생성하거나 LLM 의미 판단을 안전 차단 근거로 사용하지 않는다.
- Plugin은 M1~M5와 운영이 안정되고 실제 재사용·팀 배포 수요가 증명된 뒤에만 포장한다.

## 12. 검증과 완료 판정

- 테스트 결과에는 명령, exit code, 실행 환경, 대상 revision, 실제 결과를 기록한다.
- `SKIPPED`, `WAIT`, `DEFERRED`, `BLOCKED`, 미실행은 PASS가 아니다.
- UI는 실제 클릭·상태·브라우저 Network, API는 request/response·contract, DB는 migration apply/rollback, 복구는 강제 중단 후 resume evidence가 필요하다.
- 브라우저 코드의 localhost·내부 호스트·컨테이너 포트 직접 호출을 금지하고 same-origin/BFF를 실제 Network에서 확인한다.
- 중대 미진은 별도 수정 WorkInstruction, 경미 보완은 다음 Package에 흡수한다.
- 합격한 Package 전체를 경미한 이유로 다시 열지 않는다.
- 검증 ID·심각도·필수 증거·Phase Gate·재검증 범위는 통합검증매트릭스 §7·§8을 따르고, 실행 주체·환경·절차는 테스트계획서를 따른다.
- Developer 기본 테스트와 Tester 독립 검증을 분리하며, 증거 없는 PASS와 `SKIPPED`·`BLOCKED`의 PASS 집계를 금지한다.
- 최종 판정은 `Technical Verification → ProductValidation → DefectAssessment → 사람 ReleaseDecision → Apply/DeployApproval` 순서를 지키며 blocking defect가 있으면 Release를 차단한다.
- WSL-server의 PostgreSQL 15 일반 검증과 별도 격리 PostgreSQL 18 Release Candidate migration·extension·backup/restore 검증을 모두 통과해야 ysna-server로 승격한다.
- 서버 배포는 Git의 승인 commit/tag와 동일 ReleaseManifest로만 수행한다. `scp` 배포, 서버 직접 patch, dirty checkout 배포를 금지한다.
- Production은 `ysna-server`, 운영 도메인은 `envil.sinsan.kr`이다. 배포 후 `MONITORING`과 신산님 확인 전 `RELEASED`로 표시하지 않는다.

## 13. 현재 착수 상태

- 현재 작업환경은 문서 기반 운영 골격을 구성하는 단계다.
- Git 저장소와 코드 scaffold는 아직 생성하지 않았다.
- 설계서 v2.6과 통합 기준선은 신산님이 승인했다. 작업계획서 v1.4·검증매트릭스 v1.2·테스트계획서 v1.3·운영규칙 v1.4는 G02-DEF-001 보정을 위한 비의미 기준선 정규화본이다.
- 현재 G-02는 독립 Tester 재검토 대기이며, PASS와 Main Agent 최종 판정 전에는 G-03 또는 코드 작업을 시작하지 않는다.
