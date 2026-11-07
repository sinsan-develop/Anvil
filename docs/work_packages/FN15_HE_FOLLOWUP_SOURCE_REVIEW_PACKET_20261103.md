# FN15 수락 후 제어 조회 연결 — 한정 source 검토·결정 자료

2026-11-03. 제안 미적용 / 실제 효과 제외 / 전체 FN15 미완료.

## 문제와 기존 근거

INTERFACES §13.6(:1053)의 실제 acceptControl과 §15.2(:1107)의 HANDOFF_ELIGIBLE 실제 수락 후 단독 제어 조건을 연결하는 기존 구현 단위다. WI r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F §8/§14/U4는 일반문서·승인 및 후속 인계의 current 소비까지 요구한다. 현재 canController는 OWNER만 허용해 수락 완료한 HANDOFF_ELIGIBLE의 후속 제어 조회가 닫힌다. 회수/만료·현재 tuple 불일치와 원 물리 grant 불완결을 허용해서는 안 된다.

## 제안 정확 범위

| 경로 | 변경 내용 |
|---|---|
| apps/server/modules/control-handoff/control-grant.ts | 원 authenticated Tx의 project/member/current tuple과 실제 grant의 command·receipt·audit·grant/revocation 물리행을 기존 findCurrentControlGrant로 검산하고, 독립 동결 observation 인스턴스만 private WeakMap에 결박 |
| apps/server/modules/control-handoff/control-request-read.ts | currentAccess 기존 로그인·세션·member 검사를 유지하고 실제 검산된 원 observation에서 만든 Access 인스턴스에만 private WeakSet 표시. canController의 HE 분기는 해당 표시+자기 현재 tuple일 때만 허용 |
| apps/server/modules/control-handoff/control-handoff-pg.ts | 기존 observe 반환을 위 물리 검산으로 연결. 공개 응답 boolean이나 caller 제공 권한표시를 추가하지 않음 |
| apps/server/modules/control-handoff/control-discovery-read.ts | HE 자기 tuple이어도 실제 grant 검산이 없으면 HELD 대신 UNVERIFIED |
| tests/unit/FN15/control-grant.test.ts | 기존 신규 행동 RED를 보존하고 Binder 매개변수 자기참조/실제 readControlState export 이름 준비오류3곳 수정. 기대값·합격기준 완화0 |

Primary 제안4제품 unified diff 정규화(파일순서 grant→request-read→PG→discovery, UTF8 noBOM/LF/EOF1) 5516B SHA BDA1B453719D27643406E96C3594A1FB655CB1A37F0F3367FC1216256D1A20C6. 별도 시험 준비 diff SHA7AD51A25FD8AE56DC09BD8FD38308425C38F985E8B62D550E6FBFE01DDB3BD36. 이는 원 거절 shell script 지문이 아니다. 원script 지문 미확보다.

제안 전 제품4 지문:
- control-grant.ts A2E5B72E2C82EE7364BE60A08D30261549FEECA5C121D64C13DF3B2D9C814CF3
- control-request-read.ts F4FBFD88420B79238D43D3EED3BA2704CF2ACF99E0D5AD63E9A566C8588F1FEF
- control-handoff-pg.ts 911C6C1EC1AFEED6FFE0C82342EBA2552DB9C22CA28E875022D164751B892BE0
- control-discovery-read.ts FBD1A5308C97BA9BE2CBB880957AD1A34171228BC2E794D973DD51E7AFC83C39
- grant test D2BEBAB3EE4113D48E2A3BF6D1D26E40F69135597FD71874BF59C2E309CCA2E2

## Main 읽기 검토

현재grant:51~63은 bundle만 보지 않고 command/receipt/audit·두 event 원행의 hash/관계를 검산한다. PG:212~237은 project/member/control 잠금 뒤 시각/nullable필드를 ISO/정수의 평문 observation으로 조립한다. request-read:93~129는 현재 사용자/client/credential/세션기한/member와 정확 tuple을 별도 검산한다. 제안은 원 observation 인스턴스에만 물리관계를 결박하며 clone/공개 JSON으로 표시를 전파하지 않는다. Owner 경로/일반 HUMAN·관리 권한은 그대로다. 이는 읽기 적합 판단이며 미적용 제안의 type/test PASS가 아니다. 신규 행동 RED 및 type 준비오류는 미해소로 보존한다.

## 자동 실행 심사 경계

앞 action은 CreateProcess 이전 거절되어 실행/적용0이다. 원문 이유: “여러 제품 파일의 제어권 판정과 canController를 수정해 HANDOFF_ELIGIBLE 권한 범위를 넓히는 지속적 권한 경계 변경이며, 사용자 메시지는 이 구체적인 권한 변경을 명시적으로 승인하지 않았습니다.”

현재 프로젝트 기존 source 승인 근거와 플랫폼의 구체 승인 요구를 구분한다. 이 문서를 승인 자체로 보거나 action을 분할해 우회하지 않는다. PMO에는 이 한정 source5 경로의 기존계약 구현 결정·지원 범위만 요청한다. PMO 위임 범위에서 처리 불가하면 이유를 기록하고 직접 질문은 이 구체 단위에 한 번만 한다. 신산님의 전체 계획을 재승인 요청하지 않는다.

실제 DB 접속/DDL 적용·GRANT/사용자정책/회원역할 변경·키·Secret·서비스·Agent·운영·실제 제어권 이전은 포함하지 않는다. 승인/실행심사 해소 뒤에도 type/정상·중요음성 source검증·Main 검수 전 완료로 표시하지 않는다. 현재 SQL 완결 등 영향없는 승인작업은 계속한다.