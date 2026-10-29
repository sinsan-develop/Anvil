# FN16 기능분류 검토·채택·현재 조회 budget 전달 결과 — 2026-10-29

판정: 지정 source 단위 검수 완료. 전체 FN16/백업·복원/실사용 완료 아님.

- 기준: codex/av3-stage-b / 74a8368cc71099384fe9cfb7e06367fc9c688015. WI docs/work_packages/FN16_FEATURE_BASELINE_DECISION_BUDGET_FORWARDING_IMPLEMENTATION_20261029.md SHA256 84D631A53487C0DB79FFBCEAC0D0A17907997110EE14371B6F277EAE98FEC3D0. Main 관리·검수·통합, fn16_primary_recovered 단독 구현, fn16_review_recovered 읽기 검수.
- 수정 이유/전후: 기존 decision/read/current와 추가 검토 근거는 선택 budget을 전달하지 않았다. 이제 동일 객체를 readDraft/read/#currentCheck/#reviewSources/#basis로 전달하여 실제 반복 원문 읽기를 누적한다. 기본 호출과 원 승인/receipt/무결성 검산은 유지한다. diff는 정확 class1+신규시험1이며 새 API/SQL/권한/collector 등록은 없다.
- 최초 RED 0a11a6: 실제 save/review/confirm 정상/default/legacy 2P, 전달·오류 보존 부재5F, exit1/506.936ms. 중간39c408 신규7P 뒤 기한·회수·skip 반례를 추가했다. 기준을 낮추거나 기존 검사를 삭제하지 않았다.
- 최종 Main ed9209: 아래 지정6시험78 PASS/0 FAIL/0skip, exit0, 3002.4468ms. 수행자 f961fd는 같은78P/1886.937ms다. Main ffd850 npm run typecheck 및 git diff --check exit0. 독립 사전/최종 C0/I0·정확2hash 일치이며 독립 검수자는 시험을 재실행하지 않았다.

```text
node --test tests/unit/FN16/feature-baseline-decision-budget-forwarding.test.ts tests/unit/FN16/feature-baseline-draft-history.test.ts tests/unit/FN16/feature-baseline-draft-history-schema.test.ts tests/unit/FN16/baseline-backup-budget-forwarding.test.ts tests/unit/FN16/artifact-backup-budget-read.test.ts tests/unit/FN01/baseline-store.test.ts
npm run typecheck
git diff --check
```

- 신규11: 실제 save→review(추가 evidence)→confirm→read/current/decision, 동일budget 실제20/29bytes; 추가 근거 한도413; metadata 포괄 catch와 추가근거 catch의 자체오류 원객체·await후취소; 동일message 외부오류의 원처리; 잘못된 옵션 DB전 거절; 기본/legacy/빈head; 원UNAVAILABLE/CHANGED의 추가근거 skip; 실제 메모리 owned-handle close불명503 poison; 늦은 originalText decode기한을 검증했다.
- 저장된 contentConfirmed:true는 과거 명시채택 사실만 뜻한다. 현재 근거 미가용 시 이를 숨기거나 인수로 승격하지 않는다. sourceAuthorization/coverage/execution/dispatch false와 legacy ref:null/snapshot:null·현재legacy head503을 유지한다.
- 최종 SHA256: apps/server/modules/projects/project-baselines.ts = 376393618EE4744F55A92564AACD817588025359436AC052FDB3E599CE5DFE3B; tests/unit/FN16/feature-baseline-decision-budget-forwarding.test.ts = 6FC48905F6F80428B1B664B352AF24A1B01DD6DA128E7ED4BA901A1710B9CDAA.
- 미실행/미완료: 실제 FS/PG/SQL/DB/Unix권한·키/서비스·Agent/브라우저·백업/복원/사용자인수. 기존26 collector/helper 알고리즘·기존23 연결 불변, 새review/adoption/head inventory 미구현. OS pending 강제회수/절대기한 미보장·기존 약9PB 극단포화 제한 이력을 보존한다.
- 자원/정리: 합성 메모리만 사용, 외부 자원 생성0. 보호 untracked8 보존. rollback은 이 한정 게시 commit의 정상 revert이며 reset/force/history rewrite/운영반영은 하지 않는다.
- 다음: 같은 실제 인스턴스의 보호 decision/read/current를 이용한 검토·채택·현재head 별도 한정 이력 수집. 기존 private local26 collector를 재작성하거나 익명 DTO를 원권위로 재사용하지 않는다. WORK_PLAN/WORK_STATUS 누적 갱신.