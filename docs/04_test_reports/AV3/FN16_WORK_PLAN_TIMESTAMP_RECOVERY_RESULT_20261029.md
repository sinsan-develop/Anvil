# FN16 작업계획 이력 시각 정합 보완 검수

2026-10-29 / codex/av3-stage-b / 부모4fb6e7268a15b191c049fae9744ed0624153d0d4.
범위: 기존 FN16 수집기 정상 이력 오거절 교정. 실제키/DB/서비스0·전체FN16미완료.
WI FN16_WORK_PLAN_TIMESTAMP_RECOVERY_20261029.md SHA F29EF7C991862BA3C19EFB782616341A1F1287C0205C7D44C242A297AEAE9423.

## 문제와 최소 diff
Main2d5d1b/aafbe2와 독립검토에서서로다른transaction의기록시각이반드시증가한다는가정8개가기존writer/schema에없음을확인했다. transaction_timestamp/now는transaction시작시각이므로버전/검토/확정순서와역전가능하다. 앞선source077E 검수에서놓친Important로정정한다.
변경 전 정상시각역전→503. 변경 후 원시각을보존하고서로다른거래시각대소만으로거절하지않는다. 변경은source6행의8대소비교제거뿐이다. 각행/JSON/receipt시각일치·첫head/v1동일시각·형식·버전연속·원hash·정확검토/ref/명령·확정pointer·audit순번검사는그대로다. 기존writer/schema/권한변경0,기대값완화0.
수정파일: apps/server/modules/backups/work-plan-inventory.ts, tests/unit/FN16/work-plan-inventory.test.ts. 기존schema시험변경0.

## 실제 검증
TEST_ONLY D18823E6… 기존15시험/prefix보존,정상역전8+동일사건불일치음성1(4모드)추가.
Main88cabe: node --test --test-reporter=tap --test-name-pattern=workPlanTimestampRecovery tests/unit/FN16/work-plan-inventory.test.ts → 9중1PASS/정상8FAIL/skip0/439.21ms exit1. confirmationVersion은앞선같은원인비교에서RED이며후단독립RED라고주장하지않는다.
Author0eb2b3:24PASS/1302.5001ms·type/diff e4c4090.
Main0350cd: node --test --test-reporter=tap tests/unit/FN16/work-plan-inventory.test.ts tests/unit/FN16/work-plan-inventory-schema.test.ts →24PASS/0FAIL/skip0/1553.0863ms exit0. npm run typecheck/git diff --check0. 정확source diff를직접읽었다.
- 최종source EE930589A0562494B1367EDC7C77DEDD0F0A82CC2866886D7C3F1C78CF961823
- 행동 D18823E6F0C5215C02DD32CB35F015ECAB91B0834D712632EE85AD1A72983129
- 불변schema 2E8AC46B79F25715DFC74C11089F92E556FEE995069968C1B14A57A138A8AE6E
독립 WI/TEST_ONLY C0/I0/M0, 최종 제품delta 판정은 WORK_STATUS에 기록한다.

## 한계·복구
실제DB/SQL/RLS/키/FS/서비스/P03/전체백업/복원/UI NOT_RUN. 합성검수는실제시계역전·DB경합실측이아니며기존저장계약호환성증거다. 기존원본/SQL/기대15/다른collector보존,보호미추적8유지. 데이터변경없음,필요시본교정정상revert가능하지만원오거절이재현된다. 다음활성기준이력WI만준비됐으며전체계획완료아니다.
