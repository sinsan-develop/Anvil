# UI06 가져오기 원문 업로드 승인 연결 검수

## 최초 검수 판정

독립 read-only C0/I1/M0 REWORK. 업무카드658BFE36·baseline1407c9c8·담당7파일 고정SHA를대조했다. 기존CREATED_ORIGINAL 함수/분기·PNG target/API는불변이며원bytes/명령결박·현재정책/제어/기한재조회·후속importDocument approvalRef:null·receipt뒤재진입은연결됐다. 실제실행PASS상속0이다.

## I1 — 승인 요청 중 후보 닫기로 미확인 명령 유실

위치 DocumentImport.tsx:71/73, ImportUploadApprovalEditor.tsx:18,23~27. 최초업로드APPROVAL_REQUIRED412 failure는승인요청중에도남고, child onBusy는부모running.current만변경한다. 부모닫기버튼은busy만검사해활성이며 importState:null로원command/bytes·request.pending/uncertain을지울수있다. 요청응답유실후에도같은문제다.

최소보완은요청실행중/pending/uncertain에서닫기표시·실행을함께차단하고원상태를보존하는것이다. 확인된요청의명시닫기는요청ID·서버이력보존/자동취소아님을구분해야한다. 새archive공개계약이나무조건영구잠금으로우회하지않는다.

Main은원담당round1 TEST-ONLY를발행했다. 기존spec22/기대·timeout/제품동결을보존하고POST지연·응답유실뒤닫기반례2개를추가한다. 실제QA경로는사전등록만했으며생성/실행0·부재확인이다. Main실제RED와정리후제품최소보완GO,같은반례GREEN·한정재검수전인수0이다. 실제DB/서비스/권한/Secret/Agent변경0이다.

## round1 보완 인수

원 I1 정적 해소·C0/I0/M0. Doc58~67/81/83의 별도approvalBusy·running·pending/uncertain이 표시/handler 닫기를 모두 차단하며 자식이 자기disabled를 재귀 변경하지 않는다. 확인된 요청은 ID/서버이력유지·취소아님을 알리고 확인 뒤 같은 state/epoch/pending을 재검사한다. 원입력과 비동기 표시 권한을 복구하지 않으며 새 archive 계약은 추가하지 않았다. 검수자는 2SHA·나머지5·기존19846prefix/CREATED_ORIGINAL 불변을 확인했고 실행/변경0이다.

Main 전체25GREEN·정확 정리/별도0은 ROUND1_GREEN_RESOURCE에 보존했다. 이는 실제 컴포넌트·합성 API 범위이며 실제 서버/DB 이력 보존·사용자 인수를 증명하지 않는다. 원 실패와 locator 인프라오류는 소급하지 않는다.
