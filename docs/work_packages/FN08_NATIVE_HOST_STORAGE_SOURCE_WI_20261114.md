# FN08 한정 host 저장 접근 source 구현 지시

상태: 승인 범위 내 착수. 2026-11-14 Main. 기준 PR107/main `b2df4dcff3405d5f33a52d6be20e07358fbbdea9`, branch `codex/av3-d1-native-host-storage`.

## 승인·역할

신산님이 `FN08_NATIVE_HOST_STORAGE_ACCESS_CANDIDATE_20261114.md` 원문 SHA256 `A185C52DAD309718845F3DB40D2B1AC0F7E60ABB83FADACD243E9CABE750B00E`의 A안 계약·source-only 구현을 직접 채택했다. 이 지시는 그 계약의 구현 분해이며 권한을 확장하지 않는다.

기존 developer_primary 한 명이 아래 코드·시험을 소유한다. Main은 문서·검수·통합을 소유하고 해당 코드 동시 쓰기를 하지 않는다. 다른 작업자의 수정은 보존한다.

## 정확 구현 경로 9개

1. 신규 `apps/server/modules/executions/native-host-storage.ts`
2. `apps/server/modules/executions/project-native-preparations.ts`
3. `apps/server/modules/executions/native-preparation-store.ts`
4. `apps/server/modules/executions/native-preparation-ownership-return-store.ts`
5. 신규 `db/migrations/0094_native_host_storage_access.sql.pending`
6. 신규 `tests/unit/FN06/native-host-storage.test.ts`
7. 신규 `tests/unit/FN06/native-host-storage-sql.test.ts`
8. 신규 `tests/unit/FN06/native-host-storage-journey.test.ts`
9. `tests/unit/FN06/native-preparation-store.test.ts`

추가 경로가 필요한 경우 정확 영향과 사유를 Main에게 먼저 전달한다. 과거 SQL 0039/0071/0076/0092/0093은 수정하지 않는다.

## 구현과 완료 기준

- 첫 RED는 직접 native/ownership 표 SQL을 거절하고 채택된 목적 함수만 받는 RAM DB에 기존 실제 host handler를 연결한다. 현재 첫 credential 조회부터 실패하는 사실을 재현한다.
- `native_host_material/challenge/consume/ownership_request/ownership_accept`의 채택 입력·목적과 닫힌 반환을 구현한다. current→challenge→consume→request→accept 순서로 연결하고 공개 HTTP 형상은 유지한다.
- 원 Node ECDSA 검산 후 같은 DB 객체/query/거래/기한에 결박된 일회 verifier lease만 저장 wrapper가 소비한다. SQL은 원 material·hash·현재 DB 상태·전이를 재대조한다. 임의 Boolean/GUC를 신뢰하지 않는다. 임의 SQL을 실행하는 app 침해에 대한 독립 암호 방어라고 주장하지 않는다.
- 실제 원 command/receipt/audit/session/client/control/등록/writer/정책/기한에서 권위를 유도한다. 원 v2 consume 없이 반환 권한을 만들지 않는다. process 후보는 OS 진위 근거가 아니다.
- 새 SQL에 migrator OWNER·고정 search_path·PUBLIC 실행 회수·정확 app EXECUTE와 receive 선행 두 표의 필요한 definer 접근을 명시한다. 일반 표 직접 접근·일반 event append·HISTORY·새 principal/Pool·SET ROLE은 추가하지 않는다. ownership 차단 예외는 원 native graph에 한정한다.
- 같은 거래의 프로젝트 잠금·없는 head 경쟁·순번·용량·단발 nonce·정확 packet replay·원자 graph와 최종 COMMIT을 보존한다. 결과 불명은 재실행하지 않는다.
- 일반 HUMAN 발급(receiveArm=null)과 일반 delivery 등 다섯 목적 밖의 경로를 새 권한에 포함하지 않는다. 기존 receiveArm HUMAN 발급과 v1/v2 예약/전달 경로는 보호한다.
- 정상 여정과 잘못된 digest/목적/프로젝트/사용자/client/세대/등록, 만료·회수, 원 receipt/consume 불일치, lease 변조·재사용·거래교체, 다른 packet, 부분 저장/COMMIT 불명, 직접 표 접근 거절을 합성 검증한다. 기존 v1에는 반환 권한을 부여하지 않는다.

## 실행·검수 경계

Node/TS 문법·타입·직접/인접 합성 시험과 SQL 정적 검수만 수행한다. 실제 DB 접속·migration/권한 적용·키·사용자 자료·보호 파일·프로세스·서비스·Agent·C# 실행은 하지 않는다. 모형의 동시성/rollback을 실제 PG 검증으로 승격하지 않는다.

보호 journal와 image/startup/selection 실제 공급 조립은 이번 지시 밖이다. 그 부재를 가짜 정상 값으로 대체하지 않는다. PREPARED 관측 반환은 grant/current/resume/START나 전체 기능 완료가 아니다.

Primary는 정확 변경 목록·diff·RED→GREEN·명령/exit/실제 검사수·미검증·미해결 문제·live handle 유무를 제출한다. Main은 수행자와 분리된 검수 및 필요한 집중 검증 뒤 commit/push/PR 통합을 판단한다. 실패를 숨기거나 기존 테스트 기준을 낮추지 않는다.
