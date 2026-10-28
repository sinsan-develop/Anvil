# P03 created helper 신원 검사 내부 오류 보완

2026-10-28 · Main 어울 · 기존 승인 source-only 내부 구현 보완. 실제 복제 실행 승인 아님.

## 근거와 목표
R2 exact 8e9292d8의 한 번 실행은 create-tools/IDENTITY_UNKNOWN에서 끝났고 승인은 소진됐다. 실제 created tools의 HostConfig.Mounts는 key 부재, runtime Mounts는 []였으며 다른 신원·구성은 정확했다. 실패/원·R1·R2 volume/원장 보존은 결과서 F17CE240에 따른다. 새 grant·helper·복제·PG·서비스 실행 없이 이 관측과 단계별 신원검사 내부 구현을 맞춘다. 공개 계약·허용 효과·기한·정리 조건을 넓히지 않는다.

## 단일 writer와 범위
현재 기존 primary만 다음3파일을 수정한다. Main은 관리·검수·통합한다. 같은 Stage branch를 유지하고 다른 작업을 stage하지 않는다. source 현재HEAD 625f4255763c67c8a124804dec4ea6a224bdfa6c이며 FN16 완료 후보 변경은 동결·보존한다.
- scripts/p03-pg-copy-host.ts — 시작 raw SHA256 082D36D58438723117B4F68A4471D67B1733DD45CADEA345A2B4F48EDC30E5F4
- tests/unit/P03/pg-recovery-copy-host.test.ts — 시작 raw SHA256 F269C0889DEFB07CB5F823BC6B5FA712D42F12ACDEA603C24CCF6E80F3A2006F
- tests/unit/P03/pg-recovery-copy-docker-time.test.ts — 시작 raw SHA256 5A254445588BE50468DBA734527CDE3D1A21A4DDF19B7FC1EA7225E05E388778

결과서1 추가 허용: docs/04_test_reports/AV3/P03_CREATED_HELPER_IDENTITY_SOURCE_RESULT_20261028.md. shell·후보의 고정 resource/기한·grant/실행승인·다른 시험·환경 설정은 변경하지 않는다.

## 구현 기준
- own/ownLimited와 실제 호출부에서 created/started 검증 단계를 명시한다. 실제 state를 보고 더 느슨한 모드를 자동 선택하지 않는다. strict와 limited의 같은 결함을 같은 파일 안에서 보완한다.
- tools/request volume0에서만 HostConfig.Mounts key 부재 또는 정확 []를 구성상 동치로 받는다. 이 구성필드 정규화는 created/started 모두에 적용하되 runtime은 created 정확 [] / started 정확 tmpfs로 별도 엄격 비교한다. 정확 Tmpfs 구성과 나머지 모든 신원·설정은 유지하고 null/비배열/다른형식/추가 mount는 거절한다. init/copy에는 이 정규화를 적용하지 않는다.
- created init/copy는 원·사본 volume의 이름·source mountpoint·destination·RO/RW·NoCopy 등 정확 HostConfig 및 runtime volume 검사를 시작 전부터 유지한다. 아직 만들지 않은 runtime tmpfs 항목만 단계에 맞춰 구분한다. 원본/사본 검사를 start 이후로 미루지 않는다. 실제 init/copy/started 관측 형태를 보았다고 주장하지 않는다.
- started는 기존 runtime mount 완전성·fullID/nonce/image/Created/기한·종료/회수 조건을 유지한다. started 호출에서 created로 돌아가면 거절한다. created 허용이 자동 rm 허가가 되어서는 안 된다. closed/exited/ExitCode0/FinishedAt·기존 TERM/rm 횟수·시간 제한은 불변이다.
- 실제 관측만으로 증명되지 않는 Docker 형식은 보수적으로 거절하며, fixture만 바꿔 성공하게 하지 않는다.

## 검증·제출
실제 관측 shape를 재현하는 합성 ports에서 RED→GREEN을 남긴다. created unexpected mount/잘못된Tmpfs, init/copy mount누락·NoCopy변경·원본RW·사본RO·source/destination교체, started mount누락/추가·created재등장, fullID/nonce/Created변경, close불명/비정상종료의 정확 오류와 start/TERM/rm 도달 횟수를 대조한다. 변경 직접 host/time 시험과 필요한 타입검사·diff만 실행하며 Main fresh 집중검증·독립 코드 검수 후 기존 branch checkpoint한다. 실제 Docker/WSL/cp/신호/volume/PG/DB/서비스/Agent·새 actual grant 실행은0. 미검증은 NOT_RUN으로 남긴다.


## 2026-10-28 Main 내부 정합 보완
발행 당시 A698A9DA의 source baseline625f는 이력이며 실제 착수는 FN16 checkpoint4482cf099b1095f6f5f463c946411f31e03828cd다. 허용3path 초기raw는 불변이다. primary 제안에 따라 tools의 요청volume0 HostConfig 구성 동치만 단계무관 명시했다. runtime 단계검사와 모든 실제효과/회수 경계는 불변이며 독립 quality C0/I0. 실started shape 관측 또는 actual 재실행 승인이 아니다.


## 2026-10-28 후속 I1 정정 — --tmpfs inspect 표현
이 절이 위 created/started runtime tmpfs 기대 문구보다 우선한다. 앞선59F1/3088후보의62PASS·독립C0I0는 당시 합성fixture 검수 이력이며 현재완료판정은 I1 미해결로 정정한다. 실제Docker --tmpfs는HostConfig.Tmpfs map이며 --mount type=tmpfs와백엔드가다르다. 공식Moby v28.5.2 container/container_unix.go의TmpfsMounts(371)/GetMountPoints(397), daemon/inspect.go43/85와volumes.go171의소비선을대조했다. GetMountPoints는MountPoints만반환하고HostConfig.Tmpfs를합치지않으므로 start후 .Mounts에tmpfs를추가한fixture는잘못된가정이다. 실제hostversion확인이나실mount증명은아니다.
- 같은허용3경로에서 --tmpfs/argv·shell·권한·한도불변. HostConfig.Tmpfs exact map·옵션/size/mode/user와 HostConfig volume/NoCopy·inspect실volume Source/Destination/RO-RW·신원검사는보존한다. .Mounts는created/started 모두 정확volume-only(tools[])이며추가tmpfs/다른mount/null/비배열은거절한다. 단계상태·시작호출/startedHelpers·closed/exited/ExitCode/기한/TERM/rm조건은유지한다.
- RED는start뒤volume-only의공식API형태를독립fixture로반영해현3088이실제로거절함을확인한다. 기존62시험의등록보안조건은유지하고잘못된start tmpfs append만정정한다. 시작후HostConfig.Tmpfs 누락/추가/옵션변경과실volume변조·추가runtime mount·created재등장·신원/close음성을정확오류/호출횟수로검증한다. 통과시키기위한guard무시/임의빈목록fallback0. 실제Docker/WSL/복제/신호/DB/새grant0.
- 공식근거: https://github.com/moby/moby/blob/v28.5.2/container/container_unix.go#L371 ; https://github.com/moby/moby/blob/v28.5.2/daemon/inspect.go#L43 ; https://github.com/moby/moby/blob/v28.5.2/daemon/volumes.go#L171 ; https://docs.docker.com/engine/storage/tmpfs/ . 기존API표현정합이며runtime mount보호완전실측으로보고하지않는다.


## 2026-10-28 I1 fail-closed 내부 보완 범위 정합
Main은 기존source-only 승인 안에서 위공식API 표현정합과 보호tmpfs 실검사누락을 함께수정한다. 기존3외 scripts/pg-recovery-copy.sh(시작rawCF6B604C2EBB3DC8552C9F341934CC00A5F7970AD8B2F17C1435DF6B14C0A9C8), tests/unit/P03/pg-recovery-copy-preparation.test.ts(815F14F4E5729EB838C9F44205B539736B0FA71D1130F9F18F938338529055BD)2개만추가허용한다. 제품2/직접시험3/동일결과서1이며원R2literal/candidate/프로토콜/반환형식/한도/권한불변. 실효과0/정확새actual승인아님.
- shell은각tools/init/copy 모드의첫임시파일기록·chmod/chown/cp 이전에해당현재helper의 /proc/self/mountinfo를기존control256KiB상한내읽고, 정확한tmpfs mountpoint1개·fstype=tmpfs·rw/noexec/nosuid/nodev·size33554432와해당경로정규디렉터리/nonlink·stat owner/mode를검증한다. tools/init는 /var/lib/postgresql/data (999/0각uidgid), copy는 /anvil-copy-audit (999),mode700. 기존exactHostConfig구성과교차대조한다. 다른경로/전체metadata/stdout원문노출0, 불명/중복/부족/잘못된옵션은첫쓰기전실패. 기존보호기준을정확API표현과실kernel근거로분리하는내부보완이며통과목적의검사완화아님.
- 합성Bash시험은등록된기존GitBash에서 parser함수와mocked읽기/stat 포트만검증한다. 실제 /proc·Docker·cp·신호·chmod/chown·네트워크호출0. 필수flags/size/owner/mode/대상누락·추가중복·경로escaping/형식·잘못된FS·상한초과를검사하고각mode guard전실패에서첫쓰기/변경호출0을관측한다. Node host/time 음성도공식volume-only shape로정합한다. 기존시험삭제/skip/기대완화0. Mainfresh직접3·타입·Bash-n와독립검수후결과서에3088/62PASS의한계를이력으로보존한다.
