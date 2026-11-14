# FN08 native 준비 journal 재시작 식별 — 한정 저장 계약 후보

상태: 미채택. 2026-11-14 Main 제안. 실제 실행 승인이 아니다.

## 목적과 기존 승인 차이

Anvil이 같은 준비 작업을 다시 받거나 재시작하더라도 이미 시도한 factory를 재실행하지 않도록 원 기록을 보존한다. 기존 Client와 file adapter는 이 단발 검산을 구현했지만 제품 owner가 사용할 보호 journal 공급자는 없다.

기존 desktop trust r5의 사용자 SID/KnownFolder, 고정 `LocalAppData/Anvil/Trust/v1`, main/helper root identity, 사용자·SYSTEM 전용 DACL 정책은 재사용한다. 기존 닫힌 binding 저장 목록과 privileged 연산에는 native journal이 없으며 재시작 native authority 복구도 제외돼 있다. 이번 후보는 **journal 전용 저장 namespace, 원 설치·등록 결박, 재시작 원기록 식별 및 typed 보호 저장 연산**만 추가한다. authority·프로세스·grant·실행 재개 권한은 복구하지 않는다.

## 선택지

A안(권장): 검산된 기존 Trust root 아래 `native-journal.v1` 전용 namespace를 추가한다. 기존 binding/키/credential 파일과 형식·한도를 분리하고 보호 root 검산을 재사용한다.

B안: 별도 journal root를 관리한다. 저장 분리는 명확하지만 별도 root 생산·소유·발견·제거 정책이 필요하므로 현재 권장하지 않는다.

아래는 A안의 구체 제안이며 채택 전 구현하지 않는다.

## 저장·소유·한도

- root는 기존 r5 생산자가 결정하며 renderer/환경변수/사용자 입력 경로를 받지 않는다. journal namespace도 고정한다. root 및 namespace의 소유·DACL·reparse·보유 handle identity를 전후 검산한다. 기존 일반 폴더를 자동 채택하거나 ACL을 수리하지 않는다.
- journal의 원 사용자 SID·installationId·검산된 registration fullref·scopeDigest와 authority fullref를 고정한다. 이 값은 원 보호 등록과 검산된 준비 권위에서만 취하며 caller JSON만으로 보관 주체를 만들지 않는다. 파일명은 이 tuple의 canonical hash에서 유도하며 임의 경로는 받지 않는다.
- 같은 authority의 최초 생성 여부는 namespace의 보호된 존재 원장과 실제 행을 함께 검산한다. 최초 존재 표식과 첫 PREPARED 기록은 동일 배타/CAS 아래 원자적으로 결박하며, 둘 중 하나만 정착한 상태는 UNKNOWN으로 보존한다. 원장·행의 부재를 단순 신규로 간주하지 않는다. 원장이 처음 명시 생성된 정상 빈 namespace와 기존 namespace의 원장 소실을 보호 root의 생성/발급 근거로 구분한다. 그 근거가 없으면 최초 생성도 거절한다. 표식은 이후 원행이 소실돼도 재실행 방지를 위해 유지하며 namespace 전체 롤백을 완전 탐지한다고 주장하지 않는다.
- PREPARED/FACTORY_ATTEMPTED 두 원형·순서·hash와 authority당 최대2행은 기존 계약을 그대로 사용한다. wrapper만 별도 목적/버전·원 tuple을 갖는다. raw credential·개인키·사용자 작업 본문을 journal에 추가하지 않는다.
- 신규 namespace 한도 제안: 총 ciphertext 64MiB, authority 10,000개, 원형 한 행 canonical 2MiB 이하. 각 한도는 모두 적용한다. 임시/이전본/잠금 등 부수 파일도 총량에 포함하고 쓰기 전 최악 크기를 예약한다. 기존 binding 한도에 합치거나 기존 자료에 소급하지 않는다. 포화 시 새 기록/실행을 거절하며 자동삭제·축약·상한 확대는 없다.

## 보호 포트와 내구성

- 일반 파일 읽기/쓰기나 bytes 서명 IPC를 열지 않는다. 검산된 main/helper 관계의 전용 journal OPEN/READ/APPEND_SYNC/CLOSE만 추가한다. OPEN은 원 tuple 및 기존 원 요청 기한에 결박하고 후속 연산은 동일 비공개 handle에서만 허용한다. renderer로 원문/handle/경로를 전달하지 않는다.
- journal ciphertext는 기존 DPAPI CurrentUser 보호를 journal 전용 purpose entropy로 분리하며, 복호화된 목적/버전/원 tuple/hash를 재검산한다. 기존 binding ciphertext나 다른 등록의 journal을 바꾸어 사용할 수 없다. 개인키 또는 평문 credential은 다루지 않는다.
- r5의 root 단일 writer/create-new 잠금과 CAS를 journal의 모든 생산자에도 명시 적용한다. 별도 OPEN·다른 host·동일 authority 및 namespace 총량 경쟁은 동일 root 배타 아래 존재 원장/용량 예약→append/readback→정착 확인→확인된 자기 잠금 release 순서로 처리한다. 잠금 부재만으로 기존 미정착 기록을 신규로 만들지 않는다. 불명 잠금은 재시작 후에도 보존·차단하고 자동 탈취하지 않는다.
- append는 원 단발 순서·기존 hash·소유·용량을 검산한 뒤 create-new/원자 기록, 파일 sync 및 정확 readback을 완료해야 성공한다. 필요한 부모 metadata 정착을 확인할 수 없으면 성공을 반환하지 않는다. 구체 Windows API·기존 보호 구현 재사용은 Main의 기술 구현 선택이며 합성 성공을 OS 내구성 증거로 간주하지 않는다.
- 실제 OS가 요구 보장을 제공하지 못하면 지원 불가/UNKNOWN으로 닫는다. `SOURCE_ONLY_MODEL` file adapter를 그대로 실보호 공급자로 승격하지 않는다.
- 부분쓰기·sync/readback/close 불명·기한 초과·root 교체에서는 원 기록과 잠금을 보존하고 추가 append/factory를 차단한다. stale lock 탈취·previous/임시본 자동 최신 채택·백그라운드 재시도는 없다. 이미 시작한 IO 정착 전에 handle을 재사용하지 않는다.

## 재시작·보존

- 앱 재시작만으로 파일/키/네트워크 조회를 시작하지 않는다. 기존 사용자의 명시적 연결/준비 동작에서 보호 root와 원 등록 tuple을 검산한 후 동일 journal을 식별한다.
- 원 기록을 읽는 것은 이전 작업 재실행 방지 확인이다. native authority/profile/slot·프로세스·grant를 복구하거나 오래된 기한을 연장하지 않는다. 재시작 이전 시도를 새 factory 시도로 재개하지 않는다. 새 준비를 시작하려면 기존 별도 신규 권위 흐름을 따른다.
- 이미 기록된 원 tuple이 부재·손상·다중 후보·다른 소유라면 빈 원장으로 대체하지 않는다. 과거 FACTORY_ATTEMPTED 또는 불명 기록은 재시도 가능한 PREPARED로 되돌리지 않는다. 전원손실/악의적 동일 사용자 전체 롤백을 완전 방어한다고 주장하지 않는다.
- 만료·회수·옛 세대의 기록도 자동삭제하지 않는다. 확인된 과거 기록은 단발 감사로 보존한다. 명시 제거는 별도 소유·참조·정확 대상 정리 절차에서만 하며 이번 후보에 삭제 기능은 포함하지 않는다.

## 구현 및 검수 범위

채택 시 기존 Primary가 보호 저장·desktop owner/runtime 조립·관련 합성 시험을 구현한다. 정확 경로는 기존 클래스/포트 대조 후 WI로 고정한다. 기존 binding/키/credential 연산 및 기존 Client 원형은 보존한다.

RAM FS/보호 포트로 실제 owner/Client를 연결하여 첫 기록 후에만 진행, 새 owner의 동일 tuple 조회, 재시작 이전 시도의 factory0, 부분쓰기/flush 실패/유실·root 교체·다른 사용자/등록·기한·한도·불명 보존을 확인한다. 이전 정상 기능의 직접 영향 검사와 source 타입/정적 검수를 수행한다.

실제 root/파일/ACL·키·DB·서비스·helper/C# 컴파일·Agent·프로세스 실행은 제외한다. 실제 Windows 권한·전원손실 내구성·원격 여정은 미검증으로 남긴다. 별도 승인된 현재 host 저장 작업은 이 결정과 독립해서 계속한다.

## 근거

- FN06_DESKTOP_TRUST_ENROLLMENT_OWNER_CANDIDATE_20261102.md r5 §6, §8.2, §9 및 직접 채택 기록.
- FN06_NATIVE_LOCAL_JOURNAL_SOURCE_IMPLEMENTATION_20261102.md §3: 전용 root 명시 주입, 생성/ACL 변경 제외, max2records·불명 보존.
- FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md D1 3단계.
- 2026-11-14 PMO 지원 회신: 기존 root 전체 재승인 대신 journal 저장/발견 delta를 별도 계약으로 구체화.
