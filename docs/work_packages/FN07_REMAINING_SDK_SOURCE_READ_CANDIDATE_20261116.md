# FN07 남은 SDK 공개 원문 기술 확인 후보

상태: 직접 승인 전 실행0. 앞선 읽기 승인과 시도는 재사용하지 않는다. 이번에는 기존에 확인한6구간을 다시 합격시키는 대신 미확인 계약의 전체 근거를 확인한다.

## 정확 대상

- Anthropic Claude Agent SDK 고정0.3.224 공개 tarball URL: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz
- HTTPS GET 최대1회, redirect/재시도0. 압축물1110841B와 원 SHA512 a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==를 검산한다.
- package/sdk.d.ts 333809B/SHA256 556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575와 package/sdk.mjs 1145192B/SHA256 70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5만 읽는다.

## 남은 확인 항목

1. CanUseTool의 온전한 함수형·입력·반환/Promise·allow/deny 응답 형상과 실제 소비 분기.
2. query 생성 경로의 argv/env 조립, 각 값의 출처와 spawn hook에 넘기는 정확 입력. 가장 가까운 문자열을 같은 실행 분기로 가정하지 않는다.
3. hook 반환 child의 실제 사용·stdio/종료/오류 전달과 원 Query의 연결. 사용자 PC의 실제 Agent 실행파일이나 계정은 조사하지 않는다.

## 실행과 한도

- 승인 뒤 기존 담당자 한 명이 기존 Windows-local 감독 방식을 사용한다. 고정 Node 경로/버전/hash와 제한 환경·부모 소유 Process handle 검산을 유지한다. 기존 실행안의 hash/한도와 이번 승인 식별자를 결박한 실행 코드를 먼저 Main과 읽기 검수자가 대조한다. 실제 SDK/Agent가 아닌 공개 바이트 조사용 Node만 사용한다.
- 요청/소켓10초, 전체 조사 실행30초, 메모리 압축해제16MiB, stdout64KiB/stderr2KiB 상한. 해제 상한은 OS/JS 전체 메모리 상한을 뜻하지 않는다. SDK tar·원문은 디스크에 쓰지 않고 문자열·바이트로만 다룬다. import/eval/SDK 호출·설치0이다.
- 같은 단1회 GET의 메모리 원문에서 위 항목의 전체 선언/분기와 연결되는 별칭/값 출처를 우선 추출한다. 기존처럼 원문 창이 잘리거나 연결 근거가 빠지면 해당 항목은 미확인이다. 한도 때문에 미확인인 부분을 성공으로 승격하지 않는다. 새 fetch로 보충하지 않는다.
- 실패/결과 불명은 자동 재실행하지 않고 소비·오류를 기록한다. 실제 사용자 파일·권한·키·DB·서비스·Agent 실행과 환경 변경은 제외한다. Main의 WORK_STATUS·비밀 없는 기술 결과 기록은 허용 범위다.

## 승인으로 정해지지 않는 부분

읽기 결과는 기술 사실의 근거다. 실제 실행 허용, 보호 실행구성의 제품 정책, 동일 child의 권위·인계/회수 계약, 유료 호출이나 Agent 작업 실행은 승인하지 않는다. 확인된 사실을 바탕으로 필요한 제품 결정을 별도 구체화한다.
