# FN12 보호 실행 증거 v1

## 적용 근거와 구현 범위

2026-11-27 신산님이 채택한 범위는 같은 등록 실행·세대의 실행기가 직접 관측한 명령, 종료 코드, 환경, 커밋, 산출물 해시의 보호 보관과 검수 근거 연결이다. [v3 설계 §7.3](../design/Anvil_설계서_v3_초안.md)과 [FN12 업무 카드](../work_packages/FUNCTION_WORK.md)는 수행자 주장, 실행기 직접 관측, 시험 산출물, 검수자 판정의 출처를 구분한다. 이전 HUMAN 업로드 후보는 미채택 상태를 유지한다.

이 단위의 구현은 [공통 실행 증거 원형](../../contracts/runtime/normal-result-execution-evidence-v1.ts)의 닫힌 형상과 바이트·참조 검산, 그리고 [합성 시험](../../tests/unit/FN12/normal-result-execution-evidence.test.ts)이다. 실제 생산자 설치, 보호 보관, 서버 권한과 검수 소비는 후속 연결 대상이다. 새 API·DDL·역할·키 발급은 정의하지 않는다.

현재 `result-submission.ts`와 `result-submission-store.ts`의 `WORKER_CLAIM`은 종전의 수행자 제출이다. `normal-observations.ts`와 기존 ACK의 `PROVIDER_CLAIM_ONLY`는 종전 수송 상태와 실행기 주장이다. SDK hook, SDK 출력, SDK 자식 프로세스 종료에서 개별 작업 명령의 물리 실행이나 종료 코드를 추론하는 경로는 부적격이다. 원형의 이름, JSON 재해시, fixture 검사 성공으로 출처가 바뀌지 않는다.

## 보호 원천과 단위

- 원 등록 실행기의 원 소유자가 허용된 작업 명령의 개별 프로세스 또는 검증 가능한 공식 실행 핸들을 직접 취득한다. 해당 동일 핸들에서 실행 시작과 실제 종료 코드를 확인한다. 출력·시간·실행 이미지·원 소유권이 다른 프로세스와 섞이면 해당 시도는 불명으로 보존한다. 짧은 실행 ID, PID, SDK 세션 ID, 반환 텍스트는 독립적인 소유 증거로 사용할 수 없다.
- `dispatchCommandRef`와 `dispatchEnvelopeHash`는 해당 실행기의 원 입력을 전달한 확정 Anvil 명령과 봉투다. `captureRef`는 그 입력 아래에서 관측된 **개별 작업 호출**의 보호 원본 참조다. 같은 SEND에서 여러 명령을 실행하면 호출마다 `captureRef`와 정착 증거가 따로 생긴다. 전송 명령 ID 하나로 합치거나 제출자가 원 호출 참조를 발급하는 경로는 허용하지 않는다.
- `executorRegistrationRef`, `localAttemptRef`, `grantRef`는 끝까지 같은 `projectId`, `executionId`, `executionGeneration`에 귀속한다. 수송 접수 때의 원천은 기존 등록·허가·credential 검산으로 확인하고, 측정 시점에도 같은 시도·원 소유·목적을 대조한다. 과거 등록, 다른 세대, 현재 쓰기권을 잃은 주체가 신규 관측의 소유를 재획득하는 용도로 원자료를 사용할 수 없다.
- 승인된 고정 `environmentRef`와 `environmentFingerprint`를 함께 보관한다. 지문은 같은 호출에서 보호 측정 포트가 확인한 환경 원본의 canonical SHA-256이다. 생산자 연결 단계에서 고정 설치·실행 이미지·도구 버전 등 지원할 투영의 필드와 관측 방식을 명세하고, 각 관측값의 출처를 `captureRef`로 판독할 수 있어야 한다. 환경 설정 제목이나 호출자의 환경 설명만으로 지문을 발급하지 않는다. 전체 환경 변수, Secret, 인증정보, 사설 경로를 원형·일반 이력·로그에 넣지 않는다.
- `commit`은 같은 작업 호출에서 관측한 Git 객체 형식과 전체 객체 ID다. `SHA1`은 소문자 40자리, `SHA256`은 소문자 64자리다. 브랜치명, 축약 ID, 전부 0인 대체값은 거절한다. 이 ID는 관측된 커밋을 표시한다. 작업 트리 변경·파일 경계·실행 입력의 정합은 해당 실행의 별도 보호 원천에서 확인하며, 커밋 일치만으로 파일 전체의 동일성을 판단하지 않는다.
- `argvSha256`은 보호 원본에 보관한 실제 명령 토큰 배열의 `canonicalJson({kind: 'NORMAL_RESULT_ARGV_V1', argv})` UTF-8 SHA-256이다. 원 실행 판독은 권한이 확인된 목적 한정 경로에서 정확 배열과 digest를 재대조한다. 공개 투영에는 digest만 반환한다. 원 배열을 계약에 맞게 안전하게 보관할 수 없는 호출은 이 증거에서 제외하고 이유를 남긴다. 토큰을 고치거나 Secret을 지운 문자열을 동일 원문으로 보관하면 안 된다.
- `startedAt ≤ exitedAt ≤ observedAt`을 UTC 밀리초 ISO 시각으로 보관한다. 실제 관측된 종료 코드는 `0`부터 `4294967295`까지의 정수다. 플랫폼 포트가 원 정상 종료 코드의 대응을 확인할 수 있어야 한다. 종료 미관측, 시그널·취소·실행 결과 불명에서 코드를 만들어 넣지 않는다. 0이 아닌 종료도 같은 구조로 보관하며, 종료 코드만으로 검수 판정을 결정하지 않는다.
- 각 산출물은 같은 실행 범위의 원 소유자가 직접 읽은 보호 바이트의 길이와 SHA-256, 논리 이름과 불변 `artifactRef`를 가진다. 기존 `ProjectResultArtifacts`의 v1 바이트 참조를 재사용한다. `artifactRef.contentHash`와 `sha256`은 정확히 같아야 한다. 후속 보호 원본 판독자는 `artifactRef` 전체와 실제 바이트 길이·SHA-256을 함께 검산한다. 보호 바이트 부재·중간 교체·다른 실행 귀속·해시 불일치는 해당 근거 부족으로 남긴다. 빈 산출물 배열은 명령 종료 사실의 기록에 허용되며, 산출물이 필요한 기준은 미확인으로 남는다.

## 원형과 검산

| 영역 | 저장 필드와 한계 |
| --- | --- |
| 외피 | `ref`, `snapshot` 두 필드. 보호 저장이 증거 ID를 배정한다. `ref.version`은 1이며 `ref.contentHash`는 canonical snapshot 바이트의 SHA-256이다. `ref.id`는 capture·dispatch ID와 분리한다. |
| snapshot | `schemaVersion` 1, `kind` `NORMAL_RESULT_EXECUTION_EVIDENCE_V1`, `binding`, `command`, `artifacts`, `observedAt`. 최대 64 KiB canonical UTF-8. |
| binding | 프로젝트·실행·양의 안전 정수 세대, 등록·로컬 시도·허가·dispatch·capture·환경 전체 참조, `dispatchEnvelopeHash`, `environmentFingerprint`, `commit`. 참조는 `id`, `version`, `contentHash` 세 필드의 기존 `RuntimeRefV1`이다. |
| command | `argvSha256`, `startedAt`, `exitedAt`, `exitCode`. 실행·종료 사실의 원문은 보호된 `captureRef`를 통해 대조한다. |
| artifacts | 최대 200건. 각 행은 `name`, `bytes`, `sha256`, `artifactRef`. NFC 논리 이름은 최대 256 UTF-8 바이트이며 문자나 숫자로 시작한다. 경로 구분자와 제어 문자를 제외한다. 이름을 직렬 정렬하고 중복 이름·같은 artifact ID의 중복을 거절한다. 이름은 보호 화면에 표시하는 라벨로만 사용한다. 문자 검사는 비밀 검사를 대신하지 못하므로 생산자는 민감한 이름을 보호 범위 밖으로 공개하지 않는다. |

`normalResultExecutionEvidenceRefV1`은 보호 저장이 마련한 별도 ID에 바이트 해시를 결박한다. `readNormalResultExecutionEvidenceV1`은 형상과 자기 해시를 확인한다. `matchNormalResultExecutionEvidenceV1`은 독립 확인한 기대 `ref`와 `binding`을 모두 비교한다. 검사 결과는 방어 복사된 원형이며 권위, 현재성, 실측 적격, 업무 완료 판정은 표현하지 않는다. 동일 입력에서 기대 참조나 바탕을 자체 파생해서 대조하는 방식은 외부 출처 검증을 대체하지 못한다.

중첩 객체와 참조의 정확 키, 데이터 속성, 희소 배열 및 Proxy 사용 여부를 먼저 검사한다. 문자열·날짜·정수·배열을 확인한 다음 canonical 바이트를 만든다. 향후 수송 경계는 JSON 역변환 전에 바이트 길이를 제한하고 기존 `parseWireJson`으로 중복 키를 차단하며 원 서명 바이트를 정확히 대조한다. 현재 원형은 디스크·프로세스·등록 키 및 DB를 조회하지 않는다.

## 보호 보관, 재조회와 판정

1. 원 소유자는 실제 시작·종료, 환경·커밋·산출물의 측정 포트를 검산하고 같은 호출의 보호 원자료를 정착시킨다. 부분 쓰기, 취소, 데이터 손상, flush·close·readback 불명은 사실 정착으로 표시하지 않는다. 기존 보호 저장의 배타 claim, 정산, 엄격 close 검산을 재사용하고 원 실행과 해당 호출의 durable 표식을 보존한다.
2. 동일 등록의 목적 한정 자료에서 원 요청·등록·허가·실행 세대·시도·capture·본문을 검산한다. 원 권위와 수송 기한 안에 현재 인증·등록·정책·회수 조건을 재검산한 뒤 동일 거래에서 증거 원본, 원 명령·영수증·감사와 해당 저장량을 결박한다. 이 순서는 후속 구현 요구다. 같은 거래의 정확 저장 경로와 정산은 연결 전 상태다.
3. 같은 `captureRef`와 정확 payload는 최초 정착한 증거 ref만 재조회한다. 같은 capture의 다른 바이트, 다른 등록·시도, 교차 프로젝트·세대는 거절한다. 독립 호출은 같은 dispatch 아래에서도 별도 보관한다. 수거, 서명, 저장, COMMIT, 응답에서 결과가 불명이면 원 기록과 원 기한을 보존한다. 새 서명·nonce·재발급 또는 원 명령 재실행은 자동 수행하지 않는다. 정상 정착이 확인된 원 자료와 원 영수증에 한해 기존 same-command 기준에 맞춘 보호 읽기로 복구한다.
4. 역사 조회는 원 등록·봉인·당시 권한과 시각, 원 영수증 및 자료의 정착을 과거 근거로 검산한다. 현재 조회자의 세션·프로젝트·정책은 별도로 확인한다. 현재 검수는 고정 결과·기준·환경·커밋과 정확 증거 참조를 각각 비교하고 실제 필요한 명령·종료·산출물 조건을 충족하는 범위만 인정한다. 지금 바뀐 권한·환경·기준을 과거 사실에 소급하거나, 과거 자료를 현재 실행 권한으로 승격하지 않는다. 판정·완료 수락·차단 해제·재개는 기존 별도 절차에서 처리한다.

## 이어서 연결할 파일과 검증 순서

| 순서 | 대조할 기존 진입점과 필요한 연결 |
| --- | --- |
| 1. 보호 원 생산 | `apps/connector/runtime/normal-first-send-owner.ts`와 native 감독의 실제 명령 핸들 소유 경계를 대조한다. SDK 출력이나 SDK 자식 종료와 개별 명령 종료를 분리한 목적 측정 포트를 연결한다. 이 소유권을 직접 검증할 수 없는 조립에서는 증거를 발급하지 않는다. |
| 2. 로컬 정착과 전송 | `apps/connector/runtime/normal-owned-spool-profile.ts`의 전용 spool 정산·배타 소진·원 close 검산과 기존 서명 primitive를 재사용한다. `normal-observation-spool.ts`의 일반 관측과 ACK 의미를 보존한다. 보호 원형의 정착 및 수송 목적·권한은 실제 포트 대조 이후 구현한다. |
| 3. 서버 원장과 정확 재조회 | `apps/server/modules/executions/normal-observations.ts`의 기존 보호 수송 경계를 대조한 뒤, 별도 목적의 증거 보관을 동일 등록·세대 및 원장·정산과 묶는다. 기존 `PROVIDER_CLAIM_ONLY` 행과 권한을 보존한다. |
| 4. 검수 소비 | `apps/server/modules/results/result-evidence.ts`, `project-result-reviews.ts`, UI05/UI08의 정확 근거 조회에서 보호 증거를 수행자 주장과 구분한다. 기존 합성 계약과 과거 행 판독은 유지한다. 재검증 범위, 필요한 산출물 누락, 실제 미관측을 표시한다. |

합성 시험은 실패 종료 및 빈 산출물, 같은 dispatch의 별도 capture, 변조 원형의 재해시, 등록·실행·시도·환경·커밋 교차, 형상·길이·중복·접근자·Proxy 거절을 다룬다. 실제 실행기 관측, 키·보호 저장, 권한·DB·서비스, 실자료 파일 대조, 운영 재조회와 화면 인수는 미검증이다.
