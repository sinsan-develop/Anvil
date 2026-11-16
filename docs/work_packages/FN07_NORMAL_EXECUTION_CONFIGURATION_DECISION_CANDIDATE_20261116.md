# FN07 첫 SEND의 실행 구성 검산 후보

> Main 검토 결과: 구성 비교만 구현하고 실제 Query·child 생산자를 제외한 이 안은 다음 채택안에서 제외했다. 고정 deny를 코딩 도구 통제의 완성이나 실제 실행 안전 보증으로 사용하지 않는다. 원 기술 근거와 제안 이력만 보존한다.

**미채택 · 제품 변경 0 · 실제 실행 0.** 제안하는 다음 단위는 첫 SEND에서 SDK가 spawn hook으로 넘길 **한 번의 실행 요청을 사용자 실행 범위와 대조하는 로컬 판정**이다. 이 판정으로 child를 생성하거나 도구 사용을 허가하지 않는다.

## 1. 기존 부모와 새 결정

WORK_STATUS 19380~19383의 START → 내구 attempt → permit → current를 부모로 사용한다. 그 기록 이후 채택된 FN07 normal Query 소유 A안(86A46140…)에 따라 START는 준비영수증에서 끝난다. 첫 생성 기회는 살아 있는 같은 worker가 명시 선택한 첫 SEND의 원문·parts·세대·sessionBinding·별도 SEND permit을 검산하고 dispatch 시도를 정착한 뒤 한 번이다. 이력 재생은 원 객체를 복원하지 않는다. Nov6 admission endpoint, 제2의 permit, 별도 서버 상태는 필요하지 않다.

**결정 요청은 제한된 v1 구성 한 종류다.** 등록된 사용자 실행 범위의 고정 프로그램 한 개, 작업 디렉터리 한 개, 그 실행에 정확히 정해진 인자와 비밀 없는 환경만 비교한다. 도구·Secret·계정 사용은 이 단위에서 허용하지 않는다. 셸·임의 extraArgs·환경 상속으로 실행하는 선택지도 열지 않는다. 현재 원천이 선언만 제공하면 구성 불일치와 구별해 ‘보호 원천 없음’으로 반환한다. 원천 부재를 성공 처리하는 driver를 등록하지 않는다.

| 항목 | 제안하는 내부 필드 및 판정 |
|---|---|
| 부모 | 원 worker 객체, 등록 및 grant fullref, project/execution/generation, START key·envelopeHash·준비행·attempt·permit ref, 첫 SEND key·envelopeHash·dispatch attempt·permit ref·instruction/parts ref와 digest, 논리 sessionBindingRef, plannedSid, 최단 expiresAt. 기존 owner/claim에서 취득하고 현재성 상실·원 객체 교체 시 폐기한다. caller가 보낸 동명 JSON으로 발급하지 않는다. |
| 프로그램과 cwd | 원 선택 profileRef 및 그 등록에 속한 보호 설치·작업공간 판독이 같은 시점에 결박한 program identity/hash, cwd identity, 정확한 command/cwd 문자열을 비공개 비교 입력으로 사용한다. argv[0] 검색, PATH 검색, caller 경로 정규화만으로 신원을 발급하지 않는다. 준비 worker 이미지의 검산은 코딩 프로그램의 신원을 보장하지 않는다. |
| argv | 보호 구성의 ordered expectedArgs 문자열 배열 전체를 hook의 args와 길이·순서·값까지 대조한다. 기대값은 실제 hook 인자를 복사해서 만들 수 없다. model/maxTurns/maxBudgetUsd는 원 START 자료에서 `readClaudeQueryParams`가 검산한 값만, 계획 SID는 원 owner의 값만 쓴다. SDK의 고정 stream-json 제어 인자 및 실행 방식과 합쳐 **독립적으로 확정할 수 있는 조합**만 비교한다. 선택되지 않은 플래그, 중복·순서 변경, 스크립트/실행기 교환은 거절한다. 지원되지 않은 SDK 변환 조합은 미지원으로 남긴다. |
| env와 Secret | 원 구성은 expectedEnv의 자체 문자열 키·값 전체를 비공개로 고정한다. 사용자 추가 키·Secret 슬롯은 모두 0개이고 호스트 process.env 상속을 허용하지 않는다. 이 버전에서 허용하는 SDK 생성 키도 **독립적으로 고정된 비밀 없는 키·값만**이다. 결정되지 않은 키·동적 인증값·프로필 또는 설정 디렉터리 fallback은 거절한다. 이 판정에서는 OS 환경 조회·Secret 해석·주입을 하지 않는다. 실제 argv/env/cwd, 계정, SID, 비밀값은 결과·로그에 싣지 않는다. |
| 도구 | `CanUseTool`이 호출되면 모든 요청에 고정 deny와 비밀 없는 고정 message를 반환하도록 제안한다. null, suggestions 수락, updatedPermissions, allow, 도구 입력 로깅은 쓰지 않는다. 이는 **콜백에 도달한 요청에 대한 반환**이다. CLI가 모든 도구 사용을 중재·거절한다는 사실은 검증되지 않았다. 도구 없는 실제 실행을 이 콜백만으로 허가하지 않는다. |
| 수명·결과 | 허용 가능한 비교 결과는 ‘동일 구성과 일치’, ‘불일치’, ‘원천 없음’이다. 원 signal과 고정 기한 아래 같은 첫 SEND에서 1회 소비하며 재진입·다른 부모·늦은 반환을 거절한다. 일치는 SDK 수락·실행 허가·프로세스 영수증이 아니다. 실제 child 생성 뒤 불명에 대한 기존 UNKNOWN 보존과 재생성 금지는 그대로다. |

## 2. 기술 근거와 남는 생산자

고정 SDK 조회 결과서(2ABE77AA…DA5B)의 sdk.d.ts [8399,10976), [87981,88396)은 콜백과 결과의 전체 선언을 담는다. sdk.mjs [793780,795620)에서 원 요청과 결과가 control response로 이어진다. [778920,779367)에서 동기 hook에 command/args/cwd/env/signal이 전달되고 기본 spawn은 별도 분기다. [779681,780423)에서는 원 반환 객체의 exit/error를 소비한다. [1130362,1132636)은 환경 복사·SDK 추가 필드가 있으므로 호출자의 빈 env만으로 최종 환경을 확정할 수 없음을 보여준다. 위 오프셋은 UTF-8 반열림 구간이다.

상위 공개 옵션 별칭 전체, 모든 옵션 조합의 최종 argv/env, CLI의 최종 도구 집행은 미확인이다. SDK 기본 spawn을 실행해서 보충하지 않는다. **보호 설치 신원·프로젝트 cwd·현재성 원본의 실제 생산자, 실 Query·child 수명 및 SID 관측은 이 단위의 산출물이 아니다.** 기존 normal-first-send-owner가 원 Query/iterator 한 개, 실제 첫 yield와 같은 iterator의 init SID, 정상 정착 후에만 세션을 연결하는 원칙을 유지한다. processRef는 기존 의미대로 null이다. PID·SID 문자열, SDK 응답, 비교 성공으로 OS 소유/종료를 주장하지 않는다.

## 3. 허용 파일과 완료 판정

| 허용 경로 | 목적 |
|---|---|
| 신규 `apps/connector/adapters/secondary/normal-execution-configuration.ts` | 제한 구성과 hook 요청의 대조, 일회 소비, 도구 요청에 대한 고정 거절. 실제 SDK·OS import 및 spawn 없음. |
| `apps/connector/runtime/normal-first-send-owner.ts` | 기존 원 첫 SEND와 private owner에 구성 검산의 수명을 결박하는 내부 접점만. 기존 START·첫 SEND·STOP 종단이나 정상 실행 기본 공급자는 바꾸지 않는다. |
| 신규 `tests/unit/FN07/normal-execution-configuration.test.ts` 및 기존 `tests/unit/FN07/normal-first-send-owner.test.ts` | 닫힌 입력 대조와 원 첫 SEND의 실제 제품 함수에 대한 RAM 검증. |

정상 시험은 합성 보호 원천의 독립 기대 구성과 합성 hook 입력을 **별도로** 준비한다. 원 READY·첫 SEND dispatch 뒤 같은 owner가 비교 결과를 한 번만 소비하는지 확인한다. 원 자료/permit·세대·등록·실행파일·cwd·인자 하나 또는 env 한 키가 바뀐 경우, 원천 부재·복제 JSON·재진입·취소·기한 만료·STOP 뒤에는 일치 결과와 추가 생성이 모두 0이어야 한다. 콜백의 고정 deny와 결과의 비밀 비노출을 각각 단언한다. 기준 비교는 실제 SDK 없이 끝낼 수 있으며 실제 정상 실행과 저장·도구 격리는 미검증으로 남긴다.

문자열 비교·불변 복사·원 객체 보관 방식과 함수명은 Main의 내부 구현 판단이다. 사용자 결정 대상은 위 구성의 허용 범위와 비교 성공의 의미다. 새 공개 API·SQL·역할·저장 포맷, 실제 실행파일이나 사용자 자료 조회, Secret·DB·권한·서비스 조작, SDK 설치·추가 원문 조회·Agent 실행은 이 결정에 포함되지 않는다.
