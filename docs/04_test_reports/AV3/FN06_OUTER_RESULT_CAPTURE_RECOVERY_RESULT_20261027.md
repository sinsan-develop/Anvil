# FN06 외부 결과 수집 유실 보완 검수 — 2026-10-27

## 판정
소스 보완 범위 scoped C0/I0/M0. 실제 compiler·PS 실행 결과 복구나 전체 FN06 완료가 아니다. 원02 OUTER_RESULT_UNKNOWN/단발소진은 보존한다. 이미 소거된 원 stderr/stdout은 복구하지 못했고 이번 실패의 실제 원인도 미확정이다.
기준3654715d813682dcb87393dde207f41a05b06c59, branch codex/av3-stage-b. 단일 담당 fn06_diagnostic_capture/Main 관리·검수·통합. Main 제품 코드 수정0.
WI FN06_OUTER_RESULT_CAPTURE_RECOVERY_WI_20261027.md 최초5C9B5FEA→현재305E9FAA28B606618D08B54CD473011DD166FB88491E2CB644265A8DA64185E4. 변경 이유는 실제PS0와기존12전체반복문구충돌을명확히해불변PS3 NOT_RERUN을계획한것이며실제이탈은아래에별도로기록한다. 합격기준/실행권한/원결정의재확정이아니다.

## 변경 전·후와 정확 파일

기존 applyWindows는 stdout/stderr를 같은 배열에 넣어 단일 JSON.parse를 수행하고 오류 시 code/signal·채널 길이·parse단계 없이 버퍼를 소거했다. 새 collector는 고정 spawn과 분리된 명시 child/clock 인자로 두 채널을 합계16KiB까지 별도 보존하고, stdout 전체한JSON만 검사·오류유형/기한/분할/진행중HANDOFF 관측을 유한 metadata로 반환한다. raw 내용·임의 inner객체·오류message/사설경로는 반환하지 않는다. stderr를 무시해 PASS하지 않고, 유효FAIL/exit1과 PASS/비정상종료를 구분한다.
외부60초·고정spawn·PS4·원compiler15초/진단16KiB·입력/manifest/후보02·단발/신원FAIL/보존 원칙은 유지한다. 임의프로그램 실행 포트·새후보03·계정/키/DB·서비스·Agent는 추가하지 않는다. Node childPid는 생성 프로세스의 ID 관측일 뿐 원hostIdentity/중단 권한 proof가 아니다.
HANDOFF 조기회신은 현재stderr0과stderrEOF를 별도 enum으로 구분하며 미래 출력부재를 증명하지 않는다. 외부FAIL에서도 검사된 원보존 필요 true는 유지하고 미관측 boolean을 false로 합성하지 않는다.

| 소유 변경 | 최종 raw SHA256 |
|---|---|
| scripts/run-fn06-ownership-compile-only.ts | F160E775E96A12D490737613F5BC5196385AFFAC0970868EB297D682BD090B1F |
| tests/unit/FN06/ownership-compile-only-outer-capture.test.ts | 0050AEDDBFD98004C5CF6C91D21D1D99AA43B23056E18090FE16675C4C3703D1 |

## 검수 증거

- Main5a5c1d: 신규 outer pure10은 collector부재 RED10/exit1. 실제 child/PS/compiler/QA0.
- 최초 독립 C0/I1/M0: 외부오류가 검사된 HANDOFF true를false로덮는 I1. 같은 담당fix-round1/동일유효소스실패1회. Main5c70f5 보존회귀RED1/135.8258ms/skip0 후 무조건false대입1개만 제거했다.
- Maina2251c: node --test tests/unit/FN06/ownership-compile-only-outer-capture.test.ts → pure11 PASS/0FAIL/skip0/132.6173ms. 이파일은 fakeEventEmitter·합성Buffer·주입timer만 사용한다. PS/실compiler/새QA를 실행하지 않는다.
- Maina2251c npm run typecheck·git diff --check exit0. 담당 Node 구문0은 담당제출증거이며 Main은 실제 import/noEmit을 확인했다.
- Main608fc5: baseline Gitblob과 PS 원문블록 바이트동일, 최종2SHA·보호8원지문동일. 직전 Main42e159 읽기스크립트의 변수TDZ ReferenceError1은 읽기오류이고 변수명만 수정해 대조했으며 추가시험/PS0이다.
- 독립 같은 reviewer의 fix delta 재검수: I1 ADDRESSED/scoped C0/I0/M0. 직접 실행·수정0. 초기검수의 I1을 삭제하지 않는다.

순수11은 분할JSON·stderr/공백stderr·빈stdout·잡출력/falsy/배열/미지status·PASS의exit/signal불명·한도초과·spawn/stdin/pipe오류·주입timeout/late중복·HANDOFF OPEN/EOF·보존true/미관측을 검사한다. OS pipe경합/실프로세스 종료/강제시간상한을 검증한것은아니다.

## 실행범위 이탈 — 숨기지 않는 기록

계획은 기존9순수만선택·timestamp1/PS모의2 NOT_RERUN이었으나 담당명령 node --test --test-name-pattern="^(?!실제 apply payload|신원 미관측|신원 불명인 원 Process)" tests/unit/FN06/ownership-compile-only-preparation.test.ts 는 기존12전체를 실행했다. 실제12PASS/4337.4667ms/skip0이며 pure9/NOT_RERUN으로 바꾸지 않는다. 완료된3PS시험의 코드 호출선은 timestamp1+image3모드+limit1로 총5pwsh 자식호출이다. 개별OS추적이아닌시험완료/호출선근거다.
이는 Main의실pwsh0 지시를위반한검증범위이탈1건이다. 실제compiler/실apply/QA생성/native/Agent/DB/키/서비스는0이라는담당제출과불변코드대조를구분한다. 명령필터가왜제외에실패했는지는미확정이며같은명령을재현하지않았다. 결과를폐기/소급승인하지않고 Main WORK_STATUS·PMO에즉시보고했다.
담당의추가시험/수정은중지하고원문/hash읽기만받은후, Main이직접읽어확인한신규pure파일의명시11건만검수범위를재개했다. fix-round1에서는기존preparation/PS모의 재실행0이다. 이후기존파일필터검사를반복하지않는다. 불변시험의이전PASS를새실행으로표시하지않는다.

## 미검증·보존·다음

신규collector의실제PS/컴파일/apply 통합은 NOT_RUN. 원02 소비/승인은변경·재사용하지않고 새03도만들지않았다. 고정source12/tool4·PS원문·실행안·기존시험은불변이다. 원02 QA부재/소비marker보존은 원실행결과서의시점별관측을따른다.
sourcecheckpoint/private에소유2파일과WI/결과/현황/계획을보존한다. 실제실행이필요하면정확대상·목적·승인경계를별도구체화하며원소진허가를재사용하지않는다. 전체Stage/계획완료/실Agent연결/DB·서비스복구로승격하지않는다. rollback은소유2파일후속정상revert·신규unit보존이며원native/승인/marker·기존DB/키/서비스삭제0이다.
