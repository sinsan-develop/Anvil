# FN16 암호화 묶음·검증 복원 형식 — 상세 계약 후보

2026-10-31 / Main 어울 / NOT_ADOPTED / 구현·실제 키·파일·DB 실행 GO 아님.
상위 FN16 범위 후보 A3/A4, 원 수동 백업 후보 §3.3. 본문은 새 데이터 형식·검증 동작의 제안이다.
A1의 자료/codec registry 및 A2 snapshot 경계와 함께 채택해야 하며 키 envelope의 기존 AES-GCM을 전체 백업 구현으로 간주하지 않는다.

## 1. 권장 형식과 대안
A(권장)는 압축/실행 파일 포장 없이 단일 AES-256-GCM 메시지를 유한 streaming으로 처리하는 새 ANVIL_PROJECT_BACKUP_V1 묶음이다.
B는 전체 암호화 묶음을 미정으로 두고 선택파일 검증만 유지하는 안이며 전체 수동백업/검증복원은 미완료로 남는다.
A 채택은 실제 키 보호 adapter·key 발급·nonce 발급 저장·DB 적용/서비스/실파일 실행 승인이 아니다.
알고리즘을 직접 발명하지 않고 Node24 crypto의 인증암호 API를 사용한다. 알고리즘/길이/형식 fallback은 없다.

## 2. 보호 내용과 바깥 header
문서·대화/지식 원문·경로/이름·자료관계·세부 manifest·제외 이유는 암호문 안에 둔다.
바깥 header에는 형식/algorithm·originProjectId·정확 job/attempt/policy/key ref·registry ref·nonce·plaintextBytes·bodyHash만 둔다.
이 식별 metadata가 암호문 밖에 남는다는 점을 UI preview와 반출 계약에서 알리고, 보호 다운로드 권한을 유지한다. 익명 공개 포맷이라고 주장하지 않는다.
Secret/계정 자체·session/token/credential/구독 비밀·실키 바이트·활성 writer/권한은 body/header/manifest 어디에도 넣지 않는다.
비밀 없는 참조·역사·제외 이유·재연결 metadata는 A1 허용 목록에 있는 것만 보관한다. 단순 키 이름 차단으로 완전한 비밀탐지를 주장하지 않는다.

파일 외피 제안:
- 고정 ASCII magic ANV3BK01(8bytes), headerLength uint32 big-endian, canonical UTF-8 JSON header, ciphertext, authTag16bytes 순서.
- header는 exact keys/형식값이며 최대4096bytes다. nonce는12bytes의 canonical base64, algorithm은 AES-256-GCM, 형식은1만 허용한다.
- plaintextBytes는 양의 안전정수이며 ciphertext 길이와 같아야 한다. 파일의 전체 기대길이는 8+4+headerLength+plaintextBytes+16으로 overflow 없이 계산한다. 길이 초과/부족·trailing bytes·알 수 없는 version·duplicate key·비정규 UTF8/비canonical header를 거절한다.
- AAD는 magic/headerLength/header의 정확 bytes다. 키는 정확 key ref가 가리키는32byte 키만 사용한다. authTagLength는16으로 고정한다.
- bodyHash는 plaintext record stream 전체의 SHA256이며 AAD로 보호한다. 바깥 hash만 맞는 것을 복호화 인증 성공이라고 표시하지 않는다.
- 새 형식이므로 기존 FileBundle/PortableKeyEnvelope decoder의 의미나 파일을 바꾸지 않는다.

## 3. body와 자료 registry
body는 A1의 검증 가능한 불변 자료 DTO 및 artifact 실제 bytes를 순서가 고정된 record stream으로 보관한다.
거대한 JSON 전체를 메모리에 읽거나 임의 archive를 풀지 않는다. 압축/스크립트/SQL 실행·symlink/hardlink·절대경로 복원은 없다.
record는 kind 1byte + metadataLength uint32BE + canonical metadata bytes + payloadLength uint64BE + payload bytes다.
kind 후보는 MANIFEST/RECORD/ARTIFACT/END로 닫고, metadata exact keys·각 payload codec·정렬·행/bytes 집계는 A1 registry 부록에서 확정한다. 이 부록 미완성 동안 source parser 구현 GO는 없다.
- MANIFEST는 선두1개로, 정확 project/policy/include/registry/schema 참조·snapshot 관측·자료/bytes/hash·포함/제외·의존성/필수 gap 목록을 포함한다.
- RECORD는 허용 registry의 kind/schemaVersion/ref와 canonical 자료 DTO다. 실행 가능한 DB DDL/임의SQL을 포함하거나 실행하지 않는다.
- ARTIFACT는 exact artifact ref·bytes/hash와 원 bytes다. 동일 객체ID·버전의 다른 hash는 거절하고 중복·동일bytes의 다중참조 처리 기준을 고정한다.
- END는 말미1개로 선행 record 수·종류별 합계·선행 stream digest를 검산한다. header bodyHash는 END 포함 전체bytes에 대해 검산한다.
원문을 비반출 허용 투영으로 바꾸는 경우 source hash와 export projection hash를 구분하고 제외 필드/이유·재연결 필요를 기록한다. 기존 원문/원 hash를 수정하거나 투영본이 원본 전체bytes와 동일하다고 주장하지 않는다. 원문이 없는 과거 승인/감사는 비활성 출처 이력으로만 보존하며 현재 승인/소비 권위로 재발급하지 않는다.
미지원 registry/필수 원문·필수 관계·artifact 누락·참조충돌은 검사 실패다. 기존 composition summary만으로 원문이 보관됐다고 처리하지 않는다.

## 4. nonce·키·한도
nonce 유일성과 사용량 상한의 도메인은 ref/version 이름이 아니라 동일한 실제 암호화 키의 모든 사용이다. 별칭·개정·다른 설치·이식/복원으로 같은 실키가 쓰여도 같은 중복방지/사용량 도메인에 결박해야 한다. 안전한 난수12bytes와 그 도메인의 nonce 원자 중복 차단·지속 사용량 제한을 함께 요구한다. 실제 키 domain 귀속/독점 사용·기존 이력을 증명할 수 없으면 새 암호화를 거절하고, 가져온 키는 복호화 전용으로 유지한다. 공개 ref·자가선언·키 hash만으로 이 증명을 대체하지 않는다.
같은 원명령 replay는 이미 발급된 attempt/file을 재조회하며 같은 key/nonce로 다른 plaintext를 재암호화하지 않는다. 충돌/발급 결과 불명은 재사용하지 않고 원시도 상태를 조정한다.
nonce 발급/저장·실제 key provider 계약과 권한은 A5와 별도 채택하며, provider가 없으면 생성/검증을 거절한다.
실키를 새로 만들거나 파일에서 읽지 않는다. source 합성시험은 공개된 시험용 가짜 bytes/nonce만 쓰고 실제 환경에 등록하지 않는다.
plaintext/ciphertext/header/record metadata·rows·artifact 개수/원문·staging/실패본·deadline을 각각 유한 한도로 검사한다.
base64/암호화외피/manifest overhead도 실제 출력·staging 사용에 포함하고 policy/profile/예약·실제 저장량의 최솟값을 넘지 않는다.
단일 GCM 메시지의 허용 최대 길이와 기존 최초10GiB 정책 범위는 API/암호 표준을 대조해 구현 전에 수치로 고정한다. 이를 무제한으로 남기거나 새로운 수치 승인을 임의 생성하지 않는다.

## 5. 복호화·검증 복원
1. 보호된 입력 ref·현재 읽기권한·정확 project/policy/key/registry 기대값과 유한 한도를 확인한다. header의 자기주장만 믿지 않는다.
2. ciphertext를 bounded stream으로 복호화하되 결과는 새 소유 검증 staging에만 둔다. 인증 final 성공 전 parser/DB/사용자 다운로드·복원자료 채택으로 전달하지 않는다.
3. tag/AAD/길이·bodyHash가 모두 맞은 뒤에만 record decoder와 A1 schema/정렬/중복·관계/역사·artifact bytes/hash를 검산한다.
4. 새 검증 전용 대상에서 지원 registry/migration과 정확 자료 관계를 비교한다. 번들에 든 SQL을 실행하거나 현재 프로젝트·계정을 덮지 않는다.
5. 검증 보고에는 검사별 실제 수행/실패/미지원, 포함/제외와 외부 의존성, 원 manifest/body hash·정확 검사기 버전을 남긴다. 키 부재·형식 미지원·원문 불명은 PASS가 아니다.
6. 성공해도 현재 권한/정책·실행 허가·Agent 세션·writer/자동 실행을 복원하지 않는다. 기존 프로젝트 적용은 별도 영향/승인 계약 대상이다.

Node24 문서는 인증 확인이 final 단계에 완료됨을 설명한다. 따라서 update가 반환한 평문을 미리 신뢰하지 않는다.
인증 실패 staging을 자동 사용자 파일로 노출하지 않는다. 보존/폐기·실패본 한도/소유 정리 계약은 A5와 고정하며 원 사용자 자료/참조된 백업을 시험정리로 삭제하지 않는다.

## 6. 구현 전 필수 확정·검수
A1 record별 exact codec/정렬·모든 필수 관계, A2 신뢰 출처/최신검사, A5 job/nonce/staging/불명조정·저장예약을 채택받아야 한다.
필수 반례는 header/AAD/cipher/tag/길이 변조·wrong key·nonce 중복·경로주입·잘린/과대한 record·누락/중복/참조충돌·비밀 비반출·인증 전 채택0·기한/공간 부족·실패 정리불명·원명령 replay0이다.
외피 roundtrip만으로 DB 자료/관계 복원이 증명됐다고 보고하지 않는다. 실제 PG/키보호/파일/복원/사용자인수는 각각 필요한 실제 증거로 남긴다.
현재 공개 API·profile·SQL·소스·실제 자원 변경0이며 전체 FN16/작업계획 미완료다.

참고: [Node.js24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)의 createCipheriv/createDecipheriv, setAAD/setAuthTag/final 문서(2026-10-31 조회).

nonce 근거: [NIST SP800-38D §8](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)의 동일 키 전체 사용에 대한 IV 유일성·사용량 요건(2026-10-31 확인). 실제 도메인/이식/사용량 계약이 미정인 현재는 생성하지 않는다.
