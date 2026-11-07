# P03 원 PG 볼륨 RO 구조 metadata 조사 실제 결과

## 판정 → 이유 → 조치
**조사·정상 종료·등록 일회 자원 정리 확인. DB 복구/무결성/사용 가능은 미확인**이다. controller 반환은 METADATA_COLLECTED_AND_CLEANED / complete=true / exit0이다. 이는 허용된 구조 metadata 범위의 완료이며 P03 환경 복구·제품 기능·WORK_PLAN 완료가 아니다.
Main 어울이 신규 사용자 단발 승인을 대조해 실행했다. FN04 담당은 읽기 preflight만 수행했으며 동시 제품 writer0이다.

## 정확 권한·소스·시간
PMO chat01a054f5-c2b4-7af0-b31a-c8148ef74642에서 신산님 call_a5b62cad523c44689b487cb8d51b4812/item0의 실제 답변 ‘잔여 위험을 한정 수락하고 조사 1회 승인’을 전달받았다. 수신확인2026-10-27T10:55:41Z(19:55:41 KST), 창 상한11:25:41Z(20:25:41 KST)·연장0. 승인 기록 docs/approvals/P03_PG_DISCOVERY_METADATA_R2_20261027.json SHA6B084C414129B12FB97875C982E139ECF0B342DB818A93DC546A40CF53E4E638.
실행 Git exact **20a807dd28fa5f537f8ac06fa004902220b0b567**. 현재 개발HEAD0def97b7로 대체하지 않았다. plan C9960CD6D65DBFB0BE47E3C7A3131809D2A090CD59C51F36C6890B3BBA73794D, controller B071A57A1EA1DF44A1F93213BBFFEC8EB6D626755BC7FB8E543029BEAB8BFCF7, shell156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B가 WSL 새 Git checkout에서 모두 일치했다.
UID1001 주체 미해결/향후 UID 할당·파일교체/hash-실행 경합/loader 신뢰 잔여위험을 이번1회에 한정 수락했다. 도구의 externalUserApprovalVerified=false는 내부 grant가 외부 사람 승인을 인증하지 않는다는 의미로 유지했다. 직접 답변이 없었다는 뜻이나 owner 신뢰 해결로 바꾸지 않는다.

## 새 자원 준비·원신원 대조
09ae66 fresh 읽기2026-10-27T10:59:20.157Z: 실행UID1000, 고정Node hash7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c·도구/부모 realpath/owner/mode·신규 두경로부재·daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e·image594290e9·원볼륨 local/CreatedAt2026-10-16T03:53:33+09:00/project=v3/owner=P03/instance dc22a0629e79f259dcd935845e88e58e·소비자0/helper0을 확인했다. 원볼륨 파일 내용은 읽지 않았다.
f17080 준비11:00:17.307Z: sourceQA /home/daon/anvil-v3-pgdiscovery-20261027-r2-src는 Git init/fetch exactSHA/새 branch checkout만 사용했다. branch codex/av3-stage-b/private URL·clean·plan/controller/shell 지문 확인, root dev2096/inode4001347/UID1000/0700. 원장 /home/daon/.local/share/anvil-v3-pgdiscovery-20261027-r2는 dev2096/inode4152414/UID1000/0700. 기존 source/ref·reset/rebase/force/scp/patch0이다.
grant.json UID1000/0600/inode6907761·666bytes·SHA0c64ccc14627e9e6cd58d95a9b79ed13d236b1bda90b2b32026fc2f4a2e43c7c, runInstance2f6ea8f2768d9486d852ba0ef5a48cf0. 식별 nonce이며 비밀/인증키가 아니다. 승인창을 원시각에 결박했고 새 기록으로 연장하지 않았다.

## 실제 명령·실행 사실
Main32858a, sourceQA를 cwd로 고정한 다음 명령을 딱1회 실행했다.

    /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgdiscovery-20261027-r2-src/scripts/p03-pg-discovery-host.ts --apply

exit0/관측2.2023843초. 반환 phase=finished/error=null/failurePhase=null, consumed=true/consumeAttempted=true/pendingIO=false, createAttempted=true/startAttempted=true/removeAttempted=true, TERM 요청false/helperCloseObserved=true/helperExitCode0/signalnull, receiptFailed=false이다. sourcePreflightObserved=true/sourceVolumeObserved=true/helperAbsent=true.
helper fullID b5e2db3e4bbd8dd42ca9ae61d7e5864f9c631ced5f580eb3eb4c9a251bf1f432. 고정image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/정확name anvil-v3-pgdiscovery-20261027-r2·원volume RO/volume-nocopy/networknone/publish0·UID999:999/capdropALL/no-new-privileges·단일60초/내부55초·metadata8KiB/entry100000·create/start각1의 동결 정의를 controller가 검사했다. helper는 정상exited0 후 정확 자기ID로만 제거했다. force/재시작/자동재시도0이다.

### 수집한 허용 구조 사실
| 항목 | 실제 값 |
|---|---|
| metadata 상태 | DISCOVERY_METADATA_COMPLETE / METADATA_COMPLETE, complete=true |
| image postgres 계정 | UID999/GID999 |
| 볼륨 root | directory / UID999/GID999 / mode700 |
| 전체/고유 inode | 1873 /1873 |
| 일반파일/디렉터리 | 1846 /27 |
| symlink/special | 0 /0 |
| 일반파일 고유 inode | 1846 |
| 일반파일 logical/allocated bytes | 75529846 /75739136 |

이는 구조 집계다. 파일명·원파일 내용·원파일 hash를 출력하지 않았다. root 소유를 모든 하위 파일 소유나 DB 무결성으로 일반화하지 않는다.

이미지 도구9개의 허용 path/canonical/hash도 수집했다. postgres를 시작하지 않고 바이너리 지문만 읽었다.
| path → canonical | SHA256 |
|---|---|
| /bin/bash → /usr/bin/bash | 223fe8564b60636bc738b6178d3ba9a50ef7d791266b0efae6363bb716e4c47f |
| /usr/bin/timeout | 6ca1891dfc0b05d7680770c2884c0391b92467c7bb6500a5c84677e6481739f1 |
| /usr/bin/find | 91b75e72c495e68dd6aab198c2fd6c458fd51a2dc361045ee31f8e657417de26 |
| /usr/bin/stat | 128754b37ab743a539d889a91441c440f9b52df77f4e008b345ff221ce1daeaa |
| /usr/bin/sha256sum | 89f8c1d1ba3c76138f3771e1a91e2796ade6180b1c1e4258c04698ff32787c97 |
| /usr/bin/id | 50629fa0ab5c003b538d4ccf7de34e85d2df4e799a79eb2dd4c2f7b1e0d7ca59 |
| /usr/bin/readlink | 1dcaf494f4dec175292b1684b3e978d18a4c3c703c52f81606d9e8eea30eb6db |
| /usr/bin/awk → /usr/bin/mawk | eff9f2b711eb5bee1b58d4d33b891e8da8f6534655d3854a45bd10217dbb28e6 |
| /usr/lib/postgresql/15/bin/postgres | 784728d07c39ce37d7d171a230830fa6b4da417469f22da334418425434647dd |

## 정리와 독립 사후 조회
09e2f6의 별도SSH11:01:55.335Z는 sourceQA exact20a/clean/원inode4001347·owner/link/hardlink/inventory를 검증한 뒤 **2755파일/175폴더·51618912bytes**를 개별 unlink/빈rmdir로 정리했다. 원볼륨 내용이 아니라 새 GitQA 자료다. helper부재/원볼륨 같은 identity/소비자0을 확인했다. 공유자원/일괄recursive·force/원볼륨 쓰기0이다.
7d1c3b의 다시 별도SSH11:02:17.542Z는 sourceQA부재·정확helper name/fullID 부재·원볼륨identity/소비자0·보존원장identity와3파일hash일치를 독립 확인했다. 단발 승인 소진은 되돌리지 않는다.

| 의도적으로 보존한 원장 파일 | bytes / SHA256 |
|---|---|
| grant.json | 666 /0c64ccc14627e9e6cd58d95a9b79ed13d236b1bda90b2b32026fc2f4a2e43c7c |
| consumed.json | 419 /3511187e022ad5c281b62d1ae90c76a5330d54bd9b55408b2015ae460b1bd2dd |
| receipt.jsonl | 4416 /719c3c26d2b76991e2f549b13764b69a9dfad00e4fa2e33bcb7f5624375ce3a6 |

원장은0600파일3개/0700dir·7줄receipt/최종phasefinished이며 정상 감사 증거로 남긴다. 의도된 보존을 숨기고 전체자원0이라고 하지 않는다. 다시 apply/marker reset/grant 재발급0이다.

## 미검증과 다음 조치
원볼륨 RW/복사·PG 기동·SQL/실DB/schema·데이터 의미/복구·서비스/인증서·Secret/계정/ACL 변경·Agent/Oracle는 실행하지 않았다. 이번 구조 관측은 별도 복구 설계의 root UID/mode/비링크·유한 크기 근거로 전달하되, 내용·DB 정합/복구 가능성·공급망 전체·writer 부재를 증명하지 않는다. 실행 오류/자동 재시도0이다.
PMO에는 현재 지문과 구조 결과·의도된 원장 보존·미검증을 전달한다. 실제 DB 복구는 이 단발 승인의 범위 밖이며 별도 정확 영향·승인이 필요하다. Main은 독립 FN04 승인 범위의 구현을 계속한다. 복구 rollback을 주장하지 않으며 원볼륨/자료/과거 승인·원장/기존 Git은 보존한다.
