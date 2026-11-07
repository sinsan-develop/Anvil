#!/bin/bash
# 준비 소스. 명시 인자도 사람 승인 인증 수단이 아니다.
# import/default는 외부 명령·metadata 읽기·쓰기 없이 준비 상태만 출력한다.

p03_fail() { printf '{"status":"%s","complete":false}\n' "$1"; return 1; }

p03_aggregate() {
  # Bash의 행별 정규식/분리 비용을 없애고 고정 awk 한 프로세스로 처리한다.
  # 고정 프로그램만 argv이고 stdin은 데이터다. system/getline/eval은 없다.
  /usr/bin/awk '
    function fail(code) {
      failed=1
      printf "{\"status\":\"%s\",\"complete\":false}\n", code
      exit 1
    }
    BEGIN {
      max=9007199254740991
      number="(0|[1-9][0-9]*)"
      row="^[fdlbcpDs] " number " " number " " number " " number " [0-7]{1,4} " number " " number "$"
    }
    {
      if (ended) fail("INVALID_METADATA")
      if ($0 == "END 0") { ended=1; next }
      if ($0 == "END 1") fail("TRAVERSAL_FAILED")
      if ($0 !~ row) fail("INVALID_METADATA")
      for (i=2; i<=8; i++) {
        if (i==6) continue
        # 문자열 접두사로 awk의 자동 숫자비교/반올림을 차단한다.
        if (length($i)>16 || (length($i)==16 && ("x" $i) > "x9007199254740991")) fail("NUMERIC_LIMIT")
      }
      entries++
      if (entries>100000) fail("ENTRY_LIMIT")
      if ($1=="f") regular++
      else if ($1=="d") directories++
      else if ($1=="l") links++
      else special++
      key="inode:" $2 ":" $3
      signature="meta:" $1 ":" $4 ":" $5 ":" $6 ":" $7 ":" $8
      if (key in seen) {
        if (seen[key]!=signature) fail("INODE_METADATA_CONFLICT")
        next
      }
      seen[key]=signature; unique++
      if ($1=="f") {
        if (($8+0)>17592186044415) fail("NUMERIC_LIMIT")
        amount=($8+0)*512
        if (($7+0)>max-logical || amount>max-allocated) fail("NUMERIC_LIMIT")
        regular_unique++; logical+=($7+0); allocated+=amount
      }
    }
    END {
      if (failed) exit 1
      if (!ended) fail("TRAVERSAL_FAILED")
      printf "{\"status\":\"METADATA_COMPLETE\",\"complete\":true,\"entries\":%.0f,\"uniqueInodes\":%.0f,\"regularEntries\":%.0f,\"directoryEntries\":%.0f,\"symlinkEntries\":%.0f,\"specialEntries\":%.0f,\"regularUniqueInodes\":%.0f,\"regularLogicalBytes\":%.0f,\"regularAllocatedBytes\":%.0f}\n", entries,unique,regular,directories,links,special,regular_unique,logical,allocated
    }
  ' 2>/dev/null
}

p03_discover() {
  # 아래는 미실측 image literal 후보이다. 대체 검색·설치·권한상승은 없다.
  local path canonical digest rest tool_json='' separator='' value root_type root_uid root_gid root_mode
  local pg_uid pg_gid aggregate result
  local -a paths=(/bin/bash /usr/bin/timeout /usr/bin/find /usr/bin/stat /usr/bin/sha256sum /usr/bin/id /usr/bin/readlink /usr/bin/awk /usr/lib/postgresql/15/bin/postgres)
  # bootstrap/stat/hash/readlink 자체는 고정 image 신뢰에 의존한다. 개별 hash 사전검증 아님.
  for path in "${paths[@]}"; do
    canonical=$(/usr/bin/readlink -f -- "$path" 2>/dev/null) || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
    case "$path:$canonical" in
      /bin/bash:/usr/bin/bash|/bin/bash:/bin/bash|/usr/bin/timeout:/usr/bin/timeout|/usr/bin/find:/usr/bin/find|/usr/bin/stat:/usr/bin/stat|/usr/bin/sha256sum:/usr/bin/sha256sum|/usr/bin/id:/usr/bin/id|/usr/bin/readlink:/usr/bin/readlink|/usr/bin/awk:/usr/bin/awk|/usr/bin/awk:/usr/bin/mawk|/usr/bin/awk:/usr/bin/gawk|/usr/lib/postgresql/15/bin/postgres:/usr/lib/postgresql/15/bin/postgres) ;;
      *) p03_fail TOOL_SUPPORT_UNKNOWN; return 1;;
    esac
    [[ -f "$canonical" && ! -L "$canonical" ]] || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
    value=$(/usr/bin/sha256sum -- "$canonical" 2>/dev/null) || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
    IFS=' ' read -r digest rest <<< "$value"
    [[ "$digest" =~ ^[a-f0-9]{64}$ ]] || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
    tool_json+="$separator{\"path\":\"$path\",\"canonical\":\"$canonical\",\"sha256\":\"$digest\"}"; separator=,
  done
  /usr/bin/find -P /dev/null -xdev -maxdepth 0 -printf '' >/dev/null 2>&1 || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
  /usr/bin/awk 'BEGIN { if ("123" !~ /^[0-9]{1,4}$/) exit 1 }' </dev/null 2>/dev/null || { p03_fail TOOL_SUPPORT_UNKNOWN; return 1; }
  pg_uid=$(/usr/bin/id -u postgres 2>/dev/null) && pg_gid=$(/usr/bin/id -g postgres 2>/dev/null) || { p03_fail PG_ACCOUNT_UNKNOWN; return 1; }
  [[ "$pg_uid" =~ ^(0|[1-9][0-9]{0,9})$ && "$pg_gid" =~ ^(0|[1-9][0-9]{0,9})$ ]] || { p03_fail PG_ACCOUNT_UNKNOWN; return 1; }
  value=$(/usr/bin/stat -c '%F %u %g %a' -- /var/lib/postgresql/data 2>/dev/null) || { p03_fail ROOT_METADATA_FAILED; return 1; }
  IFS=' ' read -r root_type root_uid root_gid root_mode rest <<< "$value"
  [[ "$root_type" == directory && "$root_uid" =~ ^(0|[1-9][0-9]{0,9})$ && "$root_gid" =~ ^(0|[1-9][0-9]{0,9})$ && "$root_mode" =~ ^[0-7]{1,4}$ && -z "$rest" ]] || { p03_fail ROOT_METADATA_FAILED; return 1; }
  aggregate=$(
    set -o pipefail
    {
      /usr/bin/find -P /var/lib/postgresql/data -xdev -printf '%y %D %i %U %G %m %s %b\n' 2>/dev/null
      if (( $? == 0 )); then printf 'END 0\n'; else printf 'END 1\n'; fi
    } 2>/dev/null | p03_aggregate
  ) || { [[ "$aggregate" =~ ^\{\"status\":\"(INVALID_METADATA|NUMERIC_LIMIT|ENTRY_LIMIT|INODE_METADATA_CONFLICT|TRAVERSAL_FAILED)\",\"complete\":false\}$ ]] && printf '%s\n' "$aggregate" || p03_fail TRAVERSAL_FAILED; return 1; }
  result="{\"status\":\"DISCOVERY_METADATA_COMPLETE\",\"complete\":true,\"tools\":[$tool_json],\"postgresAccount\":{\"uid\":$pg_uid,\"gid\":$pg_gid},\"sourceRoot\":{\"type\":\"directory\",\"uid\":$root_uid,\"gid\":$root_gid,\"mode\":\"$root_mode\"},\"metadata\":$aggregate}"
  (( ${#result} + 1 <= 8192 )) || { p03_fail OUTPUT_LIMIT; return 1; }
  printf '%s\n' "$result"
}

if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "$0" ]]; then
  printf 'PREPARATION_ONLY\n'
elif (( $# == 1 )) && [[ "$1" == --discover-p03-metadata-r2 ]]; then
  p03_discover
else
  printf 'PREPARATION_ONLY\n'
fi
