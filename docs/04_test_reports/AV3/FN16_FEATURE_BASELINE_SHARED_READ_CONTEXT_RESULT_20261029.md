# FN16 기준선 이력 공유 읽기 제약 결과 — 2026-10-29

판정: 한정 source 선행 검수 완료. Root 조합 연결·실제 백업/복원·전체 FN16/WORK_PLAN 완료 아님.

- 기준 codex/av3-stage-b 4027ed88ddbe70e600f6e110583bc1e922ea8306. WI docs/work_packages/FN16_FEATURE_BASELINE_SHARED_READ_CONTEXT_IMPLEMENTATION_20261029.md r2 SHA256 795825009C518560732F75D747DC42BEB267A292DC61CE70204A1BEDB3C6EDA5(부모CD20F087). Main 관리·검수·통합, 기존 Primary 단독 구현, 기존 Reviewer 읽기 검수.
- 전후: class2는 각각 private budget을 만들던 기본 경로를 보존하고 선택 {expectedIdentity,budget}로 직렬 공유할 수 있게 했다. 실제 AccessRepository/CSRF/OWNER·원 source/docs/명령/선택승인 검산 후 실제 신원을 비교하는 추가 제약이지 새 인증/권한 proof가 아니다. 원신원/기한 원값은 DTO/hash에 반출하지 않는다.
- helper는 genuine WeakMap/same AbortSignal·현재remaining≤local추가cap·기존 cleanupUnknown/기한/취소/busy를 읽기전용으로 검사한다. counter/cap/시작점은 변경하지 않는다. frozen 유한 monotonic resource기한만 반환하며 상태객체/권한은 노출하지 않는다. 다른signal/과대cap/형식은DB전400,음수소진은413이다.
- 초기 REDb5ac8f 0P2F→초기24P(e50005)는 중간동결 증거다. Main a2002c/독립 Important1과 a5ef6d late-empty RED에서,앞 실제TTL20ms가 뒤auth/request100000ms보다 짧은데 마지막DTO21ms 성공을 확인해 최종합격을 보류했다. 준비오류15f28f는fixture maxTimeout20000과100000 입력 불일치로 분리했다.
- r2는 진입 genuine기한을 local에 고정하고 remaining=min(요청/auth/shared)의 순수 산술로 유지한다. 일반 metadata/최종직렬화/return check는shared만료·poison도 검사한다. 이미 시작한 db.query의 handler 부착 전 remaining에서 helper가 throw하는 구현은 하지 않았다. 실제phase의더짧은auth는local min과기존tighten을동시에제한한다.
- a5ef6d late-empty,9ae1ee SQL/pendingtimer,5f4b5b shared DRAFT lock/idle/readback 부재의 RED→GREEN을 보존한다. DRAFT default는기존statement-only,shared context일때만3종유한설정/readback이다. DECISION 기존3종 설정은불변이다. 실제서버설정/DB를 바꾼 것이 아니다.
- Main0036af 아래선택5시험29P/0F/0skip exit0/1465.0921ms. 수행자3d3c84는29P/1042.8741ms. c1d8e1 type/diff0·4hash일치,독립최종C0/I0. 독립검수자는시험을재실행하지않았다. 미선택항목개수를추정/합산하지않고201/48/58/67전수검사를반복하지않았다.

```text
node --test --test-name-pattern="binding|shared context|backup budget requires explicit|backup cleanupUnknown|backup concurrent|forward real save/read|forward invalid optional|decision forwarding default|decision forwarding legacy" tests/unit/FN16/artifact-backup-budget-binding.test.ts tests/unit/FN16/feature-baseline-shared-read-context.test.ts tests/unit/FN16/artifact-backup-budget-read.test.ts tests/unit/FN16/baseline-backup-budget-forwarding.test.ts tests/unit/FN16/feature-baseline-decision-budget-forwarding.test.ts
npm run typecheck
git diff --check
```

- 증거범위: malformed/accessor/extra/genuine불일치DB前거절·실auth후4필드불일치자료query0/401·초기신원복사고정,2bytes 선소비→초안delta18→검토채택delta126→global146의직렬관측증분·cap100 누적거절/reset0·최종재인증실패시소비보존,cleanup503/busy/취소·과대cap·기한단축을검수했다. delta는직렬호출관측구간값이며 동시소비개별귀속을주장하지않는다.
- pending 양메서드 반례는 genuine20ms 이하 요청timer/SQL설정·합성scheduler+5ms·늦은결과관측/정확release1을확인한다. 실제driver/OS 강제회수·절대기한 보장은 아니다. 알려진초과/회수불명은성공으로바꾸지않는다.
- Main a4b695: 새binding접점2행제거시helper원본문F4C25D6B와전체바이트동일,원보호메서드/import추가외prefix·26/32 registry불변을확인했다. 의미가달라지는것은명시shared context경로의추가제약뿐이다.
- 최종SHA256: helper96497534950CC55D10650A3E695581C551D0EDA31A8D77B11666A51FDB72B0EA; class2792F681EFAE4EFFEA1D6D316243E155119653F7981CE224726FC8B4EE8992DC; context시험0B9FFBEC28ADA100D69B8F371F1C8668ED3B79E0462465C873F67FF827773627; binding시험7E5B23EA58B9E693D41B5F40C1BA35E2D5A5611F48076E642782533A72B2C6FB.
- 미완료/미검증: 기존24 Root는이번에연결하지않았다. 보호참조A/FN15실factory/공개route/API/미채택정책·실제PG/SQL/DB/제품원문파일I/O·키서비스/Agent/브라우저·백업복원/사용자인수는제외또는미완료다. 관측/전체성/복원/권한복원false·미수집umbrella를유지한다.
- 합성프로세스종료/신규외부자원0·보호untracked8보존·WORK_PLAN/WORK_STATUS누적기록. rollback은한정게시commit정상revert,reset/force/main직접쓰기/운영반영0. 다음은실소유Root 선택context와선언bytes/반복read비용·보수적파일수의명시구분이다.