# FN07 두 번째 SDK 공개 원문 단발 조회 결과

2026-11-16. 시도 키 `FN07-REMAINING-SOURCE-20261116-D2E41B78`. 실행본 SHA-256 `1FF47992464E32B69C00BDA1AEFB761848634EAD4D4EB65837B646521820F529`, 후보 SHA-256 `D2E41B784F6AB8A842BB543221DFCBC4EA60396F62397F177A5545C229A3EB7F`.

## 실행 증거

검토된 PowerShell 블록의 승인 지문 자리만 치환해 Windows에서 한 번 실행했다. 도구 기록 `8aa1c8`, 종료 코드 0, 경과 1.351176초. 감독부 결과는 `WINDOWS_READ_VERIFIED_SOURCE`, `attempted=true`, `getCalls=1`, `requestClosed=true`였다. 회수할 실행 핸들은 0개다. 요청 한도 10초, 전체 30초, 해제 16 MiB, 표준출력 64 KiB, 표준오류 2 KiB를 적용했다. 재조회·리디렉션·SDK 설치·디스크 원문 저장·SDK import/eval/실행은 0회다.

| 대상 | 바이트 | 검산 지문 |
|---|---:|---|
| 고정 배포 압축본 | 1,110,841 | SHA-512(Base64) `a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==` |
| 해제된 tar | 4,056,576 | 고정 압축본에서 메모리 해제 |
| package/sdk.d.ts | 333,809 | SHA-256 `556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575` |
| package/sdk.mjs | 1,145,192 | SHA-256 `70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5` |

각 파일 시작 기준 UTF-8 바이트 오프셋이며 끝값은 제외한다. 반환된 연속 구간은 선언 파일 [8399,10980), [87981,88400), 구현 파일 [769160,771249), [773100,785447), [787615,790825), [793277,796568), [800939,803653), [1128600,1134300)이다. 선택된 8구간 32,351바이트를 확인했다.

## 확인 범위

| 항목 | 연속 구간과 확인한 동작 |
|---|---|
| 도구 권한 콜백 선언 | sdk.d.ts [8399,10976)에서 `CanUseTool` 전체를 확인했다. 인자는 도구 이름, 입력 객체, 옵션이다. 옵션에는 필수 signal/toolUseID/requestId와 선택 suggestions/blockedPath/decisionReason/title/displayName/description/agentID/matchedAskRule이 있다. 반환형은 `Promise<PermissionResult \| null>`이다. [87981,88396)의 전체 PermissionResult에서 allow의 updatedInput/updatedPermissions는 선택이고 deny의 message는 필수, interrupt는 선택이다. 양쪽 모두 toolUseID/decisionClassification이 선택이다. |
| 콜백 결과 소비 | sdk.mjs [794796,795620)에서 can_use_tool 요청의 이름·입력·요청 식별자·취소 signal과 부가 정보를 콜백에 넘겨 기다린다. null은 내부 표식으로 바뀌고 결과 객체에는 원 요청의 toolUseID가 적용된다. [793780,794659)에서 중복 진행 요청을 걸러 내고, 정리됐거나 내부 표식이면 응답 송신을 생략한다. 그 외 정상 반환은 원 request_id로 success control response에 담아 기록한다. 예외 시 정리 여부에 따라 error 응답을 쓴다. 이 구간에서 CLI가 allow/deny를 집행하는 장면은 관찰되지 않았다. |
| Query에서 프로세스 입력까지 | sdk.mjs [1130362,1132636)에서 선택된 환경 또는 process.env를 복사하고 조건부 SDK·인증 관련 환경 등을 적용한 뒤 실행 옵션과 hook을 transport 생성자에 전달한다. [1133066,1133107)과 [789353,789456)에서 같은 transport와 콜백 변수 R이 Query 객체에 전달·보관된다. [774946,780423)에서 cwd·executable·executableArgs·extraArgs·path·env와 SDK 제어 옵션이 argv 조립에 쓰인다. [770010,770387)는 sandbox 설정 처리, [770387,770501)는 대시로 시작하는 인자값 처리, [784584,784667)는 스크립트 경로 접미사 판별이다. [778920,779367)에서 스크립트 분기는 executable을 command로 하고 경로를 args에 넣으며, 다른 분기는 경로 자체를 command로 사용한다. 같은 지점에서 command/args/cwd/env/signal 객체를 hook에 넘기거나 기본 spawn 분기를 택한다. |
| hook 반환 자식 소비 | sdk.mjs [778920,779367)에서 동기 hook 반환 또는 기본 spawn 결과가 this.process에 들어가며 stdin/stdout을 읽는다. [779681,780423)에서 그 객체의 error/exit 이벤트로 준비·종료 오류 상태를 갱신한다. 선언과 코드의 사용 지점까지 확인했다. 실제 자식 프로세스 생성·OS 소유·종료·SDK가 명령을 수락한 사실은 측정하지 않았다. |

마지막 구현 구간의 시작점은 상위 옵션 구조분해 중간이며 transport 구간의 시작점도 클래스 정의 중간이다. R과 env/cwd/executable 관련 축약 변수의 **공개 옵션부터 이어지는 전체 별칭 선언**은 미확인이다. 선택된 구간의 객체 전달과 소비를 근거로 공개 Query 진입점 전체, 실제 환경값·환경 허용목록, 사용자 정의 hook의 stderr 배수, 도구 실행 승인 또는 권한 통제를 확정할 수 없다. 이번 결과는 고정 배포본의 원문 조회 증거이며 실제 SDK·Agent·DB·서비스 동작은 미검증이다.
