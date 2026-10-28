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
- created tools는 요청 volume이0개일 때에만 HostConfig.Mounts key 부재 또는 정확 []를 받고 runtime []와 정확 Tmpfs 구성 및 나머지 모든 신원·설정을 확인한다. null/다른형식/추가 mount는 임의 허용하지 않는다.
- created init/copy는 원·사본 volume의 이름·source mountpoint·destination·RO/RW·NoCopy 등 정확 HostConfig 및 runtime volume 검사를 시작 전부터 유지한다. 아직 만들지 않은 runtime tmpfs 항목만 단계에 맞춰 구분한다. 원본/사본 검사를 start 이후로 미루지 않는다. 실제 init/copy/started 관측 형태를 보았다고 주장하지 않는다.
- started는 기존 runtime mount 완전성·fullID/nonce/image/Created/기한·종료/회수 조건을 유지한다. started 호출에서 created로 돌아가면 거절한다. created 허용이 자동 rm 허가가 되어서는 안 된다. closed/exited/ExitCode0/FinishedAt·기존 TERM/rm 횟수·시간 제한은 불변이다.
- 실제 관측만으로 증명되지 않는 Docker 형식은 보수적으로 거절하며, fixture만 바꿔 성공하게 하지 않는다.

## 검증·제출
실제 관측 shape를 재현하는 합성 ports에서 RED→GREEN을 남긴다. created unexpected mount/잘못된Tmpfs, init/copy mount누락·NoCopy변경·원본RW·사본RO·source/destination교체, started mount누락/추가·created재등장, fullID/nonce/Created변경, close불명/비정상종료의 정확 오류와 start/TERM/rm 도달 횟수를 대조한다. 변경 직접 host/time 시험과 필요한 타입검사·diff만 실행하며 Main fresh 집중검증·독립 코드 검수 후 기존 branch checkpoint한다. 실제 Docker/WSL/cp/신호/volume/PG/DB/서비스/Agent·새 actual grant 실행은0. 미검증은 NOT_RUN으로 남긴다.
