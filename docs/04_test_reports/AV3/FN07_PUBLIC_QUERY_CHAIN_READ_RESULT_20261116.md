# FN07 공개 query에서 생성 함수까지의 원문 판독 결과

**고정 SDK 0.3.224의 일반 분기에서 공개 query의 옵션 전달과 반환 객체를 정적 원문으로 연결했다.** 선택한 첫 SEND를 AsyncIterable로 전달하는 경우와 관련된 경로다. 실제 호출·도구 허가·child 소유는 검증하지 않았다.

## 단발 실행

- 시도 `FN07-PUBLIC-QUERY-CHAIN-20261116`. 직접 승인된 후보 SHA-256 `8A63AC9887635F3F1C82D15CDCE306797F17E7006D77F1E8C3A52E8DF1ADF384`를 확인하고 고정 PowerShell 블록의 지문 자리만 치환했다. 실행 기록 `ea54d0`, exit 0, 경과 1.88428초, 잔여 핸들 0개.
- `WINDOWS_READ_VERIFIED_SOURCE`, `attempted=true`, `getCalls=1`, `requestClosed=true`. 불명 종료·재발행 0회. 압축본 1,110,841바이트 및 고정 SHA-512 일치, 해제 tar 4,056,576바이트. 요청 10초·감독 30초·해제 16 MiB·stdout 64 KiB·stderr 2 KiB 한도 안에서 종료했다.
- sdk.d.ts 333,809바이트 SHA-256 `556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575`, sdk.mjs 1,145,192바이트 SHA-256 `70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5`. 로컬 고정 파서로 메모리에서 읽었다. SDK 원문 파일 저장·설치·import/eval·실행은 0회다.

## 공개 진입과 일반 분기

오프셋은 각 파일 시작 기준 UTF-8 바이트 반열림 구간이다.

| 근거 | 확인한 값의 흐름 |
|---|---|
| sdk.d.ts [107552,107681), sdk.mjs [1144580,1144592) | 선언은 인자 객체 하나를 받는다. prompt는 string 또는 AsyncIterable<SDKUserMessage>, options는 선택 Options, 반환은 Query다. 구현 모듈은 Qwt를 query로 내보낸다. |
| sdk.mjs [1134208,1134421), 직접 호출 [1134355,1134399) | Qwt는 원 prompt를 e, options를 t로 받는다. resume 또는 continue와 sessionStore가 함께 지정되면 CMe(e,t)로 분기한다. 나머지 경로에서 aT는 같은 t와 ‘e가 문자열인지’ 플래그를 받는다. Qwt는 aT 반환에서 queryInstance r, transport n, abortController o를 꺼내 cT(r,n,e,o)를 호출하고 **그 r을 반환**한다. cT에는 원 prompt가 전달된다. |
| sdk.mjs [1127782,1133713), 구조분해 [1128140,1129034) | aT의 첫 인자는 Qwt의 options다. 일부 옵션을 분리한 나머지 p에서 canUseTool→R, cwd→ee, env→st, executable→Oe(기본 bun 또는 node), executableArgs→je(기본 빈 배열), extraArgs→xt(기본 빈 객체), sessionId→FG를 얻는다. model, maxTurns, maxBudgetUsd도 같은 구조분해에 있다. |
| sdk.mjs [1130049,1130080), [1130411,1130441), [1131762,1132636) | 실행파일 경로 변수 rg의 초기 원천은 p.pathToClaudeCodeExecutable이다. Gt는 st가 있으면 그 복사, 없으면 process.env의 복사에서 시작한다. 이후 조립된 Gt, cwd·실행기·인자·경로와 p.spawnClaudeCodeProcess를 transport 생성자에 전달한다. canUseTool의 존재 여부는 !!R로 전달한다. |
| sdk.mjs [1133066,1133107), [1133643,1133712) | 같은 transport xT와 콜백 R을 사용해 Query 객체 og를 만든다. aT는 og, xT, g를 각각 queryInstance, transport, abortController로 반환하며 processEnv도 포함한다. Qwt의 일반 분기 반환과 이어진다. |

aT에는 자식용 환경 복사에 앞서 **호출 중인 Node의 process.env.CLAUDE_AGENT_SDK_VERSION에 버전을 대입하는 코드**도 있다(sdk.mjs [1128090,1128136)). 구성 검산을 위해 실제 query를 시험 호출하면 이 동작을 수반할 수 있다. 이번 판독에서 이 코드는 실행되지 않았다.

## 확인 한계

전체 AST에서 Qwt·aT 이름에 대한 결박 후보 위치는 원 선언 두 곳 [1134217,1134220), [1127791,1127793)으로 반환됐다. 추가 write/update/가림 위치 보고는 0개, positionsIncomplete=false, issues는 비어 있다. 판독기는 어휘 scope의 동일성이나 동적 재결박 부재를 증명하지 않으므로 bindingIdentity=UNCONFIRMED와 수동 검토 표시를 유지한다. 이 보고서의 연결은 반환된 완전한 함수 본문의 일반 분기에서 직접 확인한 정적 값 흐름이다.

CMe의 별도 복구 분기와 cT의 내부 구현·입력 소비 시각은 이번 선택에 포함되지 않았다. 이전 단발 결과가 확인한 spawn hook 및 CanUseTool 반환 소비는 그 결과서의 범위를 유지한다. 실제 SDK 입력 yield, 보호 현재성·실행파일/cwd 신원, 허용 환경·Secret·도구 효과, CLI의 허용/거절 집행, 실제 Query/child/SID 결박이나 OS 종료에 대한 신규 증거는 없다. [이전 hook·콜백 결과서](FN07_REMAINING_SDK_SOURCE_READ_RESULT_20261116.md)
