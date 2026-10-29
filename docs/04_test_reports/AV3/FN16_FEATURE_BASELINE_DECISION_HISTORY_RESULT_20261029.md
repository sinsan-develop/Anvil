# FN16 기능분류 검토·채택·head 이력 내부 수집 결과 — 2026-10-29

판정: 지정 source 단위 검수 완료. 전체 FN16/백업·복원/실사용 완료 아님.

- 기준 codex/av3-stage-b f97700a582e884b7cf8b6cf820c55d4f7c3896fc. WI docs/work_packages/FN16_FEATURE_BASELINE_DECISION_HISTORY_IMPLEMENTATION_20261029.md SHA256 EE7E5389828E362970FDC11D7318345DE3BB5D875EAC4E578307ADD1C4ABA002. Main 관리·검수·통합, 기존 Primary 단독 구현, 기존 Reviewer 읽기 검수.
- 전후: review/adoption/head 이력의 수집이 없던 위치에 readDecisionHistoryInventory 내부 sibling만 추가했다. 고정32 adapter에서 원 실제 decision/read/current/#referencedReview를 검산한다. 3표30열·bigint 선text/Date·legacy nullable·MAX 버전·최근201/정렬을 보존한다. 저장 ref만 맞추는 fake 검산이나 새 권위공급자는 없다.
- RC 보호→RO RR metadata→RC 재검산/재인증, 동일세션/CSRF/OWNER·최소기한, 같은 byte budget/unique 사전계수·metadata 누적 제한, FIFO와 원 Promise.all을 연결했다. 모호한 회수는503으로 남긴다. 전체 atomic snapshot·OS 강제회수/절대기한 보장은 아니다.
- 최초 RED3cdede 0P/2F→정상7aa693 2P. 중간 fixture의 승인 SELECT 리뷰 오인/빈 head 오투영과 타입 표기를 정정했으며 제품 기준을 완화하지 않았다.
- 독립 Important2: I1은 원 #review 무결성 오류 뒤 queued 승인 Q19/Q20 실행 RED5e739b→실패관측 즉시 queue-stop/자기pending관측·원오류보존 GREEN. I2는 lock/idle 부재 RED12765a→statement/lock/idle 로컬설정/유한 readback 검증 GREEN이다.
- Main75be94→2231e5: 아래 지정4파일48 PASS/0F/0skip, exit0/20440.5037ms. 이는 class2B1895C6 시점 증거이며 수행자6a4702 48P/25591.4337ms와 구분한다. 원메서드로 만든 합성201review·201adoption 및 legacy7→modern8, nonnull선택승인/source/방법론/추가근거·RR변경·한도·pending불명 등을 검증했다. 실제DB의201자료 시험이 아니다.

```text
node --test tests/unit/FN16/feature-baseline-decision-history.test.ts tests/unit/FN16/feature-baseline-decision-history-schema.test.ts tests/unit/FN16/feature-baseline-decision-budget-forwarding.test.ts tests/unit/FN01/baseline-store.test.ts
```

- 마지막 I2 잔여: 유효 h/d readback의 정상 거절 RED55ee36(1P/1F)→정수환산·기존 안전정수/양수/설정상한 유지. 최종 Main1f9a9c 아래 직접4 PASS/0F/0skip exit0/574.3399ms, 수행자cc3b67 4P/748.6023ms. a50d9f type/diff0·최종3지문일치, 독립 scoped 재검수 C0/I0. 최종 전체 조합/201검사는 재실행하지 않았으며48+4를 하나의52 PASS라고 합산하지 않는다.

```text
node --test --test-name-pattern="timeout|local lock" tests/unit/FN16/feature-baseline-decision-history.test.ts
npm run typecheck
git diff --check
```

- Main2a0d43은 새122행을 제거한 나머지가 원class37639361과 전체바이트 동일함을 확인했다. 마지막h/d 변경도 이 sibling 내부뿐이며 기존26 collector/helper/원메서드 변경0이다. 이미 검수된58전체를 반복하지 않고 직접20회귀와 변경timeout4에 검증을 한정했다.
- 최종 SHA256: apps/server/modules/projects/project-baselines.ts = 43BABDFB171A3990C03D15DA3F5854B3B46372951C36D2B187205165FB1ABB0C; tests/unit/FN16/feature-baseline-decision-history.test.ts = 8C6D8E3BA2D39EF2CD8C44396C03458C9840C384AC98610676356C12AF5D92FD; tests/unit/FN16/feature-baseline-decision-history-schema.test.ts = 6199482C504F5081793E58DAFB3E6A55C03F9E40DC918BE14C81427A952AE1D4.
- 과거 채택 contentConfirmed와 현재 currentCheck를 구분한다. legacy 원문은 노출/검증완료로 승격하지 않고, 미선택review의 현재bytes는 미검증이다. actor/client/session/credential·이유/body 원문 대신 필요한 opaque ref/지문만 반환한다. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed와 atomicSnapshotVerified=false를 유지한다.
- 미실행/미완료: 실제 PG 구문/DB/RLS·원문 파일 I/O/Unix권한·키/서비스/Agent/브라우저·전체백업/복원·사용자 인수, 기존23 연결. 합성 프로세스는 종료·신규 외부자원0·보호untracked8 보존. WORK_PLAN/WORK_STATUS 누적 기록.
- rollback은 이 한정 게시commit의 정상 revert다. reset/force/history rewrite/운영반영0. 다음은 실제 소유 인스턴스/인증 경계를 유지한 내부 조합 연결이며 guarded proxy로 새 instanceof를 우회하거나 FN15 실제factory 부재를 성공으로 감추지 않는다.