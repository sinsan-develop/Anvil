# FN02 정식 schema 반영 준비 — 실행 불가 후보

2026-10-20 / Main 어울 / 기준 `1a2d5bfd1cb2a71a5e07c48273cdcb6adcce9dc4` 이후 code-only 후보.

## 경계와 완료할 기능

- 목표는 기존 승인 FN02/UI03의 빈 프로젝트 방법론 명시 적용과 임무·맥락·시작 기준선·실행 준비의 실제 저장 연결이다. 이 문서는 새로운 제품 기능/자동 승인/실제 Agent 실행을 추가하지 않는다.
- 실제 정식 PG는 2026-10-20T11:21:54.792276193Z 시작 후 running/PG15.18이며 고정 READ ONLY 관측은46개다. API/Web3830=0/PG5546=1은 해당 관측 시점의 값이다. 이후 live 재확인은 하지 않았다.
- **기존0012 정식 실행의 안전 거절·직접 질문 미답변은 미해소**다. 다른 실행기로 같은 행위를 우회하지 않는다. 이전 단발 metadata 창은 이 후보의 백업·DDL·추가 조회 허가가 아니다.
- 현재 허용: source/기존 결과서 대조, `scripts/fn02-development-adoption-plan.ts --plan`, 로컬 단위시험, 문서 보완. 접속·백업·DDL·서비스·Secret/권한의 실제 변경은0이다. `--apply`/`--apply-schema-only` 등은 거절한다. 외부 효과를 가진 orchestrator/runner 등록은 구현하지 않았다.

## 고정 반영 차이 — 자동 실행이 아닌 제안 순서

기존46 ID/checksum은 [실제 관측 결과](../04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md)의 표를 보존한다. code-only planner는 이 표와 현재 source46이 다르거나 누락/추가/중복이면 거절하며, 관측의 현재성을 인증하지 않는다.

| 제안 순서 | Migration | SHA256 | 누적 수 |
|---|---|---|---|
|1|0012_assignment_drafts|1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133|47|
|2|0013_assignment_confirmation|fe064af94b23185066047f8e202806cd4c3a7fe69ab7855bd2d2f6b961ae7cca|48|
|3|0014_context_preparation|7c8fa1c83400e711d341e3710f765fa29af5fa6c821adf594ce195172194ec97|49|
|4|0015_project_baselines|3e5eea0f94186f0cc28819d435e85c4fec97569dda3bef7751ad420ed9d3b6ec|50|
|5|0016_execution_preparation|612be372c2a82f201c072dde62e7c1222ff96168172edf22a11226e7291fe91d|51|
|6|0017_execution_authority|40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3|52|
|7|0031_empty_project_methodology_application|e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6|53|

- 첫6개는 임무 초안/확정·맥락 패킷·프로젝트 시작 기준선·실행 준비/권한 저장 계약이다. 새 table/function/trigger 및 기존 app-role에 대한 GRANT/REVOKE가 포함된다. 특히0017에는 실행 원장 INSERT 권한과 guard가 있으므로 **무해한 metadata 추가·권한 변경0이라고 설명하지 않는다**. 실제 사용자 정책 자동 부여·계정 생성·Agent 호출은 별개다.
-0031은 새 적용 명령과 저장 보호/receipt·CAS/7원장 이력·동시성 guard를 바꾼다. 기존46/소스 SQL/pending 원문은 덮어쓰지 않는다. SQL hash가 달라지면 후보를 조용히 추종하지 않고 실패한다.
- 제안은 한 migration TX에서46→53(기존 migration advisory lock과 고정순서/각기록 확인) 후 단1회 COMMIT이다. planner는 이 순서의 before/after 수와 manifest hash만 계산한다. 실제 TX/DDL/COMMIT 코드는 현재 없다. 중간47~52를 성공 checkpoint로 만들거나 실패를 지나쳐 적용하지 않는다.

## 기존 증거를 재사용할 범위

-0012 기존 formal executor는46→47 한 개만 다룬다.0013~0017을 자동등록하거나 이번 거절을 해제하지 않는다.
- [등록 helper 실제 검수](../04_test_reports/AV3/FN02/FORWARD_REGISTRATION_RESULT.md)는 새 빈 격리52→53/rollback/실패종료/동시 재호출의 증거다. 정식46→53·현재 데이터/권한 보존·복구 증거가 아니다.
- 실제46 metadata 조회와 전용 경로 정리는 완료한 범위로 유지하며 같은 조회/격리 시험을 반복하지 않는다. 아래 backup/restore와 정확46→53 결합 검수는 **기존 시험과 다른 미검증 범위**다.

## 별도 실행 결정 전에 필요한 보존·복원 계약 초안

아래는 실행 제안이며 경로 생성/DB 조회/백업/복원 모두 미실행이다. 실제 역할의 덤프 권한/도구 설치 여부도 미확인이고 새 superuser·GRANT·Secret로 우회하지 않는다.

1. 대상은 기존 WSL-server PG fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba / image594290e9 / DB anvil_v3_development 한 개다. 정식 현재46의 정확 ID/checksum·예상 기존 객체·실제 active writer/공유 소비자를 새 허가 안에서 확인해야 한다. 서비스3830=0만으로 writer0을 단정하지 않으며 advisory lock도 일반 DML을 막지 않는다. 불명확하면 적용0/기존 자원 보존이다.
2. 최소 backup 제안: 단일 DB의 schema+data+함수/trigger/ACL/owner·migration 기록을 포함한 consistent custom dump와 비밀 없는 manifest/hash. cluster globals·SSH/인증서/보호 config 파일 원문은 복사하지 않는다. source/Git은 별도 checkpoint다. DB dump에는 사용자 본문·계정의 password hash/세션 등 민감 자료가 들어갈 수 있어 **새 데이터 열람·복사 승인 경계**이며 metadata 허가로 생성하지 않는다. 출력은 이름/hash/크기만, 본문·password/DSN/rawstderr0.
3. 보관 후보는 `/home/daon/.local/share/anvil-v3-development/backups/schema-adoption-01/{before.dump,manifest.json}` 한 묶음, 새 부모/파일 daon0700/0600·nonlink/실경로·Git/웹/공유경로 노출0이다. 기존 접근권한을 넓히지 않는다. 접속은 기존 승인된 migrator 설정만 메모리 소비하는 별도 범위이며 인자/로그에 credential을 쓰지 않는다. 단순한0600은 암호화가 아니며 암호화·키가 추가로 필요하면 별도 정확 결정을 먼저 받는다.
4. 수명은 복원 검수+다음 안정 checkpoint까지 필수 보존, 이후 사용자 명시 삭제 전까지 보존/자동삭제OFF다. 실행 window·timeout은 최종 후보/측정 크기·공간/도구를 확인한 **새** 유한 계약에 고정한다. 현재 날짜만으로 자동삭제하거나 이전20분 창을 연장하지 않는다. 실패 partial은 민감 자료로 격리 표시·정확 목록 보존하고 자동 덮어쓰기/삭제하지 않는다.
5. backup 성공은 파일 존재/pg_restore 목록만으로 판정하지 않는다. 동일 PG15 image의 새 전용 무공개·분리 network/빈 DB에 실제 복원 후46 ID/checksum·객체 정의/권한 및 보존 데이터의 비밀 없는 count/hash를 대조해야 한다. 이 작업은 실제 자료를 다른 DB에 복사하므로 별도 정확 대상/이름·소유·격리·수명·회수 결정을 받는다. 현재 새 복원 자원 생성0이다. 복원 계정/ACL 가정이 틀리면 자동 superuser/권한 변경 없이 중단한다.
6. 정상 source/postcheck는 새53 및 기존46/대상외 데이터·객체/권한 불변을 대조하되,0012~0017/0031이 명시적으로 바꾸는 객체·권한은 별도 허용 diff로 구분해야 한다. 그 목록과 exact source/실행 창·보호 역할/backup 성공 영수증이 고정되기 전 정식 실행은 허용하지 않는다.
7. COMMIT 전 오류는 같은 TX rollback/신규 세션의 복원된46 확인이 필요하다. **COMMITUNKNOWN**(응답 유실/연결종료/기한만료)은 rollback 성공/미적용으로 보고하지 않고 상태불명으로 보존한다. 자동 SQL replay·down migration·restore-in-place·table DROP0, 별도 허가된 읽기로46/53·정확 전체 지문과 원 기록을 대조한 뒤 결정한다. COMMIT 후 실패도 파괴적 자동 복원이 아니라 검토된 forward repair 또는 사용자 승인 복원으로 분리한다.

## 다음 완료조건

code-only planner의 source drift/관측 불일치·입력변조/명시모드 거절 음성 및 타입 검사, 독립 scoped 검토, 기존46 보존·복구의 남은 정확 결정/미검증 기록. 이것은 정식 반영이나 기능 완료의 완료조건을 대신하지 않는다. Main이 기존 승인 계획을 주도하며 PMO에는 이 실행 경계의 결정·지원만 요청한다.
