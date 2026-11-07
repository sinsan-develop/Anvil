# FN08 START 등록·FN09 등록 정의 준비 r2 직접 승인 기록

2026-11-06 / 승인자 신산님 / 기록 Main 어울.

## 직접 지시

“FN08 START 등록 A안과 FN09 등록 정의 실행 준비·Options 보관 r2 A안 둘 다 승인해. 코드·화면·미적용 SQL·합성 검증은 기존 subagent에게 맡겨. 실제 DB·권한·키·서비스·Agent 실행은 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.”

이 대화의 최신 직접 지시와 목표 active 전환을 근거로 한다. PMO의 이전 직접 결정 대기·미채택 표기는 승인 전 이력으로 보존하며 현재 차단으로 적용하지 않는다.

## 정확 채택 대상

1. docs/contracts/FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md A.
   SHA256 8AE16D6CAB5334FAC4548688777AE44560997BB0D0C78816CB340A114A7E4384.
2. docs/contracts/FN09_REGISTERED_PREPARATION_OPTIONS_CANDIDATE_20261106.md r2 A.
   SHA256 BA7FD5B34BDFF9CFF26D2CA23C74AAFF685E8850054A27CE711827FCDC66DAD3.

두 원문 지문은 현재 파일에서 일치 확인했다. 후보 원문을 다시 써서 승인 지문을 바꾸지 않고 이 기록으로 ADOPTED_SOURCE_ONLY를 결박한다. 새 의미 확대·실행 승인으로 해석하지 않는다.

## 수행과 선행

- 기존 Primary가 유일한 코드·시험·미적용 SQL writer다. Main은 정확 WI·검수·fresh 검증·문서·Git 통합을 담당한다.
- FN09의 원 등록 정의/환경→닫힌 Options 원문→불변 준비/보호 조회를 먼저 구현한다. 후행 FN08의 START 두 그룹 등록/부분 조회/원 봉투·영수증·proof 완결을 같은 승인 범위로 연결한다.
- FN09 독립 문서 C0/I0/M0, FN08 독립 문서 C0/I0는 계약 검토일 뿐 실제 구현/DB 동작 PASS가 아니다.
- 기존 후보 준비 exact11/9·SEND/0062·권한/일회 소비·한도·UNKNOWN·실행 false와 보호 비추적3을 보존한다.
- 정확 허용 파일·시작 SHA·TDD·검수는 후속 WI에 고정한다. preflight는 읽기만, TEST_ONLY와 제품 GO는 Main이 기록 후 단계적으로 발행한다.
- 새 agent/chat/branch/자동화·동시 writer를 만들지 않는다. 기존 미완료 Stage B branch를 유지한다.

## 제외

실제 DB/DDL 적용·권한/정책/계정 부여·키/Secret/인증서·서비스·SDK/Agent 실행·실자료/백업 조사·C# 컴파일·J3/P03 R3·Oracle/운영·기존 프로젝트 차단 해제는 승인하지 않았다. 합성/정적 검증을 실제 실행·사용자 인수로 승격하지 않는다.

기존 Git 인증 거절을 우회하거나 push/인증 복구를 재시도하지 않는다. 새 후보 채택은 전체 계획 완료·release·main 병합의 근거가 아니다.
