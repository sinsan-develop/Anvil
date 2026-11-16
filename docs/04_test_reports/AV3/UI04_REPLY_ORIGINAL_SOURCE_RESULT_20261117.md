# UI04 답글의 원 발언 조회 결과

작업대에서 보호 조회를 마친 답글의 **답글의 원 발언 열기** 버튼을 누르면 현재 목록에 없는 원 발언도 같은 대화에서 읽을 수 있다. 조회 대상은 읽은 답글의 `message.replyTo`에서 복사하며 호출자가 임의 참조를 전달할 수 없다. 기존 API가 대화·원 참조·본문 바이트·내용 해시를 검산하고 reader가 더 앞선 서버 순번을 확인한 뒤 표시한다. 원 발언은 사용자 발언과 사용자 지시 모두 가능하다.

기준 branch는 `codex/av3-normal-sdk-producer`, 시작 commit은 `bf324138ecb6e5903b2b64244edfe50aef63d775`, WI SHA256은 `1B90D66DAAD234FAC6B6477E31C475E47582CE7ACCA77E1EB491409B3AACC69F`이다. 시작 때 Main의 신규 WI만 미추적이었다.

|변경 파일|SHA256|변경|
|---|---|---|
|`apps/web/src/features/workspace/WorkspaceConversationSources.tsx`|`39514C6B60F94B09D29F675377E4D9788039014A4F988861B7CCAC15ACB5436B`|답글 원문에서만 명시 버튼 표시. 기존 정정 버튼과 별도 연결.|
|`apps/web/src/features/workspace/workspace-conversation-reader.ts`|`FCBF1489BA0D209273404EB8EE63B72244FB328AB4C7356DE97B162BF123CD64`|`replyOriginal()`이 기존 조회 상태·오류·인증 콜백·해제 처리와 `readConversationMessage`를 재사용.|
|`tests/unit/FN09/workspace-conversation-read.test.ts`|`C557F3A4035FBD066FC459870918EBF36F651DFCC40906DF7CD075F175CEAB6F`|정상/거절·해제·중복 클릭 및 실제 ReactDOM 메모리 버튼 검증 추가.|

제품·시험 diff는 139줄 추가, 1줄 삭제다. API·서버·저장 형상·권한 변경은 없다.

## 실행 근거

|명령|결과|
|---|---|
|`node --experimental-strip-types --test --test-name-pattern='답글에서 목록 밖' tests/unit/FN09/workspace-conversation-read.test.ts`|제품 수정 전 1f1ce9, 1 FAIL/exit 1. reader 메서드가 없었다. 수정 후 144964, 1 PASS/exit 0.|
|`node --experimental-strip-types --test tests/unit/FN09/workspace-conversation-read.test.ts`|RAM UI 시험 추가 직후 7a704c, 8 PASS/1 FAIL. 메모리 빌드의 가상 entry 경로를 기존 Vite RAM 방식과 맞췄다. 최종 d61d7e, 9 PASS/0 FAIL/0 SKIP, exit 0.|
|`node --experimental-strip-types --test tests/unit/FN05/conversation-reply.test.ts`|인접 기존 답글 API 회귀 e0f1b7, 3 PASS/0 FAIL/0 SKIP, exit 0.|
|`node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false`|05bc58 → 1ce3d1, exit 0, 진단 0건.|

정상 클릭 시 목록·답글 원문을 읽은 세 요청에 원 발언 GET 한 건만 추가됐다. 원 발언을 표시하자 대상 버튼이 사라졌다. 참조 부재·pending 재진입·해제 후 재사용 시 추가 GET은 0건이다. 다른 대화, 다른 참조 해시, 본문 변조, 동일/뒤 순번, 403·401·연결 실패는 이전 원문을 지웠다. 활성 401만 인증 콜백 한 번을 호출했고 dispose 뒤 늦은 200·401의 상태·콜백 반영은 0건이었다.

메모리 ReactDOM·모의 HTTP 응답과 메모리 Vite 빌드를 사용했다. 실제 운영 브라우저·DB·권한·키·서비스·사용자 자료·CLI/SDK/Agent/C# 실행은 0건이다. 사용자 인수는 미검증이다. 시험에서 생성한 React root와 MessageChannel을 정리했고 실행 세션은 모두 종료됐다. 복구는 이 UI04의 제품·시험 차이만 기준 commit과 대조해 되돌리는 범위다. Main이 작업현황·Git 통합을 관리한다.
