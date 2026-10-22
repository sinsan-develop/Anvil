#!/usr/bin/env bash
# clone 전 trap을 설치한다. 실패 시 검증되지 않은 잔여 자료는 삭제하지 않는다.
set -euo pipefail
readonly root=/home/daon/deploy/anvil-v3-fn12-result-reviews-qa-01
readonly parent=/home/daon/deploy
readonly deps=/home/daon/deploy/anvil-v3/node_modules
readonly pg=anvil-v3-fn10-next-basis-pg-01
readonly net=anvil-v3-fn10-next-basis-net-01
readonly sha=${1:?exact SHA required}
readonly qa_case=${2:-NEXT_ACTION}
readonly issued=$(date +%s%3N)
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$qa_case" == NEXT_ACTION || "$qa_case" == STORED_ISSUE ]]
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
outer_cleanup() {
  local result=$? safe=0 exists=0 daemon names
  trap - EXIT INT TERM
  set +e
  if [[ -e "$root" || -L "$root" ]]; then
    if cleanup_checkout; then safe=0; else safe=1; fi
  else
    cleanup_until=$(( $(date +%s)+20 ))
    daemon=$(docker_exact info --format '{{.ID}}') || safe=1
    [[ "$daemon" == e3349f1d-dbfc-478a-96d9-295bf6c6839e ]] || safe=1
    names=$(docker_exact container ls -a --format '{{.Names}}') || safe=1
    [[ $'\n'"$names"$'\n' != *$'\n'"$pg"$'\n'* ]] || safe=1
    names=$(docker_exact network ls --format '{{.Name}}') || safe=1
    [[ $'\n'"$names"$'\n' != *$'\n'"$net"$'\n'* ]] || safe=1
  fi
  [[ ! -e "$root" && ! -L "$root" ]] || exists=1
  printf 'FN10_BASIS_BOOTSTRAP status=%s cleanup_failed=%s path_exists=%s\n' "$result" "$safe" "$exists"
  if [[ "$result" != 0 || "$safe" != 0 || "$exists" != 0 ]]; then exit 1; fi
  exit 0
}
[[ $(id -u) == 1000 && $(realpath -e "$parent") == "$parent" && ! -L "$parent" ]]
[[ ! -e "$root" && ! -L "$root" ]]
command -v lsof >/dev/null
cleanup_until=$(( $(date +%s)+30 ))
[[ $(docker_exact info --format '{{.ID}}') == e3349f1d-dbfc-478a-96d9-295bf6c6839e ]]
names=$(docker_exact container ls -a --format '{{.Names}}')
[[ $'\n'"$names"$'\n' != *$'\n'"$pg"$'\n'* ]]
names=$(docker_exact network ls --format '{{.Name}}')
[[ $'\n'"$names"$'\n' != *$'\n'"$net"$'\n'* ]]
trap outer_cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
/usr/bin/timeout --signal=TERM --kill-after=5s 90s /usr/bin/git clone --quiet --single-branch --branch codex/av3-stage-b git@github-sinsan-develop:sinsan-develop/Anvil.git "$root"
[[ $(realpath -e "$root") == "$root" && ! -L "$root" && $(stat -c %u "$root") == 1000 ]]
[[ $(git -C "$root" rev-parse HEAD) == "$sha" && -z $(git -C "$root" status --porcelain) ]]
[[ -z $(find "$root" -xdev -type l -print -quit) ]]
cmp "$root/package-lock.json" /home/daon/deploy/anvil-v3/package-lock.json
ln -s "$deps" "$root/node_modules"
cd "$parent"
/usr/bin/env -i PATH=/usr/bin:/bin HOME=/home/daon LANG=C.UTF-8 /usr/bin/timeout --signal=TERM --kill-after=30s 240s /usr/bin/bash "$root/scripts/next-action-basis-qa-launch.sh" "$sha" "$issued" "$qa_case"
