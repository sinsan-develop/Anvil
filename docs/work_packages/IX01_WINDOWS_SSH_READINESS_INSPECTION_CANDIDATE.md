# IX01 Windows SSH 준비 상태 — 한정 읽기 1회 후보

## 1. 상태와 목적

기준 `65289bba270605490d8a028ff54a773d09ddf0e3`. **문서 검토 후보이며 실제 읽기·실행 승인이 아니다.** 현재 Windows OpenSSH/기본 설정·기존 trust/Anvil 원장 부모의 한정 사실을 확인하여 기존 `qa-ix01-subnet-observation-windows.ts`의 미구현 `review()` 입력을 고정하는 것이 목적이다. 관측 가능한 메타데이터를 실제 SSH 접속 성공이나 실행 권위로 승격하지 않는다.

이번 문서는 신규 문서 한 파일만 작성한다. 아래 경로의 현재 존재·내용·ACL·지문을 읽지 않았으며 SSH·WSL·ip·Docker·DB·Agent 호출, 원장·설정·권한 쓰기 및 Git 실행은 없다.

역사 근거는 `WORK_STATUS.md:19654`의 WSL-server HostName/Port/User 제한 판독과 `:20567`의 `9cfbaa` strict 접속 당시 SINSAN/UID1000 확인이다. 이 기록은 현재 설정 전체·trust·Windows 파일 집합이 동일하다는 증거가 아니다. 과거 터널의 exe SHA도 현재 값으로 채택하지 않는다.

## 2. 고정 읽기 집합

아래는 **읽기 허용 대상으로 제안하는 절대 경로**다. USER/SYSTEM 기본 경로는 저장 소스에서 실제 설치판의 기본값으로 입증된 사실이 아니다. 현재 OS가 이 배치를 사용한다는 근거까지 확인되지 않으면 `DEFAULT_SCOPE_UNCONFIRMED`로 끝내며, 환경변수·레지스트리·사용자 프로필 탐색으로 다른 위치를 찾지 않는다.

| 역할 | 정확 제안 경로 | 허용 내용과 한도 |
| --- | --- | --- |
| SSH_IMAGE | `C:\Windows\System32\OpenSSH\ssh.exe` | 일반 파일·부모 metadata/owner/ACL 및 원바이트 SHA256, 최대 64MiB, 실행0 |
| USER_CONFIG | `C:\Users\cyhuh\.ssh\config` | metadata/ACL·SHA 및 메모리의 제한된 설정 판독, 최대 64KiB |
| SYSTEM_CONFIG | `C:\ProgramData\ssh\ssh_config` | metadata/ACL·SHA 및 메모리의 제한된 설정 판독, 최대 64KiB |
| USER_TRUST | `C:\Users\cyhuh\.ssh\known_hosts` | metadata/ACL·SHA 및 기존 공개 host trust 형상만, 최대 1MiB |
| USER_TRUST_2 | `C:\Users\cyhuh\.ssh\known_hosts2` | 같은 검사, 최대 1MiB |
| SYSTEM_TRUST | `C:\ProgramData\ssh\ssh_known_hosts` | 같은 검사, 최대 1MiB |
| SYSTEM_TRUST_2 | `C:\ProgramData\ssh\ssh_known_hosts2` | 같은 검사, 최대 1MiB |
| LEDGER_PARENT | `D:\Project\Anvil\.av3-data` | 디렉터리 자체와 고정 상위 체인의 metadata/owner/ACL만, 목록·자식 내용0 |

trust 이름은 각 user/system 위치의 기본형과 `2` 접미사 두 variant로만 한정한다. 서로 대체 위치를 검색하는 규칙이 아니다. 정확 부재는 `ABSENT`, 접근 실패·형상 불명은 `UNKNOWN`으로 구분한다. 설정 또는 trust 하나가 없다는 사실만으로 다른 위치가 권위 있다고 결론내리지 않는다. 필요한 기존 trust를 이 집합으로 입증할 수 없으면 준비 완료가 아니다.

원장 부모 후보는 `scripts/run-fn03-native-content-compile-only.ps1:30` 및 `scripts/development-recovery-path-guard.cs:15`가 사용했던 정확 Anvil 경로다. 현재 안전한 원장 부모로 확인됐다는 뜻은 아니다. `C:\Anvil-QA\consumed` 합성 fixture를 실제 위치로 채택하지 않는다. 부모 부재나 조건 불일치 시 생성·ACL 수정·대체 부모 탐색 없이 끝낸다. 실제 후속 원장 파일은 이 읽기에서 확인·생성하지 않는다.

각 고정 경로의 부모는 그 문자열에 포함된 루트까지의 체인만 검사한다. 디렉터리 열거·glob·하위 재귀·다른 사용자/드라이브 탐색은 없다. ReparsePoint/심볼릭 링크·판독 중 교체는 UNKNOWN이다. OS 관리 exe leaf의 정상 hard link 여부는 기존 SystemLeaf 검사와 구분하며, 이를 사용자 설정·trust 경로의 링크 허용으로 확대하지 않는다.

## 3. 설정과 비밀의 경계

`ssh.exe` 자체를 호출하지 않는다. `ssh -G`, `ssh -V`, `ssh-keygen`, agent 질의, DNS/TCP, 키 파일/credential/certificate store/패키지 DB 조회, `-F none`, 임시 config 및 자동 trust 등록·갱신은 없다. 알려진 host의 공개 trust 파일을 한정 판독하는 것과 개인키를 여는 것을 구분한다. 개인키/IdentityFile의 대상, agent socket, 비밀번호·토큰은 읽지 않는다.

기본 config 두 파일은 원 바이트를 유계 메모리에서만 처리한다. `Include`를 발견하면 대상 경로를 해석·읽지 않고 즉시 `INCLUDE_UNCONFIRMED`로 중단한다. 사용자 지정 `UserKnownHostsFile`/`GlobalKnownHostsFile`, `KnownHostsCommand`, 기타 trust 공급 경로 또는 추가 프로그램/연결을 요구하는 설정은 값·대상을 출력하거나 따라가지 않고 `CUSTOM_SCOPE_UNCONFIRMED`로 중단한다.

Host/Match, 조건·token·환경 확장, 중복 지시의 우선순위를 현재 선택 `WSL-server`에 대해 확정할 수 없으면 `CONFIG_UNCONFIRMED`다. 특히 `Match exec`는 평가하지 않는다. ProxyCommand/ProxyJump/LocalCommand 및 agent/forwarding 관련 실제 설정을 검사 없이 안전하다고 보지 않는다. 고정 carrier 플래그가 모든 config 해석 효과를 막는다고 주장하지 않는다.

새 범용 parser가 반드시 필요하다고 선결하지 않는다. 허용된 기본 파일의 실제 닫힌 형상을 확인한 뒤, 기존 정적 판독이나 정확한 제한 형상 검산으로 충분한지 판단한다. 그 범위를 넘는 설정이면 이번 1회는 UNKNOWN으로 끝내고 추가 읽기/수정 없이 필요한 범위만 보고한다.

현재 Windows launcher의 빈 env와 System32 cwd는 합성 후보다. WSL Node의 고정 빈 env와 별개이며 기존 alias·agent 인증 호환이 검증된 값이 아니다. 이 읽기는 현재 전체 환경을 덤프하지 않는다. 실제 필요한 최소 Windows env가 미확정이면 `WINDOWS_ENV_UNCONFIRMED`를 남기고, 실제 연결 전에 exact env와 실제 적용 config 집합을 실행안에 결박한다.

## 4. 기존 검사 재사용과 보증 한계

- `scripts/run-fn03-native-content-compile-only.ps1:111–128`의 `Get-CheckedItem`: 정확 파일/디렉터리 유형, 부모 체인의 reparse/link와 SystemLeaf owner 조건을 읽기 전용으로 재사용할 수 있다. 전체 컴파일 runner를 실행하거나 dot-source하여 다른 효과를 여는 방법은 사용하지 않는다.
- 같은 파일 `:131–145`의 `Assert-PrivatePath`: 현재 사용자 SID 및 USER/SYSTEM ACL 검사 논리를 원장 부모 후보에 적용할 수 있다. 기존 조건 불일치는 읽기 거절이며 ACL 재작성 사유가 아니다. 이 private 조건을 OS 설정/trust의 허용 owner 정책으로 자동 복사하지 않는다.
- 같은 파일 `:147–149`의 길이/SHA 대조와 `scripts/development-recovery-host.ps1:154–162`의 8,192B 분할/64MiB/기한 확인 패턴을 재사용한다. 최초 측정 SHA는 현재성 비교 자료이며 새 OS provenance를 발급하지 않는다.
- `scripts/development-recovery-host.ps1:126–152`의 owner/ACL digest·attributes 전후 비교는 메타데이터 검산이다. 해당 소스가 명시하듯 native FileId 고정이나 이름 교체 방지의 증거가 아니다. 동일 소스의 실행 금지 latch를 우회하여 호출하지 않는다.
- `apps/connector/native/ProviderHandleFiles.cs:40–77`에는 원 handle의 volume/file identity·최종 경로 및 no-share-delete 부모 보유 구현이 있다. 이번 문서만으로 provider 전용 root/권한을 IX01에 이월하거나 C# 컴파일·새 native host를 실행하지 않는다. 그런 강한 pin이 필수라는 결정도 이 읽기 후보가 임의로 추가하지 않는다.

현재 준비에 필요한 것은 기존 OS/SSH 신뢰 아래의 한정 사실과 불명 구분이다. OS 관리 파일 owner·metadata를 독립 서명/패키지 provenance 전체 확인으로 표현하지 않는다. 인증서 체인/온라인 revocation을 새 기본 gate로 넣지 않는다.

## 5. 단회 수거·출력·시간

실제 승인된다면 Main이 정확 검사 소스·실행 host·승인/계획 SHA와 한 시도를 먼저 고정한다. 기존 신뢰된 Windows 로컬 감독의 **한 원 PowerShell 프로세스**에서 profile/interactive 없이 제한된 .NET/PowerShell 읽기만 수행하는 안이다. 외부 SSH/C#/컴파일/설치/하위 도구 호출은 0이다. 과거 PowerShell 버전/파일 hash를 현재 신원으로 무조건 승계하지 않으며, 현재 사용할 원 실행 host의 근거도 최종안에 명시한다. 검사 소스/launcher는 아직 작성·동결되지 않았다.

후보 한도는 승인 후 30분 이내 착수, 원 검사 전체 60초, 각 파일 분할 판독 10초 이내다. wall/monotonic을 전후 확인하고 초과·실패 뒤 다음 파일 읽기0이다. 일반 파일 크기를 먼저 제한하며 전체 내용 상한은 exe 64MiB + config 128KiB + trust 4MiB다. metadata/ACL도 반환 크기를 제한하고 상한 초과는 UNKNOWN이다. 이 시간 검사는 동기 OS 읽기의 강제 중단을 보증하지 않는다.

같은 원 프로세스의 출력 종결과 정상 close까지 있어야 검사 결과를 수거 완료로 기록한다. timeout·종료 불명에서는 원 handle만 보존/수거하고 재실행·다른 프로세스 검색·kill·자동 삭제를 하지 않는다. 결과 한 줄만 먼저 도착하거나 요청한 종료만으로 완료를 주장하지 않는다.

반환은 UTF-8 단일 JSON 최대 4,096B, 고정 role enum별 `PRESENT/ABSENT/UNKNOWN`, owner/ACL/경로 검사 상태, 길이와 SHA256/ACL digest 및 고정 중단 코드로 제한한다. 실제 경로·계정·SID·HostName/Port/User·host key 본문/키 fingerprint·설정 줄·예외/stderr·원 파일 내용은 출력/로그/파일에 보관하지 않는다. 설정 원문은 필요한 판독 동안 메모리에만 두고 폐기하며 관리형 문자열의 즉시 소거를 보장하지 않는다. `INSPECTION_COLLECTED`는 한정 읽기 수거를 뜻하며 `SSH_READY`, 실제 인증 성공이나 관측 PASS를 발급하지 않는다.

## 6. 전체 실행안과 결정 구분

**권장안은 전체 실행 의사결정 안에 이 Windows 읽기를 선행 구간으로 포함하되, 현재 요청의 실행 효과는 이 읽기 1회까지만 명확히 한정하는 것이다.** 이유는 현재 기본 파일 집합·최소 env·원장 부모 및 verifier 근거가 미확정이어서, 실제 두 단계 payload/현재 carrier binding을 지금 정확히 고정할 수 없기 때문이다. 이를 확인하려고 SSH를 먼저 실행하거나 불명값을 VERIFIED로 채우지 않는다.

한 승인으로 Windows 읽기→메타 SSH→관측 SSH→원장 쓰기까지 묶는 것도 기술적으로는 가능하지만, 그러려면 읽기 결과의 허용 조건/중단 조건, 최소 env와 정확 기본 파일 집합, 후속 두 단계 source/적재물 및 원장 위치·동적 지문 결박을 **승인 전에 모두 검수 가능한 규칙으로 고정**해야 한다. 현재는 그 조건이 충족되지 않았으므로 이 문서가 자동 승계를 허용하지 않는다. Include/custom trust/불명 발견 시 한 승인 묶음이라도 그 시도는 종료하며 범위 확장은 없다.

분리되는 후속 효과는 기존 단회 관측안의 SSH 총1회를 메타 최대1회+관측 최대1회로 바꾸는 것, ip 파일 최초 측정, Windows 신규 배타 원장 쓰기, 보존 네트워크의 한정 IPAM 읽기 예외다. 이 Windows-only 읽기에는 어느 것도 포함하지 않는다. 기존 A1~A14/N1/N2 보존 및 실패/UNKNOWN 후 재시도0은 유지한다.

다음 준비는 이 문서의 고정 allowlist/출력/한도를 쓰는 검사 소스와 합성 검수, 그리고 `qa-ix01-subnet-observation-windows.ts:42–47,93–98`의 review 소비 연결이다. 실제 소스 closure에는 `preflight-carrier.ts:7`의 builder 재수출을 통한 Rolldown 로드도 포함되므로 최종 실행 source 목록에서 빠뜨리지 않는다. 원 관측 CJS 59,073B/DA375F17…와 원 wrapper/메타 번들 지문은 기존 고정값을 보존하고, 본 문서에서 재생성하거나 변경하지 않는다.

**남은 결정 한 건:** 위 고정 Windows-only 읽기 1회(외부 접속·개인키·쓰기0)를 전체 IX01 실행 준비의 선행 구간으로 허용할지 여부다. 검사 소스/원 실행 host와 정확 한도 결박이 동결되기 전에는 실제 실행하지 않는다.
