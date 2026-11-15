# normal 실행 세대별 저장 배정 — 미채택 기술 검토

이 문서는 승인 요청이나 구현 WI가 아니다. 실제 root/ACL/파일·권한·키·서비스·DB·Agent·SDK를 변경하지 않는다. P3§3.1은 normal 파일 저장소 source를 채택했고 SEND 내구 WI는 기존 private root를 재사용하되 신규 root/ACL/native namespace를 제외했다. native-journal.v1은 준비 authority의 별도 저장소다. normal 세대별 최초 배정·재시작 생산 근거는 기존 담당자 두 명과 PMO의 읽기 대조에서 찾지 못했다. 장애 원인 확정이 아니라 제품 연결 공백이다.

후보 A는 기존 등록 owner가 normal 전용 namespace와 보호 배정표식을 관리하는 방식, B는 설치자가 전용 배정을 사전 발급하는 방식이다. 같은 설치·등록·project/connector/execution/실행세대의 불변 배정을 재개하고 다른 세대는 격리해야 한다. credential 갱신은 배정을 바꾸지 않으며 반쪽 표식/디렉터리·정착/잠금 불명은 UNKNOWN으로 보존한다. caller 임의 절대경로·자동삭제·잠금탈취·ACL 수리는 허용하지 않는다.

아직 해소할 두 공백이 있다.

1. 실제 파일 I/O와 quota 예약의 권위: 현재 NormalStartFileStore의 거래 read는 채널 전체64MiB/10000행을 반환하며 파일1개 상한도3MiB다. host는 요청/응답65536B·채널64회·10초이므로 단순 ALLOCATE/RESUME과 전체 native I/O 전달만으로는 최대 입력을 처리하지 못한다. 원자 배타 안에서 전체 체인 검산·append·재조회·observations→acks 잠금 순서를 유지하는 구체적인 내부 전송/저장 주체가 필요하다.
2. 재시작 정착과 전체 quota: 파일 sync나 dev/ino의 거래 내 대조만으로 Windows 부모 metadata 정착·세션 간 identity를 입증하지 못한다. 기존 파일3MiB·채널64MiB/10000행과 P02 spool1GiB의 실제 전체 잔량/예약 주체를 함께 검산해야 한다. native 준비 원장의64MiB를 공유하거나 별도256MiB 후보를 기존1GiB에 무조건 더했다고 안전을 주장하지 않는다. DPAPI 암호화·storage.observe 성공도 배정표식만으로 주장할 수 없다.

검토 중인 방식은 목적별 native 검산/저장, 고정 snapshot과 원 기한에 묶인 유한 다중 전송, 또는 native가 검증된 부모/root handle을 보유하고 같은 owner의 Node I/O와 native quota 예약을 결박하는 방법이다. 각각 기존 한도·배타·파일 identity·취소/불명에 대한 실현 가능성을 먼저 대조한다. 안전 근거와 최대 유효 입력 처리가 확인되지 않으면 완결된 후보나 구현 가능으로 보고하지 않는다. 현재는 제품 코드 GO0이다. 이 결정과 무관한 FN10/UI04 승인 기능 구현을 계속한다.

## 추가 소스 대조

native Retain은 삭제 공유 없이 부모/root handle을 보유할 근거가 있으나 host 종료 때 해제된다. Node의 이미 시작한 write/sync가 그 뒤 정착할 수 있으므로 사후 owner 검사만으로 전체 수명을 설명할 수 없다. 기존 store는 거래 최초 lstat(root)를 기준으로 삼고 원 native 배정 identity와 직접 대조하지 않는다. 읽기는 lstat/open/fstat·사후검산, 쓰기는 wx/fstat/write/sync지만 nlink 검사는 없고 O_NOFOLLOW 미지원 시0이며 lock 해제는 최종검산 후 경로 unlink다. 부모 보유만으로 자식 교체와 검사/삭제 사이 변경까지 막는다고 주장하지 않는다. 기존 store가 제외한 동일 OS 사용자 공격 보호를 새로 충족했다고 주장하지도 않는다. 이 차이는 기존 위협모델과 새 권위 보장의 정확한 범위를 먼저 정해야 한다는 뜻이며, 새로운 전면 방어를 임의 필수조건으로 추가할 근거는 아니다.

quota 예약은 첫 lock 생성 전에 필요하고 거래 콜백의 최종 append량은 그 뒤 결정될 수 있다. 최초 예약 단위/최악 크기, 모든 등록 writer의 참여, 실제 점유/신원 검산 뒤 정산, host 사망·부분쓰기/삭제 불명 시 예약 보존을 정해야 한다. 같은 owner의 Node I/O 방식은 IPC 용량 문제를 줄이지만 원 배정 identity·수명·미정착 예약을 결박하는 구체 프로토콜은 아직 확인되지 않았다. 추가 검토는 제품/시험 읽기뿐이며 실제 파일/ACL/컴파일/실환경 실행0이다.
