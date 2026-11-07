# FN17 승인 요청 알림 조회·표준 읽음 — 서버 source 한정 결과

2026-10-27 / Main 어울 / 구현 fn17_notification_read_source / 독립 fn17_read_source_review.

## 판정

서버 source 한정 구현·집중 검수 인수. 실제 알림 생성/DB 적용/화면 사용·전체 FN17/Stage/작업계획 완료가 아니다. WI6323849260870EA5FAC48DE22A20E3E5FA5830F2C7DB64F30CDFD018B5675150, 기준 codex/av3-stage-b/672af50cea3eb6c4de32fc9f959bb9bfd6b67f97.

기존 명시 GET notifications/고정조회·markNotificationRead를 실제 인증/회원·현재 제어/정책·영수증/감사에 연결했다. 기존 개인 조회와 표준 제어 변경을 분리하고, 원승인 v1/hash/서버 command ID·불변 읽음 최초시각·서명 cursor·동일 명령 replay를 대조한다. readAt은 불변 ref hash에서 제외한다. notification FOR UPDATE/새UPDATE권한0이다.

## 변경·실패 이력

source4/시험·fixture4 정확8경로는 FN17_APPROVAL_NOTIFICATION_READ_SOURCE_MANIFEST.json에 raw 지문으로 고정했다. Main a48295가 담당자 제출8hash와 실제 파일을 대조했다. 기존 requestApproval producer/응답·publisher·원자rollback·10000행상한은 미채택 그대로이며 수정0. SQL 작성/적용·계정/정책/Secret/서비스/Agent/native 실행0, production fake0이다. 미적용 저장소/권한 부족은503이며 실제 빈목록으로 숨기지 않는다.

- 입력/service 부재7·실제 route404≠200 RED 후 parser/service/fakeDB 부작용/Fastify inject 반례로 보완했다. 단순 존재검사를 기능증거로 올리지 않는다.
- replay 최종 만료의 Missing expected rejection, 정규 hash를 재계산한 비정형 원승인·읽음 receipt digest 손상의 Missing expected rejection을 확인 후 보정했다.
- COMMIT 뒤 성공/replay×세션/정책 만료는 FN17 한정503 NOTIFICATION_READ_RESULT_UNCERTAIN이다. 이미 저장된 receipt를 보존하고 동일 commandId 재인증/조정 대상으로 남긴다. COMMIT 전 만료는 기존오류/rollback이고 다른 operation은 불변이다.
- 복수 AUTO 중 빠른 한 개의 만료가 다른 유효 AUTO까지 회수하던 문제를 Main 검수질문으로 실제403 RED 재현했다. 같은 actor/operation/PROJECT/DB현재시각 필터·DENY우선/REQUIRE_APPROVAL412·남은 AUTO 최대기한으로 보정했다.
- 최초 sandbox Git status/추정파일 읽기/편집anchor/EOF 오류 각1은 실제경로·허용 escalation·기존내용 정합·EOF 보정으로 해소했다. 같은 원인3회 반복은 없다. Main의 도구 설명/지시 중 다른언어 혼입은 한국어로 정정했고 제품범위 추가/실행0이다.

## 검증

담당자 최종 명령:

`node --test tests/unit/FN17/*.test.ts tests/unit/FN11/approval-input.test.ts tests/unit/FN11/approval-list.test.ts tests/unit/UI08/approval-api.test.ts tests/unit/FN01/project-list.test.ts tests/unit/UI11/material-policy.test.ts`

exit0,40PASS/FAIL·SKIP0,1378.2731ms. 신규16+기존FN17 3+인접21이다. npm run typecheck/diffcheck exit0. 이전 후보39PASS는 그 시점의 범위이며 새 복수AUTO 반례를 포함한 최종40과 구분한다.

Main529c4c는 새3시험 파일만 실제 재실행하여16PASS/FAIL·SKIP0·942.4431ms/exit0을 확인했다. 실제 parser/service·메모리 DB와 Fastify app.inject이며 HTTP listener/실PG/served browser가 아니다. 기존 전수/불변 타입검사를 반복하지 않았다.

독립 spec+quality C0/I0/M0. 현재 권한 보장은 transaction 동안 기존 session/user/client·project/member/control 및 policy 잠금을 소비하는 범위다. COMMIT 이후 모든 동시 회수를 다시 조회한다는 판정이 아니다. source/test와 실제 기존 receipt SQL column 정합을 읽었고 실제 SQL/권한/경쟁 실행은 하지 않았다.

## 남은 구현·확인과 복귀

화면 소비·알림 생성/저장소 실제 적용·나머지 사건/설정/채널·전체 FN17은 미완료다. 실제 DB/미래 DDL guard·권한·동시 transaction·served browser/사용자 인수는 NOT_RUN이다. 이번 업무의 신규 설치/HTTP listener/파일 QA·PG 자원은0이다.

되돌리기는 이 소유 source checkpoint의 일반 revert이며 기존 DB/SQL/권한 삭제0이다. 다음은 같은 기존계획의 본인 목록/고정조회·명시 읽음 화면 소비를 단일 writer로 이어가며 미채택 publisher/새상한·실제서비스경계를 열지 않는다.