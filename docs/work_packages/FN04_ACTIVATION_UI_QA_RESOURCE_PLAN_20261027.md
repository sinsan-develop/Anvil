# FN04 실제 App 합성 UI QA 자원 등록

2026-10-27 · Main 어울 · WI69EF/직접승인CF12의 UI 연결 검수 범위. 실서버/DB/Agent·사용자 브라우저·Secret 변경0.

- literal root: D:/tmp/anvil-v3-stage-b/fn04-activation-approval-ui-20261027-01 / owner SINSAN/cyhuh. 허용 하위는 temp/browser/results만. Main980f36 root부재·부모 D:/tmp/anvil-v3-stage-b owner/nonlink를확인했고생성직전재확인한다.
- 최초생성부터30분,검수전체10분/단일Node test60초/browser launch15초·locator3500ms/retry0·worker1. 설치Edge/headless1920×1080·독립전용profile, TEMP/TMP=root/temp. 실제사용자브라우저/인증서신뢰·OS권한을바꾸지않는다.
- ENV ANVIL_FN04_ACTIVATION_APPROVAL_DOM_QA=1에서 node --test tests/browser/UI07/design-activation-approval-dom.test.ts. 실제App/defaultApiClient/nativefetch·dummy https://anvil.invalid:3830의정확same-origin route.fulfill만허용·예상외요청abort/pageerror0. Vite write:false/기존styles2 메모리적용·실API/DB접속0이다.
- RED는기존세션·변경조회원문/hash성공뒤신규적용준비버튼부재여야한다. bootstrap/fixture오류는기능RED로세지않는다. 제품GO는RED자원의exact정리/독립부재후다. GREEN은같은literal의별도새빈instance/새생성시각으로등록하고남은RED폴더를재사용하지않는다.
- 정상GREEN에만 results/ui07-fn04-activation.png와results/ui08-fn04-activation-approval.png 2개를허용한다. trace/video/추가캡처·다운로드0. 해당영역/viewport를확인하고지문으로검수자료에보존한다. RED가해당단계미도달이면PNG0이다.
- 성공/실패모두context 종료→해당root/test명만의Node/Edge관련process0→fresh absolute root/최초생성시각·owner/link/reparse/파일inventory검사→자기파일개별Remove-Item·빈dir비재귀삭제→별도process/경로부재를확인한다. 원실패/명령exit·개별회수counts/bytes를기록하고불명/owner불일치는보존한다. 공유processkill/전역정리/recursive delete·ACL변경0이다.

## I1 controlled 승인 화면 RED 추가 등록

같은 literal은 앞선 인스턴스가49a61f에서완전회수된상태다. 새생성시각/빈root로 controlled 실제ApprovalsPage의문맥교체반례case만 --test-name-pattern으로한번선택한다. 새공유서비스/서버0·실제DB/Agent0, 기존App정상case는이RED에서선택하지않는다. root/temp/browser/results·owner·30분/시험60초/전체10분·retry0·exactcleanup/별도0은그대로며추가PNG/다운로드/trace/video0이다. 해당반례는제품수정전Fail→정리후같은담당최소수정→최종새빈GREEN인스턴스에서검수한다.
