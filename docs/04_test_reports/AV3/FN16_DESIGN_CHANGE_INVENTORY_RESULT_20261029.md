# FN16 설계변경·영향검토 이력 수집 검수

2026-10-29 / codex/av3-stage-b / 부모987b3ff374de1bda2ef6dc2a6087a53ddac97753.
판정: 내부 source·합성 부분 검수 완료. 실제 DB/백업·복원/사용자 화면·전체 FN16 미완료.
WI DADAD1E647EF472D77C7CE6493B3BCB153B7F9F14775796188B8C22E9EA4BD2B.

## 구현
신규 design-change-inventory.ts는 요청13열/영향14열과 해당명령증빙을수집한다. v1은요청과명령공유·서로다른ref, v2+는동일impact ID/직전hash/연속버전으로연결한다. 원hash를검사한후사람식별자를익명투영하고원gap·UNKNOWN·후속검토와외부ID-only proposal을보존한다. 현재원문조회·영향재계산·활성기준적용0.
- 제품 F73137CC363D03DCE88523A41BA8CB40FD664E39FC17A202459511948489EDDC
- 행동 C99ED63338C17186F77231BC927CA3321F14E5924689CE1BCDA4CBF73DA40C94
- schema 66113D715F00ECF3935476B630060A44D26E8BE4F6C30F7337E96C5338BB4831

## 검증·오류
Main2c6c6a node --test --test-reporter=tap tests/unit/FN16/design-change-inventory.test.ts tests/unit/FN16/design-change-inventory-schema.test.ts: 13중1PASS/미구현12FAIL/skip0/243.3472ms exit1.
Author3fb43e 최초13PASS/843.3467ms·type60fdab/diff0ef85d0. 최초fixture추론6타입오류는행타입2곳명시보완·기대불변. sandbox읽기diff501b30 exit128은동일elevated읽기0과구별.
Main cfe066 및 독립검토 C0/I1: 버전간transaction_timestamp단조강제는기존writer/schema에없어정상과거역전을거절한다. 반례b50bad0PASS/1FAIL/300.6937ms503후2개대소조건103자만제거했다. 각행·JSON·receipt시각일치/initial동일시각/원hash·버전·parent검사는보존했다.
Author04c763 보완14PASS881.4056ms/type1544e7/diff0. Main1972d3 같은명령 신규14PASS/0FAIL/skip0/871.9276ms exit0, npm run typecheck/git diff --check0. 기존13기대불변·반례1추가. 최종독립판정은WORK_STATUS에기록한다.

## 한계·다음
실제PG/RLS/SQL·원문FS·키·서비스·P03/Agent0. 원문존재/현재성/실행안전·전체암호화archive/복원/화면인수NOT_RUN. fullProjectCoverage/restorable=false. 새로운schema/지속자료변경0이므로데이터복구대상없음,신규3파일후속정상revert가능. 보호미추적8보존.
직접인접work-plan-inventory의같은시각가정8개는Main2d5d1b/독립검수로별도I1확인했다. 이번패치에섞지않고별도2파일WI로반례→보완한다. 이후활성기준이력은준비된WI검수뒤진행한다. 전체FN16완료로표시하지않는다.
