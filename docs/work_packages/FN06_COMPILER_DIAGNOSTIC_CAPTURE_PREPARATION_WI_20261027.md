# FN06 compiler 진단 수집 보완·새 단발 후보02 준비

2026-10-27 · Main 어울 · source24e70f71a865e3e4779f769a787000d9d6f77e98.

## 목적과 현재 실제 경계

첫 compiler1회는1248d4에서시작돼소진됐다. 이미지관측은startTicks기록후HasExited/MainModule구간에서실패했고진단수집보다앞에서중단했다. 실제컴파일성공/소스결함/빠른종료원인은미확정이다. Root01은7a6d55/79eb36 exactQA0·marker45C21C7DCD8177A4E3F316B271A223F235C108132E9980D839C0E6DA924D6C60 의도적보존이다. 원결정으로재실행하지않고소비기록을삭제/리셋하지않는다.

다음은신원FAIL/PASS기준을유지하면서본인Process의유한stdout/stderr·종료코드를신원관측실패때도유실하지않도록하는국소source보완이다. 실제추가compiler/QA는새정확직접승인전실행0이다. default새후보02는미승인·결정파일부재로apply차단이어야한다. source작성/시험을실제OS검증이나Agent연결진도로보고하지않는다.

## 단일 담당 허용5경로

1. scripts/fn06-ownership-compile-only-input.ts
2. scripts/run-fn06-ownership-compile-only.ts
3. tests/unit/FN06/ownership-compile-only-preparation.test.ts
4. docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027_02.json 신규
5. docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_EXECUTION_PLAN_20261027_02.md 신규

기존실행계획/manifest01·부모승인/결과/현황·nativeC#12·보호8/소비marker·기존helpers는수정0. 새branch/채팅/자동화/자식/commit/push0. Main관리검수통합·단일writer만수정.

## 보완 조건

- StartTime기록/실제image관측·실패종류를구분한다. 빠른종료를실제관측하지않았는데원인으로단정하지않는다. image조회예외는유한오류유형/Win32code/관측시점의HasExited를남기고raw메시지·private경로dump0이다. 같은본인Processhandle에대해필요한경우짧은bounded조회만,PID만으로다른프로세스를조회/종료0.
- 실제exe미관측/불일치에서는기존신원FAIL이유지된다. 요청exe·synthetic값으로관측exe를채우거나PASS로바꾸지않는다. PID/start/exe와Process종료/pipe EOF·exit/진단은각각사실로남긴다. 신원불명이어도본인이Start한같은Process의출력pipe와exit관측은한도안에서수집할수있되검증권한/안전writer증거로승격하지않는다.
- 처음읽기/모듈관측의순서와실패처리를보완해짧게종료된process의유한진단이확보되도록한다. 실제alive·image미검증이면강제중단/광역kill하지않고15초/16KiB/남은창·handoff계약을지킨다. 정상신원검증된본체만기존정책대로중단한다. read완료전zero/dispose0·불명은보존/메모리정리한계/원핸들종료한계명시.
- 진단은기존CS code/line/column외필요시manifest의exact basename으로만source를매핑한다. global CS error처럼위치없는진단도유한코드로보존한다. rawsource/diagnostic본문·unknown경로/파일실행·새query/role은넣지않는다.
- phase를실제process시작/capture/검증/cleanup상태와맞춰첫성공Start후PREFLIGHT로만남는혼선을없앤다. start=true이면검증실패여도그actual1회는소진이다.
- cleanup은소유·exactinventory·hash/link/relatedprocess0/종료관측으로확인된경우만. originalexe미관측을자료삭제의권한으로쓰지않고불명시자동삭제0이다. 필요하면검수된Main수동정리와같은독립조건을명확히하고모의시험으로검사한다. marker는항상보존한다.

## 새 후보02의 고정 파라미터

원01 manifest의sources12/tool4/옵션/한도/출력과동일하며원본은불변이다. 새manifest는sourceCheckpoint24e70f71...·candidate/run ID FN06_OWNERSHIP_COMPILE_ONLY_20261027_02·proposedQaRoot D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-02만구체화하고새rawhash를input상수에고정한다. output은bin/OwnershipEvidenceSource.dll,consumer는새root.consumed.json,새고정decisionPath는docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_02.json이다. 새decision은만들지않는다. 원01marker/기존QA경로재사용0. candidate별library1회·15초/16KiB/QA30분·기존compiler/3BCL·DLLload/Job/PInvoke/Agent/DB/Secret/서비스0은그대로다. 프리플라이트/authority함수는이5경로밖으로확장하지않고일반실행엔진을만들지않는다.

## TDD·검수

1. TEST_ONLY로기존unit에이번실제관측손실의회귀를먼저작성하고Main에보고한다. 실제프로세스대신PS모의객체/MemoryStream/순수관측정책만써서이미종료·image조회예외·불일치에서exit/유한진단을보존하고PASS/Stop권한을부여하지않는지검사한다. PS원문helper가없으면명확한행동RED로보여주되actualapply전체본문/FS/Process.Start/Preflight/marker를실행하지않는다.
2. Main RED후같은담당보완. 기존9+timestamp회귀의안전조건/기대한도는보존하며새02파라미터로fixture참조만정확변경한다. source/tool array의원바이트가원01과같음을검사한다. 단일fixture/metadata갱신을검사완화로숨기지않는다.
3. 필요한집중unit/type/Node구문·내장PS AST 및모의함수만검증한다. actual--plan/apply/compiler/QA/소비/승인JSON·DLL/Native/Agent실행은0이다.
4. 실제게이트유지·출력/exit보존·고정프로파일·정리/기한의독립C/I0뒤Main이sourcecheckpoint/private와새직접실행범위를구체화한다. 원소진허가로재실행하지않는다. 미래03/04등프로파일이나집계실행예산은이번source에서임의추가하지않고별도정확선택으로둔다.

검수결과에는실행한영역과pure/PS모의/실제OS/컴파일을분리한다. rollback은소유변경후속revert이며원C#/DB/서비스·marker를지우지않는다.
