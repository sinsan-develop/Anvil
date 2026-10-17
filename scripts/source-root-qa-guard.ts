// Docker --tmpfs는 Mounts 배열이 아니라 HostConfig.Tmpfs에 기록된다.
export function assertSourceRootQaTmpfs(item:any,imageId:string,actualMounts:string){
 const path='/var/lib/postgresql/data',tmpfs=item?.HostConfig?.Tmpfs;
 if(item?.Image!==imageId||!Array.isArray(item.Mounts)||item.Mounts.length||!tmpfs||Object.keys(tmpfs).length!==1||tmpfs[path]!=='rw,noexec,nosuid,size=268435456')throw Error('QA_MOUNT_OR_IMAGE_INVALID');
 const entries=actualMounts.split('\n').map(line=>line.split(' ')).filter(parts=>parts[1]===path);
 if(entries.length!==1||entries[0]![0]!=='tmpfs'||entries[0]![2]!=='tmpfs'||!['rw','noexec','nosuid'].every(flag=>entries[0]![3]?.split(',').includes(flag)))throw Error('QA_ACTUAL_TMPFS_INVALID');
}
export function sourceRootQaOutcome(primaryFailure:string|null,cleanupFailure:string|null){
 return{status:primaryFailure||cleanupFailure?'FAIL':'PASS',failure:primaryFailure,cleanupFailure,cleanup:cleanupFailure?'UNVERIFIED':'OWN_CONTAINER_NETWORK_ABSENT'};
}
export function sourceRootQaError(error:unknown){
 const e=error as {message?:unknown;code?:unknown;position?:unknown}|null;
 return{failure:typeof e?.message==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(e.message)?e.message:'QA_STEP_FAILED',pgCode:typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:null,sqlPosition:typeof e?.position==='string'&&/^\d+$/.test(e.position)?e.position:null};
}
