# P03 R3 main 수거·새 실행창 결과 — 2026-11-16

판정: **NOT_COMPLETE / create-init / IDENTITY_UNKNOWN**. 복제 성공·DB 복구 완료가 아니다.

## 승인·실행 결박

- 승인: anvil-r3-mainref-bb225b1405704a3280b1cf6e360435b2. 직접 승인 기록의 SHA256: 98bef6c1f0d3f0ef87ef4efb59a6962df05bf101003105edfb14cad20bc98c36.
- run: 52e1a5269d3943269a1a340ce4da54a5. 최초 관측 2026-11-15T15:34:24Z, 안전 만료16:03:24Z, 진입 최후15:53:24Z.
- 수거 ref만 main으로 변경하고 실제 실행 소스는 8d200333239f1bd7a7e8b6736a1492eb482e2de2, 로컬 checkout branch는 codex/av3-stage-b로 고정했다. 원 실행안/보완안 지문과 모든 기존 한도를 유지했다.
- 단일 실행자 developer_primary, Main 검수·통합, 독립 종료 관측 d2_preflight.

## 실제 실행 증거

1. strict SSH WSL-server preflight: 36c5a7 exit0. 원본 instance·labels·consumer0, 고정 daemon/image/도구, 새6대상 부재, main ab400738 확인. 누락된 출력을 로컬 원 기록에서 회수했으며 SSH를 반복하지 않았다.
2. 준비 단1회: 565c36 exit0, R3_PREPARATION_CONFIRMED_ENTRY_NOT_RUN. 새 checkout·ledger·grant 및 원 branch/remote/소스/두 지문/clean 확인. issuedAt15:40:57.178Z, 실제 LF 준비문 SHA256 2A646EB4054FAA09639510DEF5FABC3462D6767152F79649E194EFD947AB3141.
3. 고정 entry 단1회: 5909d3 exit1, 2.77995초. consumed=true, consumeAttempted=true, copyCreated=true, pendingIO=false, receiptFailed=false, copyResult=null, postgresStarted=false. create-init 신원 검사에서 중단돼 복사 작업에 도달하지 않았다.
4. 독립 종료 관측: e76e5f exit0, 0.93635초. tools와 copy helper 부재, init은 created/notrunning·시작/종료시각0, 원본 consumer0, 사본은 init만 사용. 소유 원장/소진/영수증의 run·권한·마지막 실패 상태 일치.

## 보존 대상

- 원본 volume anvil-v3-development-pgdata: 기존 instance dc22a0629e79f259dcd935845e88e58e 보존.
- 새 사본 volume anvil-v3-pgdata-recovery-20261028-r3: 이번 run labels, CreatedAt 2026-11-16T00:42:17+09:00. 복제 완료본으로 사용 금지.
- init anvil-v3-pgcopy-init-20261028-r3: fullID 99cc99d63c6283d8dc9dc3a3dab36be35d25a3e2009b373e2a8c7dff04ed6097. 종료·제거 시도 없이 보존.
- tools fullID b02baca78aee4694ffcacb7d9d94c9c8c79c0c705aa5b685771f39c0050a175b는 controller의 정상 닫힘/제거 및 독립 부재 확인. copy helper ID는 미발급.
- checkout /home/daon/anvil-v3-pgcopy-20261028-r3-src, ledger /home/daon/.local/share/anvil-v3-pgcopy-20261028-r3, grant.json/consumed.json/receipt.jsonl 보존.

소진된 승인은 재사용하지 않는다. 실제 복제 재시도·자동 삭제·PG/SQL·기존 DB/키/서비스 변경·Agent 실행·SDK 조회는 수행하지 않았다. 부분 자원의 복구/정리 또는 새 실제 실행은 정확한 대상·새 실행안에 대한 별도 결정 전 수행하지 않는다.

## 소스 원인과 한계

실제 init CapAdd는 단일 CAP_CHOWN, CapDrop은 ALL이었다. 원 strict/limited 코드는 단일 CHOWN만 허용하므로 이 predicate의 실패는 확정이다. 다른 결합 조건까지 모두 맞았다는 증거는 없다. HostConfig.Mounts/Tmpfs 및 runtime Mounts의 전체 JSON은 NOT_COLLECTED다. 수집한 투영값은 volume:anvil-v3-pgdata-recovery-20261028-r3:/anvil-recovery-copy:true뿐이며 NoCopy/ReadOnly/Source/Mode/Propagation을 추정하지 않는다. PGDATA tmpfs 누락 가설은 원 argv에 이미 tmpfs가 있어 기각했다.

현재 개발 branch에서만 init의 정확 단일 CHOWN 또는 CAP_CHOWN을 같은 기존 권한으로 판독하도록 소스 두 조건을 보완했다. 다른 권한·중복·혼합·소문자·null은 거절하며 생성 argv·CapDrop·나머지 guard는 유지했다. 원격 고정8d와 소진 실행은 수정하지 않았다.

- 수정 전 반례: strict/limited 모두 실제 CAP_CHOWN에서 create-init/IDENTITY_UNKNOWN 재현, 2P/2F exit1.
- 수정 후 직접+Docker-time RAM 시험: 74P/0F/0SKIP exit0. typecheck exit0, diff 검사 exit0.
- 제품 SHA256: 57BADDB919102B9AC8C0CEF39ED361D2146021C340FC905BA6D53B329536A112.
- 시험 SHA256: 03AC391DF923FB22397A9AA28D046357A071F4BDEE45A31C9F7EB1B288F9DD77.

소스·합성 검증의 성공은 실제 복제 성공 증거가 아니다. 실제 mount 검산·복제·PG 기동·DB 복구·전체 계획은 미완료다. rollback은 현재 두 파일의 한정 diff를 역적용하는 것이며 원격 부분 자원 삭제를 포함하지 않는다.

독립 소스 검수 C0/I0/M0. Main은 init CapAdd 직접 네 시나리오를 재확인했다(ffb039 exit0, 4P/0F/0SKIP). 변경 파일 전체 diff 검사도 통과했다. 이 검수는 RAM/소스 범위이며 실제 R3 재진입은 0회다.
