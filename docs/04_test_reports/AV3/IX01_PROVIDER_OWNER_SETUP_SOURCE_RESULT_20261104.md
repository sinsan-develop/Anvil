# IX01 provider owner 설치 선행 source 보완 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·범위

단일 Primary의 driver/controller 시험2 보완을 Main이 독립 검수했다. source 범위 C0/I0/M0이며 실제 PG 정의 설치·권한·원자성·RLS/API/UI·전체 IX01 합격은 아니다. 원 R4의0037/42501/FAILED와 원 R3 UNKNOWN은 보존한다.

- 기준 부모 f71313d01d1d79d1a404a044a3677db145bba0f5, branch codex/av3-stage-b.
- WI docs/work_packages/IX01_PROVIDER_OWNER_SETUP_SOURCE_WI_20261104.md SHA450C9130F6E23E79945ABD0FA4777F60AD9119CC44AE374F2AEBD5B6C2E09DB9.
- 후보4E027E7A의 기승인0037 설치계약 내부 구현이며 새 공개 API·제품 SQL·사용자 권한 정책 변경0.
- 허용 파일은 scripts/qa-ix01-schema-closure.sh와 tests/unit/IX01/schema-closure-controller.test.ts뿐이다.

## 변경 전·후와 보존

이전 bootstrap은 migrator/app만 준비했고0037의 별도 owner·ADMIN membership·단일 migration Tx 선행이 없었다. 이후 정확0037 선택에만 NOLOGIN/NOINHERIT·비특권 provider owner와 migrator 임시 ADMIN membership을 준비한다. controller→실제 bootstrap/sql 콜백→psql/run에 selection·path·고정 raw hash·원 stdin·single-transaction을 연결했다.

metadata는 PRISTINE의 기존 역할 집합을 유지하고 선택/단계/attempted/completed에 맞는 고정 owner·속성·grantor·회원만 허용한다.0037 전/내/후 명확 실패의 남은 membership 회수와 이미 회수된 부재를 구분한다. UNKNOWN 뒤 추가 query·mutation·stop/rm·재시도0이다.

원0037의 ACL/소유 preflight·postflight는 그대로이고 실제 PG에서 검증한 것으로 보지 않는다. SQL/index106/선택105·원 기한·정제환경·최종PID1·결과 shape와 제품 소스는 불변이다. 고정 provider 원문을 위조 index/bytes와 함께 바꿔도 claim/owner 준비 전에 거절한다.

| source | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|23FF80EFEC96E24AA770983C2226E4F8C751C2BB7186A2BAD7697CB10ED728F0|
|tests/unit/IX01/schema-closure-controller.test.ts|49076|FBCC6C5E2D36D955822B33D583360F88AAE4815ED10065A2992CBFA99AEBB7DC|

## 검증 증거

- Primary7687e9 신규 생산/공유 경계3RED →6a7e17 GREEN3.
- 고정0037 hash 위조의 claim 전 차단 b8c115 RED1→b88078 GREEN1.
- Primary ba8bea: node --test tests/unit/IX01/schema-closure-controller.test.ts, 기존46+신규10=56PASS/skip0/1056.8243ms/exit0.
- Primary e4985a: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json, exit0.
- Primary0e325d: Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh, exit0.
- Primary28ec28: 허용2파일 git diff --check, exit0.
- Main5de96f: node --experimental-strip-types --test tests/unit/IX01/schema-closure-controller.test.ts,56PASS/skip0/1094.703ms/exit0.
- Main2fee27: 최종 source hash/bytes, 기존46 test 이름 보존+신규10, db/migrations/apps/contracts diff0, default bootstrap/관측SQL 불변과 실제 조립 hash 검산0.
- Main61f5e6/a35d7a: 실제 공유 콜백·role phase·회수/UNKNOWN diff 읽기, scoped C0/I0/M0. fake 최하단 exec를 실제 PG 성공으로 확대하지 않음.

선택 bootstrap SQL hash256BDF9021C9E5350F0364D0C02263F3D367561180FE92421C2FAF7150CCEF94, provider 잔여 회원 회수 SQL hashA6BFD8FA4145906C02F4D92423E397E6A5043657DB65A9DA02E5CBFC4C80938D, 관측SQL23237B193E7C863D1D2B0E1C30EB29D9C5D62FC4D93129B97E525AFF499812E1이다. provider 미선택 default bootstrap56655E52는 원문 동일하다.

## 오류·미검증·다음

시험 조립1363da1건은 JS replace 특수 치환 토큰이 기존 tail을 끼워넣은 준비 오류이며 단일 정의 복원으로 보정했다. 의도 RED와 분리하고 기존 단언·기준은 보존했다. 정식 반복 보완 실패0·Main 코드쓰기0·writer 반환/live0.

실제 DB·role/GRANT·키·권한 적용·WSL/Docker·서비스·Agent·실자료·P03 R3 실행0. 실제 PG 원자성·ACL/RLS·역할 준비/회수와 새 QA는 NOT_RUN이다. R4 QA는5b5593에서 실행자원잔여0/감사보존이며 이번 source 검증은 새 QA를 만들지 않았다.

다음은 이 source 검수본에서 새 namespace와 실행 코드·role SQL/Tx·원 선택·기한·UNKNOWN/정리 범위를 동결한다. 실제 실행은 새 직접승인 전 금지하며 소진 R4 승인/경로/slot을 재사용하지 않는다. rollback은 이번 두 source 경로만 부모 f71313d0와 대조하는 정상 후속 commit으로 처리하고 history rewrite/전체 reset은 하지 않는다. 전체 작업계획은 미완료다.
