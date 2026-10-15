# Anvil Agent 운영 규칙

## 현재 v3 작업 진입점 — 2026-10-16 설계·계획 본문 통합

- 최신 직접 지시 → PMO 공통 지침 → 이 v3 진입점 → 설계 r8 `docs/design/Anvil_설계서_v3_초안.md` → 계획 r7 `docs/WORK_PLAN.md`/업무 카드 → P01·TD-01 직접 승인 기록 → 현재 `docs/WORK_STATUS.md`/`docs/DEVELOPMENT_ENVIRONMENT.md`를 대조한다. 타당한 검토 보완은 설계·계획 본문에 직접 통합했고 이전 실행안전 보완은 이력이다. 승인 기록은 해당 대상·범위에만 적용한다.
- 기존 아래 v2 권위 문서·고정 Package/lease·M1~M6·Phase/DIR는 보관된 과거 계약이다. 새 Stage A~G/44업무의 선행·강제 중단점으로 이월하거나 삭제된 v2 파일을 신규 시작 필수 자료로 요구하지 않는다. 이 진입점과 충돌하는 과거 항목은 v3에 적용하지 않는다.
- 현재 Main은 어울, 동시 code writer는 한 명이다. 상세 계약과 허용 파일·선행 증거를 정본 카드/시작 패킷으로 전달한다. 검수는 수행자 제출과 분리하되 이 문구만으로 다른 세션 생성·담당 교체·새 자동화를 실행하지 않는다.
- P01 상세 시안·양식과 TD-01 A안, TD-02 Anvil 전용 로그인 설계는 직접 승인됐다(TECH_DECISIONS §9). 전체 구현·실제 Agent/DB/권한/배포는 각 선행 계약과 정확한 실행 승인 범위를 별도로 대조한다. 초기 설계/계획 작성 당시 문구를 최신 지시보다 우선하지 않는다.

> 2026-10-15 신산님 최신 지시: 기존 자료는 로컬 Backup에 보관하고 새 설계 작업으로 전환했다. 현재 시작 순서는 PMO AGENTS → 이 파일 → docs/WORK_STATUS.md → docs/design/Anvil_v3_인터뷰_합의사항.md → docs/design/Anvil_설계서_v3_초안.md → docs/DEVELOPMENT_ENVIRONMENT.md다. 아래의 예전 v2 설계·계획·Package/lease·Gate 문서 참조는 보관된 과거 작업의 규칙이며 신규 구현 승인이나 새 계획을 대신하지 않는다. 상세 설계와 화면 검토 후 새 작업계획을 작성하고 구현을 승인받는다. 핵심은 프로젝트·헌법·지식은 Anvil에 남기고 총괄을 포함한 LLM/Agent/세션/서비스계정은 최소 손실로 교체·해제하는 도구로 사용하는 것이다. 기존 원문은 Backup/Anvil/legacy-20261015-1420에 보존했다.

이 파일은 Anvil 저장소에서 활동하는 모든 Main Agent와 Subagent가 가장 먼저 읽어야 하는 프로젝트 운영 진입점이다.

> 2026-10-15 후속 직접 지시 반영: 신규 개발 작업계획 정본은 `docs/WORK_PLAN.md`와 연결된 `docs/work_packages/` 업무 카드다. 현재 cold-recovery는 PMO AGENTS → 이 파일 → WORK_STATUS → WORK_PLAN → v3 설계·문서작성_공통기준 → DEVELOPMENT_ENVIRONMENT 순서다. 계획은 작성·검토 단계이며 구현 착수 승인을 대신하지 않는다. Anvil은 우리가 SW를 개발하는 방법 자체를 표준화·시스템화하고, 이번에 정한 설계·계획·위임·검수·변경·인계 기준을 제품에서 재사용한다. 아래 과거 v2 실행 계약은 새 구현 승인으로 이월하지 않는다.
개인 응답 방식과 공통 agent 운영 원칙은 전역 C:\Users\cyhuh\.codex\AGENTS.md를 따른다.

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
- 이상 상태는 시스템이 감지하여 화면의 알람·경고로 보여준다.
- 내부 구조보다 실제 사용자·운영 흐름과 화면을 먼저 설계한다.
- 화면과 기본 운영 흐름을 완성한 뒤 개별 기능을 구현한다.
- 문서·기획에 없는 기능을 임의로 추가하지 않는다.
- 기존 동작과 승인된 계약을 암묵적으로 변경하지 않는다.
- 이상 상태는 시스템이 감지하여 화면의 알람·경고로 보여준다.


## 11. 개발 환경과 배포 단계

1. 로컬에서 프로세스를 실행하고 DB는 WSL-server에 생성한다.
2. 화면과 기본 기능이 완성되면 WSL-server에 배포하여 기능을 검증한다.
3. 테스트 완료 후 GitHub를 통해 Oracle Cloud 운영 테스트 환경에 배포한다.
4. 개발 및 테스트 단계에서는 개발 전용 인증 우회를 사용하거나, 환경변수 계정으로 처리하고, 운영 코드에 임시 구조를 남기지 않는다.
5. 운영 테스트 환경에 배포할때 DB의 user_roles로 변경하고, 테스트 한경이므로 로그인 정보를 자유롭게 생성하고 사용한다.
6. 운영 테스트 환경에 배포할때 화면에 가짜, 가상, 데모 데이터는 표시하지 않는다.
7. WSL 내부 장애와 Codex 실행 환경의 권한 문제를 구분한다. WSL 서비스 재시작, Windows 재부팅, Ubuntu 재설치·등록 해제, VHDX·ACL 수정은 별도 승인 없이는 수행하지 않는다.


## 12. 작업계획서와 작업지시서

- 작업계획서의 승인된 범위는 main agent가 관리하며 완료까지 진행한다.
- 계획서 밖으로 확장하거나 설계·권한·운영 영향이 바뀌는 경우 신산님 승인을 받는다.
- 작업지시서는 설계 내용을 반영한다.
- 작업지시 프롬프트는 작업지시서와 중복하지 않고 실행 지시만 담는다.
- 작업자는 기본 테스트와 확인을 완료한 뒤 보고한다.
- 중대 미진은 별도 수정 작업지시서로 분리하고, 경미 보완은 다음 작업지시서에 흡수한다.
- 완료 보고 형식은 판정 → 판단 이유 → 조치 순서로 고정한다.

## 13 브랜치·Git

- 일반 코드 수정은 main에서 새 작업 브랜치를 만든 뒤 그 브랜치에서 수행한다.
- 작업 하나당 작업 브랜치 하나만 사용한다.
- 작업 브랜치 완료 후 검증 → main 병합 → 원격 main push → 기존 브랜치 삭제 순서로 정리한다.
- 기존 작업 브랜치를 종료하기 전 다음 작업 브랜치를 만들지 않는다.
- 병합 전 테스트·diff·영향 범위를 확인한다.
- 관련 없는 파일을 stage하거나 복구하지 않는다.

## 14. 브라우저·API 절대 규칙

- 브라우저에서 API 절대주소, localhost, 127.0.0.1, Docker 내부 호스트명·컨테이너 포트를 직접 호출하지 않는다.
- NEXT_PUBLIC_* 환경변수에 운영 내부 API 주소를 넣어 브라우저에서 사용하지 않는다.
- 브라우저 코드는 same-origin 상대 경로를 사용한다.
- 내부 API 주소는 서버 함수·route handler·BFF·프록시 계층에서만 사용한다.
- 브라우저와 서버의 공통 API 헬퍼를 구분한다.
- 운영 Docker·reverse proxy·브라우저 Network에서 실제 요청 URL을 검증한다.
- 개발 편의용 임시 구조를 운영 코드에 넣지 않는다.

수정 전 확인:

1. 브라우저 코드인가 서버 코드인가?
2. 실제 요청 URL은 무엇인가?
3. 운영 Docker에서 브라우저 기준 접근 가능한가?
4. 기존 정상 기능이 같은 헬퍼를 공유하는가?
5. 수정 후 Network가 same-origin 또는 의도한 프록시 경로인가?

## 15. 화면 표준

- 운영 기준 화면은 1920×1080과 기본 12px를 우선하되 대상 기기와 반응형 요구에 맞게 조정한다.
- 본문·폼 12px, 작은 설명 10px, 보조 설명 9px, 사이드바 제목 14px, 제목 16px를 기본으로 한다.
- 설명 박스를 상시 노출하지 않고 i 아이콘·tooltip·popover로 제공한다.
- 화면 흐름과 운영 흐름의 통일성을 유지한다.

## 16. 검증과 완료 조건

- 변경 유형과 위험도에 비례하여 단위·통합 테스트, 운영 유사 환경의 실제 클릭·호출, 빌드·타입체크·정적 검사를 선택해 수행한다.
- 브라우저 Network에서 내부 API 주소와 localhost 직접 호출이 없는지 확인한다.
- DB·프로세스·컨테이너·임시 리소스를 정리하고 잔여물을 확인한다.
- 실행하지 못한 검증은 통과로 표시하지 않고 미검증으로 명시한다.
- 수정 파일과 영향 범위를 보고한다.

## 17. 작업현황 기록

- 에러 상황에 대비해 작업현황 파일에 단계, 담당 agent, 상태, 변경 파일, 테스트, 오류 횟수, 미검증 범위, 다음 조치를 누적 기록한다.
- 예외 보고에는 판정, 판단 이유, 영향 범위, 수행 조치, 미충족 조건, 정확한 다음 조치를 포함한다.
- 관련 작업현황과 보고서는 docs/04_test_reports에 둔다.
