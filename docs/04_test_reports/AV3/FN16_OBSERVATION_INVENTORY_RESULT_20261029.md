# FN16 worker 관측·전체 ACK·고정 결과 이력 수집 결과

2026-10-29 / codex/av3-stage-b / source·합성 검수

WI FN16_OBSERVATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md SHA95B239201364191F947CF9CC6E0508BDF5CCD6F066324993A050E7BA0EAEF003. 시작HEAD4122b21eadf53dec9d9e8f484593bc4384eaebbb. 기존fn16_primary 단독구현·Main관리/검증/통합·fn16_review읽기독립검수. 보호8 보존.

관측/모든ACK버전/고정result 전체와선택receipt/grant/명령을명시열·200keyset·동일RR로수집한다. 과거ACK는원hash/버전/개수·시각국소관계만,최종ACK만전체event요약과대조한다. result가고정한원ACK를latest로바꾸지않는다. HUMAN명령없는worker자료에가짜명령/auth/audit를요구하지않는다.

## 변경·검증

- apps/server/modules/backups/observation-inventory.ts: AFDC7BB7724FB002CBEE250D40F9699C385E05AB5201CE38E3A5388DED77AA4F
- tests/unit/FN16/observation-inventory.test.ts: 6095CE4970D3EFBBE3A94D070FA39AA963B354266E92CE9761B79FAFCE59489A
- tests/unit/FN16/observation-inventory-schema.test.ts: 56EDACDD4B61A4BEA3D75DADB0F2345CA87945A198C91AC5581098575FCC6034

Primary2b897e 첫13FAIL중schema경로오기0017→0018교정,6635db schema1PASS/미구현12FAIL RED를구분했다. c3a99713PASS/990.7227ms. 타입bb4c60 group빈배열never추론1원인은Row[]명시만보완하여56e06e type0. 기존제품/SQL/시험기대변경0.

**Main036b23** `node --test --test-reporter=tap tests/unit/FN16/observation-inventory.test.ts tests/unit/FN16/observation-inventory-schema.test.ts` → **13PASS/0FAIL/0SKIP/963.9141ms exit0**. `npm run typecheck` exit0·3지문일치. Main43156a/8197ee/86df1c 실제계약·fa5d6d시험/f6a704source읽기대조. 독립사전/시험C0/I0/M0,ACK/ref재봉인과201events정합확인.

SECRET 반례는proofHash에nonhex표식을넣어형식거절과민감탐지효과를분리하지못한다. 독립민감정보탐지PASS로주장하지않는다. 최초미구현RED는후단각반례를개별재현한증거가아니다.

## 미검증·후속

실제DB/RLS·서명·키·서비스·원문FS·Agent/backupruntime변경0/NOT_RUN. credential/challenge원문조회0. proofSignature/challengeTarget/historicalAckEventSet/command전체증빙/currentAuthority는NOT_PERFORMED. 허가복원/실행/전달/writer해제/자격발급/전체coverage/restorable=false. 관측주장은PROVIDER_CLAIM_ONLY로보존한다.

이해검토/START·SEND permit/다른receipt·credential/challenge전체역사는후속미수집. 전체FN16·계획·실제백업복원완료가아니다. rollback은신규3파일만후속정상commit으로되돌리는source범위이며지속데이터는변경하지않는다. 결과/WI/계획/현황포함정확7경로만통합하고보호8은제외한다.

## 최종 M1 보완·동결
독립M1:ACK map의id/version만으로다른scope동일ID가덮이는정상오거절. 두scope동일ACK반례285eae1RED503→set/get키2곳에scope추가. 최종source C033F75381C8C4BC8ECDBD9F70DB121C6E74D49A314AC5F72CF539DC047082F7 /행동 C9C1DF8B1E03D4CF1CAADE37F428FDC80AC37F315863C03BCB2D4FC246E6C5E3/schema56EDACDD불변. 앞표는초기검수이력이다. Main0ae497 최종14PASS/0FAIL/0SKIP/1009.8942ms·type0·지문일치,독립scopedC0/I0/M0·M1해결. 메모리두변경제거SHA가이전AFDC7BB7과일치,실제자원변경0.
