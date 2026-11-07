# FN07 — 고정 Claude SDK 메시지 정규화 source 작업지시서

## 1. 목적과 범위
WORK_PLAN FN07의 두 번째 기존 코딩 Agent 연결 중, 공급자 객체 입력·출력을 Anvil의 미전송 준비/관측 사실로 분리하는 내부 codec을 구현한다. 기존 Codex 전용 codec을 재사용하거나 태그만 바꾸지 않는다. 실제 transport·6함수 전체·실제 다중 Agent 연결을 완료했다고 하지 않는다. 기존 Primary 한 명이 구현하고 Main은 관리·검수·통합, 기존 Reviewer는 읽기 전용이다.

이는 승인 계획 안의 내부 기술 기준 선정이다. 새 공개 API/DB/권한/비용 계약을 채택하지 않는다. 사용자 자료·백업 대상 조사, SDK/CLI import·Agent 실행, 실제 계정/인증·키/DB/권한/서비스 변경, provider 활성화는 제외한다. 실제 연결 방식/인증·비용·지원 등급은 이 작업으로 확정하지 않는다.

## 2. 고정 근거와 현재 상태
- 시작 branch `codex/av3-stage-b`, HEAD `c1ae34f6e21972900d8fc1d4d1f65e1104120264`; 기존 보호 untracked3과 모든 완료 source 보존.
- 정본: FUNCTION_WORK FN07(88~97), INTERFACES §12.1/12.3의 Anvil/외부 정체성 분리·6함수·UNKNOWN/UNSUPPORTED, CAPABILITIES §4/6. 후보 선택/실제 지원과 source 프로토콜 기준 선정을 구분한다.
- 공식 npm `@anthropic-ai/claude-agent-sdk@0.3.224`: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz
- tarball SHA512 `a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==`; 공개15파일·해제4,044,204바이트. package의 `claudeCodeVersion:"2.1.224"` 명시를 메모리 읽기에서 확인했다.
- sdk.d.ts 333,809바이트 SHA256 `556277033B15112811922D84EC8DC846D446CCE7BD9AA27765C52A9C09869575`; sdk-tools.d.ts 150,397바이트 SHA256 `06ECC08894EA73CAFF97BF67B3F5F1CB633D545171C7E94FD613BA429B595A5E`. 필요한 선언은 sdk.d.ts에 있다. sdk-tools를 메시지 schema로 쓰지 않는다.
- SDK 객체 API를 기준으로 한다. 이것을 CLI stream-json/NDJSON·control wire 계약이라고 부르지 않으며 최신 SDK 문서나 설치 관측을 이 고정 버전에 소급하지 않는다. 공식 타입의 존재는 설치된 CLI 호환·실제 계정·중지/OS 회수 증거가 아니다.

## 3. 정확 허용 경로
신규 source/test3만 작성한다.
1. `apps/connector/adapters/secondary/schemas.ts`
2. `apps/connector/adapters/secondary/codec.ts`
3. `tests/unit/FN07/claude-sdk-message-codec.test.ts`

기존 primary/공통 DTO·서버·SQL·package/lock·환경 설정 수정0. SDK 패키지 설치/실행0. 새로운 transport 또는 범용 provider 추상화·공통화0. 정본/현황/결과 기록은 Main이 담당한다. 필요 파일 확장은 쓰기 전에 Main에게 정확 이유를 보고한다.

## 4. 입력·출력의 상세 요구
- 고정 SDK 객체의 사용자 입력 준비와 관측 메시지 정규화를 분리한다. 실제 전송·수신 ACK·서버 저장 receipt·재시도·세션 생성·중지·도구 승인 결정을 만들어내지 않는다. 내부 메서드 이름은 수행자가 정하되 시험이 실제 함수 동작을 검증해야 한다.
- 사용자 메시지는 SDKUserMessage의 `type:user`, `message`의 사용자 역할/텍스트 내용, `parent_tool_use_id:null`만 이 단위의 지원 대상으로 한다. SDK의 선택 uuid/session_id를 필수 공급자 필드로 왜곡하지 않는다. 정확한 호출자 기대 session/명령 식별·digest와 비교하고 다른 session/같은 식별의 다른 내용은 거절한다. 하위 tool 응답·임의 permission/control 메시지는 준비하지 않는다. 준비 성공은 `dispatched:false / executionAuthorized:false`다.
- 관측 지원 대상은 system/init, assistant, result(success 및 고정 error4분기), stream_event다. 필요한 envelope/식별/고정 판정 필드를 검증한다. SDK 타입의 모든 중첩 BetaMessage/usage/tool 구조를 완전히 검증했다고 주장하지 않는다. 중첩 내용은 부작용 없는 JSON/상한 대조와 digest 목적일 뿐, 검증하지 않은 필드로 권한·완료·파일/시험 진위를 판단하지 않는다.
- system/init의 공개 필수 선언: apiKeySource,claude_code_version,cwd,tools,mcp_servers,model,permissionMode,slash_commands,output_style,skills,plugins,uuid,session_id. assistant는 message,parent_tool_use_id,uuid,session_id; partial은 event,parent_tool_use_id,uuid,session_id. result 공통은 duration_ms,duration_api_ms,is_error,num_turns,stop_reason,total_cost_usd,usage,modelUsage,permission_denials,uuid,session_id이며 success는 result:string, error는 errors:string[]과 error_during_execution/error_max_turns/error_max_budget_usd/error_max_structured_output_retries다. 실제 고정 선언과 맞지 않는 가정은 구현 전 근거로 보고한다.
- Anvil 프로젝트/지식/임무 식별과 SDK session/uuid를 혼동하지 않는다. 호출자가 제공한 정확한 기대 session과 메시지 session을 대조한다. 미결박/불일치·누락·알 수 없는 type/subtype·지원하지 않는 분기는 UNKNOWN/UNSUPPORTED로 분리하고 업무 성공으로 승격하지 않는다. 특정 메시지 순서를 공식 근거 없이 가정하거나 과거 미확인 사실을 소급 확정/재생하지 않는다.
- 출력은 고정 enum/비밀 없는 오류 코드·digest·공급자 주장 여부만 사용한다. cwd/도구 설정/원문·사용자 텍스트/모델 답변/인증 표식을 일반 관측·오류에 담지 않는다. 필요한 외부 원식별은 명시 보호 포트 내부로만 전달하며 기본 공개 사실에는 digest만 사용한다. 보호 포트가 실패하면 성공 receipt를 만들지 않는다.
- 모든 출력에 실제 실행/업무 합격/소유권 미검증을 보존한다. actualExecutionVerified:false, executionAuthorized:false, workAccepted:false, ownership:UNVERIFIED 같은 기존 의미를 사용한다. SDK success/result·permissionMode를 Anvil 승인·완료·capability VERIFIED로 해석하지 않는다. 승인 응답/중지 제어는 미구현 또는 UNSUPPORTED이며 wire/실행0이다.
- 부작용 없는 평범한 JSON 입력만 지원한다. getter/toJSON/순환/BigInt/비정상 수·UTF-16·prototype/오염 키를 검토하고, 전체 문자열/복제 생성 전에 설정한 바이트 예산에서 중단한다. 객체가 이미 차지한 메모리·reflection/VM/OS quota까지 보장하지 않는다.
- 인스턴스 상한은 message 최대2MiB 이내의 유한 설정, 식별 기억 최대1024 이내다. 같은 식별/같은 내용은 중복 관측임을 구분하고 같은 식별/다른 내용은 거절/UNKNOWN이다. 수명 내 식별을 조용히 축출해 새 사실처럼 처리하지 않고 소진은 보이는 코드로 차단한다. 메모리 중복방지를 서버 durable at-most-once로 주장하지 않는다. 반환 객체 변경으로 내부 상태가 변하지 않아야 한다.

## 5. TDD와 검수
먼저 신규 시험을 작성하고 Main이 부재/기준 실패를 확인한 뒤 제품 구현한다. 신규3경로에는 기존 함수·caller가 없으므로 최초 import 부재는 초기 TDD 준비 RED로만 기록하며 실제 Agent/기능 실행 실패로 부르지 않는다. 구현 GO 뒤 실제 함수의 정상·음성 요구를 순서대로 구현·검증하고 자연스럽게 드러난 의미 있는 동작 RED→GREEN의 정확 원인을 제출한다. RED를 만들려고 의도적으로 결함·가짜 구현을 넣지 않는다. 정상 사용자 입력 준비/각 지원 envelope/기대 session 대조·중복/상이 내용/용량·식별 상한/비정상 객체/미지원 분기/보호 포트 실패/원문 누출 금지/flags 불변을 실제 함수로 검증한다. 실제 SDK를 import하거나 transport 모델을 실 Agent 결과로 부르지 않는다. disk fixture/새 resource 불필요하며 생성0이다.

기존 인접은 Codex codec의 직접 단위와 root typecheck 범위에서 선택하고, 불변 전체 회귀/SDK 설치/실환경 전수는 반복하지 않는다. 정확 명령·exit·지문/diff·실제 RED→GREEN·준비 오류/제품 오류·미실행·live handle·writer 반환을 제출한다. Main fresh·독립 Critical/Important0 뒤 기존 branch에 소유 파일만 통합한다. 실제 SDK/CLI·6능력/계정 교체·DB/화면/사용자 인수와 전체 FN07은 별도 미완료로 유지한다. rollback은 이 신규 source checkpoint 정상 revert이며 사용자 자산 변경은 없다.