param([Parameter(Mandatory=$true)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$approvedRoots=@('D:\tmp\anvil-v3-fn06-registration-qa','D:\tmp\anvil-v3-fn06-https-qa-r1','D:\tmp\anvil-v3-fn08-ownership-qa-r2')
if ([IO.Path]::GetFullPath($OutputRoot) -cnotin $approvedRoots) { throw 'APPROVED_QA_ROOT_REQUIRED' }
$approvedRoot=$OutputRoot
$rootItem=Get-Item -LiteralPath $approvedRoot
if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'QA_ROOT_LINK_DENIED' }
$binPath=Join-Path $approvedRoot 'bin'
$binItem=Get-Item -LiteralPath $binPath
if ($binItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'QA_BIN_LINK_DENIED' }
if ($approvedRoot -ceq 'D:\tmp\anvil-v3-fn08-ownership-qa-r2') {
  $compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  $sources=@{'AnvilOwnershipHost.exe'='..\apps\connector\native\OwnershipHost.cs';'OwnedWorker.exe'='..\tests\fixtures\FN08\OwnedWorker.cs'}
  foreach($name in $sources.Keys){
    $target=Join-Path $binPath $name
    if(Test-Path -LiteralPath $target){throw 'HELPER_OVERWRITE_DENIED'}
    $source=Join-Path $PSScriptRoot $sources[$name]
    & $compiler /nologo /target:exe /optimize+ /platform:x64 /reference:System.Core.dll /reference:System.Web.Extensions.dll "/out:$target" $source
    if($LASTEXITCODE -ne 0){throw 'OWNERSHIP_HELPER_BUILD_FAILED'}
    Get-FileHash -Algorithm SHA256 -LiteralPath $target | Select-Object Path,Hash
  }
  exit 0
}
$executable=Join-Path $binPath 'AnvilProtectedStore.exe'
if (Test-Path -LiteralPath $executable) { throw 'HELPER_OVERWRITE_DENIED' }
$source=Join-Path $PSScriptRoot '..\apps\connector\native\ProtectedStore.cs'
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /optimize+ /platform:x64 /reference:System.Core.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll "/out:$executable" $source
if ($LASTEXITCODE -ne 0) { throw 'HELPER_BUILD_FAILED' }
Get-FileHash -Algorithm SHA256 -LiteralPath $executable | Select-Object Path,Hash
