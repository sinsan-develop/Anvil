# FN06 외부 결과 수집 유실 보완 — source-only WI

2026-10-27 · Main 어울 · 기준3654715d813682dcb87393dde207f41a05b06c59.

## 사실·범위
새02 실제1회는 소비됐고 OUTER_RESULT_UNKNOWN이다. QA02부재/markerBFAC30DF보존·관련생존후보0이며 실제 compiler 시작/진단/종료는 미확정이다. 원stderr가소거돼 실제원인확정0이다. 원01/02승인을재사용하거나후보03을만들지않는다.
읽기로확인한결함은 applyWindows가 stdout/stderr를같은buffers에합쳐단일JSON.parse하고 code/signal/채널별길이/parse분류없이유실하는점이다. 이것이이번실패의원인이라고확정하지않는다. source-only내부기술보완이며실행권한증가/실험재시도0이다.

## 단일 writer 허용2경로
1. scripts/run-fn06-ownership-compile-only.ts
2. tests/unit/FN06/ownership-compile-only-outer-capture.test.ts 신규
기존input/manifest/execplan/approval/marker/native/source12/기존unit/결과·현황·보호8수정0. 새branch/채팅/자동화/commit/push0. Main이현황·검수·통합한다.

## 구현 조건
- spawn은기존단일고정진입점에남기고 child event수집을명시인자 collector로분리한다. CLI일반인자/환경변수로다른프로그램/임의실행포트를열지않는다.
- stdout/stderr는분리해수집하되합계보존16384bytes·외부60초상한유지. 한도후새내용보존0·유한/saturating bytecount. raw내용/오류message/CLIXML·사설경로dump0이다. 원버퍼는종결시소거하고늦은이벤트/중복close/error에재결과0이다.
- stdout은전체한JSON으로만해석. 선행/후행잡출력을잘라정상JSON만채택하거나stderr를무시해PASS로낮추지않는다. stderr존재는구조화FAIL·parsedStatus등유한관측만남긴다. 파싱가능한유효FAIL/exit1은정상실패반환, PASS/exit!=0 또는signal/종료불명은FAIL이다. falsy/배열/문자열/알수없는status는정상상태로채택0.
- finite outerEvidence에는채널별보존byte/합계/overflow·closeCode/signal·parseStage(enum)·parsedStatus(enum|null)·spawn/stdinError종류(enum)·원child.pid(있으면정수/null)/관측시각만허용한다. 실제OS신원proof가아닌Node생성PID라는한계를명시한다. exception.message/stdout/stderr원문·비밀/임의객체를추가하지않는다.
- stderr등으로완료채택불가여도검사된단일JSON의유한 상태/실제소비·시작boolean/exitCode·CS코드등을필요하면명시allowlist로보존할수있다. 임의innerResult를통째로붙이지않고검사하지않은값으로정리/중단/PASS권한을부여하지않는다.
- 기존HANDOFF_REQUIRED 조기회신은stdout한정정확구조·stderr/overflow/stream오류없는경우에만. 원hostIdentity를실제서명으로승격0, 원child/후보PID만으로kill0. 외부timeout시기존비광역중단/UNKNOWN보존원칙유지. heartbeat/상주daemon/새프로세스조회0.
- 실제Process/ReadAsync/captureScript/PS native권한·compiler명령/한도/후보02/단발/신원FAIL기준은수정0. 이번보완후에도현재marker로apply는차단돼야한다.

## TDD·검수
먼저TEST_ONLY: fake EventEmitter+합성Buffer·주입clock/timer만으로 stdoutJSON+stderr,분할JSON,빈stdout,유효FAIL+exit1,PASS+exit1,overflow,spawn/stdin오류,timeout/late·HANDOFF를검사한다. realspawn/PS/Process.Start/FS/QA/--plan/apply/compiler실행0. 실제기다림60초대신주입timer를쓴다.
Main fresh RED후동일담당최소보완·신규순수10/기존순수9·type/Node구문/diff·독립C/I0. 기존12중timestamp1/PS모의2는불변PS본문의rawbytes를대조하고이번에는NOT_RERUN으로명시한다. 이전12PASS를새실행으로표시하지않고실제PS프로세스도재실행0이다. 이는전체Stage gate완료판정이나기존합격기준변경이아니다. 실제compiler/OS/pipe경합결과는NOT_RUN. mock collector PASS를기능/실컴파일완료로보고하지않는다.
rollback은소유2파일후속정상revert,원승인/소비/결과/native/DB/키/서비스삭제0이다. 원02의실패/UNKNOWN은보존한다.
