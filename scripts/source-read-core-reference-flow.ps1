# 기존 형식/기한 검사만 재사용한다. 과거 policy/run의 실행 권한은 수용하지 않는다.
function Read-A3CoreReferenceBinding([hashtable]$Value,[datetimeoffset]$Now){
 if(!$Value -or $Value.decisionId -cne 'A3_CORE_REFERENCE_COMPILE_01' -or $Value.runId -cne 'a3-core-reference-compile-01'){throw 'A3_BINDING_INVALID'}
 $copy=@{};foreach($entry in $Value.GetEnumerator()){$copy[$entry.Key]=$entry.Value}
 $copy.decisionId='A3_ABSOLUTE_SOURCE_COMPILE_01';$copy.runId='a3-absolute-source-compile-01'
 $binding=Read-A3AbsoluteBinding $copy $Now
 $binding.decisionId='A3_CORE_REFERENCE_COMPILE_01';$binding.runId='a3-core-reference-compile-01'
 return $binding
}
