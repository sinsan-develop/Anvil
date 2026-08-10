# Anvil Agent 운영 규칙

이 파일은 Anvil 저장소에서 활동하는 모든 Main Agent와 Subagent가 가장 먼저 읽어야 하는 프로젝트 운영 진입점이다.

## 1. 권위 문서와 우선순위

1. 신산님의 현재 명시적 지시와 승인 기록
2. `Anvil_설계서_v2.md`
3. `Anvil_작업계획서_v1.md`
4. `Anvil_통합검증매트릭스_v1.md`
5. `Anvil_테스트계획서_v1.md`
6. `docs/governance/ANVIL_OPERATING_RULES.md`
7. 현재 Work Package의 승인된 `WorkInstruction`
8. `docs/progress/build-progress.json`과 `docs/progress/BUILD_HANDOFF.md`

하위 문서가 상위 문서와 충돌하면 작업을 중지하고 Main Agent에게 `BLOCKED`로 보고한다. 임의로 해석해 구현하지 않는다.

## 2. 고정 역할

- 사용자·최종 승인자: 신산님
- 설계 책임자·Main Agent: 어울
- Primary Developer Subagent·작업 담당자: `developer-primary`
- Reviewer/Tester: 작업계획서 Phase E 이전에는 상시 역할로 자동 투입하지 않는다.

Main Agent는 설계, 작업분해, 기술 판단, 승인 요청, 결과 검토, 통합과 최종 보고를 소유한다. Developer Subagent는 승인된 WorkInstruction 범위의 구현과 기본 검증 및 완료보고를 소유한다.

## 3. 세션 시작 순서

모든 Agent는 작업 전에 다음 순서로 읽고 기준선 hash를 확인한다.

1. 이 파일
2. `Anvil_설계서_v2.md`
3. `Anvil_작업계획서_v1.md`
4. `Anvil_통합검증매트릭스_v1.md`
5. `Anvil_테스트계획서_v1.md`
6. `docs/governance/ANVIL_OPERATING_RULES.md`
7. 자신의 AgentDefinition
8. `docs/progress/build-progress.json`
9. `docs/progress/BUILD_HANDOFF.md`
10. 현재 WorkInstruction과 관련 approval
11. Git 저장소가 생성된 이후에는 `git status`, 현재 branch와 `HEAD`

읽지 못한 파일, hash 불일치 또는 상충하는 지시가 있으면 코드 작업을 시작하지 않는다.

## 4. 쓰기 권한

- 한 시점에 한 명만 하나의 경로 집합에 write lease를 가진다.
- 초기 개발은 Developer Subagent 한 명만 수행한다.
- Main Agent는 Developer가 write lease를 가진 동안 같은 파일을 수정하지 않는다.
- Main Agent의 직접 구현은 동일한 정식 실패 3회 후 인수 또는 신산님의 명시적 `HUMAN_OVERRIDE_TAKEOVER` 때만 허용한다.
- Reviewer/Tester는 기본 read-only다.
- 관련 없는 파일, 사용자 dirty·untracked 파일, Backup 자료를 수정·삭제하지 않는다.

실행 소유권은 canonical `worker_lease`의 `execution_fencing_token`, 제품 파일 mutation은 종속 `write_lease`의 `write_fencing_token`으로 확인한다. write에는 두 token이 모두 유효해야 하며 만료·인수 전 token의 commit은 거부한다.

## 5. 승인과 변경 통제

- 확정된 설계서·작업계획서·WorkInstruction의 content hash가 변경되면 의미 변경을 분류하고 영향 범위를 기록한다.
- 모든 hash 변경은 기존 approval binding을 무효화한다. 비의미 변경은 원 human approval을 부모로 둔 `MAIN_RECONFIRMED_NON_SEMANTIC` binding과 파생 baseline으로만 재확정하며 범위를 넓힐 수 없다.
- **기능 범위, 요구사항 또는 중요 위험이 변경되는 경우에만 신산님에게 승인을 요청한다.**
- 위 세 항목을 바꾸지 않는 내부 구현 방법, 작업 순서, 파일 배치, 경미한 기술 보완은 Main Agent가 판단하고 revision·근거·hash를 기록한 뒤 진행한다.
- 중요 위험에는 보안·권한·데이터 손실·공개 API 호환성·운영 배포·복구 불능·비용 한도에 중대한 영향을 주는 변경이 포함된다.
- 플랫폼이 요구하는 파괴적 명령·외부 쓰기 권한 확인은 프로젝트 변경 승인과 별개의 실행 안전 절차로 유지한다.
- 사람은 언제든 pause, steer, cancel, 재작업, 직접 작업 또는 Agent 교체를 지시할 수 있다.

### 5.1 자동 진행과 신산님 보고 경계

- 승인된 설계서·작업계획서 안의 Package 분해, WorkInstruction 발행, Subagent 배정, 독립 검증, 비의미 revision, 재작업, commit·push는 Main Agent가 중간 확인 없이 자동 진행한다.
- 작업계획서 내용, 일반 Package 시작·완료, 테스트 PASS/REWORK, 내부 구현 판단은 신산님에게 진행 보고하거나 계속 여부를 묻지 않는다. progress/HANDOFF와 Git에만 기록한다.
- 신산님에게 작업을 중단하고 보고하는 경우는 다음으로 한정한다.
  1. 기능 범위, 요구사항 또는 중요 위험 변경으로 사람 승인·결정이 필요한 경우
  2. `DIR-1`, `DIR-2`, `DIR-3` 또는 canonical trigger에 따른 `DIR-X` 도달
- 동일 실패 3회는 Main Agent 직접 인수 규칙이며 그 자체를 신산님 보고 사유로 만들지 않는다. 인수 과정에서 위 두 보고 조건이 발생할 때만 보고한다.
- 실행 플랫폼이 요구하는 외부 쓰기·권한 확인 UI는 프로젝트 진행 보고가 아니라 시스템 안전 절차다.

## 6. Subagent 결과 계약

결과 상태는 다음 중 하나다.

```text
COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED
```

개발 결과는 자동으로 수집하되 `COMPLETED`(성공), 유효한 `FAILURE_REPORT`(정식 실패보고), `INCOMPLETE`(불완전 중단)를 반드시 구분한다. 자동 수집은 자동 합격을 의미하지 않으며 Main Agent가 evidence를 검토해 최종 판정한다.

`FAILURE_REPORT`는 같은 문제를 식별할 수 있는 lineage/fingerprint, 원인, 증거, 변경 파일, 실행한 검증, 남은 작업과 Main Agent의 구체적 판단 필요사항을 모두 포함해야 한다. 내부 재시도, 도구 중단, quota, 권한·환경 문제, 근거 없는 실패 선언은 정식 실패 횟수에 포함하지 않는다.

동일한 유효 실패의 처리:

1. 1회: Main Agent가 증거를 검토하고 보완 지시
2. 2회: 설계 가정과 코드 현실을 재검토해 WorkInstruction revision 발행. 기능 범위·요구사항·중요 위험이 바뀌면 `WAITING_APPROVAL`, 아니면 Main Agent 판단으로 같은 Developer에게 재작업 전달
3. 3회: Developer 중지 → lease·tool 회수 → TakeoverPacket → Main Agent 순차 인수

## 7. 완료 증거

완료보고에는 최소한 다음을 포함한다.

- Work Package ID와 기준 문서 hash
- 시작 시 `HEAD`·branch·`git status` 또는 Git 미구성 사실
- 변경 파일과 diff
- 실행한 정확한 명령, 종료 코드, 실제 결과
- 미실행·`SKIPPED`·`BLOCKED` 항목
- API·DB·UI·브라우저·운영 증거 중 해당 항목
- 기존 기능 유지 여부와 잔여 위험
- rollback 방법
- progress/HANDOFF 갱신 여부

테스트 통과는 실행한 범위만 증명한다. mock, fixture, build, static check를 실제 브라우저·운영·배포 PASS로 승격하지 않는다.

## 8. DIR 강제 중단점

- `DIR-1`: A-15 완료 후, A Gate 판정 전
- `DIR-2`: C-15 완료 후, C Gate 판정 전
- `DIR-3`: E-11 완료 후, E Gate 판정 전
- 긴급 `DIR-X`: D Gate에서 동일 검증 hash의 `AV-LRN-003~005` 중 하나가 CRITICAL 실패로 확정되는 `DIRX-LRN-CRITICAL` 발생 시 D Gate 직후 추가. DIR-3은 생략하지 않는다.

위 시점에 도달하면 모든 Agent는 후속 작업·개발 Subagent·제품 write·commit·push·배포를 멈춘다. Main Agent는 write lease를 회수하고 progress를 `DIR_HOLD`로 기록한다. 구현 대화와 분리된 Tester는 read-only로 누적 산출물을 설계서의 5개 축으로 검토하며 DIR Report·감사 Event·progress/HANDOFF만 쓸 수 있다. Main Agent는 그 결과와 누적 진행·미검증 범위·열린 위험·다음 안전 행동을 신산님께 반드시 보고한다.

`ALIGNED` 또는 `DRIFT_MINOR`여도 자동으로 계속하지 않는다. 신산님의 계속 지시 전에는 Gate 판정과 다음 Phase를 시작하지 않는다. 기능 범위·요구사항·중요 위험 변경이 있으면 별도 승인도 받는다.

## 9. 단계적 자동화 금지선

순서는 다음과 같이 고정한다.

```text
M1 결과 전달
→ M2 구조화 결과·상태 동기화
→ M3 동일 실패 3회 인수
→ M4 검증된 절차의 Skill 승격
→ M5 기계적 조건의 Hook 적용
→ Reviewer·Tester·제한 병렬화
→ 운영 안정화
→ M6 Plugin 포장
```

앞 단계 Gate를 통과하기 전에 뒷 단계 자동화를 사용하지 않는다. Hook은 Subagent를 직접 생성하지 않으며, Skill은 사람 승인 없이 신규 활성화하지 않는다.

## 10. 운영형 시스템 원칙

- 운영자는 Python 명령·DB·내부 CLI를 직접 다루지 않는다.
- 상태, 오류, 승인, 진행, 재개, 비용과 배포 결과를 화면과 API에서 확인한다.
- 브라우저 코드는 same-origin 상대 경로만 사용하고 내부 API 주소는 BFF/서버 계층에 둔다.
- 임시 mock·개발 편의 구조를 운영 코드로 승격하지 않는다.
- Local 개발 프로세스는 WSL-server의 Anvil 개발 DB를 사용한다. WSL-server는 Test/Staging, ysna-server는 `envil.sinsan.kr` Production이다.
- WSL PostgreSQL 15 일반 검증과 별도 격리 PostgreSQL 18 Release Candidate 호환성 검증을 구분한다.
- 서버 배포는 Git의 승인 commit/tag와 ReleaseManifest만 사용한다. `scp` 배포·서버 직접 patch·dirty checkout 배포를 금지한다.
