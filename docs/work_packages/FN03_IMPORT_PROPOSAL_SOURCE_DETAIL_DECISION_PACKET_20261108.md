# FN03 가져오기·제안 출처 상세의 정확 계약 차이

상태: 결정 후보 / 미채택. 현재 문서 SourceRef 저장·UI 연결 구현과 별개이며 그 진행을 멈추지 않는다.

## 이미 승인된 부분과 실제 누락
INTERFACES670의 importDocument 입력은 fileRef/intendedFormRef/sourceRefs,672의 proposeDocumentChange는 baseRef/proposedContent/reason/sourceRefs다. 입력출처의보호검산·불변보존과proposedContent.sourceRefs의정확상세조회/반영은기존목표다.

반면670의ImportCandidate응답은id/originalRef/extractedContentRef?/parserVersion?/losses/issues/status이며sourceRefs가없다.655/657/672의Proposal응답/상세도제안자체의sourceRefs배열을명시하지않는다. 현재commands에는request_hash/payload_ref/result_ref만있고일반원request_json/원문GET은없다. approval_requests의전용request_json을우회저장소로쓰지않는다. hash만으로잃어버린배열을복원할수없다.

## 권장 A — 기존 상세에 선택적 출처 필드
기존ImportCandidate와Proposal상세에 sourceRefs?:SourceRef[]를추가한다. 4종필드자체나endpoint는추가하지않는다. 원입력이비어있지않은신규자료에만출처를불변JSON/원명령·receipt/hash에결박하고기존보호GET에서정확사본을반환한다. 기존빈자료/옛JSON은필드와hash를재작성하지않고그대로검산한다. 따라서이전지원빈출처흐름의응답형상은보존하고새비빈자료는갱신된소비자가검산한다. 옛엄격소비자가새비빈자료를지원한다고주장하지않는다.

제안의근거(sourceRefs)와제안문서의출처(proposedContent.sourceRefs)는구분한다. 전자는제안에보존하고후자는선택문서내용과정확일치시킨다. import출처는후보에보존하고기존candidate/original link로추적한다. 새문서출처에몰래합치거나원래없던전체포함의무를강제하지않는다. 사용자가문서출처로선택한경우에만명시payload에포함한다.

필수연결은기존candidate/proposal JSON·보호GET/화면·형상/hash/receipt검산,원0073수정없는목적한정forward의import조건보완이다. 새표/권한/비용목적은필수라고가정하지않는다. 일반metadata는기존quota분모를유지하고proposal diff의실제bytes만기존예약에따른다. 기존OWNER/HANDOFF·원제어/정책·명령/세대/일회소비·기한·중복검사를약화하지않는다.

검증은4종생성→새세션보호GET→명시선택→문서GET,두출처배열분리·옛빈hash불변·원hash/교차프로젝트/격리·누락/변조·replay/UNKNOWN을포함한다. 코드·화면·미적용SQL·합성검증만의채택안이며실제DB/권한·키·서비스·Agent/실자료/QA실행은허용하지않는다.

## 대안 B와 영향
입력의출처를내부에만보존하고기존응답은유지할수있으나새세션의화면조회·근거확인이미완료로남는다. 이를전체기능완료로대체하지않는다. A의공개상세차이를현재위임범위에서채택할수있는지정확결정/지원만요청하며PMO의다음작업배정을기다리지않는다.

실제기준근거: INTERFACES600/603/655/657/670~675,DATA_MODEL89/91/93,0011_authorization17~26,project-command186~190/297~303,0073_control_handoff_acceptance934~963. 구현전정확WI·허용목록·실원문지문을고정하고독립검수한다. 현재계약·원SQL·실자료변경0이다.
