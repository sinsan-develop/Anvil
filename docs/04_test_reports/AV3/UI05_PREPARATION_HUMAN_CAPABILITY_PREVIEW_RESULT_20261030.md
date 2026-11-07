# UI05 준비 원문 → 사람 능력보고 고정 조회 검수 — 2026-10-30

## 판정·구현
승인된 UI05 근거 원문 접근의 **기존 보호 GET 소비 소스 단위**를 검수했다. 제품·최종 DOM 독립 C0/I0이며 미해결 Critical/Important는 없다. 전체 UI05/FN09·Stage/WORK_PLAN 완료가 아니다.

- WI `docs/work_packages/UI05_PREPARATION_HUMAN_CAPABILITY_PREVIEW_IMPLEMENTATION_20261030.md` SHA256 `BE07FD2BBD1DB5D2F0928F59FAE77228EF888840985137378A77CC1CE9AD115A`.
- 선행 FN06 승인 r2와 checkpoint `f5fdaa90f3fe909c717f548cebfa707348a02489`의 고정 HUMAN보고 GET를 그대로 소비한다. SCREEN_WORK UI05의 버전·환경·도구와 근거 원문 접근을 연결하며 새 공개 API/저장/권한/DB 계약은 없다.
- 시작 branch `codex/av3-stage-b`, HEAD `f5fdaa90f3fe909c717f548cebfa707348a02489`, Main WORK_STATUS dirty/보호 untracked8 보존. 기존 Primary만 code writer였고 제출 뒤 해제했다. Main은 관리·검수·문서·통합을 담당했다.

이전에는 검산된 준비 snapshot을 JSON으로만 표시하고 intent.capabilityRef 원보고 접근선이 없었다. 이제 **검산 완료 준비 원문 → 사람 능력보고 확인 → exact ref/hash 및 연결/환경 fullref 대조 → 원주장/서버 UNVERIFIED·현재성 조회**가 이어진다. 보고만 닫거나 실패해도 준비 선택·원문·이력 위치는 보존한다.

과거 capabilityRef가 HUMAN namespace라는 보장은 없다. 404는 해당 참조의 사람보고 미확인, 버전1 외는 GET0·미지원으로 남긴다. 조회 성공도 실측·현재 권한·실행 준비 완료가 아니다. 기존 C1·7부족조건/NOT_AUTHORIZED·실행/dispatch false·UI04 준비 작성 차단은 유지한다.

## 정확 변경·지문
|경로|최종 SHA256|
|---|---|
|apps/web/src/features/session-detail/PreparationHistory.tsx|DE479DFE31884986B2C774EBF55CBB52A7E9B782EE7CF6B60CCBA3B93991BFEA|
|tests/browser/UI05/preparation-history-dom.test.ts|0EA901B896BAF30E5FF6C41AF50B35B87BD0FBF9FFE531D0F875BE5B73A2C5F2|
|tests/browser/UI05/preparation-history-dom-harness.tsx|C7F230F5B5840764852C3158B54531653FB2C65D007FF781EC70AF057F6FCCD9|

Main17438e에서 위3·기존 helper2·보호8 총13hash 불일치0을 확인했다. preparation-history-api.ts/capability-report-api.ts·상위 SessionDetailPage·서버·SQL·정책은 변경하지 않았다. 새조회는 원문 객체/owner/별도 sequence에 결박하며 초기 추가보고GET0/POST0이다.

## 실제 검증
수행자 실제 버튼부재 RED171df8(버튼1500ms 내 미존재·해당 자식과 부모 FAIL)→정상 GREEN6f30a8. 신규4조건, 다른 reportedBy 정상1 재검사, 기존 직접6은 각각 선택 실행했으며 합산 전수 실행이라고 하지 않았다. 추가 오류·경로 실패·동일유효실패3회는 없다.

Main 독립 실행은 다음과 같다. 모두 exit0/0 SKIP이며 기존 기능 전체 회귀가 아니다.

|증거|정확 명령·범위|실제 결과|
|---|---|---|
|4095f1|`node --test tests/unit/UI05/preparation-history-api.test.ts`|직접 helper4 PASS, 238.2591ms|
|9f0943→bfa83a→4a6a27|`ANVIL_UI05_PREPARATION_HISTORY_DOM_QA=1 node --test tests/browser/UI05/preparation-history-dom.test.ts`, CASE 미설정|최종 **신규4+직접기존6=10자식, 부모 포함 Node11 PASS**, 18620.7703ms|
|293edc→b9bd8c|`npm run build`(내부 typecheck), `git diff --check`|type/build/diff0, 479modules/794ms, 기존 큰chunk 경고 보존|

DOM은 실제 PreparationHistory와 메모리 ApiClient/Response 대역을 사용한다. 두 기존 reader의 실제 hash 검산·native crypto를 소비한다. 다른 reportedBy의 정상 보고, 자체hash 정합 wrong-pair 거절, 버전2 GET0/404 namespace 미확인, 401/403/503/hash 오류·명시 재시도·원준비 보존을 확인했다. 선택·페이지·닫기·project/full assignment/clientId/실 client 객체·같은 인스턴스 ABA와 지연 JSON/실제 digest 뒤 이전 본문 폐기를 검사했다. 기존45행/20개 paging·21번째 원문/이전/재시도/선택 복구 기준도 유지했다.

최종 번들 SHA256 `e397b12ddfa64a25fee45116b4ff4e9e192900bab7eb818169b3a93c2af7de32`. 독립 검수는 소스/시험 내용 검토이며 Main 실행과 분리한다. 확인된 미진은 없다.

## QA·미검증·복구
전용 새빈 QA `D:/tmp/anvil-v3-stage-b/ui05-preparation-capability-20261030-01`은 Main 직전 부재/전용 Edge0이었다. 2026-10-30T11:37:11.001Z 생성 후 약19초 내 확정 회수, 환경복구true/QA_REMOVED true. Main b9699e 별도 조회에서 경로false/전용Edge0을 확인했다. 확인된 소유경로만 정리했고 불명 강제kill/삭제는 하지 않았다.

**NOT_RUN:** 실제 HTTP API·인증/DB·제품 원문 FS IO·상위 전체 SessionDetailPage/App 통합·served 배포·사용자 인수·실제 Agent/키/서비스. 실제 화면 현재 서비스에 반영됐다고 주장하지 않는다. FN06 HUMAN보고의 실제 저장·전체FN06/전체계획 완료로 승격하지 않는다.

복구는 정확3 source checkpoint의 정상 revert이며 실제 자료·계정·키·DB/서비스 변경/삭제는 없다. 다음은 한정7경로(소스3+WI/결과/WORK_PLAN/WORK_STATUS4) checkpoint/private 게시와 다음 미완료 사용자 흐름의 실제 공급자 확인이다. 필수 실제 Stage gate 미달이므로 PR/main병합0이다.