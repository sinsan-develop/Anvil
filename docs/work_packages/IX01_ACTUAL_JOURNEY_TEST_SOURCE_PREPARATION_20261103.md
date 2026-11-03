# IX01 문서 여정 — 실제 PG opt-in 시험 source 작업지시서
2026-11-03 · Main 어울 · 기존 Primary 단일 writer

개정 r2: 실행 입력은 검산된 외부 QA binding을 명시 opt-in 뒤에 받는다. 영구 null 상수나 승인 때마다 시험 source를 고쳐야 하는 scaffold를 만들지 않는다. 제품/API·실제 실행 제외 범위는 불변이다.

## 범위와 기준
- 계획: WORK_PLAN Stage B / INTEGRATION_WORK IX01. 방법론→프로젝트→문서→계획·지식의 원 저장·재조회 소비선을 이어 붙인다.
- 기준 commit17351bebbbefd9b3dae5c21c3399609c8686702c, codex/av3-stage-b. Main 소유 기술 초안·WORK_STATUS의 변경과 보호3은 그대로 둔다.
- 사용자 승인된 source 구현·시험 범위다. 실제 DB·권한·키·서비스·Agent 실행은 제외한다. 신규 공개 API·SQL·제품 계약 변경도 하지 않는다.
- 허용 writer 경로는 신규 tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts 한 개뿐이다. 다른 파일이 필요하면 소스 쓰기 전에 경로·이유를 반환한다.

## 작업
기존 FN02 application-assignment-race-isolated.test.ts의 실제 PG·인증·buildApp/app.inject·ApiClient 소비 원형을 참고하되 원 파일/기존 fixture/53개 manifest를 수정하지 않는다. 기존 source helper는 재사용할 수 있으나 외부 resource 실행 script를 import해 상위 코드를 실행하지 않는다.

한 여정에서 실제 반환 ref를 다음 연산에 넘긴다.
1. 격리 합성 프로젝트·명시 정책·방법론 버전 검토/확정/적용.
2. 적용본에 연결한 설계 문서 저장·내용 검토·확정.
3. 그 실제 확정 설계 ref에 연결한 화면/기능 업무·선행·검수 계획 저장/검토/확정.
4. 설계 위치↔계획 업무/시험 추적 저장·양방향 조회.
5. 해당 원문/단계/계획 근거 지식 저장·정확 조회/검색.
6. 같은 DB 자료를 reader/서비스 객체 재생성 후 재조회한다. 실제 서버/OS 재시작이라고 부르지 않는다.

이상 조건은 각 원 소비선에서 확인한다. 타 프로젝트 직접 ID/문서·계획·지식 접근, 만료 session, 옛 control세대, 미확정 설계/잘못된 ref/hash, replay 추가 저장0을 구분한다. 실제 SQL의 권한/receipt/audit/버전 검산을 true fixture나 별도 SQL emulator로 대체하지 않는다.

## 기본 거부와 실행 경계
- import/기본 실행 단계에서 Pool 연결·난수 키 생성·mkdir·설정/환경 Secret 읽기·네트워크를 만들지 않는다.
- 실제 실행은 별도 명시 opt-in과 기존 격리 QA guard(정확 Linux/UID/cwd/HEAD·새 격리 자격·TTL·실환경 설정 거절) 뒤에만 가능하게 한다.
- 신규 시험 내부의 외부 QA binding parser는 exact 필드·64KiB 한도·공개 metadata만 검산한다. 입력은 manifest/HEAD/격리 자원·소유 marker/TTL의 실행 계획 결박용이며 사람 승인이나 제품 인증 권위 자체가 아니다. 실행 승인은 별도 플랫폼·실행 계획에서 받는다. 입력이 없으면 Secret/키/Pool·파일 IO보다 먼저 거절한다.
- 외부 binding의 원문 SHA256과 실제 source HEAD·원 SQL bytes/order·원 소유 marker를 대조한다. 동일 사용자가 제공한 hash 자체로 사람이 승인했다고 주장하지 않는다. 실제 실행 계획은 후속에 정확 source/manifest/input SHA를 함께 동결하며 이번에는 작성한 시험을 실행하지 않는다.
- 현재 source에 맞는 SQL manifest는 미확정이다. 기존 FN02 정확53은 raw checksum 일치가 확인됐지만 IX01 전체의 충분조건이 아니다.
- manifest가 없거나 정확 source HEAD/원문 hash·순서/의존 검산이 충족되지 않으면 실제 연결보다 먼저 거절한다. 미적용 SQL을 전부 자동 적용하거나 기존53 검사를 완화하지 않는다.
- 시험 자체는 DB·컨테이너·네트워크 생성/삭제를 수행하지 않는다. 후속 실행기는 새 소유 artifact root/자원을 사전 등록하고 정확 정리·불명 보존을 별도 검토해야 한다.
- 테스트 source에 실제 키/DSN/계정·사용자 자료를 넣지 않는다. 실제 실행 승인은 이번 WI에 포함되지 않는다.

## 현재 허용 검증
- 새 파일 구문 및 root noEmit·diff 확인만 수행한다. 실제 opt-in test 실행/skip를 PASS 증거로 만들지 않는다.
- 실제 PG RED→GREEN·SQL 적용·RLS·경합·browser/Agent는 NOT_RUN으로 남긴다. TDD의 실제 DB 실행 선행을 충족하지 못한 준비 코드임을 명시한다.
- 기존 완료 검사를 반복하지 않는다. 새 source의 타입/구문 오류에 필요한 최소 확인만 수행한다.

## 반환·검수
정확 변경 파일/hash·구문/type/diff 명령과 실제 종료 결과·실행하지 않은 항목·현재 manifest/자원 선행·사용한 원 service/handler를 제출한다. 코드만 동결/반환하고 commit/push·실행·새 path 수정은 Main이 관리한다.
이 단위는 실행할 검증 source 준비이며 새 제품 기능/IX01 통과/전체 계획 완료가 아니다. 억지로 전체여정을 한 파일에 흉내 내야 한다면 부분 scaffold를 만들지 말고 최소 실제 소비 구간과 한계를 반환한다.
