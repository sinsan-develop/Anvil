# FN07 고정 IMAGE argv와 환경 판독 준비

상태는 준비 중이다. 추가 HTTPS 조회는 승인되지 않았으며 실행은 0회다. 이 문서는 기존 1회 조회안을 재사용하기 위한 범위를 고정한다. 판독 코드와 합성 검수의 최종 지문은 준비 후에 기록한다.

## 기존 증거와 공백

2026-11-16의 공개 조회 8aa1c8 및 query-chain ea54d0은 sdk.mjs의 같은 고정 지문에 연결된다. 보존 출력에는 argv [775501,777091), [778926,780396), 환경 [1130362,1132552), [1132637,1133487)와 공개 옵션/생성 함수 연결이 남았다. 원 메모리 stdout의 두 키는 현재 세션에 없다. 이 범위만으로 단일 조합의 최종 인수 순서와 환경 전체를 확정할 수 없다.

## 판독할 한 조합

SDK 0.3.224 공개 query에 AsyncIterable prompt, 원 AbortController·sessionId·model, 보호된 명시 cwd와 env, 고정 IMAGE의 명시 실행 경로, 빈 executableArgs와 원 동기 spawn hook·도구 deny callback을 제공하는 경우다. 원 Options에 maxTurns/maxBudgetUsd가 둘 다 없을 때로 한정한다. resume/continue/sessionStore·extraArgs·추가 인증·설정·체크포인트는 명시하지 않는다. 지원하지 않는 옵션이나 전파 환경을 기본값으로 추정하지 않는다.

aT [1127782,1133713), Qwt [1134208,1134421)과 transport initialize의 완전한 선언에서 hook 인수 객체까지를 같은 어휘 결박으로 대조한다. TM, SS, oye, be를 포함해 해당 분기의 argv/env를 바꾸는 직접 의존 선언만 확인한다. 정확 노드 범위와 해당 분기에 영향을 주는 환경 읽기·기본값·가림·추적/auth/DEBUG/secure storage 설정·삭제를 기계적으로 추출한다. 추출 결과와 정적 해석을 분리하고 미해결 직접 의존, 조건, 가림, 분석 한도 또는 비연속 출력이 있으면 그 부분을 미확인으로 기록한다. 실제 운영 환경 경로나 값을 사용하지 않는다.

## 별도 조회 결정 및 한도

공개 URL은 기존 고정 실행안의 [SDK tarball](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz)이다. 압축 1,110,841바이트, SHA512 Base64 a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==. 추출된 sdk.mjs 1,145,192바이트 SHA256 70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5, sdk.d.ts 333,809바이트 SHA256 556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575가 모두 일치해야 판독한다.

새 직접 승인과 승인된 스크립트 지문 확인 후에만 기존 Windows-local 고정 감독에서 HTTPS GET 1회, 요청 10초, 감독 27초와 종료 회수 3초, 해제 16MiB, stdout 64KiB/stderr 2KiB를 적용한다. 리디렉션과 재시도는 0이다. 사전 검사 실패의 GET 0은 기존 감독과 child 결과가 모두 일치할 때만 확정한다. 불명·잘림·실패도 시도를 소진하며 원 핸들 회수 상태만 남긴다. SDK 설치·import/eval/query·실제 Agent·OS 보호자원·DB·권한·키·서비스 접근은 제외한다.

결과는 원문과 실제 값 없이 입력 조합, argv 토큰과 순서, 환경 키별 유지/추가/삭제 조건, 근거 UTF-8 범위와 파일 지문, 미확인 의존성과 발행 가능 여부를 보존한다. 최종 recipe에 반영할 수 있는 조합은 각 변환을 입증한 경우만 해당한다. 이 결과는 PRESPAWN, 원 현재 witness 또는 child 소유·실행 허가를 제공하지 않는다.

## 준비 검수

실제 조회 전에 새 판독 코드의 경계/출력 누락/한도/파싱/취소/무결성 실패를 기존 보존 발췌 및 합성 자료로 확인한다. GET은 0회로 유지한다. 평가가 끝나면 정확 소스 지문, 검수 결과 및 실제 필요한 GET 1회의 차이를 PMO에 전달한다.
