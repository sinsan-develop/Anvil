# IX01 읽기 관측의 원격 직접 자식 종결 — 소스 준비 후보

## 1. 상태와 보존 기준

기준은 `a782069aaae90f97e3d3912311a4bab369bea533`이다. 이 문서는 기존 준비 범위의 기술 후보이며 제품·스크립트 구현, 새로운 실행안, 단회 실행 승인 또는 실제 관측 결과가 아니다. 현재 관측안은 [IX01_SUBNET_CANDIDATE_READ_ONLY_PLAN.md](IX01_SUBNET_CANDIDATE_READ_ONLY_PLAN.md)의 **실제 관측 미승인** 상태를 유지한다. A1~A14/N1/N2 및 기존 자원에 접촉하지 않는다.

기존 `scripts/qa-ix01-subnet-observation-bundle.ts`의 원 입력 HEAD `5c7e889ffabe3e4d0e13800d8999e2cda1f0407c`, Rolldown `1.2.14`, 원 5소스 합계 38,742B를 보존한다. 기존 메모리 CJS는 35,390B, SHA256 `7374964b28227c507d9488a73b674074817e9a9b46712b68916f051f32a379e8`이다. 후보를 기존 번들과 같은 것으로 표시하지 않는다.

| 원 소스 | Git LF 바이트 | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-subnet-observation-host.ts | 13836 | 6c5edf5eb8bc2612a184c12a58ff8eca363d1a094febfb085d9f75b7a14e5ae5 |
| scripts/qa-ix01-subnet-observation-payload.ts | 7230 | 6af0a95bd7b1eab602469eaf8fc9f3c193c224b099d37c6e3b8829645297df72 |
| scripts/qa-ix01-subnet-projection.ts | 7376 | c43216df091683d7f5a4355570552121efdc23bff7d0953f29f2efb4d04b533e |
| scripts/qa-ix01-subnet-candidate.ts | 7314 | 1ce97ab13fa4734f3306262fe4fc5f4af514a1329d11d822f1a7cb83f1280110 |
| contracts/canonical.ts | 2986 | 5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143 |

## 2. 현재 확인된 경계

`host.ts:84–89`의 원 `spawnSync`는 고정 도구·인자·환경으로 호출하고 error/status/signal 및 stdout을 검사한다. `host.ts:105–108`은 동기 호출이 반환하지 않으면 JS가 전체 기한을 선점할 수 없음을 명시한다. 외부 감독에 직접 ip/docker 자식 객체를 제공하지 않는다.

현재 `subnet-observation-supervisor.ts`는 원 입력 finish·stdout end·close(0,null)의 **로컬 수거**만 구별한다. 정상 수거도 `UNKNOWN/REMOTE_COMPLETION_UNVERIFIED`이며 후보를 반환하지 않는다. 로컬 SSH close, timeout 또는 kill 요청만으로 원격 종결을 판정하지 않는다. 이 기존 함수의 의미를 변경하지 않는다.

## 3. 재사용할 순서와 한도

`payload.ts:75–111`, `projection.ts:76–111`의 다음 순서를 보존한다. 앞 단계의 검산과 원 자식 close가 끝나기 전 다음 단계는 0이다.

1. 고정 daemon `info --format`의 ID·Name 확인.
2. 시작 Docker network ID 목록 읽기.
3. `ip -j -4 address show`의 IPv4 주소·prefix 투영.
4. `ip -j -4 -details route show table all`의 모든 table 목적지·prefix 투영.
5. 시작 목록의 각 정확 ID에 기존 제한 template의 IPAM inspect를 순차 1회 수행.
6. 종료 ID 목록을 다시 읽어 시작 목록과 정확히 대조한 뒤 기존 후보 판정.

원 관측안의 **승인 후 30분 이내 strict SSH 1회, 연결 내 관측 전체 최대 60초, 개별 호출 최대 10초**를 유지한다. `payload.ts:24,62–69`의 호출당 stdout **1,048,576B**, 누적 **8,388,608B**와 기존 배열·IPAM 상한도 유지한다. stderr는 수거하지 않고 stdin은 도구 자식에 제공하지 않는다. host의 고정 도구/부모·UID·daemon/socket·환경·`--config /dev/null` 검산을 약화하지 않는다. 원 IPAM/주소/경로/이름/ID를 최종 출력에 넣지 않는다.

## 4. 단일 후보: 동일 WSL 감독의 순차 비동기 직접 자식 소유

고정 Node 감독 하나가 관측을 수행하고 ip/docker를 **직접** 생성·보유하는 비동기 경로를 후보로 삼는다. 별도 worker·일반 RPC·process group·PID 재탐색은 도입하지 않는다. 고정 `exec` 연결을 통해 이 Node가 원 SSH 세션의 명령이 되도록 하는 진입은 후속 실행안에서 정확히 고정해야 한다. 이 문서가 원격 명령을 발행하지 않는다.

기존 동기 host/payload/projection에 Promise를 넣는 것은 유효한 연결이 아니다. 같은 순차 검산을 유지하는 비동기 변형을 별도로 만들고 각 읽기 포트 반환을 끝까지 await한다. 기존 동기 export와 원 Git blob/번들은 보존한다. 판정기와 canonical 입력 의미는 변경하지 않는다.

직접 실행 포트는 닫힌 도구·정확 argv·환경만 수락한다. 생성 직후 원 ChildProcess 객체를 지역 소유 집합에 넣고 원 객체 이벤트만 수거한다. stdout의 유계·fatal UTF8 검사, stdout end, error 없음, close(0,null), 현재 기한을 모두 만족한 뒤에만 결과를 파서로 넘긴다. exit 이벤트·출력 완성·종료 요청의 반환만으로 집합에서 제거하지 않는다. 다른 객체나 재사용된 요청의 이벤트는 채택하지 않는다.

기한은 wall과 monotonic 양쪽으로 확인하며 최초 종료시각을 연장하지 않는다. **후보 내부 예산**으로 각 호출의 최대 10초 중 마지막 최대 1초를 원 자식 수거에 남긴다. 전체 남은 시간이 1초 이하이면 새 호출 0이다. 정상 작업 구간의 시간 초과/전송·출력 실패 시 다음 읽기를 영구 차단하고, 아직 보유한 해당 직접 자식에만 기존 SIGKILL 의미의 종료 요청을 최대 1회 적용하는 설계를 검토한다. 요청과 close는 별개이며, 수거도 원 호출/전체 기한 안에서 끝나지 않으면 `UNKNOWN`이다. 이 종료 효과는 아직 구현·실행 승인된 것으로 취급하지 않는다.

실패 결과에 원 예외나 임의 신호/종료값을 포함하지 않는다. 실패·불명 후 추가 조회·재시도·재시작·자동 삭제·새 연결은 0이다. 기한 뒤의 늦은 이벤트가 있어도 후보를 다시 발행하지 않는다. OS가 종결을 제공하지 않거나 감독 자체가 응답하지 않으면 원격 잔여 부재를 보증할 수 없으며, 불명과 보존 책임을 남긴다. 유한 대기와 강제된 실제 종료를 같은 것으로 쓰지 않는다.

## 5. 고정 통신에서 대조할 완료 근거

후속 실행안이 고정할 입력은 정확 소스/번들 지문, 원 단회 시도 식별자, 원 승인 결박과 절대 기한이다. 식별자는 그 연결의 상관값일 뿐 새 승인·인증 권위가 아니다. 해당 값을 echo한 것만으로 성공을 인정하지 않는다.

새 완료 envelope는 기존 후보 JSON과 구별되는 목적/버전, 원 시도·번들/승인 결박, 고정 완료 상태와 기존 `CANDIDATE` 또는 `NO_CANDIDATE` 결과만 담는 닫힌 형상으로 검수한다. **완료 상태는** 원 감독이 모든 단계·시작/종료 목록·원 직접 자식 close와 소유 집합 잔여 0을 확인한 후에만 만들고, 이후 도구 호출은 금지한다. 원 stdout 자료·PID·기존 망 ID·주소·경로·예외는 포함하지 않는다. 최종 envelope도 기존 수거기 한도 4,096B 이내의 단일 UTF8 JSON으로 제한한다.

로컬 감독은 같은 원 SSH 객체의 stdin 완료·유계 단일 envelope·stdout 종료·정상 close를 확인하고 정확 고정 원격 exec의 종료 상태 및 원 시도/소스/승인/기한을 교차 대조한다. 원격 완료 envelope가 없거나 어긋나면 로컬 close가 정상이더라도 `UNKNOWN`이다. 원격 envelope만 있고 원 정상 종료가 없을 때도 후보를 채택하지 않는다.

이는 검산된 고정 프로그램이 같은 연결에서 반환한 직접 자식 수거 증거이며 독립 커널 증명이나 서명된 attestation이 아니다. 원격 root·도구 교체, SSH carrier 미검산, OS 무응답을 해결했다고 주장하지 않는다. 현재 collector는 이 새 형상을 수용하지 않는다. 별도 검수된 소비 경로와 진입 계약이 마련되기 전에는 현재 UNKNOWN 경계를 유지한다.

## 6. 향후 최소 소스/합성 검수 범위

아래는 미래 배정 후보이며 이번 문서 작성의 쓰기 범위가 아니다.

| 경로 | 필요한 한정 변경/검증 |
| --- | --- |
| scripts/qa-ix01-subnet-observation-host.ts | 기존 신원·명령 검산을 공유하는 비동기 직접 자식 소유 경로. 기존 동기 export 보존 |
| scripts/qa-ix01-subnet-observation-payload.ts | 기존 6단계/파서/총 출력 한도 그대로 순차 await 연결 |
| scripts/qa-ix01-subnet-projection.ts | 기존 읽기/시각·목록/형상 검산 그대로 순차 await 연결 |
| scripts/qa-ix01-subnet-observation-supervisor.ts | 기존 로컬 UNKNOWN 수거기 보존, 별도 고정 원격 완료 소비 검수. 임의 원격 완료 boolean/callback을 권위로 수용하지 않음 |
| scripts/qa-ix01-subnet-observation-bundle.ts | 원 manifest/번들 유지, 새 변형에 별도 exact closure·번들 지문. 원 후보 지문 재사용 금지 |
| tests/unit/IX01/subnet-observation-{host,payload,supervisor,bundle}.test.ts 및 subnet-projection.test.ts | 실제 자식 없이 해당 기존 RAM fixture로 변경된 경계만 검증 |

필수 반례는 정확 6단계 순서/단일 활성 자식, 결과-before-close, 다른 handle·중복/늦은 이벤트, child error/비0/signal/stdout 미종결, 호출/전체 기한과 수거 예산, 종료 요청만 성공한 경우, byte/UTF8/누적 상한, 실패 뒤 다음 호출 0이다. 원격 완료는 누락/다른 시도·소스·승인/오염/기한/잔여 자식, 로컬만 정상 종료, 원격 보고만 있고 로컬 종결 없는 경우를 모두 거절해야 한다. 정상 RAM도 실제 OS 종료·도구 신원·관측 승인으로 승격하지 않는다.

## 7. 별도 결정과 미확인

이 후보는 checkout·임시 파일·외피 저장 없이 stdin 메모리 전달을 유지하려는 소스 설계다. 새 통신 형상과 비동기 소스의 exact closure, 로컬/원격 진입 동일성, 60초 안의 직접 자식 종료 요청·수거 효과를 후속 소스 검수 및 **새 고정 실행안**에서 확정해야 한다. 원 관측안의 IPAM 예외와 실제 단회 실행 승인은 별도이며 이번 준비로 확대되지 않는다. 실제 ip 지문과 현재 도구/daemon·설정 신원, 원격 정상 종료, 후보 대역과 운영 예약은 아직 미확인이다.

이번 변경은 본 문서 1개뿐이다. 제품·시험·기존 문서·원 번들 및 실행안은 변경하지 않으며 실제 프로세스/원격 명령/관측을 수행하지 않는다.
