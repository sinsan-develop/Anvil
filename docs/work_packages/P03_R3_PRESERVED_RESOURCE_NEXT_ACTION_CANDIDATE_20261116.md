# P03 R3 보존 자원 마운트 재관측 결정 후보

**미채택 · 실행 0회.** 제안하는 결정은 기존 WSL-server에서 보존된 init 한 개와 원본·사본 볼륨의 신원 및 마운트 메타데이터를 한 번 대조할지 여부다. 승인 대기 또는 보류 중에는 세 자원과 원장을 그대로 보존한다.

## 이번 관측이 답할 질문

원 실행 `5909d3`은 `create-init / IDENTITY_UNKNOWN`으로 끝났고 init을 시작하기 전에 중단됐다. 독립 관측 `e76e5f`는 단일 `CAP_CHOWN`, 사본 볼륨 한 개의 이름·대상·쓰기 가능 여부를 확인했다. 고정 소스 `8d200333239f1bd7a7e8b6736a1492eb482e2de2`의 `ownLimited`는 단일 `CHOWN`만 받아 이 차이만으로 거절한다. 현재 개발 소스의 보완은 두 표기를 허용하는 RAM 검증을 마쳤다. 원격 checkout과 실행 결정은 여전히 8d에 결박돼 있다. 관측 결과는 8d의 limited 검사와 개발 기준 3858e225501306ffaf05a300ea226fd7e5160bd0의 strict·limited 검사에 각각 대입할 수 있게 남긴다. 기존 실행안 §4의 독립 종료 확인을 이번 추가 조회의 승인으로 간주하지 않는다.

남은 질문은 **보존된 동일 init의 현재 메타데이터가 8d의 나머지 마운트 조건에도 맞는가**이다. 당시 미수집 값은 `NOT_COLLECTED`로 남는다. 후속 관측은 새 시각의 자료이며, 모든 실행 시점 조건이나 유일 실패 원인을 확정하는 증거로 쓰지 않는다. 원 실행 결과는 `docs/04_test_reports/AV3/P03_R3_MAIN_REF_WINDOW_RESULT_20261116.md`에 있다.

## 대상과 허용할 조회

기존 strict SSH 별칭 `WSL-server` 한 곳, 기존 사용자 `daon`(UID/GID 1000), 호스트 `SINSAN`, 고정 Docker 소켓의 daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`만 사용한다. 기존 SSH·도구 신원 조건을 유지한다. 결정 시각과 새 관측 식별자를 기록하고 호스트·daemon·시간을 확인한 뒤 아래 순서로 대조한다.

| 순서 | 고정 조회와 비교 기준 |
| --- | --- |
| 1 | daemon info의 ID만 확인한다. |
| 2 | 원본 `anvil-v3-development-pgdata`를 이름으로 volume inspect한다. driver/scope=local/local, CreatedAt=`2026-10-16T03:53:33+09:00`, labels의 정확한 세 쌍(project=v3, owner=P03, instance=dc22a0629e79f259dcd935845e88e58e)을 대조한다. |
| 3 | 사본 `anvil-v3-pgdata-recovery-20261028-r3`를 이름으로 volume inspect한다. driver/scope=local/local, CreatedAt=`2026-11-16T00:42:17+09:00`, 정확한 다섯 anvil labels(project=v3, owner=project-main, instance=52e1a5269d3943269a1a340ce4da54a5, role=copy-volume, source-instance=dc22a0629e79f259dcd935845e88e58e)을 대조한다. Mountpoint는 후속 Source 일치 비교에만 쓴다. |
| 4 | container inspect는 fullID `99cc99d63c6283d8dc9dc3a3dab36be35d25a3e2009b373e2a8c7dff04ed6097` 한 개에 한정한다. Name=/anvil-v3-pgcopy-init-20261028-r3, Image=`sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, 정확한 네 anvil labels(project=v3, owner=project-main, instance=위 run, role=init), created·Running=false·시작/종료시각 0을 앞선 기록과 대조한 뒤 아래 투영만 반환한다. |

원본·사본의 귀속은 이름, 생성시각, daemon, driver/scope와 전체 label 집합으로 함께 판정한다. 컨테이너 이름 검색, 다른 ID 추적, 별도 볼륨 탐색, 원장·파일 내용 조회는 범위 밖이다. 하나라도 부재·교체·불일치이면 해당 단계에서 종료한다.

## 반환할 최소 증거

- `HostConfig.Mounts`의 항목 수·종류·전체 키 집합 일치와 비교값을 기록한다. 예상은 사본 volume 한 개, 정확한 이름·Target=/anvil-recovery-copy·ReadOnly=false·VolumeOptions의 유일 키 NoCopy=true다. 누락된 ReadOnly, 명시 false, null은 구분한다.
- `HostConfig.Tmpfs`는 유일 키 `/var/lib/postgresql/data`와 값 `rw,noexec,nosuid,nodev,size=33554432,uid=0,gid=0,mode=0700`의 정확 일치를 검사한다. runtime `Mounts`는 별도로 검사한다. 항목은 하나이며 8d의 정확 키 Type/Name/Source/Destination/Driver/Mode/RW/Propagation을 갖춰야 한다. 이름·대상·driver(local)·RW(true), Source와 위 사본의 Mountpoint 일치, Mode(빈 문자열 또는 rw), Propagation(빈 문자열 또는 rprivate)을 각각 판정한다.
- 현재 CapAdd/CapDrop의 정확 단일값(CAP_CHOWN 또는 CHOWN / ALL)을 구분해 함께 기록한다. 보고 형식은 대상 신원, 관측시각, 고정 필드별 일치·부재·null·다른 값·미관측 및 종료코드다. 알려진 값만 열거하고 예외 키/값은 개수·불일치만 남긴다. Docker의 지정 필드 투영을 사용하고 원 inspect JSON, Env, Cmd, 임의 labels, 실제 호스트 경로, 파일·DB 원문, 키 및 stderr 원문은 출력하거나 저장하지 않는다.

## 제안 한도와 중단

승인된다면 직접 승인 수신부터 **최대 30분**이며 창을 연장하지 않는다. strict SSH 연결 **1회**, 위 Docker 읽기 **최대 4회**(각 1회), 재연결·재시도 0회다. 이번 관측의 직접 승인 수신 시각 + 30분과 SSH 요청 시작 시각 + 30초 중 이른 시점까지 종료 확인을 포함한다. 도구 stdout+stderr 누적 수거는 최대 32 KiB, 반환하는 고정 투영은 최대 4 KiB로 제한한다. 시간·출력 초과, 연결 단절, 도구 오류 또는 불완전한 응답은 확인된 단계까지만 기록하고 나머지를 `UNKNOWN`으로 보존한다. 대체 조회나 자원 조작으로 결과를 추정하지 않는다.

## 후속 결정의 선행

- 원 R3의 grant·nonce·run·consumed.json·receipt.jsonl과 checkout을 보존한다. 해당 승인은 소진됐다. 이 관측으로 grant를 발급·재사용하거나 init을 시작·종료·제거하거나 볼륨을 마운트·복사·삭제하지 않는다.
- 관측 후에도 불일치가 있으면 해당 필드와 8d predicate에 대해 RAM 반례와 보존 조건을 검토한다. 개발 소스 SHA256 `57BADDB919102B9AC8C0CEF39ED361D2146021C340FC905BA6D53B329536A112`의 CapAdd 보완은 원격 실행 허가가 아니다.
- 새 복제안을 결정하려면 실행할 정확 commit 및 controller·shell 지문, 원본과 기존 부분 사본을 보존할 **충돌 없는** 대상 목록과 코드 결박, 추가 공간·소유·잔여 위험, 생성 전 consumer/귀속/기한 재검산, 새 승인·run·원장·한도를 먼저 고정해야 한다. 현재 R3 고정 이름은 점유되어 있다. 정리 여부와 새 실제 실행은 각각 별도 결정 대상이다. 이 후보로 PG 기동, SQL, 정식 복구 전환은 진행하지 않는다.
