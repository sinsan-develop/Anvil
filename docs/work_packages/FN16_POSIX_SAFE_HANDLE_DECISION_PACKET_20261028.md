# FN16 POSIX 안전 파일 어댑터 — 기술 경계 결정 요청

2026-10-28 · Main 어울 · 상태: 미채택 후보 / 제품 변경 없음

## 현재 완료와 남은 구현

직접 승인 3FAD0CE9·계약5A6819의 서버/화면/미적용0054/합성 검증은 d44d7caff3323a88f5ecf6ea593929aa4cfd9550까지 게시했다. 실제 키·DB·서비스는 제외 상태다. InstallationResourceCatalog.prepareSlot은 안전한 실제 공급자가 없어 RESOURCE_UNVERIFIED로 거절한다. 이는 미구현 경계이며 합성 시험으로 실제 슬롯 사용 가능 판정을 대신하지 않는다.

## 실제 확인한 차이

- 계약§3은 부모/파일 정체성, no-follow, 배타 생성/게시, 부모 sync와 자기 파일만의 정리를 요구한다. 기존 경로 확인 후 open/stat 방식만으로 확인과 사용 사이 교체 방어가 충족됐다고 할 수 없다.
- Node24 공개 fs는 FileHandle의 stat/sync와 path 기반 open/link/rename/unlink를 제공한다. 공개 dirfd 상대 openat/linkat/unlinkat는 확인하지 못했다. 로컬24.22.1 win32 관측 f4bde8도 해당 함수 undefined이며 Linux 실측은 아니다.
- Linux O_NOFOLLOW는 마지막 경로 성분에 적용된다. unlinkat도 expected inode를 조건으로 삭제하는 API가 아니다. 따라서 native를 추가하는 것만으로 소유 삭제와 악의적 같은 UID writer 대응을 증명하지 못한다.
- 기존 Node/TypeScript 기술 구성에 Linux native 제품 산출물의 빌드·배포·로드 규칙은 고정돼 있지 않다. 실제 라이브러리 설치·컴파일·로드·OS 시험은 이번에 수행하지 않았다.

## 권장 결정과 정확한 신규 경계

A: 기존 Node 프로세스 안에서만 사용하는 소형 Linux Node-API 모듈을 상세 설계 후보로 채택한다. 새 daemon/관리자 권한/capability/네트워크/공개 API/DB 변경 없이 dirfd 기반 root·parent, no-follow 생성/열기, 열린 파일과 같은 inode의 배타 게시, parent fsync를 내부 포트로 제공하는 안이다.

새로 고정할 사항은 native source와 제품 바이너리의 공급/로드 지문, Linux·로컬 FS 지원 범위, 소유/단일 writer 전제, native 메모리·FD 수명, 게시/정리 결과 불명 시 보존과 UNKNOWN 처리다. 지원하지 않는 환경과 실제 검증 전에는 UNCONFIGURED/UNVERIFIED를 유지한다. /proc/self/fd 문자열 접근을 검증된 동등 구현으로 간주하지 않는다. 같은 UID의 임의 악성 프로세스까지 방어한다고 새로 약속하지 않으며 이 위협·설치 전제를 확정해야 한다.

B: 현재 source-only 공급자 차단을 유지한다. 이는 실제 파일 어댑터 구현 완료가 아니며 백업 준비의 실제 사용은 열리지 않는다.

PMO에 필요한 결정은 A의 기술/위협 경계를 채택해 상세 계약·정확 허용 파일·합성 검증 계획을 작성할지다. 이 후보 자체는 native 코드 저장/컴파일/로드나 실제 키·DB·서비스 사용 승인이 아니다. 본문 작성은 기존 일반 방법으로 보장을 약화해 우회하지 않기 위한 결정 자료다. 기존 사용자 승인이 내부 구현 선택까지 이미 포괄한다고 판단하면 그 범위와 근거를 명시해 불필요한 재승인 없이 진행할 수 있도록 회신한다.

## 후속 검증과 현재 제외

상세 계약 후 코드/합성 검증은 OS 증거와 분리한다. 실제 Linux의 부모 교체·배타 게시·동기화 실패·정리 경쟁 검증은 별도 정확 격리 실행안에서 다루며 원본/운영 경로·실제 키/DB·서비스를 사용하지 않는다. 현 P03 R2 소진 실행, 기존 volume/원장, 만료 인증서 또는 DB 복구를 이 결정으로 재실행하지 않는다.

근거: [Node24 fs](https://nodejs.org/docs/latest-v24.x/api/fs.html), [Linux open](https://man7.org/linux/man-pages/man2/open.2.html), [Linux unlink](https://man7.org/linux/man-pages/man2/unlink.2.html). 프로젝트 원문: FN16_INSTALLATION_RESOURCE_PORTABLE_KEY_CANDIDATE.md §3/§8, TECH_DECISIONS.md §2/§3, installation-resource-catalog.ts.
