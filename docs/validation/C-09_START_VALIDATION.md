# C-09 시작 투영 검증

seq1~795 raw event prefix는 불변이며 seq796 WORK_INSTRUCTION_ISSUED, seq797 WORKER_LEASE_ISSUED, seq798 WRITE_LEASE_ISSUED만 append한다.
exact11 시작 기록, 제품 exact18 lease, C-08 ACCEPTED, C-09 IN_PROGRESS, C-10 NOT_READY, DIR-2 NOT_REACHED.
필수 명령: python -B scripts/check_project_progress.py; python -B -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'seq798 or seq790 or seq795'; python -m py_compile scripts/check_project_progress.py tests/tooling/test_project_progress.py; git diff --check; git diff --cached --check.
builder 결정성, 원본 prefix, authority/lease/hash/digest, seq798 우선 dispatch와 fail-closed Git 수집을 검증한다.
Git predicate positive는 staged/direct-child/reviewed-main/detached-main; negative는 URL/ref/base/branch/upstream/parent/extra-parent/second-descendant/dirty/unstaged/untracked/path/noncanonical/traversal/tree mismatch다.
외부 Git fixture와 Docker/WSL/DB/API/browser/Provider/Telegram/network/deploy/Secret은 NOT_EXECUTED.
이 문서는 재현 가능한 검증 계약이다. 실제 명령의 exit code와 최종 GREEN은 writer 보고서에서 별도 기록하며 제품 acceptance가 아니다.
