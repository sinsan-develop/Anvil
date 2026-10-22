#!/usr/bin/env bash
# FN10 새 빈 QA checkout만 실행/정리. 다른 서비스·정식 DB·공유 의존성은 변경하지 않는다.
set -euo pipefail
readonly root=/home/daon/deploy/anvil-v3-fn12-result-reviews-qa-01
readonly parent=/home/daon/deploy
readonly deps=/home/daon/deploy/anvil-v3/node_modules
readonly pg=anvil-v3-fn10-next-basis-pg-01
readonly net=anvil-v3-fn10-next-basis-net-01
readonly node=/opt/node-v24.21.0-linux-x64/bin/node
readonly sha=${1:?exact SHA required}
readonly issued=${2:?creation window required}
[[ "$sha" =~ ^[0-9a-f]{40}$ && "$issued" =~ ^[0-9]{13}$ ]]
[[ $(id -u) == 1000 && $(realpath -e "$root") == "$root" && ! -L "$root" ]]
[[ $(stat -c %u "$root") == 1000 && $(realpath -e "$parent") == "$parent" ]]
[[ $(git -C "$root" rev-parse HEAD) == "$sha" && $(git -C "$root" status --porcelain) == '?? node_modules' ]]
[[ $(git -C "$root" remote get-url origin) == git@github-sinsan-develop:sinsan-develop/Anvil.git ]]
[[ -L "$root/node_modules" && $(realpath -e "$root/node_modules") == "$deps" ]]
[[ $(date +%s%3N) -ge "$issued" && $(( $(date +%s%3N) - issued )) -lt 300000 ]]
command -v lsof >/dev/null
cleanup_until=0
qa_bounded() {
  local left=$((cleanup_until-$(date +%s)))
  (( left > 0 )) || return 1
  (( left <= 5 )) || left=5
  /usr/bin/timeout --signal=TERM --kill-after=1s "${left}s" "$@"
}
docker_exact() { qa_bounded /usr/bin/docker --host unix:///var/run/docker.sock "$@"; }
cleanup_checkout() {
  cleanup_until=$(( $(date +%s)+45 ))
  cd "$parent" || return 1
  # runner의 exact ID 회수가 실패했으면 source도 보존하고 새 실행을 금지한다.
  local daemon names dirty wrong links open code pid
  daemon=$(docker_exact info --format '{{.ID}}') || return 1
  [[ "$daemon" == e3349f1d-dbfc-478a-96d9-295bf6c6839e ]] || return 1
  names=$(docker_exact container ls -a --format '{{.Names}}') || return 1
  [[ $'\n'"$names"$'\n' != *$'\n'"$pg"$'\n'* ]] || return 1
  names=$(docker_exact network ls --format '{{.Name}}') || return 1
  [[ $'\n'"$names"$'\n' != *$'\n'"$net"$'\n'* ]] || return 1
  [[ $(qa_bounded /usr/bin/realpath -e "$root") == "$root" && ! -L "$root" && $(qa_bounded /usr/bin/stat -c %u "$root") == 1000 ]] || return 1
  [[ $(qa_bounded /usr/bin/git -C "$root" rev-parse HEAD) == "$sha" ]] || return 1
  dirty=$(qa_bounded /usr/bin/git -C "$root" status --porcelain) || return 1
  [[ "$dirty" == '?? node_modules' ]] || return 1
  wrong=$(qa_bounded /usr/bin/find "$root" -xdev ! -user daon -print -quit) || return 1
  [[ -z "$wrong" ]] || return 1
  links=$(qa_bounded /usr/bin/find "$root" -xdev -type l -print) || return 1
  [[ "$links" == "$root/node_modules" ]] || return 1
  [[ -L "$root/node_modules" && $(qa_bounded /usr/bin/realpath -e "$root/node_modules") == "$deps" ]] || return 1
  set +e
  open=$(qa_bounded /usr/bin/lsof -t +D "$root" 2>&1)
  code=$?
  set -e
  [[ "$code" == 0 || ( "$code" == 1 && -z "$open" ) ]] || return 1
  for pid in $open; do [[ "$pid" =~ ^[0-9]+$ && "$pid" == "$$" ]] || return 1; done
  # 공유 node_modules는 링크만 제거한다. 실경로를 삭제하지 않는다.
  qa_bounded /usr/bin/rm -- "$root/node_modules" || return 1
  dirty=$(qa_bounded /usr/bin/git -C "$root" status --porcelain) || return 1
  [[ ! -L "$root/node_modules" && -z "$dirty" ]] || return 1
  qa_bounded /usr/bin/rm -r -- "$root" || return 1
  [[ ! -e "$root" && ! -L "$root" ]] || return 1
  echo FN10_BASIS_QA_CHECKOUT_REMOVED
}
cd "$root"
export ANVIL_FN10_NEXT_BASIS_SHA="$sha"
export ANVIL_FN10_NEXT_BASIS_EXPIRES=$((issued+600000))
set +e
/usr/bin/timeout --signal=TERM --kill-after=30s 150s "$node" "$root/scripts/next-action-basis-isolated-qa.ts" --run
status=$?
set -e
if ! cleanup_checkout; then echo FN10_BASIS_QA_CLEANUP_INCOMPLETE; exit 2; fi
exit "$status"
