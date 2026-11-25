# IX01 0076 benign 동일-FD launcher carrier 후보

- 작성일: 2026-11-26 KST
- 기준: `464c76bec5ec225dd2652619766a07c39cd6847c`
- 상태: `SOURCE_CARRIER_CANDIDATE_ONLY`
- 목적: 정상 실행담당자가 외부에서 확정한 원 단회 승인과 정확 보호 원문을, 기존 IX01 Windows→WSL 고정 route로 benign 동일-FD launcher에 한 번 전달할 최소 source diff를 고정한다.
- 제외: 승인·영수증·역할·키 발급, 실제 release/dispatch, SSH/WSL/Linux child/Docker/PostgreSQL 실행, 0076 migration, cleanup, 재시도, acceptance 판정.

이 문서는 `IX01_0076_SAME_FD_EXECUTION_CANDIDATE_20261125.md`를 이력으로만 비교한다. benign `/usr/bin/sleep` 관측과 후속 0076 PostgreSQL proof를 합치거나 서로의 승인을 전용하지 않는다.

## 1. 현재 실제 연결 판정

현재 launcher를 호출하는 제품 source는 없고 unit 시험만 직접 참조한다. 다만 실제 Windows OpenSSH 운송 기계는 이미 `scripts/qa-ix01-subnet-observation-windows.ts`에 있다.

- `nativePorts`는 System32 OpenSSH, 빈 Windows env, System32 cwd, `shell=false`, 원 stdin, 원 child와 배타 파일 handle을 보유한다(`:49-69`).
- `createSubnetWindowsSupervisor`는 review current, 로컬 O_EXCL 기록·flush·close와 종료 뒤 동일 파일 identity·size, timer 선등록, 원 child stream/close를 검산한다(`:77-140`).
- 고정 route는 `WSL-server`와 forwarding/proxy/local-command/control socket 차단을 사용한다. 그러나 현재 subnet 명령과 승인·소진 목적은 benign launcher와 다르므로 기존 `run`을 호출하거나 기존 receipt를 재사용하지 않는다.

FN03 sender도 동일한 운송 극성을 구현하지만 TC01 profile, checkout, CLI argv, wire와 결과 collector가 하드코딩돼 있다. 이번 최소 diff의 기준은 IX01 안에서 이미 실제 native port를 보유한 `qa-ix01-subnet-observation-windows.ts`다. generic SSH runner나 임의 command builder를 새로 만들지 않는다.

## 2. 현재 동결 launcher 계약

| 파일 | bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts` | 24,590 | `fb9621d0ec43a699761fc76870006427c441896ba884f8bcfa15a93fc65f91ee` |
| `scripts/qa-ix01-0076-negative-linux-fd-proof-issuer.ts` | 8,233 | `5b785ae3e61dbf27f365f163fe0f4a6b9a933ba88b0501d5ad8a6fe3d96c4eac` |
| `scripts/qa-ix01-0076-negative-linux-fd-proof-entry.ts` | 12,020 | `68c8ce0089463d3d807fa436fa1a3d2fd749061fa839373988fbe539c6277b33` |
| `scripts/qa-ix01-0076-negative-linux-fd-proof-system.ts` | 16,718 | `73d321726a8d91c8500cc1dc3a1c509ec866571eccda4f07acd9074c27b6509f` |

이 네 지문은 전체 Node load closure가 아니다. 원 실행담당자가 이미 검산한 source graph와 실제 적재 대상의 일치가 별도로 필요하다. carrier나 launcher가 hash 문자열만 보고 source 검산 또는 승인 사실을 새로 발급하지 않는다.

launcher의 exact 조건은 다음과 같다.

- Node: `/opt/node-v24.22.1-linux-x64/bin/node`
- Linux uid: 1000
- `execArgv=[]`, `envKeys=[]`
- argv: `--run <attemptId> <planHash> <approvalHash> <stdinSha256>`
- stdin: canonical UTF-8, BOM/LF 없음, external stored approval 원문과 byte-exact 동일
- launcher 자체 한도: 32KiB, stdin 획득 10초
- 보호 원문: `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-<attemptId>-start.json`
- 실행 intent: 같은 parent의 `ix01-0076-fd-proof-<attemptId>-intent-v1.json`, O_EXCL 정착

보호 원문의 exact 필드는 `schemaVersion`, `purpose`, `attemptId`, `approvalId`, `approvalRef`, `approvalHash`, `sourceHead`, `planHash`, `sourceHash`, `graphHash`, `issuedAt`, `expiresAt`, `nodePath`, `nodeHash`, `launcherHash`, `issuerHash`, `entryHash`, `systemHash`, `loadedSourceRef`의 19개다. `purpose`는 `IX01_0076_NEGATIVE_LINUX_FD_PROOF_PROTECTED_START`다.

carrier는 이 파일을 생성·수정·재직렬화하지 않는다. 정상 실행담당자가 제공한 exact bytes를 stdin으로만 운송한다. 파일 부재·불일치·읽기 또는 close 불명은 remote intent와 benign child 효과 0이다.

## 3. exact remote command

source root는 기존 host source와 동일하게 시도 ID에서만 파생한다.

```text
/home/daon/anvil-ix01-0076-negative-<attemptId에서 '-' 제거>-qa
```

carrier가 만들 수 있는 remote command는 다음 하나다.

```text
cd '<sourceRoot>' && exec /usr/bin/env -i \
/opt/node-v24.22.1-linux-x64/bin/node \
'<sourceRoot>/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts' \
--run <attemptId> <planHash> <approvalHash> <stdinSha256>
```

`attemptId`는 UUID이고 세 hash는 lowercase 64 hex다. `sourceRoot`, script, Node, alias와 SSH 옵션은 caller 입력이 아니다. 추가 argv, env, Node option, 다른 cwd, 다른 path를 허용하지 않는다. 기존 Windows carrier의 입력 상한 16KiB를 유지하므로 보호 원문도 1..16KiB로 더 좁힌다.

## 4. 최소 source diff

후속 source는 아래 두 tracked 파일만 변경하는 것이 최소다.

| 파일 | 현재 지문 | 최소 변경 |
| --- | --- | --- |
| `scripts/qa-ix01-subnet-observation-windows.ts` | 14,407B / `3dade4b79163e6ac79dece080d26a9f6ddb96789ec60f35ccffaa7ee17b737dc` | 같은 module-private `nativePorts`를 쓰는 목적 전용 benign carrier factory 추가. 기존 subnet `run`·receipt·횟수·결과는 불변 |
| `tests/unit/IX01/subnet-observation-windows.test.ts` | 10,833B / `5e92abf2d98515e8109c378bc79b6e384f4ee1e0efb19651ba907efe72d84b3e` | exact command/stdin/단회·late/UNKNOWN 회귀 추가. 기존 subnet 사례는 모두 유지 |

새 factory는 module 밖에 native spawn port나 generic command capability를 노출하지 않는다. 외부 실행담당자의 immutable approval projection과 stored stdin bytes를 받아 다음 순서만 수행한다.

1. 기존 review callback으로 현재 alias/config/host trust, 원 단회 승인, source deployment와 원 절대기한을 재대조한다. callback과 입력 hash 자체는 승인 발급이 아니다.
2. 별도 승인 원장을 만들지 않고, 목적 전용 **transport attempt record**만 기존 Windows 보호 parent에 O_EXCL로 정확 바이트 수만큼 쓰고 flush·close한다. 이후 동일 파일 identity와 크기를 검산한다. 이 Windows 경로는 기록 본문을 다시 읽지 않는다. 이 기록은 remote 실행 성공이나 승인 receipt가 아니다.
3. listener와 timer를 먼저 설치한다.
4. §3 exact command로 원 SSH child를 한 번 시작한다.
5. 이미 stored 된 보호 원문의 exact bytes를 stdin에 한 번 전달하고 전송 copy를 소거한다.
6. stdout은 canonical 한 줄·유계 크기로만 수거한다. `IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS` 또는 정확 `UNKNOWN` 외 형상을 거절한다.
7. 원 stdout end, exit, close 및 사후 current가 모두 맞아도 결과는 benign observation candidate일 뿐이다. Docker/PG/0076 상태를 만들지 않는다.

기존 `createSubnetWindowsSupervisor`의 subnet preflight/observation receipt를 benign 용도로 소비하지 않는다. 기존 함수의 두 단계 실행 횟수, 승인 목적, 원 결과는 바꾸지 않는다. 공통화는 module-private native port와 고정 launch option까지만 허용한다.

## 5. 필수 회귀

직접 시험은 다음을 고정한다.

1. exact approval projection + stored stdin digest + current review에서만 transport record 1, spawn 1, stdin 1.
2. remote command가 §3과 byte-exact이고 `env={}`, System32 cwd, strict SSH flags를 유지.
3. stored stdin은 carrier가 작성하지 않으며, 전송 bytes SHA가 argv의 마지막 `stdinSha256`와 일치.
4. 다른 purpose/attempt/plan/approval/stdin SHA, source root·script·추가 argv 조작은 transport record와 spawn 0.
5. transport record existing/partial/flush·close 불명, review 상실, timer 선만료는 spawn 또는 stdin 0이며 같은 factory 재시도 0.
6. spawn 뒤 late/stream/close 불명은 원 child listener를 보존하고 kill·retry·receipt 삭제 0.
7. benign candidate를 실제 Linux PASS, Docker/PG 준비, 0076 결과로 승격하지 않음.
8. 기존 subnet 정상·오류 시험과 명령 hash가 불변.

## 6. 남은 별도 경계

이 최소 diff는 carrier **형상과 제약 source**만 닫는다. 다음은 실제 release/dispatch 전 별도 확인이며 이번 후보에서 새 절차나 선조회로 추가하지 않는다.

- 외부 정상 실행담당자가 발급·보유하는 원 단회 승인과 exact stored stdin
- 이미 승인된 source graph 및 실제 Node load bytes와 현재 배치의 일치
- 현재 Windows SSH alias/config/host trust와 Linux source root/Node 상태
- 실제 benign 실행 결정과 원 child/intent의 UNKNOWN 인수 책임

실제 benign 관측이 성공해도 후속 PostgreSQL proof 승인·원장·격리 자원·정리 권한이 아니다. 실제 release/dispatch는 위 외부 자료를 고정한 별도 단계이며 이 문서나 transport attempt record가 그 결정을 대신하지 않는다.
