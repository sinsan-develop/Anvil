# FN15 가져오기·선택 SQL 연결 — 후속 source 실행 부록 준비본

상태 PREPARED / NOT_DISPATCHED. 현재 FN01 단일 writer 종료·검수·checkpoint 뒤에만 착수한다. 기존 WI r7의 일반문서9op 연결 범위이며 새 공개 계약·추가 실행 허가를 만들지 않는다.

## 범위와 소유

- 부모 docs/work_packages/FN15_CONTROL_ACCEPTANCE_SOURCE_IMPLEMENTATION_20261103.md r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F.
- 읽기 기준6e3c8eb79aae943a22bf8520039f285f41ba50b8. FN01이 일부 경로를 수정하므로 이 기준을 미래 착수 지문으로 재사용하지 않고 최신 안전 checkpoint/5지문·다른writer0를 재확인한다.
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