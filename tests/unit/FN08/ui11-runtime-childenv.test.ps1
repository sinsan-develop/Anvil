$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../../../scripts/ui11-runtime-flow.ps1')
$root='D:\tmp\anvil-v3-stage-b\ui11-childenv-fixture-01'
if(Test-Path -LiteralPath $root){throw 'UI11_CHILDENV_FIXTURE_EXISTS'}
foreach($path in @('D:\tmp','D:\tmp\anvil-v3-stage-b')){if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'UI11_CHILDENV_PARENT_LINK'}}
$oldArtifact=$env:ANVIL_ARTIFACT_ROOT;$oldCanary=$env:ANVIL_TEST_DROP_CANARY
$child=$null
$null=New-Item -ItemType Directory -Path $root
try{
 $env:ANVIL_ARTIFACT_ROOT='LOCAL_TEST_DROP';$env:ANVIL_TEST_DROP_CANARY='LOCAL_TEST_DROP'
 $entry=Join-Path $root 'entry.mjs';$out=Join-Path $root 'child.out.log';$err=Join-Path $root 'child.err.log'
 [IO.File]::WriteAllText($entry,'console.log(JSON.stringify({artifact:process.env.ANVIL_ARTIFACT_ROOT??null,canary:process.env.ANVIL_TEST_DROP_CANARY??null,host:process.env.ANVIL_HOST,port:process.env.ANVIL_PORT,referenceOnly:process.env.ANVIL_DB_CONFIG.endsWith("never-read\\db-app.json")}));')
 $childEnv=Get-Ui11ChildEnvironment ([Environment]::GetEnvironmentVariables()) (Join-Path $root 'never-read')
 $line=Get-Ui11NodeArgumentLine '22222222-2222-4222-8222-222222222222' 'new' $entry
 $child=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList $line -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err -Environment $childEnv
 if(!$child.WaitForExit(10000)){$child.Kill();$null=$child.WaitForExit(3000);throw 'UI11_CHILDENV_CHILD_TIMEOUT'}
 if($child.ExitCode -ne 0 -or (Get-Item -LiteralPath $err).Length -ne 0){throw 'UI11_CHILDENV_CHILD_FAILED'}
 $v=Get-Content -Raw -LiteralPath $out|ConvertFrom-Json
 if($null -ne $v.artifact -or $null -ne $v.canary -or $v.host -ne '127.0.0.1' -or $v.port -ne '3830' -or !$v.referenceOnly){throw 'UI11_CHILDENV_LEAK'}
 @{status='PASS';actualNodeFixture=1;serviceChanges=0;secretReads=0;databaseConnections=0}|ConvertTo-Json -Compress
}finally{
 $env:ANVIL_ARTIFACT_ROOT=$oldArtifact;$env:ANVIL_TEST_DROP_CANARY=$oldCanary
 if($child -and !$child.HasExited){throw 'UI11_CHILDENV_PROCESS_PRESERVE'}
 $items=@(Get-ChildItem -LiteralPath $root -Force)
 foreach($item in $items){if($item.PSIsContainer -or $item.Name -notin @('entry.mjs','child.out.log','child.err.log') -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-Acl -LiteralPath $item.FullName).Owner -ne [Security.Principal.WindowsIdentity]::GetCurrent().Name){throw 'UI11_CHILDENV_CLEANUP_SCOPE_INVALID'}}
 foreach($item in $items){Remove-Item -LiteralPath $item.FullName -ErrorAction Stop}
 Remove-Item -LiteralPath $root -ErrorAction Stop
}
