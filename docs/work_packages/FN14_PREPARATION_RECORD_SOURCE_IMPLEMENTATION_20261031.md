# FN14 준비 기록·별도 상한 A — 구현 WI

상태 MAIN_GO / DIRECT_HUMAN_APPROVED. FN02 writer 반환·Main42PASS/독립C0I0·제품2008be2cc4d2d666091c0172ad5fda1c3c69f3bb/private동일 확인 뒤 같은 Primary에게 정확8경로를 순차 발행한다. 이전 준비WI1CCD88EB의 계약·범위·검수는 동일하며 GO/시작기준만 갱신한다. 신산님의 최신 두 A안 직접승인 binding FN02_FN14_SOURCE_APPROVAL_20261031.md SHA B7F928C104D3A4DB8ED86CA557D6CFBEC786E9060939EF0DA453CAFDCD01AA33를 따른다.

## 채택 근거·목표
원 후보 docs/contracts/FN14_TRANSFER_PREPARATION_RECORD_PROPOSAL.md E096C897761A71D980F19B98E7BB47623DF8933C4F456BD1592621751DB1EB9D와 상한A docs/work_packages/FN14_PREPARATION_STORAGE_LIMIT_DECISION_20261031.md C842350B21242E6817FF1BA7BF709A286B8B33A936D368B212F98E63073DB0AD의 교집합을 구현한다. 원 후보 끝절이 명시한 범위는 exact parser·기본NOT_CONNECTED verifier·transaction store·in-process 합성·미적용 SQL이다. 공개 command/GET 형태는 source 계약으로 정의하지만 기존 app/routes/공유operation·policy 목록/실제 source reader에는 연결하지 않는다. 저장된 사용자기능·실제HTTP/DB/이전·전체FN14완료가 아니다.

- 새2표 anvil.transfer_preparation_records / transfer_preparation_record_versions와 createTransferPreparationRecord·고정v1읽기 DTO·작성자OWNER의 별도readTransferPreparationRecord/AUTO를 source로 구현한다. REQUIRE_APPROVAL는 계속412, 일회승인소비0.
- 실제DB/SQL실행·role/권한/정책부여·키·사용자파일조사·서비스·Agent·기존project차단해제0. 화면/동결/세션교체/이전확정/재개/제어전환·실제source본문수집0. 기존 quotaA10GiB집계변경0·새의존성0.
- 기존Primary 단일writer/Main동일code수정0/기존Reviewer읽기. 새branch/worktree/agent/chat/예약0. Main이WI·현황·계획·결과/commit통합소유. 제품 시작HEAD는2008be2cc4d2d666091c0172ad5fda1c3c69f3bb이며, 이 WI/현황을 보존하는 다음 control commit을 실제 작업 HEAD로 사용한다.

## 허용8경로 — 모두 신규
1. apps/server/modules/transfers/preparation-record-input.ts
2. apps/server/modules/transfers/preparation-record-verifiers.ts
3. apps/server/modules/transfers/preparation-record-store.ts
4. apps/server/modules/transfers/preparation-records.ts
5. tests/unit/FN14/preparation-record-input.test.ts
6. tests/unit/FN14/preparation-record-store.test.ts
7. tests/unit/FN14/preparation-record-schema.test.ts
8. db/migrations/0060_transfer_preparation_records.sql.pending
0060은Main0c4eff에서부재확인했다. 구현직전현재목록을재확인하고충돌시작성하지않고Main에보고한다. migrationloader/manifest등록·기존SQL·공유인증/ProjectCommand/공개route/공용operation권한목록변경0. 추가경로필요시근거를먼저Main에전달한다.
기존 preparation-analysis.ts SHA457445D81C277A8A13E873792C09DE7AC19519ACCD15AE31BB10CDD069308BF7와 0059 SHA0E13C17946D47A03E388C16D6CC05CAB17F13033DEC572DEDD9E559A0F4E24E7·보호3/원5복구본보존. 기존분석의동적gap/recordClaims/bodyRef를새닫힌DTO로복사하지않는다.

## Q1 닫힌 parser·서버 파생 metadata·기본 verifier
- 원문§2/4/7의명령/payload/snapshot/POST/GET exact키·정확VersionRef/MessageRef·SHA·kind·false flags·관계·길이/유효Unicode·canonical2MiB/이유4096bytes를검산한다. 정상intent는새저장시DB시각뒤/최대30분,만료새명령410. 알려진비밀표식거절과유한오류정규화,rawreason/ref/예외반사0.
- snapshot은원문정확키/ID/project/v1·canonicalH·기존7slot한번/원순서·출처union최대207·고정gap집합을유지한다. context null은7개NOT_COLLECTED,비null의각slot선택/포함/누락으로METADATA_ONLY/MISSING_OR_EXCLUDED도출. METADATA_ONLY를이해/전달/원문완비로승격0. SOURCE_DIFFS/CHECKPOINT/STOP/WRITER/ORIGINAL_BYTES/RECORD_DURABILITY/SOURCE_AUTHORIZATION/UNDERSTANDING/TRANSFER_CONFIRMATION항상미확인gap유지.
- rawcontext/body/본문/URL/경로/credential·실행handle·completed/unfinished/임의성공flag입력·새영속복제0. baselineRefs/budget/sourceRefs/slot은exact고정임무/context에서서버port로도출하고request가넣지않는다. context currentCheck CHANGED/UNAVAILABLE는원문대로gap이며허용된과거원문접근을권한거절로왜곡하지않는다.
- verifier는원후보4.1/6.1표의transaction단위현재auth/currentOWNER/client/control/write-readpolicy·잠금/재읽기·assignment/currentdraft·context/role/binding/실등록target·각source의현재보호/관계를명시한다. 기본연결없음412 SOURCE_VERIFIER_NOT_CONNECTED. 선택ref가있는데없는검증기를gap/null로넘기지않는다.
- 기존 context.read/version/knowledge/message reader는본문까지읽으므로이번실호출0. connection candidate를실제등록target으로대체0. ownerRole이름만으로임무/역할관계인정0. source adapter는명시SYNTHETIC_ONLY의in-processport/fixture로만검증하며실제신뢰공급자나활성runtime으로등록하지않는다. 어떤mutation도같은충돌잠금을쓴다는근거없으면기본미연결을유지한다.

## Q2 transaction 저장·정확 replay/읽기·상한
- 원문§6 순서: 형식→현재auth/OWNER/client/control/명시write+readAUTO→공통외부command키잠금과현재보호→기존command탐색→잠금후현재성재검사→새것만intent/최신assignment·고정관계검산→snapshot/상한→내부command/2표/receipt/audit원자저장. auth-prefix→project/member→control(POST만)→policy→source종류/id정렬상위행·부모부재직렬화. 실제전체mutation충돌을합성PASS로주장0.
- source wrapper는transactionowner가성공COMMIT확인한뒤만응답한다. 모든실패/감사·receipt/guard·상한오류는전체rollback,COMMIT응답불명은UNKNOWN/자동재전송·새command생성0. 포트/현재주체/기한·보호재검사없이serializer·ref/count/부분receipt노출0.
- command의내부commands.id와외부commandId/operationId를구분한다. versions.command_id는내부id,원문scopeDigest/requestHash/policy/creator/ref·result묶음을검산한다. project/actor/외부commandId복수operation과다른payload/client/세대409. 같은APPLIED는현재POST권한+GET정책/작성자/각source보호를재검산한뒤exact과거receipt만반환한다. 과거intent만료/새sourcehead/새assignmentCAS를replay에적용하지않는다. GET은현재인증된새client의OWNER/작성자/명시readAUTO를검사하며control보유는강제하지않는다.
- 같은project잠금을유지한동일저장Tx에서record총수+1<=10000 AND 최종canonical snapshot UTF8합계+신규bytes<=1073741824를재검산한다. rowid/서버관측시각/파생gaps등최종값을고정한실제snapshot바이트로계산한다. 숨김/만료/원문회수도기록/사용량삭제0. 넘으면429 TRANSFER_PREPARATION_STORAGE_LIMIT과명령/2표/receipt/audit전체rollback. 과거exactGET/replay는신규량0·현재보호유지로허용한다. DB물리/WAL/명령복제한도인것처럼주장0.
- source가회수/격리되면오래된commands.result_ref도일부반환0/동일404. 정상과거head는접근가능하면허용·현재이전가능usableForTransferfalse/sourceCurrentnessNOT_REVALIDATED. 응답id/project/version/hash/기록/관측·expiry현재상태의정확범위를분리한다.

## Q3 새 scoped pending SQL·직접검수
- 새2표v1·부모/FK/UNIQUE/RESTRICT·정확내부commandFK·creator/user-client/project·policy/operation/requestHash·canonical contenthash/result/receipt/audit·타임스탬프결박을새scoped함수/guard로검산한다. 기존0058/0059와공유canonical함수를수정하지않고필요한새wrapper로기존assignment_draft_canonical을소비할수있다. 기존SQL의canonical표현을임의jsonb::text/다른문자수로대체0.
- null/type/JSON exact키·추가flag·잘못된버전·행반쪽/command/receipt만·원행없는APPLIED·역방향누락·hash/creator/policy/result불일치·UPDATE/DELETE/직접DML을양방향deferred완결/불변제약으로닫는다. 사용자임의set_config만으로guard가통과하면안된다. 새함수PUBLIC EXECUTE/테이블PUBLIC권한을방치하지않고기존app role의raw접근을열지않는다. 새role/공유GRANT·실제policy등록0.
- SQL내상한은같은project부모잠금/동일canonical최종bytes를다시검사하며병렬저장/overshoot의실PG동작은NOT_RUN. 구조시험은literal포함만반복하지말고제약연결·양방향guard·잘못된scope/null/빠진receipt반례의의미를검토한다. SQL파싱/가짜DB를실제PGtrigger/DML검증으로승격0.
- 입력·정상저장→읽기→exactreplay·crossproject/relationship·기한/현재credential/client/control/policy·source회수전후/잠금후변경·원문/권위flag주입·2MiB/4096·서로다른내부/외부ID·감사/COMMIT불명·상한10000/1GiB정확경계·replay신규량0·숨김이력산입·FK/guard반례를새3시험으로RED→GREEN한다.
- 직접인접 preparation-analysis.test.ts는원분석불변회귀만필요할때선정한다. type/noEmit·diffcheck·기존source/SQL/보호3지문을검사한다. 실제DB/FS/브라우저/served·이전재개는미실행으로명시하며새QA생성0. Primary exact8diff/명령exit·지문·오류·미검증제출/반환,Mainfresh·독립C/I0후소유파일만기존branch통합한다.
