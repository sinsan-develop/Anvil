# FN01 시작 기준선 — 기존 계약 대조와 최소 보완 제안

상태: `PROPOSED_NOT_APPROVED` · Main 어울 · 2026-10-18. 기준 branch `codex/av3-stage-b`, 조사 HEAD `70aec22093b44601352b5aa75a187907b6acdad7` clean. **신규 제품 코드/API/SQL·실행 승인이나 전체 FN01 완료가 아니다.**

## 1. 왜 이 업무인가

WORK_PLAN의 FN01/UI02는 기존 프로젝트의 기능을 4상태로 분류하고 근거·미확인을 사용자 확인 후 시작 기준선으로 보존한다. FN09/UI04 임무 초안의 실제 source/관측/기준 참조가 미연결이므로 이 공백을 먼저 분리한다. 사용자 소유 시스템에 현재 사실을 누적하는 것이 목적이며 관측/허가 없는 실행을 가능하게 만드는 우회가 아니다.

## 2. 설계·코드 대조 — 실행 없는 읽기 증거

| 항목 | 확인된 위치·실제 내용 | 판정·남은 공백 |
|---|---|---|
| 기능 4상태 | 설계 §3.2(149행), §5 상태구분(267~272행), §11.3 S02; FUNCTION_WORK FN01 | 공식 표시값은 ‘구현 완료·핵심 동작 확인 / 구현했지만 동작 미확인 / 부분 구현 / 미구현’. 기능 상태와 업무 진행/검수 상태는 다름 |
| 기준선 저장 계약 | INTERFACES §9.2 confirmBaseline: items·sourceSnapshotRef:Id·reviewRefs → 불변 BaselineVersion | 큰 틀만 있고 상태 enum·판정 근거/미확인·현재 버전 CAS·빈 소스/관측 미확인·조회 계약은 미구체화 |
| 기존 기준선 SQL | `db/migrations/0001_projects_access.sql:95`의 project_baselines: id PK, project/version UNIQUE, source_snapshot_ref NOT NULL, content/hash/작성자 | **이미 존재**. ‘기준선 테이블 없음’으로 판단하거나 새로 같은 이름을 만들면 안 됨. source snapshot의 같은 프로젝트/version/hash FK·명령/정책/감사 결박은 후속 설계 필요. 실제 행/권한은 이번에 DB로 확인하지 않음 |
| 프로젝트 조회 | `apps/server/modules/projects/repository.ts:190`은 baselineRef:null, project-create/api.ts의 생성 응답도 null만 받음 | 시작 기준선 조회·정확 ref 연결 미구현. 생성 성공은 기준선 확정/실소스 검증이 아님 |
| 명령/화면 | projects/routes.ts의 프로젝트 command enum/dispatch와 access/project-command.ts에 confirmBaseline 구현 없음; projects/project-create 화면에 기능 4상태 저장 연결 없음 | 버튼만 추가하거나 임의 JSON 제출로 완료할 수 없음. 새 명령/조회와 보호 저장·UI 연결 필요 |
| 실제 source snapshot | `0008_source_read_observation.sql:46`, connections/source-read-protocol.ts:191, source-read-records.ts의 snapshot | 이미 **같은 이름 source_snapshots**에 version1·grant/connector/root·서명 report를 보관. CONNECTOR_REPORTED / osVerification=UNVERIFIED 고정. 옛 DATA_MODEL의 일반 Git/dirty snapshot 개괄과 현재 물리 계약은 동등하지 않음 |
| 관측 내용 | contracts/runtime/source-read-observation-v1.ts의 READ_ATTRIBUTES/nonrecursive FILE; source-read-report-v1.ts의 identity/size/time/state | 파일 내용 hash·Git branch/commit·dirty/미추적 diff·기능 실행 결과는 없음. report hash는 보고서 hash이지 파일 본문 hash가 아님. 서명/OBSERVED만으로 기능 동작이나 실제 OS 검증을 합격시키지 않음 |
| SourceScope | source-scope-v1.ts의 sourceRootRef/mappingRef/observationRef/baselineRef와 FILE READ/WRITE; assignments/source-scope-containment.ts | 문법/부모 부분집합 대조뿐이고 executionAuthorized=false. READ_ATTRIBUTES 허가를 READ/WRITE로 변환하거나 사용자 확인 기준선을 실행 허가로 쓸 수 없음 |
| 임무 초안 소비 | project-assignment-drafts.ts의 basis는 plan/application/design만 허용; assignment-input.ts의 allowedScopes는 문법 검사 후 SOURCE_SCOPE_UNVERIFIED | 현재 허가 source/관측/기준선 원문 조회·정합/현재 권한 집행과 selector가 없다. 문법상 scope 참조는 실소스 검증이 아니며 현재 구현은 다른 필수 내용/검토를 충족하면 내용 확정이 가능하다. 이때도 UNVERIFIED·ready/execution/dispatch=false를 보존한다. 이번 제안은 가짜 참조로 실행 선행을 충족시키지 않음 |

이번 판정은 지정된 정본·현재 source의 정적 대조다. DB row 수·실제 guard/권한/서비스/브라우저·Agent·OS/Git 소스 관측을 새로 실행하지 않았다. 이전 테스트 PASS를 새 증거로 재사용해 기능 완료로 표시하지 않는다.

## 3. 필요한 최소 결정과 권장안

**권장 A: 기능 상태를 기록하는 시작 기준선과 실행 source 기준을 분리해, FN01 후보부터 작성·검수한다.**

- 기존 4상태·근거·실행하지 못한 확인·사용자 검토를 프로젝트에 불변 보존하는 기능이다. 시작 기준선의 확인은 ‘이 기준선 기록을 채택함’이지 임무 실행 허가나 모든 기능의 동작 합격이 아니다.
- EMPTY/아직 source 관측이 없는 경우도 미확인을 기록할 수 있게 계약을 보완한다. sourceSnapshotRef의 nullable/정확 version/hash·source 선언 참조·누락 사유는 **변경안**이며 현재 Id 필수·SQL NOT NULL을 몰래 바꾸지 않는다.
- 관측이 있으면 기존 보호 snapshot GET에서 현재 주체가 접근 가능한 같은 프로젝트의 정확 ref를 읽고 등급/누락을 보존한다. READ_ATTRIBUTES 보고는 본문/Git 증거로 보지 않는다. 관측이 없으면 임의 snapshot을 생성하지 않는다.
- ‘구현 완료·핵심 동작 확인’은 해당 기능의 실제 정상 처리/저장/조회 근거와 중요한 실패 확인·환경/시각을 내용 검토해야 한다. 파일 존재·목업·검사 초록만으로 선택할 수 없고 충분한 증거가 없으면 다른 상태/미확인으로 돌린다. 기계의 ref/hash/권한 검사는 이 의미 판정을 대신하지 않는다.
- 기록/확정된 기준선은 당장 SourceScope.baselineRef/observationRef로 변환하지 않는다. SourceScope의 실제 Git/파일·현재 허가/매핑 검증은 FN08/FN09의 별도 선행으로 남긴다. 실행·Agent·새 host 관측을 이번 결정에 포함하지 않는다.
- 현재 임무의 **내용 확정과 실행 준비를 구별**한다. SOURCE_SCOPE_UNVERIFIED 자체가 현재 내용 확정의 거절 조건인 것처럼 해석하거나, 이 제안만으로 기존 거절 조건/기대값을 바꾸지 않는다. 기준선 기록 채택도 실제 SourceScope·Agent 시작을 허가하지 않는다.

**대안 B:** 실제 Git/파일 관측 연결을 먼저 완성한 뒤에만 FN01 기준선을 구현한다. 기존 sourceSnapshotId 필수 전제를 유지하기 쉽지만 현재 host/실소스 승인 경계 때문에 기능 상태 기록/검토까지 지연된다. A를 권장하되 자료 부족을 숨기는 ‘무근거 확정’은 허용하지 않는다.

필요한 결정은 **A의 데이터/API·화면·forward SQL 후보 작성/독립 검수 범위** 수용 여부다. 실제 DB 적용/격리 QA/서비스 반영·실사용자 정책/권한·실소스/Agent·native compile·비밀·인증서·비용은 별도이며 승인으로 추정하지 않는다. 원 경로 심사 거절·소진 권한도 해소하지 않는다.

## 4. A를 수용할 경우 Main이 상세 카드로 고정할 책임 단위

| 단위 | 실제 산출·연결 | 검수 초점 |
|---|---|---|
| FN01 입력/내용 판정 계약 | 정확 4상태와 item ID/설계 ref·증거·미확인/선택 이유, source 선언/관측의 종류·정확 ref, 사용자 확인/근거 | 기능 존재/부분 구현을 테스트 이월로 숨기지 않음. 실제 수행 근거 없이 핵심 동작 확인 합격 금지. source 없음/미확인 보존 |
| 불변 저장·보호 조회 후보 | 기존 명령의 현재 로그인/OWNER/client/제어·명시 정책·기한/CAS/replay·감사와 연결, exact GET/유한 목록 | 같은 프로젝트/정확 version/hash·원문 격리/현재 접근. 기존 일회 승인 소비는 uploadArtifact 전용이므로 몰래 확장하지 않고 미지원 경로는 거절 |
| forward SQL 후보 | 기존 project_baselines 구조·기존행을 보존하며 새 보호 계약만 추가 | source id만 믿는 참조·직접 DML/교차 프로젝트·불변성·명령/감사/중복·현재 head. 기존SQL 수정/행 삭제·자동 backfill/실제 적용0. 실제 row 미확인을 빈 표로 가정하지 않음 |
| UI02/프로젝트 연결 | 기준선 입력→근거 원문→별도 검토/확인→저장/정확 재조회. 생성과 기준선의 두 상태 구별 | 자동 확정0, pending 같은 명령/원입력 보존, 주체/프로젝트 전환·조회 거절 뒤 옛 원문 숨김, 정확 상태·미확인 표시 |

현재 문서 작성만으로 이 단위의 구현을 시작하지 않는다. 기존 설계·WORK_PLAN의 정본 계약은 변경하지 않았다. 범위가 수용되면 Main이 확정 입력/반환·상태·허용 파일·검증의 상세 카드와 기준 hash를 고정하고 그 범위로 진행한다. PMO에는 필요한 결정만 요청하며 다음 업무 배정을 요청하지 않는다.

## 5. 전 계획의 중단으로 확대하지 않을 항목

- 서비스 복구는 N4_DEVELOPMENT_RECOVERY_PROPOSAL의 미확정 경계로 별도 관리한다. 시간 경과·코드 후보 완료가 복구 실행 허가가 아니다.
- FN01 계약을 구체화하는 동안에도 기존 허가 자료/화면·내용/맥락의 독립 결함 대조와 계획 선행 상세화는 가능하다. 다만 새 API/데이터·권한·실소스 호출은 승인 전에 만들지 않는다.
- 계획 전체가 막혔다고 판정한 것이 아니다. 현재 다음 단위와 필요한 결정·재개 조건을 명확히 기록한 것이며 기능 구현 진도로 계산하지 않는다.
