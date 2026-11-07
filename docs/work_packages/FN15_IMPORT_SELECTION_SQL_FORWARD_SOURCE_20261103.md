# FN15 가져오기·선택 SQL 연결 — source 실행 부록 r2

상태 SOURCE_ONLY_GO / Main 기술 상세 검토 후 기존 Primary 단독 착수. FN01 source writer 반환·한정 검수·private checkpoint4d517f4e를 확인했다. 실제 FN01/DB 인수 완료를 뜻하지 않는다. 기존 WI r7의 일반문서9op 연결 범위이며 새 공개 계약·추가 실행 허가를 만들지 않는다.

## 범위와 소유

- 부모 docs/work_packages/FN15_CONTROL_ACCEPTANCE_SOURCE_IMPLEMENTATION_20261103.md r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F.
- 착수 기준 local/private codex/av3-stage-b의4d517f4e11d5dd10b71c07f63ac1facfdb34cfb0. 해당 기준의 실제5지문을 아래에 고정한다. 다른 writer0·Main 문서 소유/보호3·미저장 작업/live를 preflight한다. 읽기 준비 당시6e3 기준은 역사이며 착수 지문으로 쓰지 않는다.
- 기존 Primary 정확5후보: apps/server/modules/access/project-command.ts; db/migrations/0073_control_handoff_acceptance.sql.pending; apps/server/modules/control-handoff/control-acceptance.ts(checksum만); tests/unit/FN15/control-source-integration.test.ts; tests/unit/FN15/control-acceptance-schema.test.ts. Main은 문서·검수·Git만 소유한다.
- 실제 DB접속/SQL·GRANT/정책·회원 적용/키·서비스·Agent/OS·실자료 조사0. 옛 SQL·기존 source등록/관측·공개양식/상한·새approval operation 추가0.

## 확인한 실제 공백과 최소 구현

Primary 읽기와 Main d6b70e/daa7b7에서 최종0072 guard_document_import_write를 직접 대조했다. 옛0072 raw SHA E561CDADB1BC68E426B6CD8D62417822B549756263463F252A9B032493706B06은 읽기 고정이며 수정하지 않는다.

1. importDocument는 기존 일반9op이지만 Node private 목적context 고정4op에서 누락됐다. 실제 인증 callback의 원context 생산/단발소비에 importDocument만 더한다. sameDB·actor/session/credential·원command/hash·finally폐기·기한을 유지한다.
2. saveDocumentDraft의 importCandidateRef 선택은 이미 기본context를 생산한다. 기존 ProjectDocuments.checkImportSelection의 READY 후보·원 Artifact 링크·본문/양식을 그대로 소비하고 별도 임시 선택 기능을 만들지 않는다.
3. 기존 fn15_ordinary_document_command_current(pid,cid,op) helper의 고정 op에 importDocument만 추가한다. GUC exact5/목적값·2097314B·원command2097152B·원실제session/fn01_active·credential/current grant/receipt/정책·예외의미/최소ACL은 유지한다. 다른 활성session·외부verified flag·범용 공개grant helper로 대체하지 않는다.
4. import 원request는 targetId:null/expectedVersion0과 기존 exact fileRef/intendedFormRef/sourceRefs[]를 검산하고 receipt candidate의 원문·해당 file/form과 결박한다. save 선택은 원payload importCandidateRef와 receipt 선택ID·실제document/version을 결박한다. 새 payload나승인생산을 추가하지 않는다.
5. 0073에서 guard_document_import_write의 최종0072 전체 정의를 forward한다. regular membership 조건의 OWNER 또는 (HE이고 command.operation이 importDocument/saveDocumentDraft이며 같은 목적helper성공)만 delta다. 기존 control/project/policy/receipt/current_user/actor·client/원command·candidate/hash/READY원Artifact/form·선택문서/version/link 검산을 그대로 보존한다.
6. 앞 COLLECT_PROPOSAL 특별 분기와 document_source_current·정확 source event/관측Artifact/원COLLECT 결박은 byte동일 보존한다. HE 일반helper로 source등록권위·보호관측을 우회하지 않는다. invoker trigger를 definer로 바꾸지 않는다.
7. REQUIRE_APPROVAL의 미지원 import/save 생산은 계속 명시거절/잔여다. AUTO 양성을 전체정책 지원·다른사용자정책 생산경로·실사용완료로 보고하지 않는다.

## 검수·반환

- 실제 Repo→ProjectDocuments.import→기존Artifact reader/파서→receipt/context→import INSERT의 메모리 행동 RED/GREEN. 이어 명시save→원READY후보/원문검산→selection INSERT를 소비한다. 앞NOT_CONNECTED 거절을개별권한음성성공으로세지않는다.
- context없음/원request변조·다른DB/session/폐기·중복사용,옛세대·누락/회수grant·DENY는목적쓰기0. 다른project/Artifact/hash/form·FAILED/UNSUPPORTED/원Artifact누락선택거절,OWNER기존정상·COLLECT보존을확인한다.
- regular membership delta 역치환 시 최종0072 함수 전체와 정확 동일하고 COLLECT구간도 byte동일임을검수한다. 문자열일치가 실SQL집행/ACL·RLS·경합 PASS가아니다.
- 직접2시험과 필요한인접만·noEmit/diff·최종LF/raw SQLchecksum/service상수·단일COMMIT/postflight를확인한다. 완료된기본문서26/UI2·전체회귀반복0. 실제PG/HTTP/브라우저/사용자인수는NOT_RUN.
- Primary는변경전후5hash·정확명령/exit/결과·오류/미완료·live0/실효과0·rollback을반환한다. 자동심사거절은정확근거만반환·우회/분할/반복0. Main의착수GO전에는구현하지않는다.
## r2 기준 지문·실행 순서

부모 준비본 SHA92E5145A41BF122CC25FF6D2B39702403EBE5A0975ABA9E78455D68154095FA4, 동일 승인 WI r7 U4의 내부 기술 상세다. Main a69572에서 private4d517f4e와실제5지문을확인했다. 새공개요청/응답·권한의미·테이블/role을추가하지않으며Main검토는이한정source상세다.

| 경로 | 시작 SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | CAB8C4A7609F54DDAB65ACEE5D75CDB73597ECED37BC8049C416AB13239BAA0B |
| db/migrations/0073_control_handoff_acceptance.sql.pending | 43898B2BBE455274975FC9A3C1C44AC216B4E203B2941F9C61C070C7E49BB2F6 |
| apps/server/modules/control-handoff/control-acceptance.ts | DF2B6818A9F7DA806236198112A942E83A3956E2597207E36352FD0F7AAE4F6D |
| tests/unit/FN15/control-source-integration.test.ts | 9C9143F97350AAC418576342E15284EFDBBE4DA00F5C79FA0C6921FA6F5AAE65 |
| tests/unit/FN15/control-acceptance-schema.test.ts | F338701D716C79CB7FE26139F609967C44719BC8EF23D4BC84BD0E53C7400600 |

1. 위기준/지문·기존5/신규0·보호3·기존writer반환·live0를확인하고Main문서/미채택후보를수정하지않는다. 정확범위밖필수경로는이유/delta만Main에반환한다.
2. 실제ProjectPolicyRepository→ProjectDocuments.import와save선택leaf를소비하는메모리Reader/DB의RED를먼저만든다. 가짜성공함수를제품경로로추가하거나실제원문보관소/DB를읽지않는다.
3. import 자체는READY/FAILED/UNSUPPORTED 후보를원래규칙대로저장해손실/문제를보고할수있다. READY만요구하는것은그본문의명시선택경로다. 미지원형식보존을이번HEhelper에서거절하는회귀를만들지않는다. 원fileRef/intendedFormRef/null/sourceRefs[]와receipt.candidate원문을검산한다.
4. 같은purpose helper/Nodecontext에importDocument만추가하고save선택SQLregular분기를위계약대로forward한다. COLLECT특수분기·Owner/invoker기존조건은그대로다. helper SD소유/고정path·최소EXECUTE·예외는기존그대로이고다른trigger를SD로변경해권한검사를우회하지않는다.
5. 원명령/목적context·폐기/변조·다른session/db/client/세대·회수grant/DENY·다른project/Artifact/form/hash·미지원후보선택거절과OWNER기존정상을직접확인한다. 0072→새regular membership delta만역치환해원함수전체와COLLECT구간의byte동일을검산한다.
6. 직접 두시험파일을node --test로실행하고새변경이영향받는인접만선정한다. 필요한noEmit/diff·SQL LF/raw/service checksum·단일COMMIT/postflight를확인한다. FN01 31/21/UI와기존불변기본문서26·전체회귀반복0이다.
7. 의미추가/자동심사거절은정확action·이유만반환하고우회/분할/반복0이다. 결과불명은원cell/session을기록·수거하고확정전동일실행을다시시작하지않는다. snapshot/도구출력이문맥에서사라지기전에번호·결과·pending을짧게Main에보내복구가능하게한다.
8. 실제5변경/hash·정확명령/결과/오류·NOT_RUN·live0·cleanup/rollback을제출하고writer를반환한다. 실제PG/RLS/ACL/경합·served/UI·실자료/키/서비스/Agent/OS는계속NOT_RUN이다.

타사용자HE정책의정상생산은별도미채택후보이며이번단위는유효한명시정책조건의source를검증할뿐그생산경로나전체FN15의실제사용을완료했다고하지않는다.