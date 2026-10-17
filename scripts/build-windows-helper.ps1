param([Parameter(Mandatory=$true)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$approvedRoot='D:\tmp\anvil-v3-fn06-registration-qa'
if ([IO.Path]::GetFullPath($OutputRoot) -cne $approvedRoot) { throw 'APPROVED_QA_ROOT_REQUIRED' }
$rootItem=Get-Item -LiteralPath $approvedRoot
if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'QA_ROOT_LINK_DENIED' }
$binPath=Join-Path $approvedRoot 'bin'
$binItem=Get-Item -LiteralPath $binPath
if ($binItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'QA_BIN_LINK_DENIED' }
$executable=Join-Path $binPath 'AnvilProtectedStore.exe'
if (Test-Path -LiteralPath $executable) { throw 'HELPER_OVERWRITE_DENIED' }
$source=Join-Path $PSScriptRoot '..\apps\connector\native\ProtectedStore.cs'
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /optimize+ /platform:x64 /reference:System.Core.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll "/out:$executable" $source
if ($LASTEXITCODE -ne 0) { throw 'HELPER_BUILD_FAILED' }
Get-FileHash -Algorithm SHA256 -LiteralPath $executable | Select-Object Path,Hash
