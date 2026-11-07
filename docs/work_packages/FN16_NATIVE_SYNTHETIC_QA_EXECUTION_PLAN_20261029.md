# FN16 native 공개 합성 자료 검증 실행안

2026-10-29 / Main 어울 / PREPARED_NOT_EXECUTED

## 목적과 권한
직접 승인3FAD0CE9의 코드·합성검증과 PMO 공통§6의 필수 build/WSL QA 범위다. 실제 설치 catalog·키·DB·서비스를 만들거나 변경하지 않는다. Linux native 파일 연산을 공개 문자열 fixture로 검증하는 일회성 개발 시험이며 실제 키·백업/복원·서비스 수용 증거가 아니다. 원 계약5A6819E6와 source WI C6E59B3E의 보호 기준은 유지한다.

## 사전조건
- native4와 retention adapter/unit2의 소스 검수 Critical/Important0, 정확 변경·시험·미검증 기록, 기존 branch private 게시 exact SHA 확인.
- 실행 직전 이 문서에 source commit와 addon.c/build/test SHA256을 결박한다. 미기입 상태 실행 금지.
- source commit: 7fc087b2f80daeb245d275330fbaa82b637ff787. addon.c SHA25620DC3C14A1D406329487A993E63355BB656A6A235786104BCFA843A7C044F532; binding.gyp237171593AB8E5CCD5CE548F20142F69BEF9DA0AECED0D951ED23590EBE5A053; BUILD0E60317B037C13E0E8D7B3E8F3D9505F411AF7B4238C3F51A7D862CCDC1A7E96; native시험14252DC4846AE4FB061E85B08D0517E0143C517602B13917C0382492644E6C15. Git blob/WSL LF 지문 기준. Main ded9be 단위22/type/diff0 및 독립 C0/I0 확인; native15건(기존13+반복2), fixture16. retention WI B09AED75 포함.
- compiler/header/runtime의 현재 지문과 owner·모드·부모·링크를 대조하고 변경/불명은 실행하지 않는다. 자동 설치·도구 교체·권한 수정은 하지 않는다.
- 신규 QA root 부재, /home/daon의 realpath·owner·link, ext4 및 procfs를 확인한다. 기존 경로가 있으면 덮어쓰기/자동 삭제하지 않는다.

## 일회 자원
- 환경: ssh WSL-server, daon UID/GID1000. root: /home/daon/anvil-v3-fn16-native-qa-20261029-01.
- 그 아래 src(Git exact checkout), build(addon.node), fixtures(공개 bytes와 소유 marker), results(비밀 없는 진단)만 사용한다. 생성 시 umask077이며 기존 경로 권한 변경0.
- 기존 승인 private 저장소의 codex/av3-stage-b를 Git으로 받아 고정 SHA를 detached checkout한다. Windows 파일 복사·서버 patch·source 변조0. 개발 서버의 기존 checkout·컨테이너·DB·volume·인증·Secret 접근0.
- 새 process는 일회 compiler와 Node test 및 그 exact 소유 자식뿐. listener·port·컨테이너·daemon·서비스·Agent·유료 호출0. 공개 fixture에는 운영 key/password/암호화키를 넣지 않는다.
- 생성부터 최대30분. compiler 최대60초, Node 시험 전체 최대120초. timeout은 종료 신호로 test-only 프로세스를 회수하며 기존 서비스/PID에는 보내지 않는다. 불명 종료는 경로를 보존·보고한다.

## 고정 도구
- Node: /opt/node-v24.22.1-linux-x64/bin/node, SHA256 e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb.
- header: /opt/node-v24.22.1-linux-x64/include/node/node_api.h, SHA256 2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a.
- compiler: /usr/bin/x86_64-linux-gnu-gcc-13, SHA256 1b99826121ae6682a634e5efe09bd3e3df58ce58e0b28f849114ab5b89139c26.
- 기존 /usr/bin/timeout만 사용. build flags와 exact invocation은 BUILD_CONTRACT 검수 후 이 문서에 고정한다. npm install/download/postinstall0.
- 읽기 관측be3974: compiler root0:0/755, header directory0:0/755, /home/daon1000:1000/750, Linux6.18.54.1-microsoft-standard-WSL2, QA_ABSENT. 도구 metadata는 시험 PASS가 아니다.

## 검증과 판정
- compile 성공 exit0 및 binary SHA·NAPI factory/12연산을 확인한 뒤 exact binary만 시험 process에 명시 로드한다. 환경 자동 검색·제품 loader 활성화0.
- 정상 create/sync/read/remove와 불변 publish/open, 잘못된 binding·capability·닫힌 handle·타root, 파일/부모 교체·symlink·선점·기존파일 보존, managed adapter dispose를 현재 시험에 따라 실행한다.
- 실제 syscall 관측과 TS 메모리포트 검증을 구분한다. deterministic native 부분실패 주입·전원손실·운영 설치 보호·다른 UID/다중 process 위협·실제 키/DB/서비스는 NOT_RUN/EXCLUDED이며 통과로 세지 않는다.
- 실패는 원 진단/정체성/정리 상태를 보존한다. 합격 기준 완화·임의 retry·기존 자료 삭제를 하지 않는다. 소스 보완은 로컬 담당자→새 exact commit/private→별도 새 QA 기록 순서다.

## 정리·보고
자식 종료 및 남은 process의 exact command/root 확인 뒤, src Git exact/변경0과 전용 root owner·realpath·link·mount를 대조한다. 증거는 공개 진단·hash·결과만 정본 보고서에 남긴다. 확인된 위 전용 root 아래 자원만 같은 shell에서 삭제하고 별도 SSH 조회로 경로·process 잔여0을 확인한다. 신원 불명·예상외 mount/owner·종료 불명은 삭제하지 않고 보존·예외 보고한다. 기존 PG/복구 volume·원장·서비스·키/catalog는 생성/변경/정리 대상이 아니다.
## 실행 종료 보완 — 독립 검토 I1 반영

- compiler는 `/usr/bin/timeout --signal=TERM --kill-after=5s 60s <고정 compiler·flags>`, Node는 같은 옵션의 `120s <고정 node·시험>`로 실행한다. --foreground는 사용하지 않는다. timeout의 전용 process group에만 TERM/KILL이 적용되며 기존 service나 이름 검색 PID에는 신호를 보내지 않는다. 유예 포함 compiler65초/Node125초가 종료 관측 기준이다.
- 실행 부모는 각 timeout을 별도 session/process group으로 생성하고 자식 PID·PPID·PGID·/proc starttime·exact command를 기록한다. 기존 Python3 subprocess(start_new_session=True) 또는 동등한 명시 spawn을 사용하며 shell 문자열을 도구 인수로 재해석하지 않는다. 승인된 compiler 또는 Node 인수 배열만 전달한다.
- 정상 종료 및 timeout 모두 부모의 wait 결과·종료코드를 기록하고, 해당 PGID 소유 process가 0인지 /proc 또는 ps의 PID/PPID/PGID/starttime으로 독립 확인한다. PID가 없거나 신원을 확인하지 못하면 새 PID를 추정해 신호를 보내지 않는다. 남은 프로세스·D상태·종료 미확정은 실패로 기록하고 root를 보존하며 추가 실행·삭제를 중단한다.
- timeout124/137·signal 종료는 시험 PASS가 아니다. 설치/도구 오류·native 실패·종료 불명을 분리한다. 임의 재시도나 process 이름 기반 pkill/killall은 사용하지 않는다.
## 고정 실행 형태 (source hash 결박 전)

compiler 인수는 BUILD_CONTRACT의 C11/O2/PIC/shared/Wall/Wextra/Wpedantic/pthread/NAPI8/GNU_SOURCE 및 기존 Node header, 마지막 -lm으로 고정한다. output은 위 root/build/fn16_posix_safe_handle.node 한 파일이다. npm/gyp 실행·외부 dependency 설치0. Node는 --test --test-concurrency=1 tests/integration/FN16/installation-resource-posix-native.test.ts로 실행한다. 두 명령의 cwd는 위 root/src다.

자식 환경은 PATH=/usr/bin:/bin, LANG=C.UTF-8, HOME=전용root/home, TMPDIR=전용root/tmp, ANVIL_FN16_NATIVE_QA_ROOT=전용root로만 구성하고 Node옵션/loader/라이브러리경로·기존Secret환경은 상속하지 않는다. home/tmp는 이번시험용새0700경로다. Git 획득의 인증은기존SSH설정을그대로사용하며키를복사하거나바꾸지않는다.

시험13번째 FIFO 반례는 기존 /usr/bin/python3 -I -c의 os.mkfifo를 exact cases 아래 자기새UUID이름에0600으로1회 호출한다(timeout1500ms/output1024bytes). 실제키/특권/설치변경이아닌공개합성파일이며같은root정리범위에속한다. compiler·Node및이Python자식은전용processgroup의종료·잔여조회에포함한다.

execution-manifest.json은schemaVersion1/purpose FN16_NATIVE_ISOLATED_QA/rootIdentity/ownerUid/ownerGid/expiresAt/binarySha256/addonSourceSha256/bindingSourceSha256의닫힌metadata다. Git exactSHA는별도preflight로확인하며이manifest는사람승인을대신하지않는다. 파일은새0600·exclusive로만작성한다. fixture는cases,빌드는build,진단은results아래이며기존fixtures표기는이새cases와같은시험자원구분이다.
## 진단·작업 자원 제한
일회 compiler/Node child에는 core dump0, CPU time 최대60/120초, 파일당 최대16MiB의새출력제한을적용한다(기존프로세스/서비스limit변경0). 진단은results의전용새파일로받고대화에는비밀없는종료코드·요약과최대64KiB만읽어낸다. source·native·fixture는실행전검수한Gitexact코드/공개bytes이며네트워크요청·기존서비스접속을호출하지않는다. 실제network격리/운영sandbox완료를이제한으로주장하지않는다. 보안skill의소스집중검토와일반승인개발검증을구분하며별도침투시험은수행하지않는다.