$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../../../scripts/ui11-runtime-flow.ps1')
if(!(Get-Command Set-Ui11AtomicIndex -ErrorAction SilentlyContinue)){throw 'UI11_ATOMIC_NOT_IMPLEMENTED'}
$target='D:\tmp\anvil-v3-stage-b\ui11-atomic-fixture-01'
if(Test-Path -LiteralPath $target){throw 'UI11_ATOMIC_FIXTURE_ALREADY_EXISTS'}
foreach($p in @('D:\tmp','D:\tmp\anvil-v3-stage-b')){if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'UI11_FIXTURE_PARENT_LINK'}}
$null=New-Item -ItemType Directory -Path $target
$files=@('index.html','staged.html','original.html','failed.html')
try{
 $index=Join-Path $target 'index.html';$stage=Join-Path $target 'staged.html';$backup=Join-Path $target 'original.html';$failed=Join-Path $target 'failed.html'
 [IO.File]::WriteAllText($index,'old');[IO.File]::WriteAllText($stage,'new')
 $old=(Get-FileHash -Algorithm SHA256 -LiteralPath $index).Hash;$next=(Get-FileHash -Algorithm SHA256 -LiteralPath $stage).Hash
 Set-Ui11AtomicIndex $stage $index $backup $next $old
 if((Get-FileHash -Algorithm SHA256 -LiteralPath $index).Hash -ne $next -or (Get-FileHash -Algorithm SHA256 -LiteralPath $backup).Hash -ne $old){throw 'UI11_ATOMIC_PUBLISH_ASSERT'}
 [IO.File]::Copy($backup,$stage,$false)
 Set-Ui11AtomicIndex $stage $index $failed $old $next
 if((Get-FileHash -Algorithm SHA256 -LiteralPath $index).Hash -ne $old -or (Get-FileHash -Algorithm SHA256 -LiteralPath $failed).Hash -ne $next){throw 'UI11_ATOMIC_ROLLBACK_ASSERT'}
 [IO.File]::WriteAllText($stage,'wrong')
 $caught=$false;try{Set-Ui11AtomicIndex $stage $index (Join-Path $target 'must-not-exist.html') $next $old}catch{$caught=$_.Exception.Message -eq 'UI11_ATOMIC_HASH_MISMATCH'}
 if(!$caught -or (Get-FileHash -Algorithm SHA256 -LiteralPath $index).Hash -ne $old -or (Test-Path -LiteralPath (Join-Path $target 'must-not-exist.html'))){throw 'UI11_ATOMIC_NEGATIVE_ASSERT'}
 @{status='PASS';cases=3;actualServiceChanges=0}|ConvertTo-Json -Compress
}finally{
 $all=@(Get-ChildItem -LiteralPath $target -Force)
 if(@($all|Where-Object {$_.PSIsContainer -or ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $_.Name -notin $files}).Count){throw 'UI11_FIXTURE_CLEANUP_SCOPE_DRIFT'}
 foreach($file in $all){if((Get-Acl -LiteralPath $file.FullName).Owner -ne [Security.Principal.WindowsIdentity]::GetCurrent().Name){throw 'UI11_FIXTURE_OWNER_DRIFT'}}
 foreach($file in $all){Remove-Item -LiteralPath $file.FullName -ErrorAction Stop}
 Remove-Item -LiteralPath $target -ErrorAction Stop
}
