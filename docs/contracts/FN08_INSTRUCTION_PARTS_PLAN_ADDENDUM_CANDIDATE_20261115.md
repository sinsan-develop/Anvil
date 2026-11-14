# FN08 지시 부분계획 참조 생산 — 한정 보완 후보 A

상태: 미채택. 부모 normal SEND 후보 SHA256 `DEA72C3FB14A955E02956C50898A50ED6BE9705E911A17CB651DAFE2847FFB7C`의 구현 중 발견한 선행 누락만 보완한다. 이미 채택한 SEND 저장·자료·permit을 다시 결정하는 문서가 아니다.

## 1. 누락과 선택

기존 제품은 caller가 전달한 partsRef와 주입된 current의 동등성만 검사한다. 보호 메시지 reader는 body/sourceRef를 반환하지만 partsRef를 만들지 않는다. material 등록은 주어진 partsRef를 검산한 뒤 manifestRef를 후행 생성한다. 합성 fixture의 ref를 제품 발급 근거로 사용할 수 없다.

A안은 기존 보호 원문에서 고정 부분계획과 목적별 참조를 결정적으로 계산하고 명시 GET으로 반환한다. 새 표·쓰기 권한·허가·Secret 없이 조회할 수 있다. B안인 별도 계획 발급 명령/저장표는 같은 불변 원문을 중복 보관하므로 현재는 권하지 않는다.

## 2. 정확 파생 규칙

실제 TextArtifactRef는 `{artifactId,bytes,contentHash,mediaType}`다. 존재하지 않는 bodyRef.id/version을 참조하지 않는다. 원문은 기존 보호 ProjectDocuments reader가 원 artifact/project·bytes/hash/mediaType 및 격리를 검산한 실제 bytes다.

```text
plan = {
 schemaVersion:1,
 purpose:"INSTRUCTION_PARTS_PLAN",
 algorithm:"UTF8_CODEPOINT_64K_V1",
 bodyRef:{artifactId,bytes,contentHash,mediaType},
 limits:{maxSourceBytes:2097152,maxPartBytes:65536,maxParts:200},
 parts:[{partIndex,byteOffset,utf8Bytes,contentHash}]
}
partsRef = {id:bodyRef.artifactId,version:1,contentHash:hash(canonicalJson(plan))}
```

부분은 기존 context-text-plan의 UTF-8 code point 경계 분할을 사용한다. bytes 변경·Unicode 정규화·자르기·임시 대체문자 삽입은 없다. 2MiB 초과·빈 원문·불완전 UTF-8·부분 상한 초과는 성공 계획으로 반환하지 않는다. 저장·응답 부분 순서는 기존0062/readMaterialDescriptor와 같은 1 기반 연속 partIndex이며 offset0부터 겹침/누락 없이 원 bytes 전부를 덮는다. 부분 hash는 그 부분 원 bytes의 기존 SHA256 형식이다.

partsRef는 원문 바이트의 부분계획을 식별할 뿐 메시지/실행 권한이 아니다. 같은 bodyRef를 여러 메시지가 쓰면 같은 partsRef가 나올 수 있고, 매번 별도 instruction/conversation/message와 현재 사용자 권한을 검산한다. bodyRef나 manifestRef의 별칭으로 취급하지 않는다. manifest/materialId/commandId·시각은 plan hash에 포함하지 않는다. 이들은 SEND별 후행 생성이다.

version1의 알고리즘·한도·canonical 형상은 고정한다. 규칙 변경 시 새 버전이 필요하며 과거 SEND를 최신 분할로 조용히 재해석하지 않는다. 원문 소실·정정·제외·격리 또는 원 참조 불일치면 그 계획 사용을 거절한다. 임의 partsRef에 맞춰 body를 선택하거나 hash를 재발급하지 않는다.

## 3. 사용자가 참조를 얻는 명시 조회

기존 메시지 상세 GET과 같은 HUMAN 인증/회원·프로젝트·메시지 읽기 권한을 적용하는 새 읽기 경로 하나다.

`GET /api/v1/projects/:projectId/conversations/:conversationId/messages/:messageId/instruction-parts`

query/body는 받지 않는다. 실행 Bearer·다른 프로젝트·정정/제외/격리 원문은 기존 정책에 따라 거절하며 원문 조회 권한을 확대하지 않는다. 자동 실행·등록·예약·승인을 만들지 않는다.

응답은 `Cache-Control:no-store`이며 정확 `{instructionRef,partsRef,plan}`이다. readMessage의 CONVERSATION sourceRef에는 version이 없으므로 이것을 VersionRef라고 반환하지 않는다. instructionRef는 원 메시지를 생성한 append 명령의 기존 확정 `commands.result_ref.data.ref` `{id,version:1,contentHash}`를 사용한다. 원 결과 외피의 targetId/version, 원 message·command·authorization receipt·audit 관계까지 대조하여 반환한다. 존재하지 않는 receipt.targetRef 필드를 만들지 않는다. 서로 다른 명령·메시지·hash나 원 영수증 부재는 거절한다. 원 USER_INSTRUCTION 사용 가능 여부는 context-sources의 metadata.superseded 등 정정·제외·격리 검사를 재사용하며, 단순 readMessage 성공만으로 유효 지시라고 판단하지 않는다.

원 지시 문자열을 응답에 중복 포함하지 않는다. 실제 bytes를 읽고 검사할 수 없으면 실패하고 metadata만으로 성공하지 않는다. 존재/권한 오류는 기존 메시지 상세의 외부 오류 정책을 유지하며, 빈/분할불가 원문은 고정 `INSTRUCTION_PARTS_UNAVAILABLE` 422, 원문 변경/불일치는 기존 보호 reader 실패로 처리한다.

## 4. SEND에서 소비

SEND 요청의 partsRef는 비교값이다. 서버가 exact instruction/메시지/body에서 같은 계획을 재생성해 fullref·부분목록을 비교하고 기존 material 등록에 고정한다. 요청의 partsRef를 그대로 신뢰하거나 GET을 수행했다는 사실만으로 실행 허가를 인정하지 않는다. 자료 재조회에도 원문·계획·등록의 정확 결박을 재검산한다. START/SEND permit·예산·현재성은 부모 계약 그대로다.

## 5. 구현·검수·제외

신규 순수 계획 생산 모듈·직접 시험 각1개와 기존 승인된 routes/conversations/normal-instruction-source 접점에 한정한다. 새 DB 표/migration·일반 권한·기존 reader의 거절 완화는 없다. 기존 경로 응답은 바꾸지 않는다.

필수 source/RAM 검증: 같은 bytes 재조회 불변, UTF-8 다중바이트 경계, 2MiB/빈/손상 거절, 변경/격리·다른 메시지/프로젝트 차단, 동일 body의 메시지별 권한 독립, caller 변조 partsRef 거절, 실제 보호 reader→부분계획→normal SEND 등록/자료/permit 연결. 전체 실행 완료·SDK 수락을 증명하지 않는다.

이번 결정은 코드·합성 검증만이다. 실제 사용자 원문 조회/전송·DB 접속·권한 부여·키·서비스·SDK/Agent 실행은 제외한다. 롤백은 신규 GET/소비 연결의 소스 revert이며 실제 자료/DB를 삭제하지 않는다.
