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

if [[ -n ${BASH_SOURCE[0]-} && ${BASH_SOURCE[0]} != "$0" ]] || (($# == 0)); then
 printf 'PREPARATION_ONLY\n'
else
 # 실제 모드의 진입은 닫힌 carrier만 허용한다. local 시험은 source/library/gate만 사용한다.
 set -o pipefail
 umask 077
 mode=$1; shift
 p03_copy_parse "$@" && [[ ${#P03_COPY[@]} == 11 ]] || { p03_copy_fail COPY_BINDING_UNVERIFIED; exit 1; }
 case $mode in
  --preflight-p03-copy-r1) p03_copy_runtime_tools || { p03_copy_fail COPY_TOOLS_UNVERIFIED; exit 1; };;
  --init-p03-copy-r1) p03_copy_init || { p03_copy_fail COPY_INIT_UNVERIFIED; exit 1; };;
  --copy-p03-copy-r1) p03_copy_runtime "$@" || { p03_copy_fail COPY_UNVERIFIED; exit 1; };;
  *) p03_copy_fail COPY_MODE_REJECTED; exit 1;;
 esac
fi
