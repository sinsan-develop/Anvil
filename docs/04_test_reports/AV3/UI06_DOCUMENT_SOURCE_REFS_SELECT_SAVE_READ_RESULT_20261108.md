# UI06 문서 전체 출처 선택·저장·고정 조회 소스 결과

## 판정·범위
기존계약소비의소스·합성DOM검수인수다. 실제DB·served브라우저·사용자인수/전체FN03완료는미검증이다. 서버checkpoint943083a5의4종sourceRefs 저장·보호GET를이어서같은branch codex/av3-fn03-document-sources에서UI8파일만단일Primary가구현했다. Main은검수·통합을소유한다. 기준WI045ddb166d2f857b432934c6f2542c0584fe4b4165a2c0aa8c0e09ba3cc273fd.

## 동작과 기존 경계
실제문서/발언/지시·보관import READY UTF-8텍스트≤2MiB 보호조회에서고정SourceRef를선택한다. 버전/hash/실지시종류를확인하며수기UUID/hash를정상흐름으로대체하지않는다. 편집content.sourceRefs→pending고정사본→원save/hash→고정GET의content/별도sourceRefs동일성을연결했다. old[]는유지하고새비빈refs에서는분리열을필수로검산한다.

저장원ref를부모state에먼저반영한후layoutEffect에서후속GET을시작하며실패시원ref/출처/pending을보존한다. UNKNOWN은같은원packet만명시재확인하고재upload/추가save를자동실행하지않는다. 주체/client/CSRF/transport/generation·외부buffer A→B→A·선택ABA/late401/후행파일GET을차단한다. SourcePicker에는기존Editor epoch를전파하고자기입력/자식변경은managedChange로기록해불필요리셋을피했다. 식별자는details에서명시확인하고원문은클릭때만읽는다.

## RED·보완·오류 이력
- 최초RED49e601 exit1/2FAIL:고정GET DOCUMENT_REFERENCE_CHANGED·편집비빈refs412. API/helper후bc8850 2PASS.
- 완료CAS REDb983c0 exit1:마지막부모CAS거절뒤외부buffer A/B/A에서옛onSaved GET1이발생. completed에원epoch를고정하고layoutEffect의epoch/CSRF대조로폐기해dafc41 선택1PASS,최종집중에도포함했다.
- buffer선택ABA는보완후직접GREEN이며선행RED로과장하지않는다.
- 치환문법7c20ac,중간refs누락ca8b63,virtualentry e491ff,중복key/loading d90b37,crypto대기전클릭7a8ad0은준비/초안오류로분리보정했다. 최종타입중신규시험header string|undefined1건은실존재assertion으로보강했다. 기존시험/기대값삭제·완화0이다.

## 실제 명령과 결과
node --test tests/unit/UI06/document-source-refs.test.ts tests/unit/UI06/document-source-refs-ui.test.ts
최종f26cc9/session94935→5fa403 exit0:13PASS/skip0. 선택CAS1은이13에포함하며합산하지않는다.

node --test tests/unit/UI06/editor-api.test.ts tests/unit/UI06/document-upload-approval.test.ts tests/unit/UI06/stage-document-draft.test.ts tests/unit/FN03/document-record-provenance.test.ts
1423b8 exit0:26PASS/skip0.

npm run typecheck:최종exit0(5fa403). git diff --check/지문2d99ff exit0.
Main Web 메모리build98ce5e: node --input-type=module -e "const {build}=await import('vite');await build({configFile:'apps/web/vite.config.ts',build:{write:false}})"
520modules/1.28s/exit0. 제품지문은이build뒤불변이며typecheck는Primary와중복실행하지않았다.

## 동결과 독립 검수
UI8 정렬rawmanifest8ba74061da2b64328ed8e69d02e1b23b24c594a60b4e0706224ef08f11a9190e,서버5 manifest18f6897743fc9507e0b9ee7b4968173f718df0d25db963396fbf8936dbfdd584 불변/writer반환/live0이다. 독립cb5d1a/224494는8개별지문과manifest동일/C0/I0/M0를확인했다. 독립시험은재실행하지않고Primary/Main실행증거와읽기판정을분리한다.

## 남은 범위·확인 경로·복구
코드상S06의문서작성→문서전체출처종류/목록→원문확인/추가→새초안버전저장→고정문서출처보기순서다. 현재서비스반영/실로그인브라우저검수는하지않아실행URL이나실사용가능완료를주장하지않는다.

새endpoint/공개SourceRef필드/권한·DB/migration·키·서비스·Agent·실자료조사0. 일반파일전체목록·바이너리자료·자동대화역조회·항목별attribution/evidenceRefs를지원한다고하지않는다. import/proposal의별도상세sourceRefs는미채택후보로분리돼이화면저장완료로대체하지않는다. 다음은검증된변경게시/PR필수검증/main/merged한정smoke/정리와계획의다음미완료작업이다. 회귀시이업무소스변경을정상revert하고원문·이전기록을보존한다.

## main 통합 후 한정 확인
PR68 sourcec85fee824200e4def9c0a16f5e8127425bbd9dc1는Broker42433973928 success로main339fdad926f9a0ad2593cfe75dd71758cda9d2c3에통합됐다. parentef933a87/source·merge tree5a137984c891ca29123008efb66f46fc1667e814동일,Mainc440bf정상FF후집중서버+UI29PASS/skip0/exit0(6125.7082ms)로검산했다. 2654f8에서main동일·clean/완료remote branch·tag부재/PR68복구ref확인뒤2cad00의정상-d/-dr로정리했다. 실제DB/served/전체계획완료를증명하지않는다.
