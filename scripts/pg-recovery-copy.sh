#!/bin/bash
# COPY 전용 library/준비 진입점. source/default는 읽기·쓰기·도구 probe를 하지 않는다.
# 실제 세 모드는 controller가 검증한 exact argv와 별도 실행 결정 없이는 사용하지 않는다.

p03_copy_fail(){ printf '{"status":"%s","complete":false}\n' "$1"; return 1; }
p03_copy_uint(){ [[ $1 =~ ^(0|[1-9][0-9]*)$ && ${#1} -le 16 ]] && { [[ ${#1} -lt 16 ]] || [[ $1 < 9007199254740992 ]]; }; }
# 작은 제어 출력 전용 순수 검증. raw manifest/NUL 자료에는 사용하지 않는다.
p03_copy_scalar_format(){
 local kind=$1 value=$2 line
 [[ ${#value} -le 16384 ]] || return 1
 if [[ $kind == empty ]]; then [[ -z $value ]]; return; fi
 [[ $value == *$'\n' ]] || return 1
 line=${value%$'\n'}
 if [[ $kind == help ]]; then [[ -n $line ]] || return 1; P03_VALUE=$value; return; fi
 [[ -n $line && $line != *$'\r'* ]] || return 1
 [[ $kind == df-avail || $kind == df-inodes || $line != *$'\n'* ]] || return 1
 case $kind in
  hash) [[ $line =~ ^[a-f0-9]{64}\ [\ *].+$ ]] || return 1; P03_VALUE=${line:0:64};;
  uint) p03_copy_uint "$line" || return 1; P03_VALUE=$line;;
  df-avail|df-inodes) local header=${value%%$'\n'*} number=${value#*$'\n'}; number=${number%$'\n'}; [[ $number != *$'\n'* && ( $kind == df-avail && ${header//[[:space:]]/} == Avail || $kind == df-inodes && ${header//[[:space:]]/} == IFree ) ]] || return 1; number=${number//[[:space:]]/}; p03_copy_uint "$number" || return 1; P03_VALUE=$number;;
  path) [[ $line =~ ^/[A-Za-z0-9_./-]+$ && /$line/ != *'/../'* ]] || return 1; P03_VALUE=$line;;
  stat) [[ $line =~ ^[0-9[:space:]:.+-]+$ ]] || return 1; P03_VALUE=$line;;
  *) return 1;;
 esac
}
# marker로 후행 개행도 보존한다. 빈 줄뿐인 stderr도 정상화하지 않는다.
# raw byte가 문자열치환에 도달하기 전에 NUL/상한 도달을 거절한다.
# 실패 시 남은 pipe를 유한 chunk로 비워 producer의 SIGPIPE warning도 외부로 내보내지 않는다.
p03_copy_raw_guard(){
 local LC_ALL=C limit=$1 value='' discarded='' status
 [[ $limit == 16384 || $limit == 16385 ]] || return 1
 IFS= read -r -d '' -n "$((limit+1))" value; status=$?
 if [[ $status != 1 ]]; then
  while IFS= read -r -d '' -n 4096 discarded; do :; done
  return 1
 fi
 printf '%s' "$value"
}
# marker는 guard 통과 후의 제어문자이며 payload cap과 분리한다.
p03_copy_capture_memory(){
 local kind=$1 captured error status value
 shift
 captured=$(
  set -o pipefail
  {
   error=$(
    set -o pipefail
    "$@" 2>&1 >&3 | p03_copy_raw_guard 16384
    status=$?
    printf '\036%s' "$status"
   )
   status=${error##*$'\036'}; error=${error%$'\036'*}
   [[ $status == 0 && -z $error ]] || exit 1
   printf '\036'
  } 3>&1 | p03_copy_raw_guard 16385
 ) || return 1
 [[ $captured == *$'\036' ]] || return 1
 value=${captured%$'\036'}
 p03_copy_scalar_format "$kind" "$value"
}
p03_copy_sha256(){ /usr/bin/sha256sum "$@"; }
p03_copy_hash_stream(){ p03_copy_capture_memory hash p03_copy_sha256 || return 1; printf '%s' "$P03_VALUE"; }
p03_copy_frames(){
 local LC_ALL=C row='' path='' kind='' size=0 count=0 files=0 dirs=0 logical=0 bytes=0 ended=0 root=0 field='' sum='' found='' endcount='' endlogical='' owneruid='' ownergid='' entryhash=''
 local -a records=()
 local -A seen=()
 while IFS= read -r -d '' row; do
  ((bytes+=${#row}+1)); ((bytes<=33554432)) || { p03_copy_fail COPY_FRAME_LIMIT; return 1; }
  ((ended==0)) || { p03_copy_fail COPY_FRAME_INVALID; return 1; }
  if [[ $row =~ ^END\ ([0-9]+)\ ([0-9]+)$ ]]; then
   endcount=${BASH_REMATCH[1]}; endlogical=${BASH_REMATCH[2]}
   p03_copy_uint "$endcount" && p03_copy_uint "$endlogical" || { p03_copy_fail COPY_FRAME_INVALID; return 1; }
   [[ $endcount == "$count" && $endlogical == "$logical" && $root == 1 && $count -gt 0 ]] || { p03_copy_fail COPY_FRAME_INVALID; return 1; }
   records+=("$row"); ended=1; continue
  fi
  [[ $row =~ ^([df])\ ([0-9]+)\ ([0-9]+)\ ([0-7]{3,4})\ ([0-9]{1,12}\.[0-9]{9})\ ([0-9]+)\ ([a-f0-9]{64}|-)\ (.*)$ ]] || { p03_copy_fail COPY_FRAME_INVALID; return 1; }
  kind=${BASH_REMATCH[1]}; path=${BASH_REMATCH[8]}; size=${BASH_REMATCH[6]}; owneruid=${BASH_REMATCH[2]}; ownergid=${BASH_REMATCH[3]}; entryhash=${BASH_REMATCH[7]}
  [[ $owneruid == 999 && $ownergid == 999 && -n $path && $path != /* && $path != */ ]] && p03_copy_uint "$size" || { p03_copy_fail COPY_FRAME_INVALID; return 1; }
  if [[ $path == . ]]; then [[ $kind == d ]] || { p03_copy_fail COPY_FRAME_INVALID; return 1; }; root=1
  else case "/$path/" in *'/../'*|*'/./'*|*'//'*) p03_copy_fail COPY_FRAME_INVALID; return 1;; esac; fi
  [[ ! ${seen["$path"]+found} ]] || { p03_copy_fail COPY_FRAME_DUPLICATE; return 1; }; seen["$path"]=1
  if [[ $kind == d ]]; then [[ $size == 0 && $entryhash == - ]] || { p03_copy_fail COPY_FRAME_INVALID; return 1; }; ((dirs+=1))
  else [[ $entryhash =~ ^[a-f0-9]{64}$ ]] || { p03_copy_fail COPY_FRAME_INVALID; return 1; }; ((files+=1)); ((logical+=size)); fi
  ((count+=1)); ((count<=100000 && logical<=268435456)) || { p03_copy_fail COPY_FRAME_LIMIT; return 1; }; records+=("$row")
 done
 [[ -z $row && $ended == 1 ]] || { p03_copy_fail COPY_FRAME_INCOMPLETE; return 1; }
 # 전체 원bytes/NUL을 재구성한다. 경로는 eval/명령/format string으로 사용하지 않는다.
 sum=$(printf '%s\0' "${records[@]}" | p03_copy_hash_stream) || { p03_copy_fail COPY_FRAME_HASH; return 1; }
 [[ $sum =~ ^[a-f0-9]{64}$ ]] || { p03_copy_fail COPY_FRAME_HASH; return 1; }
 printf '{"status":"COPY_FRAMES_VALID","complete":true,"entries":%s,"regularEntries":%s,"directoryEntries":%s,"regularLogicalBytes":%s,"manifestSha256":"%s"}\n' "$count" "$files" "$dirs" "$logical" "$sum"
}

p03_copy_parse(){
 local key value
 declare -gA P03_COPY=()
 (($#%2==0)) || return 1
 while (($#)); do key=$1; value=$2; shift 2
  case $key in --scope|--run-instance|--source-instance|--copy-instance|--decision-sha256|--acl|--xattr|--quota|--writer|--writer-evidence-sha256|--quota-evidence-sha256|--acl-observed|--xattr-observed|--available-bytes|--available-inodes|--allocation-limit-bytes|--reserve-bytes|--manifest-limit-bytes|--logical-bytes|--entry-count|--allocation-bytes-needed|--audit-bytes-needed) ;; *) return 1;; esac
  [[ ! ${P03_COPY["$key"]+found} ]] || return 1; P03_COPY["$key"]=$value
 done
 [[ ${P03_COPY[--scope]} == P03_PROTECTED_COPY_R1 && ${P03_COPY[--run-instance]} =~ ^[a-f0-9]{32}$ && ${P03_COPY[--source-instance]} == dc22a0629e79f259dcd935845e88e58e && ${P03_COPY[--copy-instance]} == "${P03_COPY[--run-instance]}" && ${P03_COPY[--decision-sha256]} =~ ^[a-f0-9]{64}$ && ${P03_COPY[--writer-evidence-sha256]} =~ ^[a-f0-9]{64}$ && ${P03_COPY[--quota-evidence-sha256]} =~ ^[a-f0-9]{64}$ && ${P03_COPY[--acl]} == REQUIRE_NONE_VERIFIED && ${P03_COPY[--xattr]} == REQUIRE_NONE_VERIFIED && ${P03_COPY[--quota]} == REQUIRE_ENFORCED && ${P03_COPY[--writer]} == REQUIRE_CONTROLLED ]]
}
p03_copy_gate(){
 p03_copy_parse "$@" || { p03_copy_fail COPY_GATE_BINDING; return 1; }
 local key available inodes limit reserve manifest logical entries allocated audit
 [[ ${#P03_COPY[@]} == 22 && ${P03_COPY[--acl-observed]} == NONE_VERIFIED && ${P03_COPY[--xattr-observed]} == NONE_VERIFIED ]] || { p03_copy_fail COPY_GATE_UNVERIFIED; return 1; }
 for key in --available-bytes --available-inodes --allocation-limit-bytes --reserve-bytes --manifest-limit-bytes --logical-bytes --entry-count --allocation-bytes-needed --audit-bytes-needed; do p03_copy_uint "${P03_COPY[$key]}" || { p03_copy_fail COPY_GATE_NUMERIC; return 1; }; done
 available=${P03_COPY[--available-bytes]}; inodes=${P03_COPY[--available-inodes]}; limit=${P03_COPY[--allocation-limit-bytes]}; reserve=${P03_COPY[--reserve-bytes]}; manifest=${P03_COPY[--manifest-limit-bytes]}; logical=${P03_COPY[--logical-bytes]}; entries=${P03_COPY[--entry-count]}; allocated=${P03_COPY[--allocation-bytes-needed]}; audit=${P03_COPY[--audit-bytes-needed]}
 ((logical<=268435456 && entries>0 && entries<=100000 && manifest==33554432 && reserve>=33554432 && audit>0 && audit<=manifest && allocated>=logical && allocated<=536870912 && available>=allocated+reserve+manifest && limit>=allocated+reserve+manifest && inodes>=entries+100)) || { p03_copy_fail COPY_GATE_CAPACITY; return 1; }
 p03_copy_cp
}
p03_copy_io_run(){ local out=$1 err=$2; shift 2; "$@" >"$out" 2>"$err"; }
p03_copy_measure(){
 local LC_ALL=C path=$1 row='' size=0
 [[ -f $path && ! -L $path ]] || return 1
 while IFS= read -r -d '' row; do ((size+=${#row}+1)); ((size<=33554432)) || return 1; done <"$path"
 ((size+=${#row})); ((size<=33554432)) || return 1
 P03_BYTES=$size
}
p03_copy_io_text(){
 local status
 [[ -f $1 && ! -L $1 ]] || return 1
 IFS= read -r -d '' P03_VALUE <"$1"; status=$?
 [[ $status == 1 && ${#P03_VALUE} -le 16384 ]]
}
p03_copy_observe(){
 local out=$1 err=$2 status
 shift 2
 p03_copy_io_run "$out" "$err" "$@"; status=$?
 [[ $status == 0 ]] || return 1
 p03_copy_measure "$err" && [[ $P03_BYTES == 0 ]] || return 1
 p03_copy_measure "$out" && ((P03_BYTES<=33554432))
}
p03_copy_capture(){
 local kind=$1 out=$2 err=$3
 shift 3
 p03_copy_observe "$out" "$err" "$@" && p03_copy_io_text "$out" || return 1
 p03_copy_scalar_format "$kind" "$P03_VALUE"
}
p03_copy_cp(){ p03_copy_observe /anvil-copy-audit/cp.stdout /anvil-copy-audit/cp.stderr /usr/bin/cp --archive --no-dereference --one-file-system --preserve=all -- /var/lib/postgresql/data/. /anvil-recovery-copy/ && [[ ! -s /anvil-copy-audit/cp.stdout ]]; }

# 아래 함수는 실제 helper 안에서만 호출한다. 출력/오류는 보호 tmpfs 안에 둔다.
p03_copy_runtime_tools(){
 local path canonical value expected comma=''
 local -a paths=(/bin/bash /usr/bin/timeout /usr/bin/find /usr/bin/stat /usr/bin/sha256sum /usr/bin/id /usr/bin/readlink /usr/bin/awk /usr/bin/cp /usr/bin/sort /usr/bin/cmp /usr/bin/df /usr/bin/getfacl /usr/bin/getfattr /usr/bin/chmod /usr/bin/chown)
 local -A known=( [/bin/bash]=223fe8564b60636bc738b6178d3ba9a50ef7d791266b0efae6363bb716e4c47f [/usr/bin/timeout]=6ca1891dfc0b05d7680770c2884c0391b92467c7bb6500a5c84677e6481739f1 [/usr/bin/find]=91b75e72c495e68dd6aab198c2fd6c458fd51a2dc361045ee31f8e657417de26 [/usr/bin/stat]=128754b37ab743a539d889a91441c440f9b52df77f4e008b345ff221ce1daeaa [/usr/bin/sha256sum]=89f8c1d1ba3c76138f3771e1a91e2796ade6180b1c1e4258c04698ff32787c97 [/usr/bin/id]=50629fa0ab5c003b538d4ccf7de34e85d2df4e799a79eb2dd4c2f7b1e0d7ca59 [/usr/bin/readlink]=1dcaf494f4dec175292b1684b3e978d18a4c3c703c52f81606d9e8eea30eb6db [/usr/bin/awk]=eff9f2b711eb5bee1b58d4d33b891e8da8f6534655d3854a45bd10217dbb28e6 )
 # 먼저 모든 도구가 확인될 때만 JSON을 구성한다. 미관측 도구 지문은 고정값으로 채우지 않는다.
 local -a values=() canonicals=()
 for path in "${paths[@]}"; do
  p03_copy_capture path /var/lib/postgresql/data/tool-canonical /var/lib/postgresql/data/tool-stderr /usr/bin/readlink -f -- "$path" || return 1; canonical=$P03_VALUE
  case "$path:$canonical" in /bin/bash:/bin/bash|/bin/bash:/usr/bin/bash|/usr/bin/awk:/usr/bin/mawk|/usr/bin/awk:/usr/bin/gawk) ;; *) [[ $path == "$canonical" ]] || return 1;; esac
  [[ -f $canonical && ! -L $canonical ]] || return 1
  p03_copy_capture hash /var/lib/postgresql/data/tool-hash /var/lib/postgresql/data/tool-stderr /usr/bin/sha256sum -- "$canonical" || return 1; value=$P03_VALUE
  expected=${known[$path]}; [[ -z $expected || $value == "$expected" ]] || return 1
  values+=("$value"); canonicals+=("$canonical")
 done
 p03_copy_observe /var/lib/postgresql/data/tool-help /var/lib/postgresql/data/tool-stderr /usr/bin/find --help || return 1
 p03_copy_io_text /var/lib/postgresql/data/tool-help && p03_copy_scalar_format help "$P03_VALUE" || return 1; local helptext=$P03_VALUE; [[ $helptext == *-print0* ]] || return 1
 local feature token
 for feature in sha256sum sort cmp cp df getfacl getfattr chmod chown; do
  p03_copy_observe /var/lib/postgresql/data/tool-help /var/lib/postgresql/data/tool-stderr "/usr/bin/$feature" --help || return 1
  p03_copy_io_text /var/lib/postgresql/data/tool-help && p03_copy_scalar_format help "$P03_VALUE" || return 1; helptext=$P03_VALUE
  case $feature in sha256sum) [[ $helptext == *--zero* ]] || return 1;; sort) [[ $helptext == *--zero-terminated* ]] || return 1;; cmp) [[ $helptext == *--silent* ]] || return 1;; cp) [[ $helptext == *--archive* && $helptext == *--preserve* && $helptext == *--one-file-system* ]] || return 1;; df) [[ $helptext == *--output* ]] || return 1;; getfacl) [[ $helptext == *--numeric* && $helptext == *--omit-header* ]] || return 1;; getfattr) [[ $helptext == *--absolute-names* && $helptext == *--dump* ]] || return 1;; esac
 done
 printf '{"status":"COPY_TOOLS_VERIFIED","complete":true,"tools":['
 local i
 for ((i=0;i<${#paths[@]};i++)); do path=${paths[$i]}; canonical=${canonicals[$i]}; printf '%s{"path":"%s","canonical":"%s","sha256":"%s","regular":true,"symlink":false,"image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f"}' "$comma" "$path" "$canonical" "${values[$i]}"; comma=,; done
 printf '],"features":{"nulFind":true,"nulHash":true,"nulSort":true,"compare":true,"archiveCopy":true,"capacity":true}}\n'
}
p03_copy_init(){
 local root=/anvil-recovery-copy audit=/var/lib/postgresql/data before after
 p03_copy_capture_memory uint /usr/bin/id -u && [[ $P03_VALUE == 0 ]] || return 1
 p03_copy_capture_memory uint /usr/bin/id -g && [[ $P03_VALUE == 0 ]] || return 1
 [[ -d $audit && ! -L $audit && -d $root && ! -L $root ]] || return 1
 p03_copy_capture_memory stat /usr/bin/stat -c '%u %g %a' -- "$audit" && [[ $P03_VALUE == '0 0 700' ]] || return 1
 p03_copy_capture stat "$audit/init-before" "$audit/init-stderr" /usr/bin/stat -c '%u %g %a' -- "$root" || return 1
 before=$P03_VALUE; [[ $before == '0 0 755' ]] || return 1
 p03_copy_observe "$audit/init-empty" "$audit/init-stderr" /usr/bin/find "$root" -mindepth 1 -printf ENTRY -quit && [[ $P03_BYTES == 0 ]] || return 1
 # 새 root 하나만 변경하며 stdout/stderr도 확인한다. 재귀/추가 capability는 없다.
 p03_copy_observe "$audit/init-chmod" "$audit/init-stderr" /usr/bin/chmod 0700 -- "$root" && [[ $P03_BYTES == 0 ]] || return 1
 p03_copy_observe "$audit/init-chown" "$audit/init-stderr" /usr/bin/chown 999:999 -- "$root" && [[ $P03_BYTES == 0 ]] || return 1
 p03_copy_capture stat "$audit/init-after" "$audit/init-stderr" /usr/bin/stat -c '%u %g %a' -- "$root" || return 1
 after=$P03_VALUE; [[ $after == '999 999 700' && ! -L $root ]] || return 1
 printf '{"status":"COPY_ROOT_INITIALIZED","complete":true,"empty":true,"rootOnly":true,"recursive":false,"before":{"uid":0,"gid":0,"mode":"755","type":"directory","symlink":false},"after":{"uid":999,"gid":999,"mode":"700","type":"directory","symlink":false}}\n'
}
p03_copy_scan(){
 local LC_ALL=C root=$1 prefix=$2 path relative row type device inode uid gid mode size links seconds date rest nanos filehash blocks rootdev acl attr aclcount checkrow
 [[ -d $root && ! -L $root ]] || return 1
 p03_copy_capture uint "$prefix.rootdev" "$prefix.stderr" /usr/bin/stat -c %d -- "$root" || return 1; rootdev=$P03_VALUE
 : >"$prefix.records"; : >"$prefix.metadata"; : >"$prefix.stderr"
 p03_copy_observe "$prefix.paths" "$prefix.stderr" /usr/bin/find "$root" -xdev -print0 || return 1
 P03_COUNT=0; P03_FILES=0; P03_DIRS=0; P03_LOGICAL=0; P03_ALLOCATED=0
 while IFS= read -r -d '' path; do
  [[ ! -L $path ]] || return 1
  p03_copy_capture stat "$prefix.stat" "$prefix.stderr" /usr/bin/stat -c '%d %i %u %g %a %s %h %Y %y %b' -- "$path" || return 1
  row=$P03_VALUE
  read -r device inode uid gid mode size links seconds date rest <<<"$row"
  [[ $device == "$rootdev" && $uid == 999 && $gid == 999 ]] || return 1
  relative=${path#"$root"}; relative=${relative#/}; [[ -n $relative ]] || relative=.
  [[ $path == "$root" || $path == "$root/"* ]] || return 1
  # 선택 metadata는 ACL/xattr 없음이 실제 확인된 경우만 받는다.
  p03_copy_observe "$prefix.acl" "$prefix.stderr" /usr/bin/getfacl -cpn -- "$path" || return 1
  aclcount=0
  while IFS= read -r acl; do [[ -z $acl ]] && continue; [[ $acl =~ ^(user|group|other)::[rwx-]{3}$ ]] || return 1; ((aclcount+=1)); done <"$prefix.acl"
  [[ $aclcount == 3 ]] || return 1
  p03_copy_observe "$prefix.xattr" "$prefix.stderr" /usr/bin/getfattr --absolute-names -d -m- -- "$path" || return 1
  [[ ! -s $prefix.xattr ]] || return 1
  nanos=${row#*.}; nanos=${nanos%% *}; [[ $nanos =~ ^[0-9]{9}$ && $seconds =~ ^[0-9]+$ ]] || return 1
  blocks=${row##* }; p03_copy_uint "$blocks" && p03_copy_uint "$size" || return 1
  if [[ -d $path ]]; then type=d; size=0; filehash=-; ((P03_DIRS+=1))
  elif [[ -f $path && $links == 1 ]]; then type=f; ((P03_FILES+=1)); ((P03_LOGICAL+=size)); ((P03_ALLOCATED+=blocks*512)); p03_copy_observe "$prefix.hash" "$prefix.stderr" /usr/bin/sha256sum --zero -- "$path" || return 1
   local hashrecord hashmarker
   IFS= read -r -d '' hashrecord <"$prefix.hash" || return 1
   filehash=${hashrecord:0:64}; hashmarker=${hashrecord:64:2}
   [[ $filehash =~ ^[a-f0-9]{64}$ && ( $hashmarker == '  ' || $hashmarker == ' *' ) && ${hashrecord:66} == "$path" ]] || return 1
   p03_copy_measure "$prefix.hash" && ((P03_BYTES==${#hashrecord}+1)) || return 1
  else return 1; fi
  p03_copy_capture stat "$prefix.restatted" "$prefix.stderr" /usr/bin/stat -c '%d %i %u %g %a %s %h %Y %y %b' -- "$path" || return 1
  [[ ! -L $path && $row == "$P03_VALUE" ]] || return 1
  ((P03_COUNT+=1)); ((P03_COUNT<=100000 && P03_LOGICAL<=268435456 && P03_ALLOCATED<=536870912)) || return 1
  printf '%s %s %s %s %s.%s %s %s %s\0' "$type" "$uid" "$gid" "$mode" "$seconds" "$nanos" "$size" "$filehash" "$relative" >>"$prefix.records" || return 1
  printf '%s %s %s %s %s.%s %s %s\0' "$type" "$uid" "$gid" "$mode" "$seconds" "$nanos" "$size" "$relative" >>"$prefix.metadata" || return 1
 done <"$prefix.paths"
 [[ -z $path ]] && ((P03_COUNT>0)) || return 1
 { while IFS= read -r -d '' checkrow; do printf '%s\0' "$checkrow" || return 1; done <"$prefix.records"; printf 'END %s %s\0' "$P03_COUNT" "$P03_LOGICAL"; } >"$prefix.framed" || return 1
 p03_copy_frames <"$prefix.framed" >"$prefix.validated" || return 1
 LC_ALL=C TMPDIR=/anvil-copy-audit p03_copy_observe "$prefix.sorted" "$prefix.stderr" /usr/bin/sort -z -S 4M --temporary-directory=/anvil-copy-audit -- "$prefix.records" || return 1
 LC_ALL=C TMPDIR=/anvil-copy-audit p03_copy_observe "$prefix.meta-sorted" "$prefix.stderr" /usr/bin/sort -z -S 4M --temporary-directory=/anvil-copy-audit -- "$prefix.metadata" || return 1
 local sum meta
 p03_copy_capture hash "$prefix.sum" "$prefix.stderr" /usr/bin/sha256sum -- "$prefix.sorted" || return 1; sum=$P03_VALUE
 p03_copy_capture hash "$prefix.meta-sum" "$prefix.stderr" /usr/bin/sha256sum -- "$prefix.meta-sorted" || return 1; meta=$P03_VALUE
 [[ ${sum:0:64} =~ ^[a-f0-9]{64}$ && ${meta:0:64} =~ ^[a-f0-9]{64}$ ]] || return 1
 printf '{"entries":%s,"regularEntries":%s,"directoryEntries":%s,"regularLogicalBytes":%s,"manifestSha256":"%s","selectedMetadataSha256":"%s"}' "$P03_COUNT" "$P03_FILES" "$P03_DIRS" "$P03_LOGICAL" "${sum:0:64}" "${meta:0:64}" >"$prefix.summary"
}
p03_copy_runtime(){
 local -a binding=("$@")
 p03_copy_parse "$@" && [[ ${#P03_COPY[@]} == 11 ]] || return 1
 local nonce=${P03_COPY[--run-instance]} writer=${P03_COPY[--writer-evidence-sha256]} source=/var/lib/postgresql/data target=/anvil-recovery-copy audit=/anvil-copy-audit empty capacity available inodes header summary before after copied
 p03_copy_capture_memory uint /usr/bin/id -u && [[ $P03_VALUE == 999 ]] || return 1
 p03_copy_capture_memory uint /usr/bin/id -g && [[ $P03_VALUE == 999 ]] || return 1
 [[ -d $audit && ! -L $audit && -d $target && ! -L $target ]] || return 1
 p03_copy_capture_memory stat /usr/bin/stat -c '%u %g %a' -- "$audit" && [[ $P03_VALUE == '999 999 700' ]] || return 1
 p03_copy_capture stat "$audit/target-root" "$audit/runtime-stderr" /usr/bin/stat -c '%u %g %a' -- "$target" && [[ $P03_VALUE == '999 999 700' ]] || return 1
 p03_copy_capture stat "$audit/source-id" "$audit/runtime-stderr" /usr/bin/stat -c '%d:%i' -- "$source" || return 1; local sourceid=$P03_VALUE
 p03_copy_capture stat "$audit/target-id" "$audit/runtime-stderr" /usr/bin/stat -c '%d:%i' -- "$target" && [[ $sourceid != "$P03_VALUE" ]] || return 1
 umask 077
 local mi1 mi2 mi3 mi4 mountpoint mountoptions remainder
 while read -r mi1 mi2 mi3 mi4 mountpoint mountoptions remainder; do case $mountpoint in "$source/"*|"$target/"*|"$audit/"*) return 1;; esac; if [[ $mountpoint == "$source" ]]; then [[ ,$mountoptions, == *,ro,* ]] || return 1; fi; done </proc/self/mountinfo
 # stderr/임시sort/manifest는 32MiB 보호 tmpfs에만 둔다. PGdata 안에는 쓰지 않는다.
 p03_copy_observe "$audit/target-empty" "$audit/runtime-stderr" /usr/bin/find "$target" -mindepth 1 -printf ENTRY -quit && [[ $P03_BYTES == 0 ]] || return 1
 p03_copy_capture df-avail "$audit/space" "$audit/df.stderr" /usr/bin/df -B1 --output=avail -- "$target" || return 1; available=$P03_VALUE
 p03_copy_capture df-inodes "$audit/inodes" "$audit/df.stderr" /usr/bin/df --output=iavail -- "$target" || return 1; inodes=$P03_VALUE
 p03_copy_scan "$source" "$audit/before" || return 1
 local logical=$P03_LOGICAL entries=$P03_COUNT allocated=$P03_ALLOCATED
 # 외부 quota/writer는 host에서 grant/evidence/inspect에 이미 결박된 별도 관측이다.
 # REQUIRE 문자열만으로 이를 확인하지 않는다. 현재 system evidence provider는 UNVERIFIED여서 이 모드에 도달하지 않는다.
 p03_copy_gate "${binding[@]}" --acl-observed NONE_VERIFIED --xattr-observed NONE_VERIFIED --available-bytes "$available" --available-inodes "$inodes" --allocation-limit-bytes 536870912 --reserve-bytes 134217728 --manifest-limit-bytes 33554432 --logical-bytes "$logical" --entry-count "$entries" --allocation-bytes-needed "$allocated" --audit-bytes-needed 33554432 || return 1
 p03_copy_scan "$source" "$audit/after" && p03_copy_scan "$target" "$audit/copied" || return 1
 local comparison
 for comparison in after copied; do
  p03_copy_observe "$audit/cmp.stdout" "$audit/cmp.stderr" /usr/bin/cmp -s -- "$audit/before.sorted" "$audit/$comparison.sorted" && [[ ! -s $audit/cmp.stdout ]] || return 1
  p03_copy_observe "$audit/cmp.stdout" "$audit/cmp.stderr" /usr/bin/cmp -s -- "$audit/before.meta-sorted" "$audit/$comparison.meta-sorted" && [[ ! -s $audit/cmp.stdout ]] || return 1
 done
 before=$(<"$audit/before.summary"); after=$(<"$audit/after.summary"); copied=$(<"$audit/copied.summary")
 # 관측된 집계·전체지문만. 경로/개별hash/원문/상세stderr는 출력하지 않는다.
 printf '{"status":"PROTECTED_COPY_VERIFIED","complete":true,"sourceIdentity":{"name":"anvil-v3-development-pgdata","instance":"dc22a0629e79f259dcd935845e88e58e","createdAt":"2026-10-16T03:53:33+09:00"},"copyIdentity":{"name":"anvil-v3-pgdata-recovery-20261027-r1","instance":"%s"},"sourceBefore":%s,"sourceAfter":%s,"copy":%s,"sourceConsumersBefore":[],"sourceConsumersAfter":[],"writer":{"status":"CONTROLLED","windowEvidenceSha256":"%s"},"metadata":{"acl":"NONE_VERIFIED","xattr":"NONE_VERIFIED","allUid":999,"allGid":999,"symlinks":0,"special":0,"hardlinks":0,"externalMounts":0},"capacity":{"availableBytes":%s,"availableInodes":%s,"quotaStatus":"ENFORCED","allocationLimitBytes":536870912,"reserveBytes":134217728,"manifestLimitBytes":33554432},"contentVerified":true,"selectedMetadataVerified":true,"pointInTimeConsistencyProven":false,"postgresStarted":false}\n' "$nonce" "$before" "$after" "$copied" "$writer" "$available" "$inodes"
}

# 별도 limited supervisor. cp/clock/관측/TERM/wait/dispose는 runtime adapter 또는 파일 없는 fake 함수로 주입한다.
p03_limited_identity_matches(){
 p03_limited_cp_identity "$P03_LIMITED_CP_PID" || return 1
 [[ $P03_LIMITED_OBSERVED_PID == "$P03_LIMITED_CP_PID" && $P03_LIMITED_OBSERVED_PARENT_PID == "$P03_LIMITED_CP_PARENT_PID" && $P03_LIMITED_OBSERVED_START_IDENTITY == "$P03_LIMITED_CP_START_IDENTITY" ]]
}
p03_limited_sample(){
 local minimum=$1 inodes=$2 maxms=$3 started finished
 p03_limited_now || return 1; started=$P03_LIMITED_NOW_MS
 p03_limited_space_observe || return 1
 p03_limited_now || return 1; finished=$P03_LIMITED_NOW_MS
 [[ $P03_LIMITED_SPACE_STATUS == OBSERVED ]] || return 1
 p03_copy_uint "$P03_LIMITED_AVAILABLE_BYTES" && p03_copy_uint "$P03_LIMITED_AVAILABLE_INODES" && p03_copy_uint "$P03_LIMITED_SPACE_OBSERVED_MS" || return 1
 ((finished>=started && finished-started<=maxms && P03_LIMITED_SPACE_OBSERVED_MS>=started && P03_LIMITED_SPACE_OBSERVED_MS<=finished && P03_LIMITED_AVAILABLE_BYTES>=minimum && P03_LIMITED_AVAILABLE_INODES>=inodes)) || return 1
 if [[ -n ${P03_LIMITED_LAST_OBSERVATION_MS-} ]]; then
  ((finished>=P03_LIMITED_LAST_OBSERVATION_MS && finished-P03_LIMITED_LAST_OBSERVATION_MS<=maxms)) || return 1
  if ((finished-P03_LIMITED_LAST_OBSERVATION_MS>P03_LIMITED_MAX_OBSERVATION_GAP_MS)); then P03_LIMITED_MAX_OBSERVATION_GAP_MS=$((finished-P03_LIMITED_LAST_OBSERVATION_MS)); fi
 fi
 P03_LIMITED_LAST_OBSERVATION_MS=$finished
}
p03_limited_copy_supervise(){
 local key value source_deadline deadline reserve inodes needed logical allocated entries maxms now attempted=false owned=false done=false waitok=false disposed=false failed=false
 local -A options=()
 P03_LIMITED_VIOLATION_LATCHED=false; P03_LIMITED_PRESERVATION_REQUIRED=false; P03_LIMITED_TERM_COUNT=0; P03_LIMITED_MAX_OBSERVATION_GAP_MS=0
 unset P03_LIMITED_LAST_OBSERVATION_MS
 (($#%2==0)) || return 1
 while (($#)); do key=$1;value=$2;shift 2;case $key in --scope|--source-deadline-ms|--deadline-ms|--reserve-bytes|--min-inodes|--expected-needed-bytes|--source-logical-bytes|--source-allocated-bytes|--source-entry-count|--max-observation-ms) ;; *) return 1;; esac;[[ ! ${options["$key"]+found} ]] || return 1;options["$key"]=$value;done
 [[ ${#options[@]} == 10 && ${options[--scope]} == P03_PROTECTED_COPY_LIMITED_RISK_R1 ]] || return 1
 for key in --source-deadline-ms --deadline-ms --reserve-bytes --min-inodes --expected-needed-bytes --source-logical-bytes --source-allocated-bytes --source-entry-count --max-observation-ms;do p03_copy_uint "${options[$key]}" || return 1;done
 source_deadline=${options[--source-deadline-ms]};deadline=${options[--deadline-ms]};reserve=${options[--reserve-bytes]};inodes=${options[--min-inodes]};needed=${options[--expected-needed-bytes]};logical=${options[--source-logical-bytes]};allocated=${options[--source-allocated-bytes]};entries=${options[--source-entry-count]};maxms=${options[--max-observation-ms]}
 p03_limited_now || return 1;now=$P03_LIMITED_NOW_MS
 if ! ((logical<=268435456 && allocated<=536870912 && entries>0 && entries<=100000 && inodes==entries+100 && reserve==134217728 && maxms==10000 && needed==(logical>allocated?logical:allocated)+33554432 && deadline>source_deadline && deadline-now<=600000 && source_deadline-now<=500000 && now<source_deadline));then failed=true;fi
 if [[ $failed == false ]];then p03_limited_sample "$((needed+reserve))" "$inodes" "$maxms" || failed=true;fi
 if [[ $failed == false ]];then
  if p03_limited_now;then now=$P03_LIMITED_NOW_MS; ((now<source_deadline && now<deadline)) || failed=true;else failed=true;fi
 fi
 if [[ $failed == false ]];then
  P03_LIMITED_START_AVAILABLE_BYTES=$P03_LIMITED_AVAILABLE_BYTES
  P03_LIMITED_START_AVAILABLE_INODES=$P03_LIMITED_AVAILABLE_INODES
  attempted=true
  if p03_limited_cp_start;then
   if p03_copy_uint "$P03_LIMITED_CP_PID" && p03_copy_uint "$P03_LIMITED_CP_PARENT_PID" && [[ $P03_LIMITED_CP_PID -gt 0 && $P03_LIMITED_CP_PARENT_PID -gt 0 && $P03_LIMITED_CP_START_IDENTITY =~ ^[0-9]{1,20}$ ]] && p03_limited_identity_matches;then owned=true;else failed=true;fi
  else failed=true;fi
 fi
 if [[ $failed == false ]];then p03_limited_cp_poll || failed=true;fi
 while [[ $failed == false ]];do
  p03_limited_now || { failed=true;break; };now=$P03_LIMITED_NOW_MS
  if ! ((now<source_deadline && now<deadline));then failed=true;break;fi
  if [[ ${P03_LIMITED_EXTERNAL_STOP-false} == true ]];then failed=true;break;fi
  if [[ $P03_LIMITED_CP_DONE == true ]];then
   p03_limited_sample "$reserve" "$inodes" "$maxms" || failed=true
   if p03_limited_now;then now=$P03_LIMITED_NOW_MS; ((now<source_deadline && now<deadline)) || failed=true;else failed=true;fi
   [[ $failed == false ]] || break
   if p03_limited_cp_wait "$P03_LIMITED_CP_PID" "$deadline" && [[ $P03_LIMITED_CP_CLOSED == true && $P03_LIMITED_CP_EXIT == 0 ]];then waitok=true;done=true;else failed=true;fi
   break
  fi
  p03_limited_wait_tick "$maxms" "$source_deadline" || { failed=true;break; }
  p03_limited_now || { failed=true;break; };now=$P03_LIMITED_NOW_MS
  if ! ((now<source_deadline && now<deadline && now>=P03_LIMITED_LAST_OBSERVATION_MS && now-P03_LIMITED_LAST_OBSERVATION_MS<=maxms));then failed=true;break;fi
  if ! p03_limited_identity_matches;then
   # 이미 확인했던 원 Bash job의 정상 reap만 경합으로 받는다. 최초 identity 실패는 복구하지 않는다.
   if ! p03_limited_cp_poll || [[ $P03_LIMITED_CP_DONE != true || $P03_LIMITED_CP_CLOSED != true || ${P03_LIMITED_CP_REAPED-false} != true ]];then owned=false;failed=true;break;fi
  fi
  p03_limited_sample "$reserve" "$inodes" "$maxms" || { failed=true;break; }
  p03_limited_cp_poll || { failed=true;break; }
 done
 if [[ $failed == true ]];then
  P03_LIMITED_VIOLATION_LATCHED=true;P03_LIMITED_PRESERVATION_REQUIRED=true
  if [[ $attempted == true && $owned == true ]];then
   if p03_limited_identity_matches && p03_limited_cp_poll;then
    p03_limited_now || P03_LIMITED_NOW_MS=$deadline
    if ((P03_LIMITED_NOW_MS<deadline));then
     if [[ $P03_LIMITED_CP_DONE != true ]];then
      P03_LIMITED_TERM_COUNT=1
      p03_limited_cp_term "$P03_LIMITED_CP_PID" || owned=false
     fi
     if [[ $owned == true ]];then p03_limited_cp_wait "$P03_LIMITED_CP_PID" "$deadline" || :;fi
    fi
   fi
  fi
 fi
 if p03_limited_watch_dispose;then disposed=true;else failed=true;P03_LIMITED_PRESERVATION_REQUIRED=true;fi
 [[ $failed == false && $done == true && $waitok == true && $disposed == true && $P03_LIMITED_VIOLATION_LATCHED == false && $P03_LIMITED_TIMER_DISPOSED == true && $P03_LIMITED_PIPE_CLOSED == true ]]
}
# 아래 adapter는 실제 limited helper에서만 사용한다. local 시험은 같은 이름의 fake 함수를 주입한다.
p03_limited_now(){
 local uptime rest seconds fraction
 p03_copy_observe "$P03_LIMITED_AUDIT_ROOT/uptime.stdout" "$P03_LIMITED_AUDIT_ROOT/uptime.stderr" p03_limited_read_uptime || return 1
 uptime=$P03_LIMITED_UPTIME
 [[ $uptime =~ ^([0-9]+)\.([0-9]{2})$ ]] || return 1
 seconds=${BASH_REMATCH[1]};fraction=${BASH_REMATCH[2]}
 p03_copy_uint "$seconds" && ((seconds<=9007199254740)) || return 1
 P03_LIMITED_NOW_MS=$((10#$seconds*1000+10#$fraction*10))
}
p03_limited_read_uptime(){ local rest; IFS=' ' read -r P03_LIMITED_UPTIME rest </proc/uptime; }
p03_limited_read_proc(){
 local pid=$1 row tail
 local -a fields=()
 p03_copy_uint "$pid" && ((pid>0)) || return 1
 IFS= read -r row <"/proc/$pid/stat" || return 1
 [[ $row == "$pid ("* && $row == *') '* ]] || return 1
 tail=${row##*) };read -r -a fields <<<"$tail"
 [[ ${#fields[@]} -ge 20 ]] && p03_copy_uint "${fields[1]}" && p03_copy_uint "${fields[19]}" || return 1
 P03_LIMITED_OBSERVED_PID=$pid;P03_LIMITED_OBSERVED_PARENT_PID=${fields[1]};P03_LIMITED_OBSERVED_START_IDENTITY=${fields[19]};P03_LIMITED_OBSERVED_STATE=${fields[0]}
}
p03_limited_cp_identity(){ p03_copy_observe "$P03_LIMITED_AUDIT_ROOT/proc.stdout" "$P03_LIMITED_AUDIT_ROOT/proc.stderr" p03_limited_read_proc "$1" && [[ $P03_BYTES == 0 ]]; }
p03_limited_cp_start(){
 [[ -z ${P03_LIMITED_CP_PID-} ]] || return 1
 /usr/bin/cp --archive --no-dereference --one-file-system --preserve=all -- /var/lib/postgresql/data/. /anvil-recovery-copy/ >"$P03_LIMITED_AUDIT_ROOT/cp.stdout" 2>"$P03_LIMITED_AUDIT_ROOT/cp.stderr" &
 P03_LIMITED_CP_PID=$!;P03_LIMITED_CP_PARENT_PID=$BASHPID;P03_LIMITED_CP_REAPED=false;P03_LIMITED_TERM_SENT=false
 p03_limited_cp_identity "$P03_LIMITED_CP_PID" && [[ $P03_LIMITED_OBSERVED_PARENT_PID == "$BASHPID" ]] || return 1
 P03_LIMITED_CP_START_IDENTITY=$P03_LIMITED_OBSERVED_START_IDENTITY
}
p03_limited_active_jobs(){ jobs -pr; jobs -ps; }
p03_limited_reap(){
 local status
 wait "$P03_LIMITED_CP_PID";status=$?
 P03_LIMITED_CP_EXIT=$status;P03_LIMITED_CP_REAPED=true;P03_LIMITED_CP_DONE=true;P03_LIMITED_CP_CLOSED=true
 [[ $status != 127 ]]
}
p03_limited_cp_poll(){
 local pid active=false
 if [[ ${P03_LIMITED_CP_REAPED-false} == true ]];then return 0;fi
 p03_copy_observe "$P03_LIMITED_AUDIT_ROOT/jobs.stdout" "$P03_LIMITED_AUDIT_ROOT/jobs.stderr" p03_limited_active_jobs || return 1
 while IFS= read -r pid;do p03_copy_uint "$pid" || return 1;[[ $pid != "$P03_LIMITED_CP_PID" ]] || active=true;done <"$P03_LIMITED_AUDIT_ROOT/jobs.stdout"
 if [[ $active == true ]];then P03_LIMITED_CP_DONE=false;P03_LIMITED_CP_CLOSED=false;return 0;fi
 p03_copy_observe "$P03_LIMITED_AUDIT_ROOT/reap.stdout" "$P03_LIMITED_AUDIT_ROOT/reap.stderr" p03_limited_reap
}
p03_limited_term_builtin(){ kill -s TERM -- "$1"; }
p03_limited_cp_term(){
 [[ $1 == "$P03_LIMITED_CP_PID" && ${P03_LIMITED_TERM_SENT-false} == false ]] && p03_limited_identity_matches || return 1
 P03_LIMITED_TERM_SENT=true
 p03_copy_observe "$P03_LIMITED_AUDIT_ROOT/term.stdout" "$P03_LIMITED_AUDIT_ROOT/term.stderr" p03_limited_term_builtin "$1" && [[ $P03_BYTES == 0 ]]
}
p03_limited_wait_tick(){
 local maximum=$1 deadline=$2 duration seconds status token timerchild
 p03_limited_now || return 1
 ((P03_LIMITED_NOW_MS<deadline)) || return 1
 duration=$((deadline-P03_LIMITED_NOW_MS));((duration<=maximum)) || duration=$maximum;((duration<=5000)) || duration=5000
 printf -v seconds '%d.%03d' "$((duration/1000))" "$((duration%1000))"
 # 익명 pipe의 자기 RW end가 EOF를 막아 timed read를 timer로 사용한다. 디스크/FIFO 파일/새 도구는 없다.
 exec {P03_LIMITED_TIMER_FD}<> <(:) || return 1
 timerchild=$!;wait "$timerchild" || { exec {P03_LIMITED_TIMER_FD}<&-;unset P03_LIMITED_TIMER_FD;return 1; }
 P03_LIMITED_TIMER_DISPOSED=false;P03_LIMITED_PIPE_CLOSED=false
 IFS= read -r -t "$seconds" -u "$P03_LIMITED_TIMER_FD" token;status=$?
 exec {P03_LIMITED_TIMER_FD}<&- || return 1
 unset P03_LIMITED_TIMER_FD
 P03_LIMITED_TIMER_DISPOSED=true;P03_LIMITED_PIPE_CLOSED=true
 ((status>128))
}
p03_limited_cp_wait(){
 local pid=$1 deadline=$2 end
 [[ $pid == "$P03_LIMITED_CP_PID" ]] || return 1
 p03_limited_now || return 1;end=$((P03_LIMITED_NOW_MS+25000));((end<=deadline)) || end=$deadline
 while [[ ${P03_LIMITED_CP_REAPED-false} != true ]];do
  p03_limited_cp_poll || return 1
  [[ ${P03_LIMITED_CP_REAPED-false} != true ]] || break
  p03_limited_wait_tick 100 "$end" || return 1
 done
 [[ $P03_LIMITED_CP_CLOSED == true && $P03_LIMITED_CP_EXIT == 0 ]]
}
p03_limited_watch_dispose(){
 if [[ -n ${P03_LIMITED_TIMER_FD-} ]];then exec {P03_LIMITED_TIMER_FD}<&- || return 1;unset P03_LIMITED_TIMER_FD;fi
 P03_LIMITED_TIMER_DISPOSED=true;P03_LIMITED_PIPE_CLOSED=true
}
p03_limited_space_observe(){
 P03_LIMITED_SPACE_STATUS=ERROR
 p03_copy_capture df-avail "$P03_LIMITED_AUDIT_ROOT/free-bytes" "$P03_LIMITED_AUDIT_ROOT/df.stderr" /usr/bin/df -B1 --output=avail -- /anvil-recovery-copy || return 1;P03_LIMITED_AVAILABLE_BYTES=$P03_VALUE
 p03_copy_capture df-inodes "$P03_LIMITED_AUDIT_ROOT/free-inodes" "$P03_LIMITED_AUDIT_ROOT/df.stderr" /usr/bin/df --output=iavail -- /anvil-recovery-copy || return 1;P03_LIMITED_AVAILABLE_INODES=$P03_VALUE
 p03_limited_now || return 1;P03_LIMITED_SPACE_OBSERVED_MS=$P03_LIMITED_NOW_MS;P03_LIMITED_SPACE_STATUS=OBSERVED
}
p03_limited_parse(){
 local key value
 declare -gA P03_LIMITED_BINDING=()
 (($#%2==0)) || return 1
 while (($#));do key=$1;value=$2;shift 2;case $key in --scope|--policy|--candidate-sha256|--run-instance|--source-instance|--copy-instance|--decision-sha256|--writer-assurance|--quota-assurance|--acl-selection|--xattr-selection|--numeric-owner-risk) ;; *)return 1;;esac;[[ ! ${P03_LIMITED_BINDING["$key"]+found} ]] || return 1;P03_LIMITED_BINDING["$key"]=$value;done
 [[ ${#P03_LIMITED_BINDING[@]} == 12 && ${P03_LIMITED_BINDING[--scope]} == P03_PROTECTED_COPY_LIMITED_RISK_R1 && ${P03_LIMITED_BINDING[--policy]} == P03_COPY_LIMITED_RISK_POLICY_R1_20261028 && ${P03_LIMITED_BINDING[--candidate-sha256]} == ffc3f2a2979a7845c48b61946a32f0b142c698ed7c6e8004d3038bad777670d3 && ${P03_LIMITED_BINDING[--run-instance]} =~ ^[a-f0-9]{32}$ && ${P03_LIMITED_BINDING[--source-instance]} == dc22a0629e79f259dcd935845e88e58e && ${P03_LIMITED_BINDING[--copy-instance]} == "${P03_LIMITED_BINDING[--run-instance]}" && ${P03_LIMITED_BINDING[--decision-sha256]} =~ ^[a-f0-9]{64}$ && ${P03_LIMITED_BINDING[--writer-assurance]} == NOT_PROVEN && ${P03_LIMITED_BINDING[--quota-assurance]} == NOT_ENFORCED && ${P03_LIMITED_BINDING[--acl-selection]} == UNAVAILABLE_ONLY_BASIC_METADATA && ${P03_LIMITED_BINDING[--xattr-selection]} == UNAVAILABLE_ONLY_BASIC_METADATA && ${P03_LIMITED_BINDING[--numeric-owner-risk]} == NEW_EXACT_RUN_ACCEPTED ]]
}
p03_limited_probe_attribute(){
 local private=$1 kind=$2 path leaf canonical state reason helptext
 case $kind in ACL)path=/usr/bin/getfacl;leaf=getfacl;;XATTR)path=/usr/bin/getfattr;leaf=getfattr;;*)return 1;;esac
 p03_copy_observe "$private/attribute.find" "$private/attribute.stderr" /usr/bin/find /usr/bin -mindepth 1 -maxdepth 1 -name "$leaf" -printf ENTRY || return 1
 if [[ $P03_BYTES == 0 ]];then state=UNAVAILABLE;reason=NOT_INSTALLED
 else
  p03_copy_io_text "$private/attribute.find" && [[ $P03_VALUE == ENTRY ]] || return 1
  p03_copy_capture path "$private/attribute.canonical" "$private/attribute.stderr" /usr/bin/readlink -f -- "$path" || return 1;canonical=$P03_VALUE
  [[ $canonical == "$path" && -f $canonical && ! -L $canonical && -x $canonical ]] || return 1
  p03_copy_capture hash "$private/attribute.hash" "$private/attribute.stderr" /usr/bin/sha256sum -- "$canonical" || return 1
  p03_copy_capture help "$private/attribute.help" "$private/attribute.stderr" "$path" --help || return 1;helptext=$P03_VALUE
  if [[ $kind == ACL && $helptext == *--numeric* && $helptext == *--omit-header* && $helptext == *--absolute-names* || $kind == XATTR && $helptext == *--absolute-names* && $helptext == *--dump* && $helptext == *--match* ]];then state=AVAILABLE;reason=SUPPORTED
  else state=UNAVAILABLE;reason=REQUIRED_FEATURE_UNSUPPORTED;fi
 fi
 if [[ $kind == ACL ]];then P03_LIMITED_ACL_STATE=$state;P03_LIMITED_ACL_REASON=$reason;else P03_LIMITED_XATTR_STATE=$state;P03_LIMITED_XATTR_REASON=$reason;fi
}
p03_limited_runtime_tools(){
 local private=${1:-/var/lib/postgresql/data}
 [[ $private == /var/lib/postgresql/data || $private == /anvil-copy-audit ]] || return 1
 p03_copy_capture_memory stat /usr/bin/stat -c '%u %g %a' -- "$private" && [[ $P03_VALUE == '999 999 700' ]] || return 1
 local path canonical value expected comma=''
 local -a paths=(/bin/bash /usr/bin/timeout /usr/bin/find /usr/bin/stat /usr/bin/sha256sum /usr/bin/id /usr/bin/readlink /usr/bin/awk /usr/bin/cp /usr/bin/sort /usr/bin/cmp /usr/bin/df /usr/bin/chmod /usr/bin/chown)
 local -A known=( [/bin/bash]=223fe8564b60636bc738b6178d3ba9a50ef7d791266b0efae6363bb716e4c47f [/usr/bin/timeout]=6ca1891dfc0b05d7680770c2884c0391b92467c7bb6500a5c84677e6481739f1 [/usr/bin/find]=91b75e72c495e68dd6aab198c2fd6c458fd51a2dc361045ee31f8e657417de26 [/usr/bin/stat]=128754b37ab743a539d889a91441c440f9b52df77f4e008b345ff221ce1daeaa [/usr/bin/sha256sum]=89f8c1d1ba3c76138f3771e1a91e2796ade6180b1c1e4258c04698ff32787c97 [/usr/bin/id]=50629fa0ab5c003b538d4ccf7de34e85d2df4e799a79eb2dd4c2f7b1e0d7ca59 [/usr/bin/readlink]=1dcaf494f4dec175292b1684b3e978d18a4c3c703c52f81606d9e8eea30eb6db [/usr/bin/awk]=eff9f2b711eb5bee1b58d4d33b891e8da8f6534655d3854a45bd10217dbb28e6 )
 # 먼저 모든 도구가 확인될 때만 JSON을 구성한다. 미관측 도구 지문은 고정값으로 채우지 않는다.
 local -a values=() canonicals=()
 for path in "${paths[@]}"; do
  p03_copy_capture path "$private"/tool-canonical "$private"/tool-stderr /usr/bin/readlink -f -- "$path" || return 1; canonical=$P03_VALUE
  case "$path:$canonical" in /bin/bash:/bin/bash|/bin/bash:/usr/bin/bash|/usr/bin/awk:/usr/bin/mawk|/usr/bin/awk:/usr/bin/gawk) ;; *) [[ $path == "$canonical" ]] || return 1;; esac
  [[ -f $canonical && ! -L $canonical ]] || return 1
  p03_copy_capture hash "$private"/tool-hash "$private"/tool-stderr /usr/bin/sha256sum -- "$canonical" || return 1; value=$P03_VALUE
  expected=${known[$path]}; [[ -z $expected || $value == "$expected" ]] || return 1
  values+=("$value"); canonicals+=("$canonical")
 done
 p03_copy_observe "$private"/tool-help "$private"/tool-stderr /usr/bin/find --help || return 1
 p03_copy_io_text "$private"/tool-help && p03_copy_scalar_format help "$P03_VALUE" || return 1; local helptext=$P03_VALUE; [[ $helptext == *-print0* ]] || return 1
 local feature token
 for feature in sha256sum sort cmp cp df chmod chown; do
  p03_copy_observe "$private"/tool-help "$private"/tool-stderr "/usr/bin/$feature" --help || return 1
  p03_copy_io_text "$private"/tool-help && p03_copy_scalar_format help "$P03_VALUE" || return 1; helptext=$P03_VALUE
  case $feature in sha256sum) [[ $helptext == *--zero* ]] || return 1;; sort) [[ $helptext == *--zero-terminated* ]] || return 1;; cmp) [[ $helptext == *--silent* ]] || return 1;; cp) [[ $helptext == *--archive* && $helptext == *--preserve* && $helptext == *--one-file-system* ]] || return 1;; df) [[ $helptext == *--output* ]] || return 1;; getfacl) [[ $helptext == *--numeric* && $helptext == *--omit-header* ]] || return 1;; getfattr) [[ $helptext == *--absolute-names* && $helptext == *--dump* ]] || return 1;; esac
 done
 p03_limited_probe_attribute "$private" ACL && p03_limited_probe_attribute "$private" XATTR || return 1
 printf '{"status":"COPY_LIMITED_TOOLS_OBSERVED","complete":true,"tools":['
 local i
 for ((i=0;i<${#paths[@]};i++)); do path=${paths[$i]}; canonical=${canonicals[$i]}; printf '%s{"path":"%s","canonical":"%s","sha256":"%s","regular":true,"symlink":false,"image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f"}' "$comma" "$path" "$canonical" "${values[$i]}"; comma=,; done
 printf '],"features":{"nulFind":true,"nulHash":true,"nulSort":true,"compare":true,"archiveCopy":true,"capacity":true},"acl":{"tool":"/usr/bin/getfacl","status":"%s","reason":"%s"},"xattr":{"tool":"/usr/bin/getfattr","status":"%s","reason":"%s"}}\n' "$P03_LIMITED_ACL_STATE" "$P03_LIMITED_ACL_REASON" "$P03_LIMITED_XATTR_STATE" "$P03_LIMITED_XATTR_REASON"
}
p03_limited_scan(){
 local LC_ALL=C root=$1 prefix=$2 path relative row type device inode uid gid mode size links seconds date rest nanos filehash blocks rootdev acl attr aclcount checkrow
 [[ -d $root && ! -L $root ]] || return 1
 p03_copy_capture uint "$prefix.rootdev" "$prefix.stderr" /usr/bin/stat -c %d -- "$root" || return 1; rootdev=$P03_VALUE
 : >"$prefix.records"; : >"$prefix.metadata"; : >"$prefix.stderr"
 p03_copy_observe "$prefix.paths" "$prefix.stderr" /usr/bin/find "$root" -xdev -print0 || return 1
 P03_COUNT=0; P03_FILES=0; P03_DIRS=0; P03_LOGICAL=0; P03_ALLOCATED=0
 while IFS= read -r -d '' path; do
  [[ ! -L $path ]] || return 1
  p03_copy_capture stat "$prefix.stat" "$prefix.stderr" /usr/bin/stat -c '%d %i %u %g %a %s %h %Y %y %b' -- "$path" || return 1
  row=$P03_VALUE
  read -r device inode uid gid mode size links seconds date rest <<<"$row"
  [[ $device == "$rootdev" && $uid == 999 && $gid == 999 ]] || return 1
  relative=${path#"$root"}; relative=${relative#/}; [[ -n $relative ]] || relative=.
  [[ $path == "$root" || $path == "$root/"* ]] || return 1
  # 선택 metadata는 ACL/xattr 없음이 실제 확인된 경우만 받는다.
  if [[ $P03_LIMITED_ACL_STATE == AVAILABLE ]];then
  p03_copy_observe "$prefix.acl" "$prefix.stderr" /usr/bin/getfacl -cpn -- "$path" || return 1
  aclcount=0
  while IFS= read -r acl; do [[ -z $acl ]] && continue; [[ $acl =~ ^(user|group|other)::[rwx-]{3}$ ]] || return 1; ((aclcount+=1)); done <"$prefix.acl"
  [[ -z $acl && $aclcount == 3 ]] || return 1
   P03_LIMITED_ACL_SELECTED=NONE_VERIFIED
  elif [[ $P03_LIMITED_ACL_STATE == UNAVAILABLE ]];then P03_LIMITED_ACL_SELECTED=UNVERIFIED_TOOL_UNAVAILABLE
  else return 1;fi
  if [[ $P03_LIMITED_XATTR_STATE == AVAILABLE ]];then
  p03_copy_observe "$prefix.xattr" "$prefix.stderr" /usr/bin/getfattr --absolute-names -d -m- -- "$path" || return 1
  [[ ! -s $prefix.xattr ]] || return 1
   P03_LIMITED_XATTR_SELECTED=NONE_VERIFIED
  elif [[ $P03_LIMITED_XATTR_STATE == UNAVAILABLE ]];then P03_LIMITED_XATTR_SELECTED=UNVERIFIED_TOOL_UNAVAILABLE
  else return 1;fi
  nanos=${row#*.}; nanos=${nanos%% *}; [[ $nanos =~ ^[0-9]{9}$ && $seconds =~ ^[0-9]+$ ]] || return 1
  blocks=${row##* }; p03_copy_uint "$blocks" && p03_copy_uint "$size" || return 1
  if [[ -d $path ]]; then type=d; size=0; filehash=-; ((P03_DIRS+=1))
  elif [[ -f $path && $links == 1 ]]; then type=f; ((P03_FILES+=1)); ((P03_LOGICAL+=size)); ((P03_ALLOCATED+=blocks*512)); p03_copy_observe "$prefix.hash" "$prefix.stderr" /usr/bin/sha256sum --zero -- "$path" || return 1
   local hashrecord hashmarker
   IFS= read -r -d '' hashrecord <"$prefix.hash" || return 1
   filehash=${hashrecord:0:64}; hashmarker=${hashrecord:64:2}
   [[ $filehash =~ ^[a-f0-9]{64}$ && ( $hashmarker == '  ' || $hashmarker == ' *' ) && ${hashrecord:66} == "$path" ]] || return 1
   p03_copy_measure "$prefix.hash" && ((P03_BYTES==${#hashrecord}+1)) || return 1
  else return 1; fi
  p03_copy_capture stat "$prefix.restatted" "$prefix.stderr" /usr/bin/stat -c '%d %i %u %g %a %s %h %Y %y %b' -- "$path" || return 1
  [[ ! -L $path && $row == "$P03_VALUE" ]] || return 1
  ((P03_COUNT+=1)); ((P03_COUNT<=100000 && P03_LOGICAL<=268435456 && P03_ALLOCATED<=536870912)) || return 1
  printf '%s %s %s %s %s.%s %s %s %s\0' "$type" "$uid" "$gid" "$mode" "$seconds" "$nanos" "$size" "$filehash" "$relative" >>"$prefix.records" || return 1
  printf '%s %s %s %s %s.%s %s %s\0' "$type" "$uid" "$gid" "$mode" "$seconds" "$nanos" "$size" "$relative" >>"$prefix.metadata" || return 1
 done <"$prefix.paths"
 [[ -z $path ]] && ((P03_COUNT>0)) || return 1
 { while IFS= read -r -d '' checkrow; do printf '%s\0' "$checkrow" || return 1; done <"$prefix.records"; printf 'END %s %s\0' "$P03_COUNT" "$P03_LOGICAL"; } >"$prefix.framed" || return 1
 p03_copy_frames <"$prefix.framed" >"$prefix.validated" || return 1
 LC_ALL=C TMPDIR=/anvil-copy-audit p03_copy_observe "$prefix.sorted" "$prefix.stderr" /usr/bin/sort -z -S 4M --temporary-directory=/anvil-copy-audit -- "$prefix.records" || return 1
 LC_ALL=C TMPDIR=/anvil-copy-audit p03_copy_observe "$prefix.meta-sorted" "$prefix.stderr" /usr/bin/sort -z -S 4M --temporary-directory=/anvil-copy-audit -- "$prefix.metadata" || return 1
 local sum meta
 p03_copy_capture hash "$prefix.sum" "$prefix.stderr" /usr/bin/sha256sum -- "$prefix.sorted" || return 1; sum=$P03_VALUE
 p03_copy_capture hash "$prefix.meta-sum" "$prefix.stderr" /usr/bin/sha256sum -- "$prefix.meta-sorted" || return 1; meta=$P03_VALUE
 [[ ${sum:0:64} =~ ^[a-f0-9]{64}$ && ${meta:0:64} =~ ^[a-f0-9]{64}$ ]] || return 1
 printf '{"entries":%s,"regularEntries":%s,"directoryEntries":%s,"regularLogicalBytes":%s,"manifestSha256":"%s","selectedMetadataSha256":"%s"}' "$P03_COUNT" "$P03_FILES" "$P03_DIRS" "$P03_LOGICAL" "${sum:0:64}" "${meta:0:64}" >"$prefix.summary"
}
p03_limited_runtime(){
 local -a binding=("$@")
 p03_limited_parse "$@" || return 1
 local nonce=${P03_LIMITED_BINDING[--run-instance]} decision=${P03_LIMITED_BINDING[--decision-sha256]} source=/var/lib/postgresql/data target=/anvil-recovery-copy audit=/anvil-copy-audit sourceid entry deadline source_deadline before after copied logical allocated entries needed comparison
 p03_copy_capture_memory uint /usr/bin/id -u && [[ $P03_VALUE == 999 ]] || return 1
 p03_copy_capture_memory uint /usr/bin/id -g && [[ $P03_VALUE == 999 ]] || return 1
 [[ -d $audit && ! -L $audit && -d $target && ! -L $target ]] || return 1
 p03_copy_capture_memory stat /usr/bin/stat -c '%u %g %a' -- "$audit" && [[ $P03_VALUE == '999 999 700' ]] || return 1
 P03_LIMITED_AUDIT_ROOT=$audit
 p03_copy_capture stat "$audit/target-root" "$audit/runtime-stderr" /usr/bin/stat -c '%u %g %a' -- "$target" && [[ $P03_VALUE == '999 999 700' ]] || return 1
 p03_copy_capture stat "$audit/source-id" "$audit/runtime-stderr" /usr/bin/stat -c '%d:%i' -- "$source" || return 1;sourceid=$P03_VALUE
 p03_copy_capture stat "$audit/target-id" "$audit/runtime-stderr" /usr/bin/stat -c '%d:%i' -- "$target" && [[ $sourceid != "$P03_VALUE" ]] || return 1
 p03_limited_now || return 1;entry=$P03_LIMITED_NOW_MS
 # scan 뒤에 새 budget을 만들지 않는다. 외부 helper timeout500/host 최초600초가 별도 상한이다.
 deadline=$((entry+500000));source_deadline=$((deadline-25000))
 P03_LIMITED_EXTERNAL_STOP=false
 trap 'P03_LIMITED_EXTERNAL_STOP=true' TERM INT
 umask 077
 local mi1 mi2 mi3 mi4 mountpoint mountoptions remainder
 while read -r mi1 mi2 mi3 mi4 mountpoint mountoptions remainder;do
  case $mountpoint in "$source/"*|"$target/"*|"$audit/"*)return 1;;esac
  if [[ $mountpoint == "$source" ]];then [[ ,$mountoptions, == *,ro,* ]] || return 1;fi
 done </proc/self/mountinfo
 p03_copy_observe "$audit/target-empty" "$audit/runtime-stderr" /usr/bin/find "$target" -mindepth 1 -printf ENTRY -quit && [[ $P03_BYTES == 0 ]] || return 1
 # 각 helper의 immutable image에서 다시 분류한다. 출력은 보호 tmpfs에 두며 상태는 같은 함수 문맥에서만 받는다.
 p03_copy_observe "$audit/limited-tools.json" "$audit/runtime-stderr" p03_limited_runtime_tools "$audit" || return 1
 [[ $P03_LIMITED_EXTERNAL_STOP == false ]] || return 1
 p03_limited_space_observe || return 1
 p03_limited_scan "$source" "$audit/before" || return 1
 logical=$P03_LOGICAL;allocated=$P03_ALLOCATED;entries=$P03_COUNT
 p03_copy_uint "$logical" && p03_copy_uint "$allocated" && p03_copy_uint "$entries" || return 1
 needed=$(((logical>allocated?logical:allocated)+33554432))
 [[ $P03_LIMITED_EXTERNAL_STOP == false ]] || return 1
 # 이 함수 안의 runtime cp_start가 원 cp를 실제로 한 번 시작한다. 감시는 report 검사가 아니다.
 p03_limited_copy_supervise --scope P03_PROTECTED_COPY_LIMITED_RISK_R1 --source-deadline-ms "$source_deadline" --deadline-ms "$deadline" --reserve-bytes 134217728 --min-inodes "$((entries+100))" --expected-needed-bytes "$needed" --source-logical-bytes "$logical" --source-allocated-bytes "$allocated" --source-entry-count "$entries" --max-observation-ms 10000 || return 1
 [[ $P03_LIMITED_EXTERNAL_STOP == false && $P03_LIMITED_CP_REAPED == true && $P03_LIMITED_CP_CLOSED == true && $P03_LIMITED_CP_EXIT == 0 && $P03_LIMITED_VIOLATION_LATCHED == false && $P03_LIMITED_TIMER_DISPOSED == true && $P03_LIMITED_PIPE_CLOSED == true ]] || return 1
 # 원 cp의 실제 stdout/stderr와 wait 결과를 확인한 뒤에만 후속 scan/성공 수집을 한다.
 p03_copy_measure "$audit/cp.stderr" && [[ $P03_BYTES == 0 ]] || return 1
 p03_copy_measure "$audit/cp.stdout" && [[ $P03_BYTES == 0 ]] || return 1
 p03_limited_scan "$source" "$audit/after" && p03_limited_scan "$target" "$audit/copied" || return 1
 for comparison in after copied;do
  p03_copy_observe "$audit/cmp.stdout" "$audit/cmp.stderr" /usr/bin/cmp -s -- "$audit/before.sorted" "$audit/$comparison.sorted" && [[ $P03_BYTES == 0 ]] || return 1
  p03_copy_observe "$audit/cmp.stdout" "$audit/cmp.stderr" /usr/bin/cmp -s -- "$audit/before.meta-sorted" "$audit/$comparison.meta-sorted" && [[ $P03_BYTES == 0 ]] || return 1
 done
 p03_limited_now && ((P03_LIMITED_NOW_MS<deadline)) && [[ $P03_LIMITED_EXTERNAL_STOP == false ]] || return 1
 before=$(<"$audit/before.summary");after=$(<"$audit/after.summary");copied=$(<"$audit/copied.summary")
 # fullID는 helper가 스스로 관측했다고 꾸미지 않는다. null은 host의 원 fullID 재검사 문맥에서만 결합한다.
 printf '{"status":"COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY","complete":true,"scope":"P03_PROTECTED_COPY_LIMITED_RISK_R1","policy":"P03_COPY_LIMITED_RISK_POLICY_R1_20261028","sourceIdentity":{"name":"anvil-v3-development-pgdata","instance":"dc22a0629e79f259dcd935845e88e58e","createdAt":"2026-10-16T03:53:33+09:00"},"copyIdentity":{"name":"anvil-v3-pgdata-recovery-20261027-r1","instance":"%s"},"sourceBefore":%s,"sourceAfter":%s,"copy":%s,"sourceConsumersBefore":[],"sourceConsumersAfter":[],"selectedMetadata":{"fields":["BYTES","RAW_PATH","TYPE","UID","GID","MODE","MTIME_NANOSECONDS","REGULAR_LENGTH"],"matches":true,"acl":"%s","xattr":"%s"},"acceptedUncertainty":{"candidateSha256":"ffc3f2a2979a7845c48b61946a32f0b142c698ed7c6e8004d3038bad777670d3","runInstance":"%s","sourceInstance":"dc22a0629e79f259dcd935845e88e58e","copyInstance":"%s","decisionSha256":"%s","writer":"NOT_PROVEN","quota":"NOT_ENFORCED","numericOwner1001":"ACCEPTED_FOR_THIS_RUN"},"capacity":{"sourceObservedAllocatedBytes":%s,"expectedNeededBytes":%s,"availableBytes":%s,"availableInodes":%s,"reserveThresholdBytes":134217728,"allocationGuardBytes":536870912,"observationIntervalMaxMs":%s},"monitor":{"status":"COMPLETED","cpPid":%s,"cpParentPid":%s,"cpStartIdentity":"%s","containerId":null,"violationLatched":false,"termCount":0,"reaped":true,"timerDisposed":true,"pipeClosed":true},"writerFullyControlled":false,"hardQuotaVerified":false,"pointInTimeConsistencyProven":false,"postgresStarted":false}\n' "$nonce" "$before" "$after" "$copied" "$P03_LIMITED_ACL_SELECTED" "$P03_LIMITED_XATTR_SELECTED" "$nonce" "$nonce" "$decision" "$allocated" "$needed" "$P03_LIMITED_START_AVAILABLE_BYTES" "$P03_LIMITED_START_AVAILABLE_INODES" "$P03_LIMITED_MAX_OBSERVATION_GAP_MS" "$P03_LIMITED_CP_PID" "$P03_LIMITED_CP_PARENT_PID" "$P03_LIMITED_CP_START_IDENTITY"
}
if [[ -n ${BASH_SOURCE[0]-} && ${BASH_SOURCE[0]} != "$0" ]] || (($# == 0));then
 printf 'PREPARATION_ONLY\n'
else
 set -o pipefail
 umask 077
 mode=$1;shift
 case $mode in
  --preflight-p03-copy-limited-risk-r1|--init-p03-copy-limited-risk-r1|--copy-p03-copy-limited-risk-r1)
   p03_limited_parse "$@" || { p03_copy_fail LIMITED_COPY_BINDING_UNVERIFIED;exit 1; }
   case $mode in
    --preflight-p03-copy-limited-risk-r1)p03_limited_runtime_tools || { p03_copy_fail LIMITED_COPY_TOOLS_UNVERIFIED;exit 1; };;
    --init-p03-copy-limited-risk-r1)p03_copy_init || { p03_copy_fail LIMITED_COPY_INIT_UNVERIFIED;exit 1; };;
    --copy-p03-copy-limited-risk-r1)p03_limited_runtime "$@" || { p03_copy_fail LIMITED_COPY_UNVERIFIED;exit 1; };;
   esac;;
  *)
 p03_copy_parse "$@" && [[ ${#P03_COPY[@]} == 11 ]] || { p03_copy_fail COPY_BINDING_UNVERIFIED; exit 1; }
 case $mode in
  --preflight-p03-copy-r1) p03_copy_runtime_tools || { p03_copy_fail COPY_TOOLS_UNVERIFIED; exit 1; };;
  --init-p03-copy-r1) p03_copy_init || { p03_copy_fail COPY_INIT_UNVERIFIED; exit 1; };;
  --copy-p03-copy-r1) p03_copy_runtime "$@" || { p03_copy_fail COPY_UNVERIFIED; exit 1; };;
  *) p03_copy_fail COPY_MODE_REJECTED; exit 1;;
 esac
   ;;
 esac
fi
