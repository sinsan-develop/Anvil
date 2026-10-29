# FN16 본인 제어요청·합성 인계 역사 profile 결과

- 기준 d97a453673222270acb6e3cafd6b8568066f2950 / codex/av3-stage-b / 2026-10-30
- WI docs/work_packages/FN16_CONTROL_HANDOFF_HISTORY_PROFILE_IMPLEMENTATION_20261030.md
- WI SHA256 248A5895DF698DC451F13F942DD8B90DF07E827EC527D6EE699C28FBD83BC64C
- 판정: 내부 source·메모리 합성 연결 검수 완료. 실제 제어권 전환·실환경·전체 FN16/WORK_PLAN 완료가 아니다.

## 변경·판단 이유

실제 factory 생성 객체의 비공개 기록에 고정 pool/access·원 gate 구성·실 read closure를 보존했다. Root와 같은 자원 참조인지 토큰 전달/연결 전에 확인하며, 함수 모양/가짜 객체/외부 boolean을 권위로 쓰지 않는다. 이는 오구성 차단이고 실제 인증·OWNER proof가 아니다. 기존 공개 forSession/readOwnHistoryInventory의 원형·DTO 의미를 유지하고 Root 전용 경로만 고정 구성을 사용한다.

실제 인증 직후 Root identity4를 대조하며 절대 최소기한을 처음부터 제한한다. factory가 더 짧게 관측한 기한과 raw 누적+projection+최종 DTO의 전체 metadataCharge를 frozen 내부 봉투로 전달한다. 공개 usage.metadataBytes의 기존 DTO 크기 뜻은 유지한다. 신원·기한·권한표식은 공개 DTO/hash에 추가하지 않는다.

기본24/기존26/소스root27은 보존한다. 실제 factory를 명시한 control27 또는 결합28에서만 Root·consumer가 이를 소비한다. Root 최초 인증을 닫은 후 factory gate/history를 old24 전에 완료하며, factory 내부 query를 Root timer/설정으로 중첩하지 않는다. 원5표43열·본인 SQL 선필터·타인 존재/건수0·만료된 역사와 다른 client 정상·원 request/summary/command/payload/receipt/audit 검산을 유지한다.

요청과 합성 summary는 별도 namespace/명시 관계로 보존한다. 다른 generic을 provider로 자동 선언하지 않는다. 합성 fourfalse·세대 전이 원장 NOT_RECORDED·전체 미수집/복원/실행 false를 유지한다. D/B/V·file 의미는 그대로이며 전체 metadataCharge만 Root 전체 예산에서 차감한다. main.ts·공개 route/ProjectBackups·DB/SQL·키/서비스·실Agent는 변경하지 않았다.

## 정확5코드와 최종 지문

| 파일 | SHA256 |
|---|---|
| apps/server/modules/control-handoff/control-handoff-pg.ts | F8B02E2C477D6716655A46DAF618D925A538DF506A69BB26BD6CB20B6F1BCEA2 |
| apps/server/modules/backups/project-inventory-composition.ts | 65B618C9CD5EF63ABE40FED6D15D662FD5E0B65B1AA851CCD419A3D04C0F0472 |
| apps/server/modules/backups/artifact-current-verification.ts | 66E06AB1AF88314CB9886AC9DE6082E107C9031FA7C6D7B9B5537B6B84DA0681 |
| tests/unit/FN16/control-handoff-history-profile.test.ts | 70D1AFEBF17058954AD0D73A316D61AE5C4609865652EBBC87DB959C27CCF1ED |
| tests/unit/FN16/control-handoff-history-profile-schema.test.ts | FBF97EBAD046B92047817243C2F6B360459C553080A18D40C360FF398EC91665 |

Primary writer 해제·Main 같은 코드쓰기0. Main a6688f는 소유 기록/제약 복사·정확 diff 범위와 원 collector B6CA2A0EE35CF04828A5724C3A3A6AC2D25A1D15C3276CD370C0B07B1E463207 불변을 확인했다. 수행자 원 forSession537C9005/PgContext167305CF 본문 문자 동일 증거는 Main·독립 diff 대조와 구분한다. 기존 시험 파일은 수정하지 않았다. 소유 WI/결과/계획/현황4문서만 함께 게시한다.

## 실행 증거와 오류 분리

부재 RED bff073 0P2F. 실제 생산자 반환을 status로 가정한1FAIL은 receipt.outcome 계약으로, gate 생산2회/역사3회 혼동과 nullable 타입은 fixture 정합으로 수정했다. sandbox Git fatal1은 정확 cwd elevated 읽기23b302에서 해소·쓰기0/제품·ACL 문제와 구분했다.

비용 첫 음성 a5db17은 DTO차감 변이14a591에서도 통과하여 자식 한도에 가렸다. Main309fd6와 측정 대조 뒤 ecd2c7에서 독립화했다. 원 Root389388/M36707/n2276·실다음child차감36707, 변이 Root354957/차감2276이다. cap=usage+(M-실차감)-1000은 둘 다388388이며 원은 마지막 Root DTO에서413, DTO만 차감한 변이는 성공해 기대거절 누락 RED→Root65B618C9 정확 원복 GREEN이다. 초기 bbacbe/875d0d 진단을 최종 인과 증거로 승격하지 않는다. Main 출력에도 COST_MEASURED/COST_FINAL_STAGE1·마지막 자료Q13이 보존돼 있다.

Main24be20: 아래 신규19+기존직접7 실제26시험 PASS/0FAIL/0SKIP, 3864.2501ms, exit0. 12ee7d type/diff0·당시5지문 일치. 당시 행동 B7EE22AF…이며 제품3/schema는 최종과 같다.

```text
node --test --test-name-pattern="control handoff history profile |controlHandoffHistoryProfileSchema |own control history actual factory gate|own control history OFF schema checksum|own control history final DTO serialization|feature composition actual context adds two real histories|feature composition default context absent|feature artifact consumer actual26 and repeated|source root history profile true is consumed by real artifact consumer" tests/unit/FN16/control-handoff-history-profile.test.ts tests/unit/FN16/control-handoff-history-profile-schema.test.ts tests/unit/FN16/control-handoff-history-inventory.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/source-root-history-profile.test.ts
```

독립 제품C0/I0 후 WI 필수 phase 검증 공백I1: 초기RC 인증/connect/rollback·release 시험은 RR 자료 pending·최종RC pending을 대체하지 못했다. 신규 행동파일에 실제 생산 뒤 Root client1·factory 초기RC2/RR3/최종RC4를 구분하는 두 반례만 추가했다. 괄호1·생산자 인증2회 포함 계수1·누락 타입1은 fixture 보완이고 제품 수정0이다.

Main ab6bf1: 다음 추가2 PASS/0FAIL/0SKIP, 1023.7916ms, exit0. 실제 RR 본인 SELECT와 마지막RC 실제 인증을 각각 대기시켜503·성공0·자기 target client 회수1·늦은 결과1·이후 query/release0·old24/원문 IO0을 확인했다. 183e0b type/diff0·최종5지문 일치. 같은 읽기에서 행동 앞65491B의 SHA가 이전 B7EE22AF179B7CEA70B08CD2F20FCD58FF90488E98F7768EE9C2FB2FB50E2C66과 정확히 같고 뒤3835B만 추가됐음을 검산했다.

```text
node --test --test-name-pattern="factory RR own SELECT pending|factory finalRC actual authentication pending" tests/unit/FN16/control-handoff-history-profile.test.ts
npm run typecheck
git diff --check
```

앞26과 뒤2는 다른 행동 지문/범위의 Main 실행이다. 단일 최종28 전수PASS로 합산하지 않는다. 독립 scoped 재검수는 I1 해소·최종C0/I0이며 직접 실행하지 않은 Reviewer와 Main 증거를 구분한다. 기존 전체55/201/48/58/67 반복0·기준 완화0이다.

## 미실행·잔여·rollback

실제 PostgreSQL/schema/RLS/trigger·제품 원문 FS·키·서비스·실Agent·main 활성·공개 API·브라우저·전체 백업/복구·사용자인수 NOT_RUN. 실제 메서드+메모리 SQL 상태 검증은 실제 DB/권한/서비스 증명이 아니다. factory의 생성 provenance는 악성 동일 process 반사 방어가 아니며 원 gate/인증을 대체하지 않는다. 제어권 수락/실제 전이·lease/grant·세션 복원·새 세대 전이 원장은 구현/검증하지 않았다.

미채택158E 정책·공유B issuer/ABA 미충족·보호참조A 미연결·P03 R2 재실행 금지와 전체 notCollected는 유지한다. rollback은 정확 내부 delta의 정상 Git revert이며 dirty/untracked·보호8·실자료/계정/키·DB/서비스를 변경하지 않는다. 실제 Stage gate 미충족으로 PR/main 병합·전체 완료를 주장하지 않는다.

자동 안전심사는 위치부터 EOF를 자르는 시험 교체가 뒤 시험까지 없앨 수 있다는 이유로1회 거절했다(실행0). 동일 스크립트를 재시도하지 않았고 정확 oldLine 한 번 치환·나머지 시험 역지문 보존의 안전한 대안으로 수행했다.
