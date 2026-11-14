# FN08 native host 목적별 저장 접근 source 검수

판정: 승인된 source·합성 구현·독립 검수 및 PR108 통합 완료. source `96abb161b594e36236957038e064a29a6f4f5c17`, main `2c42f84b021350b8412555b4e7f4ebd40d377815`, Broker43555389945 success. source/main tree와 local/private main이 같고 clean이며 merged RAM 여정 smoke1P/0F/0SKIP2964.7387ms exit0을 확인했다. 실제 DB 실행과 제품 전체 완료는 아니다.

기준 main `b2df4dcff3405d5f33a52d6be20e07358fbbdea9`(PR107), branch `codex/av3-d1-native-host-storage`. 신산님 직접 채택 원문 SHA256 `A185C52DAD309718845F3DB40D2B1AC0F7E60ABB83FADACD243E9CABE750B00E`. Primary 단일 구현, Main 검수·통합, d2_preflight/d2_scope_audit 독립 읽기 검수.

## 범위

기존 host의 current→challenge→consume→ownership request→accept 다섯 경로를 목적별 보호 함수에 연결한다. 새 forward `0094_native_host_storage_access.sql.pending`만 작성하며 과거 SQL은 보존한다. 일반 app 직접 테이블 접근과 일반 발급·delivery·HISTORY는 열지 않는다.

기존 Node ECDSA 검산은 신뢰 구성요소다. 같은 DB 객체·query·거래·기한의 일회 verifier lease와 SQL의 원 자료·hash·상태 재검산을 함께 유지한다. DB 자체가 ECDSA를 독립 검증하거나 임의 SQL을 실행할 수 있는 app 침해를 암호적으로 방어한다고 주장하지 않는다.

## 검수 중 발견 사항

| 문제 | 조치·상태 |
|---|---|
| 최초 host current가 app 직접 표 조회에서 거절 | 직접 접근을 거절하는 RAM DB에서 RED 확보 후 material wrapper 연결. 실제 PG 검증 아님 |
| current material의 짧은 TTL이 후속 await/COMMIT에 미반영 | 송신 시각 기반 단조 deadline·await 전후 검사·원 budget tightening으로 보완. 독립 C0/I0 |
| consume replay의 SQL 조기 반환이 공통 read 정책까지 생략 | read 없음/DENY/만료/회수 검사를 replay보다 앞에 유지. 독립 C0/I0/M0 |
| 저장 직전 transaction await 중 packet/expected 변조 가능 | 첫 await 전 검산 snapshot을 만들고 같은 사본의 lease hash·SQL 입력·응답을 대조. 반례 RED 후 독립 C0/I0 |
| deferred observation/anchor 검산의 app COMMIT 실행 권한 누락 | 기존 본문을 유지한 definer 실행 문맥 보완, 고정 search_path/OWNER/직접 EXECUTE 차단. 독립 재검수 C0/I0/M0 |

## 현재 증거

- 첫 직접 접근 거절 RED: 0P/1F, exit1, 2847.8573ms. Main current handler 보완 확인: 1P/0F/0SKIP, exit0, 7100.1375ms.
- material TTL 반례 RED 후 GREEN: Primary 1P/0F/0SKIP, exit0, 6612.1249ms, COMMIT0. 독립 검수는 짧은 기존 deadline과 재조회 TTL 비연장을 확인했다.
- 0094 최종 SQL SHA256 `A33809F4355EE44132988AA8C58BE5FB36D03241945EBBC38B5D13ACB46FCFB4`. 독립 source C0/I0/M0. Main `node --test tests/unit/FN06/native-host-storage-sql.test.ts`: 5P/0F/0SKIP, exit0, 157.6216ms. 원 migration 불변·app 직접 표 접근 차단·기존 검산 보존을 확인했다. 정적 시험이며 실제 함수 설치·실행 증거가 아니다.
- 전체 다섯 목적 저장 여정·인접 회귀·최종 타입·diff·독립 종합 검수 결과는 아직 제출 전이다.

## 제외·남은 범위

실제 DB 접속/migration/권한 적용, 키·보호 파일·사용자 자료·서비스·Agent·C# 실행은 하지 않는다. 실제 PG의 RLS·trigger·경쟁·rollback은 미검증이다. RAM 저장소 합성 결과를 실제 DB 통과로 승격하지 않는다.

보호 journal와 image/startup/selection 공급자, 최초 grant의 writer OWNED/osFence CURRENT, resume/START/실제 코딩 Agent 여정은 별도 미완료다. WORK_PLAN 전체 완료 체크를 올리지 않는다.

## 복구

실제 서비스나 데이터를 변경하지 않는다. 통합 후 source 회귀는 정상 revert로 복구하며 과거 migration·보호 WIP·사용자 자료는 보존한다. 미적용 SQL을 실제 DB rollback으로 간주하지 않는다.
