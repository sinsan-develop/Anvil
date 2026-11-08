# IX01 현재 113 SQL 소스 재결박 작업지시서

상태: 소스·합성 검증 구현 허용 / 실제 실행 미허용. 담당은 기존 Primary 단일 writer, Main은 검수·통합이다.

## 근거와 목적
WORK_PLAN IX01의 현재 스키마 통합 검증 준비다. 현재 main 4b266f616c8726386c2092639007468d04f85d35에 승인된 0082가 포함됐지만 현재 실행 기준은112에 머문다. 역사105를 보존하고 suffix8 및 부모/자식의 정확113 검산으로 맞춘다. 신산님의 J3 횟수 무제한 지시를 보존하며 소스 SHA·개수 변경만으로 재승인을 요구하지 않는다. 이번 지시는 실제 SSH·PG·키·권한·서비스·Agent 실행을 허용하지 않는다.

## 정확 쓰기 소유
다음6파일만 Primary가 수정한다. 다른 담당자의 변경을 되돌리지 않는다.
- tests/integration/IX01/current-schema-baseline.ts
- scripts/qa-ix01-current-journey.ts
- tests/unit/IX01/current-schema-baseline.test.ts
- tests/unit/IX01/current-schema-installation.test.ts
- tests/unit/IX01/current-journey-controller.test.ts
- docs/work_packages/IX01_CURRENT_TC01_EXECUTION_CANDIDATE_20261108.md

검산 전용: tests/integration/IX01/current-methodology-journey.test.ts 및 current-schema-installation.ts. 실제 자식 시험은 실행하지 않는다. 역사105 TSV/J3 실행기·결과·SQL 원문은 수정하지 않는다. Main은 WORK_STATUS·본 WI·결과만 소유한다.

## 구현과 TDD
시험에 먼저 정확113 성공과 과거112 거절을 넣어 실패를 확인한다. 기준 suffix의0082는 Git blob230239B/SHA256 4cbca6ad03aa9b4ac8b7ce485ca1dc9e34df8692cd7dc6a0b5de716101fa84b2다. git cat-file 바이너리를 메모리에서 검산하며 Windows CRLF를 정규화하여 통과시키지 않는다. 기존 역사105 길이·해시·순서와 음성은 보존한다.

부모·자식 ledgerCount113을 맞추고 마지막0082 누락/중복/변조/순서/CRLF·112/114 원장·과거112 자식결과를 거절한다. 마지막 설치 FAIL/UNKNOWN 뒤 원장·망·자식·정리 후속0을 확인하고 기존 intent 재사용·기한·timeout·UNKNOWN 보존 반례를 유지한다. count 동적 소비자는 불필요하게 수정하지 않는다.

후보 문서는 현재113 총바이트/순서·원장해시/14sourceFiles를 Git 원문으로 다시 산출한다. 최종 sourceHead는 실제 소스 commit 후 Main이 결박하며 존재하지 않는 SHA를 만들지 않는다. 필요하면 최종 결박 미완료를 명시한다. 오래된 후보의 source SHA 변경 자체를 신규 권한으로 간주한 문구를 실제 효과 대조에 맞게 정정한다.

원 인간 승인시각은 변경하지 않는다. 각 신규 실행은 Main이 실제 발급한 유한 외피 시각과 별도 고유 소진 기록으로 전체30분/PG10분/자식90초의 최소 기한을 유지한다. 과거 만료 grant 연장·재사용과 UNKNOWN 자원 조회·재사용·삭제는 금지한다. 실제 실행 GO는 원문·현재 도구/자원·정확소스·외피·기한·독립검수 확인 후 별도 Main 절차다.

## 검증과 반환
node --test tests/unit/IX01/current-schema-baseline.test.ts tests/unit/IX01/current-schema-installation.test.ts tests/unit/IX01/current-journey-controller.test.ts
npm run typecheck
git diff --check

Main과 typecheck 실행 소유를 중복하지 않는다. RED/GREEN 명령·exit·실제 결과·오류 횟수·변경 파일 바이트/해시·미검증을 반환하고 writer를 명시 반환한다. 합성 통과는 SQL 실제 설치·권한·제품 기능 완료가 아니다. commit/push/PR은 Main만 수행한다.
