# IX01 IPv4 관측 — 두 단계 단회 실행 의사결정 후보

## 1. 상태와 보존

기준 `834b998fa97bdc14bc3b30ec7d93b350c3d358c4`. 이 문서는 PMO 회신을 반영한 **미완성 의사결정 후보**다. 실제 실행 승인, 운영 포트 완성, 현재 도구·설정·신뢰 검산 또는 ip 신원 확보를 뜻하지 않는다. 이 문서 작성에서는 소스/시험/기존 문서 변경, 실제 파일·키·설정 조사, 프로세스·네트워크 호출을 수행하지 않는다.

기존 [읽기 관측안](IX01_SUBNET_CANDIDATE_READ_ONLY_PLAN.md)의 주소/route/IPAM 투영 범위와 보존 예외를 넓히지 않는다. A1~A14/N1/N2의 컨테이너·DB·로그·내용을 읽거나 변경하지 않는다. 전용 CIDR을 예약/선택하여 실행하는 안이 아니다. 원 관측 결과도 관측 시점의 후보일 뿐 운영 예약이나 TC01 통과가 아니다.

보존할 소스 산출물:

| 대상 | 길이 | SHA256 |
| --- | ---: | --- |
| native CJS 원 바이트 | 59,073B | DA375F17E1CCFBC4A1BD85AF108EE82C0A8398A061DCED888427725223BB6D8D |
| 고정 ESM wrapper 문자 | 3,672B | CCF403D8B3281063C972D192725D66DA0808F8B90180AE19952848FE3FC8BC75 |
| carrier 소스 | 8,334B | 263FD78210E4BD2997DA022510C0C1C1A5931C6B31649EA029F332D551C0C1EC |

합성 예시 적재물 83,083B/C662DF2D…는 운영 입력 지문이 아니다. 실제 ip 측정과 승인/기한 값이 결정된 뒤 원 조립기로 운영 적재물 길이·SHA256을 산출해야 한다. 원 7374964b·03221a62 번들 이력은 그대로 보존한다.

## 2. 선택할 최소안과 기존 단회 범위의 차이

현재 carrier는 시작 전에 ip 기대 지문 및 전체 payload hash를 요구한다(`qa-ix01-subnet-observation-carrier.ts:26–33`). 아직 실제 ip 지문이 없으므로 기존 carrier를 그대로 한 번 실행하는 계획은 닫히지 않는다. 다음 **한 개 상위 시도 안의 두 단계**를 선택 후보로 제시한다.

1. **메타 사전검산 SSH 최대 1회:** 이미 신뢰하는 Windows OpenSSH/등록 alias/host trust로 같은 WSL에 접속하여 고정 Node와 OS 관리 ip 파일의 한정 신원·현재 측정값만 확인한다. ip/Docker 명령, 주소/route/IPAM 관측은 0이다.
2. **관측 SSH 최대 1회:** 1단계가 정상 수거되고 검수된 경우에만 측정된 ip 신원을 고정 입력에 넣어 기존 native CJS/ESM/carrier로 원 6단계 관측을 한 번 수행한다.

이는 기존 **SSH 총 1회**와 달리 **전체 최대 2회(단계별 최대 1회)**다. 1단계는 기존에 없던 도구 파일 metadata/바이트 측정이며, Windows 로컬 단회 기록 쓰기도 기존 무파일 원격 관측과 구별되는 효과다. 이 차이를 명시 채택하기 전 1단계 결과로 2단계 권한을 자동 생성하거나 기존 승인을 승계하지 않는다. 메타 사전검산만 승인된 경우에는 결과를 반환하고 끝낸다.

권장 시간 후보는 기존 승인 후 30분 이내라는 상한을 유지하면서 **첫 SSH 진입부터 두 단계·중간 조립·수거 합계 최대 60초**, 메타 단계 최대 10초, 이후 관측은 원 절대 종료까지 남은 시간만 사용하는 것이다. 관측의 개별 도구 최대 10초/마지막 최대 1초 수거 예산은 유지한다. 첫 단계 뒤 기한을 새로 시작하지 않는다. 이 시간 안에 끝난다고 보증하지 않으며 부족하면 UNKNOWN/중단이다. 단계별 60초로 늘리는 안은 제시하지 않는다.

## 3. Windows 신뢰와 설정: 실행 전에 확인할 범위

기존 OS 신뢰·배포와 등록된 `WSL-server` alias를 출발점으로 삼는다. 과거 N4 터널의 파일 SHA를 현재 OpenSSH 신원으로 채택하지 않는다. 선택된 기존 `C:\Windows\System32\OpenSSH\ssh.exe`의 현재 원바이트 지문은 **OS 배포 provenance를 확인한 파일의 현재 측정**이며, 측정값 하나가 신뢰를 새로 만드는 것은 아니다.

실제 준비 포트는 선택된 파일과 부모 경로의 변조/재분석 지점 여부, OS 관리 신원 및 기존 신뢰 근거를 읽기 전용으로 확인해야 한다. 인증서·OS 배포 근거를 검산할 경우 네트워크 revocation/download 없이 가능한 정확 오프라인 방법을 소스 검수에서 고정한다. 그런 방법이 미구현/불명인 상태를 파일 hash 일치만으로 통과시키지 않는다. ACL·인증서·설치 상태를 수정하지 않는다.

현재 선택 alias에 관여하는 기존 user/system 설정과 실제 Include 범위, 설정 발동 조건, 목적 host/port/user와 기존 host trust를 정적으로 제한 판독한다. 원문·계정·host key·경로 목록은 출력하지 않고 내부 결박 지문과 제한된 판단만 보존한다. 비밀키/credential의 내용은 조사하지 않는다. 향후 허용된 SSH 자체가 기존 인증 방법을 쓰는 것과 도구가 키를 읽어 복사/출력하는 것을 구분한다.

안전한 실제 설정 검산 방법은 **실행 없는 닫힌 구문 판독**이다. `ssh -G`조차 Match exec를 평가할 수 있으므로 사전검산 수단으로 호출하지 않는다. Include 경로/양, token·환경 치환, Host/Match 조건의 실제 적용을 정확히 닫을 수 없으면 중단한다. Match exec 또는 외부 프로그램·추가 연결·신뢰 변경을 유발할 수 있는 미검산 분기는 실행해 결과를 알아내지 않는다. 임시 config 생성, `-F none`으로 alias 우회, 자동 host 신뢰 등록/갱신은 하지 않는다.

carrier의 고정 인자는 BatchMode/StrictHostKeyChecking, ClearAllForwardings, ForwardAgent/ForwardX11/ForwardX11Trusted/Tunnel 비활성, ProxyCommand/ProxyJump/LocalCommand/PermitLocalCommand 비활성, ControlMaster/ControlPath/ControlPersist 비활성을 유지한다. `UpdateHostKeys=no`, `AddKeysToAgent=no`, `VerifyHostKeyDNS=no`를 유지한다. 이 플래그가 설정의 모든 해석 효과를 제거한다고 주장하지 않는다. 실제 선택된 설정/신뢰와 실행 직전 재검산이 모두 필요하다.

현재 image/config/known_hosts의 정확 파일 집합·지문 및 위 오프라인 판독 구현은 미확정이다. 이를 임의의 VERIFIED boolean이나 합성 지문으로 채우지 않는다.

## 4. ip 최초 측정과 이후 동일성

ip 파일을 읽기 전에 새 독립 SHA를 반드시 확보해야 한다는 gate를 추가하지 않는다. 이미 신뢰하는 OS/등록 SSH host/고정 Node 아래에서 OS가 관리하는 정확 ip 경로의 provenance를 먼저 확인하고 해당 파일의 SHA256을 측정한다. 처음 측정한 SHA는 출처 신뢰 자체가 아니라 **그 뒤 교체를 발견하기 위한 기준**이다.

원 host가 허용하는 네 위치(USR_BIN/USR_SBIN/BIN/SBIN) 중 하나를 사전검산 입력에 명시 고정한다. 위치는 실제 OS 배포 근거를 대조해 최종안에서 확정하며, 부재/다름이면 다른 위치를 순회하거나 자동 대체하지 않는다. 정확 경로와 부모의 소유·mode·일반 파일·symlink/실경로·단일 link·dev/ino·길이와 전후 metadata를 기존 host 규칙에 맞춰 대조한다. 원 OS 관리 근거를 확인할 수 없으면 측정 hash만으로 채택하지 않는다.

한정 메타 helper는 기존 고정 Node 신원·UID/host·빈 env를 먼저 대조하며 ip 파일을 **실행하지 않는다**. 읽는 파일 상한은 기존 host의 160MiB, 분할 read는 65,536B를 넘지 않고 원 기한을 전후 확인한다. OS provenance 확인에 추가 설치 DB/광범위 파일 탐색이 필요하다면 그것을 숨겨 실행하지 않고 필요한 정확 범위를 다시 결정한다. ip 원바이트·설정 원문·원 경로를 반환하지 않는다.

메타 반환은 원 시도/기한·고정 helper hash에 결박한 위치 enum, 원바이트 SHA/길이 및 검산된 최소 metadata로 제한한다(단일 UTF8 JSON 최대 4,096B). 실제 형상과 metadata 중 내부 보존할 필드는 helper 소스 검수에서 고정해야 한다. 이것은 공개 제품 응답이 아니다.

2단계 host는 받은 expected SHA를 원 파일에 다시 대조하고 기존 파일/부모 pin·현재성 검산을 반복한다. 첫 측정 후 파일/경로/metadata/지문이 바뀌면 효과0으로 끝낸다. 두 SSH 사이의 원자적 파일 보유나 root 변경 방지를 증명했다고 하지 않는다. 읽은 측정값을 로그/문서에서 가져온 임의 입력으로 교체하지 않는다.

## 5. 단발 기록·한도·실패 분기

Windows 로컬 **외부 감독**이 원 상위 시도와 단계별 단회를 소유한다. 기존 메모리 factory의 spent나 proof echo는 지속 소진 원장이 아니다. 원격에는 checkout·임시 파일·외피·원장·설정 파일을 만들지 않는다.

로컬 기록 경로와 현재 사용자 소유/접근 조건은 최종 실행안에서 정확히 고정해야 한다. 현재 경로를 조사하거나 새 ACL을 부여하지 않는다. 구현은 선택된 안전한 부모 아래 배타 생성·정착 확인만 허용하며 기존 기록을 덮거나 복구/삭제하지 않는다. 배타 생성/flush/정착이 불명이면 해당 단회를 소진된 것으로 보존하고 SSH0 또는 후속 단계0으로 닫는다.

원 기록에는 상위 승인/계획 지문·정확 source commit, Windows carrier 신원/설정/신뢰 결박, 두 단계의 허용 여부와 횟수, 절대 기한, 단계별 고정 helper/payload hash·길이·시도·소비와 제한된 결과만 둔다. 첫 단계 정상 후 2단계 payload를 파생할 수 있는지까지 상위 결정에 포함한다. 실제 측정 입력으로 만들어진 2단계 binding에 별도 배타 consumed 기록을 정착시키고 기존 verifyConsumed에 연결한다. 새 바인딩은 승인 발급이 아니다.

관측 payload는 기존 98,304B 상한, 입력 1,024B 상한, 원 CJS 59,073B/고정 hash를 유지한다. 관측의 daemon→시작 ID→IPv4 주소→전체 table route→각 원 ID IPAM→종료 ID 순서, 호출당 stdout 1MiB·누적 8MiB, 최종 결과 4KiB, 도구 stdin/stderr ignore를 유지한다. SSH stdin/stdout은 원 handle에만 연결하며 stderr는 저장/출력하지 않는다. collector listener·기한 timer의 성공 등록 뒤에만 stdin을 보낸다.

메타 정상 출력만으로 다음 단계를 열지 않는다. 정확 원 handle의 입력 finish·출력 end·정상 close 및 결박·기한을 모두 수거해야 한다. 관측도 원격 직접 자식 완료 envelope와 같은 SSH 종결을 함께 요구한다. 종료 요청/exit/로컬 SSH 종료를 실제 원격 종료로 승격하지 않는다.

거절·오류·불명·잘림·기한 초과는 후속 연결/조회/재시도/재시작/자동 삭제0이다. 메타 실패면 관측0, 관측 실패면 결과 보존 후 종료한다. 원 직접 도구의 기존 종료요청 최대1회·유한 수거는 유지하되, 원격 Node/SSH 자체가 반환하지 않을 때의 원 handle 감독/회수 책임은 실제 local-host 구현과 실행안에서 별도로 고정한다. PID/group 또는 새 연결로 확인하지 않는다.

## 6. 다음 정확 소스와 최소 검수

아래는 아직 배정/구현/실행 승인이 아닌 최소 후보다. 기존 59,073B 번들·ESM wrapper·carrier·collector는 변경하지 않는 것을 우선한다.

| 후보 경로 | 닫아야 할 실제 포트/검수 |
| --- | --- |
| scripts/qa-ix01-subnet-observation-local-host.ts 및 대응 unit 시험 | Windows OS 배포 신원·효과 없는 config/trust 판독, 외부 원장 배타 생성/정착, 고정 SSH start/sendEnd의 원 handle 소유를 현재 carrier에 연결. 실제 OS 증거 공급·정착은 모형 결과와 구분 |
| scripts/qa-ix01-subnet-observation-preflight.ts 및 대응 unit 시험 | 사전 고정한 ip 위치의 OS provenance·원 파일 전후 측정만 수행하는 무파일 Node 메타 helper와 4KiB 완료 검산. 관측 명령/DB/키 접근0 |

필수 합성은 원장 누락/중복/정착 불명 start0, alias·config 부작용/신뢰 불명 start0, metadata와 hash 이후 교체 관측0, 단계1 실패·늦은 결과 단계2=0, 공유60초 소진 시 새 연결0, 단계별 최대1·결과-after-close, 잘림·원 예외 원문0이다. 소스/합성이 끝나도 실제 OS provenance와 SSH 효과·ip 측정이 완료된 것으로 표시하지 않는다.

## 7. 남은 결정

**결정할 한 묶음:** 기존 SSH 총1회 관측을, 같은 승인·시도·공유60초 안의 메타 SSH 최대1회 + 관측 SSH 최대1회로 바꾸고, 한정 Windows 현행 신원/config/trust 판독·로컬 외부 단발 기록 쓰기와 WSL OS 관리 ip 파일 최초 측정을 포함할지 여부다. 보존 네트워크의 한정 IPv4 IPAM 예외 및 원 직접 자식 종료요청·수거 효과도 같은 실행 범위에서 명시해야 한다.

이 선택과 필요한 소스 검수 뒤에 정확 로컬 원장 위치·설정/trust 범위, ip 위치/provenance 방법, helper/source commit·바이트 지문, 원 handle의 절대 기한 감독을 고정해야 실행안이 완성된다. 현재는 실행 명령을 발행하거나 자동 승계할 수 없다.
