# IX01 provider owner 설치 선행 source 보완 작업지시서

2026-11-04 · Main 채택 · SOURCE_ONLY · 실제 실행 승인 아님

## 기준과 목적

기준 HEAD 1f19556496048c14cbe2eb708ea165b4565c5618의 R4 실행 소스 cd6b832289716e686d263b7f62a80a18499fb566을 이어간다. 최소 후보 docs/work_packages/IX01_PROVIDER_OWNER_SETUP_SOURCE_CANDIDATE_20261104.md SHA256 4E027E7A99F1EB10D67426F8BDCD7BD4EC68008461338030B724AF8D75D43146을 source2 내부 구현 기준으로 채택한다. 후보의 SOURCE_GO0는 작성 당시 상태이고 이 WI가 후속 source 배정을 허가한다.

원 SQL0037은 별도 NOLOGIN owner·migrator 임시 ADMIN membership·전체 migration transaction을 이미 요구한다. 승인 계획의 기존 설치 계약을 진단 도구에 연결하는 내부 보완이며 공개 API·제품 SQL·사용자 권한 정책 변경이 아니다. 실제 role 생성/GRANT/DB·WSL QA는 이 WI로 승인되지 않는다. 소진 R4 승인 재사용0이며 향후 새 동결 실행안과 별도 직접 승인이 필요하다.

## 단일 writer·허용 경로

기존 Primary fn16_primary_recovered만 다음 두 코드 경로를 수정한다. Main은 코드쓰기0이며 문서·Git·독립 검수를 소유한다. 다른 작업자의 변경과 보호 untracked3은 보존하고 되돌리지 않는다.

1. scripts/qa-ix01-schema-closure.sh
2. tests/unit/IX01/schema-closure-controller.test.ts

SQL105/index106/선택 순서·SQL sourceHead0a647daa·기존 R4 packet/감사·제품 파일은 변경하지 않는다. namespace를 미래 실행으로 미리 바꾸지 않는다.

## 필수 동작

- 정확0037 선택에만 원 계약의 provider owner 준비 SQL을 조립한다. 동명 역할 인수·IF NOT EXISTS·app membership·SUPERUSER/BYPASSRLS/LOGIN 허용0.
- PRISTINE은 원 깨끗한 역할 집합을 유지한다. INSTALLER/SETTLED/REVOKED는 selected/attempted/completed와 연계해 고정 owner 이름·속성·grantor·ADMIN membership·회수 시점만 허용한다. 역할 개수 상한만 올리거나 임의 역할을 허용하지 않는다.
- provider owner는 기존0066/0073 reader와 생성 주체·시점·회수 규칙을 분리한다. reader 선생성0·기존 systemHash/속성 검사 보존.
- 원 SQL0037 전체만 psql --single-transaction 실행 경계로 결박한다. 실제 controller→ports.sql→psql builder/run까지 파일 경로·고정 원문 hash를 소비한다. 다른 SQL이나 이미 BEGIN/COMMIT인 reader SQL에 일괄 적용하지 않는다. 원 stdin 바이트·statementEndLine 분모를 보존한다.
- 성공 뒤 원 SQL의 membership/schema CREATE 회수와 역할 상태를 검산한다. 명확한 원자 실패 뒤에는 실제 남은 허용 membership만 회수하고 installer CREATEROLE을 회수한다. 이미 회수된 membership 부재는 정상이다. 임의 DROP/권한 확대/관리자 migration 대행0.
- UNKNOWN/COMMIT 불명/관측 불명/회수 불명 뒤 query·mutation·stop/rm·재시도0. 기존 기한·보안·정제환경·finalPID1·raw 오류정제·원장 입력/결과 shape를 유지한다.
- bootstrapSqlHash/revokeSqlHash는 실제 조립·소비된 원문과 일치시킨다. 새 공개 입력/결과키·범용 권한관리 기능을 추가하지 않는다.

## TDD·필수 검수

수정 전 신규 RED로 준비 누락 및0037의 원자 실행 누락을 실제 공유 builder/run/controller에서 재현한다. 역할 정상/부정, 다른 selection 생성0, PRISTINE 동명 역할 거절, LOGIN/INHERIT/임의 grantor·app membership·부적절한 시점, 원SQL preflight의 ACL/소유 차단 보존, 성공 후 회수/이미 없음, 명확 실패 정산, COMMIT UNKNOWN 뒤 후속효과0을 확인한다. ACL 검증은 기존 SQL guard 원문 보존과 metadata가 증명하는 범위를 구분하며 fake가 실제 PG 보안을 검증했다고 하지 않는다.

기존46 중 직접 영향 회귀와 신규 집중 검사를 수행한다. 실제 공통 runner·psql 인자를 소비하고 최하단 exec만 fake로 둔다. 필요한 noEmit/Bash-n/diff를 실행하고 정확 명령·종료코드·수량·오류를 반환한다. 중복 전수/실환경 테스트는 하지 않는다. 동일 근본 오류3회면 중단하고 Main에 원인·증거·대안을 반환한다.

## 제외·결과 계약

실제 DB·role/GRANT·키·권한 적용·실자료 조사·서비스·Agent·WSL/Docker·컴파일·P03 R3·새 QA 실행0. 새 세션/branch/worktree/자동화/외부 메시지0.

결과는 코드 diff·신규 RED→GREEN·최종 검증·실제 sourceHash/역할 SQL·미검증·오류 횟수·rollback을 포함한다. 제출과 합격을 분리하며 Main 독립 검수 전 기능/PG/IX01/계획 완료를 주장하지 않는다.
