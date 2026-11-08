# FN03 문서 전체 출처 저장·보호 조회 소스 검수

## 현재 판정
코드·합성 검증 인수 완료다. 실제 DB/HTTP 종단·UI·사용자 인수/전체FN03 완료가 아니다. 현재 branch codex/av3-fn03-document-sources, Main어울/기존Primary단일writer, WI f02b4c29af826ba8a692266dfb95515b60f34628152fea08823f6034d167560a 기준이다.

## 구현 범위
기존 SourceRef4종을 문서초안→불변버전→기존보호GET에 보존한다. 정확과거문서·READY artifact·실발언/USER_INSTRUCTION 원종류/hash를같은거래에서검산하고본문/분리출처열을대조한다. 출처참조200회공유예산·순환차단과원budget를유지한다. existing proposal의읽은base타입2줄만정합화하며제안Content[]/412·함수본문/SQL은보존한다.

## RED와 보완
- RED68c466 exit1:4종정상save가이전DOCUMENT_REFERENCE_CONNECTION_PENDING412로거절(하위1/부모포함2FAIL).
- 선import RED5a13c5 exit1:Documents의top-level Conversations원함수캡처가TDZ로실패. 최초사용lazy pin은최초prototype변조를원함수로오인할수있어기각했다. Convos자기모듈에서lexical원함수고정/선택적내부모드의own readonly/nonconfigurable메서드로소비하며기존ordinary생성/5인자를보존했다.
- I1 REDaa6383 exit1:DB원행/hash/kind정상상태에서Docs.originalText의getter/가짜본문이실행돼APPLIED. 외부HTTP함수교체권한취약으로확정한것이아니며내부원reader보존반례다. 무root/IO0 genuineDocs의own원문함수를lexical원함수.bind(원receiver)로고정해전용Convos에공급하며실store/privateguard/DB/pid/budget를유지했다. I1은 독립1e8097/2b12f3의최종읽기C0/I0/M0로해소했다.

## 검사 결과
- 집중: node --experimental-test-module-mocks --test tests/unit/FN03/document-source-refs.test.ts
- 최종36084d:16PASS/skip0/exit0. 4종저장/고정조회/과거v1·형상/변조/교차범위/GET503·200공유/초과·원메서드선후변조와import순서를검산했다.
- 직접인접7파일6ef89a:26PASS/skip0/exit0. 기존FN03확정·단계·목록/FN05지식·scope저장·대화/FN16backup전파를확인했다. 명령은아래와같다.
- type a7f05f/session61019→b56d25 exit1의소유내3타입오류와BaseDocument[]의3TS2345는구분보정했다. 최종 npm run typecheck: bce552/session4376→60ed37 exit0.
- diff/제안type2줄역치환a34d54 exit0·기존함수본문동일. 제품4/시험1 정렬rawmanifest18f6897743fc9507e0b9ee7b4968173f718df0d25db963396fbf8936dbfdd584 동결/writer반환/live0.

## 남은 연결과 미검증
다음 UI06에서기존조회기반의명시선택→저장→고정GET표시를연결한다. import/proposal의비빈출처저장·항목별attribution/evidenceRefs는완료라고하지않는다. 새endpoint/표/SQL/migration/권한·quota분모를추가하지않았다. 일반metadataJSON은기존quota분모외이고본문artifactbytes를중복계상하지않는다. 실제DB·RLS·COMMIT·served브라우저·키·서비스·Agent/실자료조사는미실행이다.

독립검수/화면연결후같은업무의안전commit/privatepush·PR필수검증·main·mergedsmoke/정리순서로진행한다. 회귀시본업무변경을정상revert하며원문·역사결과·감사는지우지않는다.

## 최종 명령·지문·검수
직접인접명령: node --test tests/unit/FN03/document-confirmation.test.ts tests/unit/FN03/document-stage.test.ts tests/unit/FN03/document-list-stage.test.ts tests/unit/FN05/knowledge.test.ts tests/unit/FN05/knowledge-scope-store.test.ts tests/unit/FN05/conversation.test.ts tests/unit/FN16/baseline-backup-budget-forwarding.test.ts

독립1e8097/2b12f3은최종5지문동일/C0/I0/M0다. I1보완은실store원바이트읽기·호출전/원행await중getter/fakebody0을확인했다. root없는생성의IO0은기존합성FS미등록API차단/blocked[]/handle0으로검산했다. 원실store·budget·권한을새genuine객체의빈store로대체하지않는다.

순환음성은위조저장행이hash검사에서거절되는증거다. hash가유효한순환을직접실행한증거는아니며수행하지않은분기커버리지를PASS로표시하지않는다. 초기최초prototype교체 RED84c52e→990d9a도TDD이력에보존한다.

## main 통합 후 한정 확인
PR68 sourcec85fee824200e4def9c0a16f5e8127425bbd9dc1는Broker42433973928 success로main339fdad926f9a0ad2593cfe75dd71758cda9d2c3에통합됐다. parentef933a87/source·merge tree5a137984c891ca29123008efb66f46fc1667e814동일,Mainc440bf정상FF후집중서버+UI29PASS/skip0/exit0(6125.7082ms)로검산했다. 2654f8에서main동일·clean/완료remote branch·tag부재/PR68복구ref확인뒤2cad00의정상-d/-dr로정리했다. 실제DB/served/전체계획완료를증명하지않는다.
