# FN06 기존 slot 수용 증거의 읽기 조사

2026-11-04 · Main 어울 · 읽기 전용 지원 · 코드/시험/SQL 쓰기0

Primary는 S2 저장·quota를 구현 중이다. 별도 읽기 담당자는 S4 연결에 필요한 기존 slot의 실제 관측 가능 동작만 조사한다. 일반적인 slot.accept(void)가ACK가아니라는부모설계검토를반복하지말고현재함수/호출선/공개메서드/실제private상태변화를구체적으로확인한다.

실재확인경로 apps/connector/runtime/native-preparation-credential-slot.ts와그실제caller/기존시험을rg --files와정확심볼로따른다. 승인된새client파일이아직없으면미작성으로구분하고결함으로세지않는다. 실제키/NativeHelper/서비스/DB/Agent/시험실행은0이다.

질문: 새receiver가실제기존slot을공급받아opaque43을단발수용한뒤,credential을공개하지않고SlotReceipt를생산할실제근거가현재메서드/생산자에있는가? accept호출만기록한bool대역으로닫으면안된다. 아직server CONFIRMED가필요한challenge/consume을수용증명의선행조건으로다시요구하면ACK순환이된다. 정확한메서드·실제상태변화·경계예외/기한검산·원current공급선으로가능여부를반환한다.

허용56밖의기존slot파일수정이꼭필요하다면현재authority/opaque/purpose/권한의미를바꾸지않는최소private관측접점인지,새공개/서명권한이필요한지구분해Main에게제안한다. 직접파일수정/Primary에게수정지시/추가사용자승인요청은하지않는다. Main이실제근거와최소delta를판정한다. 작성중S2를중단시키지않는다.


## 조사 결과와 Primary의 S4 접점

실제기존slot을receiver가직접생성·소유하고원메서드identity를고정하면,accept정상종료뒤같은instance.getChannel()성공으로private secret/delivery 실저장·미종료/미만료·시계후퇴없음·source binding/함수불변을확인할수있다. 기존source:35~36의실제복사저장과:29~30,38의private생존검산이근거다. getChannel 자체는current/challenge/consume·서명·네트워크호출0이다. 임의주입slot/성공bool대역으로동일근거를주장하지않는다. 메서드receiver를잃지않고같은실제instance의원메서드를호출한다. 이를이유로허용56밖slot파일의새관측API를추가할필수근거는현재없다.

getChannel은source.read를호출하지않으므로최신보호current/profile/signer기한까지증명하지않는다. 이검산은실제보호producer에서별도로수행한다. 기존owner.createNativeProofSource의read는currentSource.read로authority/등록/설치/subject/profile·phase RESERVED·기한을검산하며consume을요구하지않는다. 그러나실제shell조립caller/실제source공급은읽기조사에서확인하지못했으므로S4에서실제호출선으로닫아야한다. ACK전에channel.current/challenge/consume를호출해공백을메우지않는다. 아직없는공급을bool이나가짜current로대체하지않는다.

## 현재 후속 읽기 지시 단계2

기존native-preparation-routes/current-source와실제runtime owner/entry caller에서ACK이전owner.read의currentSource를공급할보호HUMAN조회/내부producer가현재있는지정확히조사한다. 파일은rg --files로실재확인하고이미한slot수용상태조사/기존시험을반복하지않는다. 새로운public endpoint/필드/권한이필요하다고판단하면현재소비/부재근거와최소delta만Main에게반환한다. 존재하지않는route나서버bool을실제공급이라고해석하지않는다. 아직S3/S4미작성은현재코드결함으로세지않는다. 코드/문서/SQL쓰기·시험실행·실제서비스/DB/키/Agent접근0이다.
