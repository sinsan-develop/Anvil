# FN06 완성형 환경 승인 원문 결박 보완안

2026-11-01 / Main 어울 / A권장 / NOT_ADOPTED
부모: 환경 r4 A BA002F75E66D2A07374F1919F241AB1F843E839AF0D6F9CBEEB0603951DD1EBA 직접 승인. 부모 원문·구현 범위는 변경하지 않는다.

## 1. 실제 공백과 승인 경계

현재 requestApproval 기본 payload는 exact {details}이며 details.actionScope에는 operation/targetRef/expectedVersion/payloadHash만 있고 원 payload의 종류는 없다. 후보와 완성형은 모두 saveEnvironment를 쓴다. 생성 target=null 또는 같은 UUID의 ref만으로 namespace를 선택해서는 안 된다. 실제 authorize/저장 단계는 원command.payload로 구분되지만 요청·결정 단계에는 그 원형이 없다.

Main74e366/d76280은 기존 작업계획/백업정책/설계적용 등이 exact {details,candidatePayload}와 전용 원문 보관·보호 조회·정확 소비를 이미 쓰는 것을 확인했다. 이 기능을 임의로 환경에도 허용하지 않는다. 환경 r4는 같은 operation과 기존 scope를 유지하도록 정했으나 이 추가 승인입력/보관/조회 원형까지 명시하지 않았으므로 아래 delta만 별도 채택 대상으로 제시한다.

독립적인 새6 metadata·환경 AUTO 저장/조회/화면·정의 결박 구현은 계속한다. 완성형 환경 REQUIRE_APPROVAL 경로는 결정 전 명시412로 닫고, 미구현을 완료로 보고하지 않는다.

## 2. 대안

A(권장): 기존 candidatePayload 방식의 닫힌 환경 분기를 추가해 요청 원문을 보호 보관·조회하고 결정/일회소비에 결박한다. 새 승인 엔진이나 승인 scope 구조는 만들지 않는다.
B: 새 operation 또는 actionScope namespace 필드를 도입한다. 기존 r4의 operation 유지와 scope 원형을 바꾸며 더 넓은 호환 수정이 필요해 권장하지 않는다.
결정 전의 412 유지는 임시 미연결 상태이며 전체 환경 기능의 대체 완료안이 아니다.

## 3. A의 exact 입력·서버 구분

requestApproval 중 완성형 saveEnvironment에만 exact {details,candidatePayload}를 허용한다.
candidatePayload는 이미 채택한 exact {environment,baseRef,reason} 원형이며 환경 입력6필드·typed ref를 기존 실제 검산기로 확인한다. hash는 details.actionScope.payloadHash와 정확히 같아야 한다. candidateCommandId·project·actor/client·controlGeneration·target/expected/baseRef·현재 정책·기한을 결박한다.

기존 ENVIRONMENT_CANDIDATE의 {details} 경로는 그대로다. 추가필드/혼합원형/다른 operation의 환경 원문·hash 불일치·namespace 불일치는 거절한다. UUID·reader fallback·table 존재만으로 namespace를 추정하지 않는다.

새 요청의 저장 snapshot/request_json에는 candidateKind='ENVIRONMENT_DEFINITION'을 결박하고 이 값을 해당 새 분기의 request ref hash 계산에 포함한다. 이 marker는 검산된 원문으로 서버가 만든다. 기존 요청은 marker 없이 기존 hash/응답을 보존한다. 새 marker와 원문 행의 존재·원형·원명령이 정확히 대응하지 않으면 무결성 실패다. 새 marker 자체를 실행·쓰기 허가로 취급하지 않는다.

## 4. 원문 보관·보호 조회·정확 소비

새 미적용0069 안에 anvil.environment_approval_candidates 한 표를 추가하는 안이다. exact 열:
project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,projection_json,canonical_bytes,created_at.
project/request 및 request_command/candidate_command 관계를 실제 원행·영수증·감사에 묶고 payload는 불변 보존한다. 새 입력 원형·서버 metadata의 canonical projection을 검산하며 caller 성공 bool/임의 ref로 대체하지 않는다.

기존 승인 fixed GET은 새 marker 분기에만 candidateEnvironment={kind:'ENVIRONMENT_DEFINITION',payload,payloadHash}를 추가한다. 기존 응답의 필드·legacy GET은 변경하지 않는다. 현재 OWNER이면서 원 요청 작성자인 주체만 원문을 보호 조회한다. 현재 읽기 보호 실패는 원문을 반환하지 않는다. 원문에는 실제 키/비밀값/경로 파일 조사 결과를 넣지 않는다.

요청·결정·authorize는 이 저장된 종류와 원문을 통해 환경 reader로만 대상/부모를 검산한다. fresh 요청/결정/소비는 현재 회원/제어·정책·기한·선택 ref/현재 head를 검사한다. consume에서는 원 command의 정확 payload/hash와 저장 원문·승인 scope/결정을 대조한다. 원 consumption/command hash가 같은 replay는 현재 보호 뒤 원결과를 검산하고 fresh head를 소급하지 않는다. 다른 원문/operation/주체/세대/기한의 재사용은 거절한다.

## 5. 상한·화면·검수

새 후보는 프로젝트 누적10000행, 각 원문/보관 projection은2MiB 이하다. 기존 전체 request body2MiB 제한도 유지한다. 환경 네 종류 원형+등록증빙+이 새 후보의 합산64MiB 및 프로젝트 전체10GiB 산식에 새로 보관한 bytes를 한 번만 합산한다. 기존1000head/10000환경·metadata버전 제한은 그대로이고 후보는 버전 head로 위장하지 않는다. 소비/회수 뒤 자동 삭제·bytes 환급0,기존프로젝트 차단 해제0이다.

화면은 완성형 환경의 원 버퍼 ACK 뒤 동일 candidatePayload로 승인 요청을 준비하고, UI08은 보호 GET의 원형을 읽어 해당 원문·hash를 보여준 뒤 별도 결정한다. 원명령/승인 요청 UNKNOWN·receipt·문맥/선택세대/CSRF/transport fencing을 유지한다. 후보/새6 metadata의 승인 화면은 의미를 변경하지 않는다.

합성 검수는 실제 환경 producer/보호 reader와 request→원문 capture/GET→결정→정확 소비/replay를 연결한다. marker/원문 누락·다중/손상·같은 UUID 다른namespace·hash/baseRef/현재 head·기한/주체·중복명령·상한/bytes이중계산과 legacy {details} 원형 보존을 확인한다. 실PG/RLS/OID/경합·실서비스/실Agent 검증으로 승격하지 않는다.

## 6. 코드 범위와 현재 실행

부모 WI66503F67의 기존29경로 안에서 구현하는 안이다. 원문 adapter/projection은 project-environments.ts 또는 이미 허용된 환경 모듈 안에 닫힌 별도 책임으로 둔다. 새 코드파일/새HTTProute는 신설하지 않는다. requestApproval·기존 승인GET/decide/consume·Web 승인 buffer와0069만 해당 새 분기를 연결한다.

현재 이 보완 delta의 코드·SQL·화면 쓰기는0이다. 채택 후 부모 WI에 좁은 보완 binding을 추가하고 같은 Primary가 TDD를 수행한다.
범위는 코드·화면·미적용SQL·합성검증뿐이다. 실제DB·권한/정책부여·키·서비스·Agent/비용·실자료조사·기존차단해제는 제외한다.

## 7. 독립 검토 보완 — 내부 환경 역사 소비

공개 candidateEnvironment 원문 GET의 현재 OWNER+원 작성자 제한은 유지한다.
별도로 환경 고정/역사 reader가 소비된 승인·원 payload·원명령/결정/consumption의 결박을 재검산하는 내부 역사 접점을 둔다. 기존 backup의 readBackupPolicyConsumption→history→candidate.readPolicyHistory 방식처럼 실제 현재 주체의 OWNER와 readEnvironmentVersion 접근 정책을 먼저 확인하고, 원 작성자/client/세대는 저장 metadata와 원행의 일치를 검사하는 자료로만 사용한다.

이 접점은 다른 현재 OWNER의 환경 역사 조회도 원 승인 원문/소비를 검산할 수 있게 하는 채택 대상 내부 보호 소비다. 원 작성자 actor를 꾸미거나 RLS 주체를 교체하지 않는다. 공개 후보 원문 조회의 작성자 조건을 완화하지 않고, 원문을 새 공개 GET에 추가 노출하지 않는다. 내부 반환은 환경 원형과 승인 소비의 정확 결박을 검산하는 데 필요한 최소 proof로 제한한다.

현재 접근 정책과 원 승인 당시 정책/기한/주체 증빙을 분리한다. 원 소비가 완료된 뒤의 역사 검산에 fresh head/기한을 소급하지 않는다. 현재 접근 실패·원문/소비 손상·namespace 불일치는 fail-closed다. 다른 현재 OWNER의 정상 환경 역사조회, 공개 후보 원문 조회 거절, 현재 읽기 정책 거절과 손상/외부 project/위장 actor 반례를 합성 검수에 포함한다.
