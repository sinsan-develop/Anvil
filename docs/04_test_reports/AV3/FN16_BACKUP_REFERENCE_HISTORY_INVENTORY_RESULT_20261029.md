# FN16 보호참조 이력의 최소 metadata 수집 결과 — 2026-10-29

## 판정과 범위
PMO A의 신규 내부 수집기 3파일을 Main 19개 합성 시험, 타입·diff 검사, 독립 최종 C0/I0로 검수했다. 실제 민감자료 조회, 설치자원 사용, 백업 실행·복원의 완료가 아니다.

기준 branch는 codex/av3-stage-b, 시작 HEAD는 dd47e7c7ffea24033bb5ca3c7a6ecb63cfe392ec다. 결정안425D6502 및 승인기록 docs/approvals/FN16_BACKUP_REFERENCE_HISTORY_SENSITIVE_SCOPE_PMO_DECISION_20261029.json을 적용했다. 최종 WI SHA256은 41EEE90807B8EEF1F1F60943B9ABA254DB2D18E73BD0CD54443D58BC4C1F083E다. Main은 관리·검수·통합, 기존 Primary는 단독 구현, Reviewer는 읽기 검수를 담당했다.

## 구현과 보호 경계
보호참조 head/version/event 3표와 그에 연결된 명령·영수증·감사·승인 증빙만 총9표116열로 수집한다. 원 snapshot/hash, 이전 버전, 당시 명령, 승인 null/nonnull, 과거 버전의 회수 대상과 과거 주체를 검산한다. 데이터는 RO RR에서 관측하고 처음·마지막 RC에서 같은 유효 세션과 활성 OWNER를 확인한다.

새 RR에 인증된 actor/client를 transaction-local로 설정하고 readback을 확인한 뒤 자료를 조회한다. 마지막에도 재설정하지 않고 readback하여 중간 변경을 숨기지 않는다. 이 보완은 새0053 경로에만 적용했다. 기존23 중 알림은 이미 필요한 문맥을 설정하므로 기존 수집기를 예방적으로 수정하거나 전수 재검사하지 않았다. 실제 DB 역할/BYPASSRLS·적용된 RLS는 확인하지 않았다.

현재 자료는 최소 opaque ID/ref/hash만 출력한다. 자유문자열·사람/client·정책/시각·raw request/result·경로/handle/descriptor/키는 출력·로그·오류로 내보내지 않는다. 원 hash와 투영 hash는 구분하며 해시를 완전한 익명성으로 보지 않는다. 알려진 비밀 표식은 고정 오류로 거절한다.

별도 민감검사는 UNRESOLVED/NOT_PERFORMED다. 현재 resource/key/profile·권한·원형·가용성·실행 허가를 발급하지 않는다. 기존23 조합과 전체 미수집 목록은 유지한다. 공급자/catalog/파일·기존 API/parser/SQL/RLS/role/GRANT·실제 DB/키/서비스/Agent는 변경하지 않았다.

## 오류와 검증
- 독립 사전검수에서 빠진 RETENTION 정상 범위를 보완해4종 정상과 automaticDeletion:false/true 거절을 명시했다.
- Primary e4de92: source 부재 RED 0 PASS/13 FAIL.
- 중간35316e:11 PASS/2 FAIL. 선택 승인 조회의 검증키 오류 제품1건과 fixture 반환 누락1건을 보완했다. fixture string|undefined 타입 오류2건도 수정했다.
- Primary6bb6de18 PASS/type·diff0 이후 독립 검수 I1: 승인 nonnull 상태에서 옛버전을 회수하는 정상·독립 음성의 검증 공백을 확인했다. Main41c5b7의18 PASS는 보완 전 증거다.
- be1b33에서 fixture의 승인 target=null 오류를 확인하고 당시 head v2·회수 payload v1·현재 head v3를 구분하도록 보완했다. 승인 target만v1으로 바꾸고 관련 원형·명령·감사를 정합 재봉인한 음성은503이었다. 제품 source 변경은 필요하지 않았다.
- 최종 Main f5702b: 아래 명령으로19 PASS/0 FAIL/0 SKIP,499.3232ms,exit0. npm run typecheck 및 git diff --check exit0,최종3지문 일치. 독립 최종 C0/I0는 읽기 검수이며 실행 증거와 구분한다.

정확 시험 명령: node --test tests/unit/FN16/backup-reference-history-inventory.test.ts tests/unit/FN16/backup-reference-history-inventory-schema.test.ts

4종 참조·다른 과거 주체·옛버전 회수, 원명령·승인 결박, DB micro 보존과0053의 명시적 milliseconds 절삭 관계, RLS-aware fixture의 설정 전 비노출·같은 연결의 stale 사용자 재사용, 취소/기한/회수불명503, 후속 승인·최종 RC 이후 DTO 누적한도를 확인했다. 단순 metadata나 합성 성공으로 실제 RLS 강제·원형 접근을 증명했다고 하지 않는다.

## 최종 지문
- source:1619652D908EE3FEA29A43BECFD797CA1C688AF92B0204682A6F60ED4A7BCC1D
- 행동 시험:028A623E23D44E851B92D1B0005BB8F525B1772473FB2E1482333997A4DF1B53
- schema 시험:A7442170C763D189B871A0E71E59FF9A595B7170034227C16BC1EFC1D6998513

## 미검증과 복구
실제 PG/RLS·migration·민감권한·자원/키/파일·서비스·UI·Agent·반출/복원은 NOT_RUN이다. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified는 false다. 공유 B의 실제 권위·RO 동등성 미충족 및 수동 정책158E10BC의 미채택도 유지한다.
Main만 신규3+WI/승인/본결과/WORK_STATUS/WORK_PLAN 정확8경로를 checkpoint한다. rollback은 신규3의 검토된 revert 또는 미연결 유지이며 자료·권한·키는 삭제하지 않는다. 전체 FN16과 WORK_PLAN은 미완료다.
