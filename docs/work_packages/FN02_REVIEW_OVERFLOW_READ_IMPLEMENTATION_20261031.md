# FN02 과다 검토 버전 읽기 — 구현 준비 WI

상태: MAIN_GO / DIRECT_HUMAN_APPROVED. FN02_FN14_SOURCE_APPROVAL_20261031.md의 최신 직접 승인에 따라 FN02 r2 8B6742A94ABB4433AF6A2B220EF823097AA7EAEFEB84B27E516A152D3BCF99F7의 A안과 아래 정확7경로를 기존 Primary에게 발행한다. 이전 준비본의 미채택/NOT_DISPATCHED는 이력이며 현재GO를 막지 않는다. 계약/허용7경로/검증/실제실행 제외는 준비본D60C4F3A와 동일하다.

## 기준·정확 범위
- 준비 기준 codex/av3-stage-b / d51e7f028065a173a68edcb921635634838cfdee(제품8c939d4b). 문서 checkpoint가 추가되면 구현 직전 실제 HEAD·dirty·기준2제품 지문을 다시 대조한다. 새branch/worktree/agent/chat/자동화0.
- 기존 단일 Primary 구현, Main 관리·검수·통합·기존 Reviewer 읽기검수. 코드 write 동안 Main은 같은7경로 수정0. WI/WORK_STATUS/WORK_PLAN/결과는 Main 소유다.
- 실제DB/SQL실행·DDL/migration·권한/정책/키/사용자파일조사·서비스·Agent·기존project차단해제0. 새dependency/전역CSS/기존완료시험 공통화0.

허용7경로:
1. apps/server/modules/projects/routes.ts — 시작5C841A44848A96BEA3A627BC71803D17666343638C22D92BAF37CC4F0A51A7F2.
2. apps/server/modules/methodologies/project-methodology-review-reads.ts — 신규.
3. apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx — 시작4E70B9489D28E9EE23A3B8730152464B9319D04FCA231DF10239E9E7FF9BB272.
4. apps/web/src/features/methodology-editor/project-methodology-review-api.ts — 신규.
5. apps/web/src/features/methodology-editor/StoredMethodReviewRead.tsx — 신규.
6. tests/unit/FN02/project-methodology-review-reads.test.ts — 신규.
7. tests/unit/UI03/project-methodology-review-read.test.ts — 신규.
추가 경로가 필요하면 근거를 Main에 먼저 전달한다. 기존 ProjectMethodologies/MethodVersion/MethodReviewPanel·원reader·서버mutation은 변경하지 않는다. 이들 원문 지문을 동결해 guard 보존을 확인한다.

## Q1 서버 보호 읽기·유한 codec
- 기존 projects route 등록 영역/Host검사/no-store와 options.repository.authenticated(token(request),null,...)의 동일db/actor를 소비한다. 기존row() graph·원command 또는 최초적용 근거로 원본을 검산한다. 새 read에서 기존read()를 호출해201guard에 다시 걸리지 않는다. 기존mutation은 기존read()/201guard를 계속 소비한다.
- signer는 기존 repository.signProjectCursor('FN02_METHOD_REVIEW_HISTORY:'+value)의 내부주입. 합성 시험은 고정 시험서명만, 실제 키 생성/조회/활성화0. Date/UUID ProjectListCodec 수정/강제변환0.
- cursor TTL은 기존 ProjectListCodec/MethodListCodec의30분=1800000ms 정책을 재사용한다. 최초issued/expires를 후속페이지에서 유지한다. 정확한 고정 필드·용도·actor/project/fullref/limit/upper/before·유한시각·signature를 검산한다. 만료·다른문맥/변조는400/자동재시도0.
- 빈 이력 upper=0/items[]/hasMorefalse. 비어있지 않으면 sequence는1..9007199254740991 정수만. 최초before=null로 정확MAX_SAFE도 포함하며 후속sequence<before AND sequence<=upper. 중복sequence/ref·순서반전·outcome/criteria/target/hash·원명령/receipt/audit 불일치503, INNER JOIN으로 누락증거를 숨기지 않는다. 원review행과 nullable 증빙의 scoped 완결 검산을 구현한다.
- overview confirmation은 원command/ref·validation·확정자/시각과 모든 원reviewRefs를 검산한다. 페이지 밖 참조를 삭제하거나 현재목록으로 바꾸지 않는다. currentConfirmationState=NOT_REEVALUATED/별도readonly DTO와 r2의2MiB응답상한을 유지한다. 기존validation은 정의 유효성이지 현재실행허가가 아니다.
- DB statement/snapshot 가정과 실제공급자/경합 미검증을 분리한다. memoryfake를 실제PG PASS로 올리지 않는다. 기존인증callback COMMIT확인뒤 반환선 보존.

## Q2 실제 UI 연결
- 기존 원본 선택/이전·다음 버전 요청의 id/version/알려진hash를 별도lookup으로 보존한다. 정확METHOD_REVIEW_PAGINATION_NOT_READY/412에서만 명시 분리조회 버튼. 다른412/401/403/손상에서는 새fallback0.
- overview는id/version/knownhash선택으로조회→실graphSHA검산→반환fullref를page에필수고정. readonly패널의현재project/user/client·객체/실transport·선택version문맥에결박한다. 닫기/전환/이탈후늦은JSON/digest/401·관측ABA폐기,현재활성401만callback.
- 원본/확정당시refs·현재효력미확인·선택한page의원검토/관측·다음/이전·실패동일대상재시도를보여준다. 성공history만확정·중복GET차단. page를전체이력으로표현0·POST0.
- 기존MethodVersion/편집/검토/확정/적용에별도DTO를넣지않는다. 기존draftbuffer/선택원본/정상0~200경로보존. 기존201+mutation412와실행false는그대로다. 전체FN02완료로보고0.
- 기존Operate/12px·패널스타일유지. UI쓰기직전impeccablecraft-floor·target2detect. context는앞선49c4db에서세션1회완료,새PRODUCT/DESIGN/init0.

## Q3 필요한 검사·제출
- 원실패201/과거hash미보유/knownhash불일치·누락증빙과페이지행반례로실제기능RED→GREEN. 서버codec/route/dbfake의현재회원·같은target·상한0/MAX_SAFE·새검토상한/과거confirmationrefs·200/201·변조/만료·서명부재와기존mutation412불변을시험한다.
- 실제Page의명시버튼→원decoder/graph검산→readonly패널/전체page·늦은응답/중복/POST0·원입력불변을소형메모리DOM으로검증. 실제브라우저/served/DB와구분한다. 새framework/dependency0.
- 직접인접 project-method-web.test.ts·stored-content-reviews.test.ts·project-list.test.ts 중영향검사를선정한다. application-read.test.ts의실pg.Pool 조건은실행금지,필요하면읽기확인한메모리조건만선택한다. type/noEmit·메모리Web build·diffcheck와원source지문보존.
- Primary가exact7diff/RED→GREEN/정확명령exit·오류/미검증·지문을제출하고writer반환. Mainfresh·독립C/I0후같은privatebranch에소유파일만통합한다. 실제통합/인수나전체계획완료로승격0.
