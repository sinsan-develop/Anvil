param([Parameter(Mandatory=$true)][string]$DataRoot)
$ErrorActionPreference = 'Stop'
$expected = [IO.Path]::GetFullPath('D:\Project\Anvil\.av3-data')
if ([IO.Path]::GetFullPath($DataRoot) -ne $expected -or (Test-Path -LiteralPath $DataRoot)) { throw 'HTTPS_TARGET_NOT_NEW' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$directory = New-Item -ItemType Directory -Path $DataRoot
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true,$false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
Set-Acl -LiteralPath $directory.FullName -AclObject $acl
$tls = New-Item -ItemType Directory -Path (Join-Path $DataRoot 'dev-tls')
$now = [DateTimeOffset]::UtcNow
$expires = $now.AddDays(7)
$caKey = [Security.Cryptography.RSA]::Create(3072)
$leafKey = [Security.Cryptography.RSA]::Create(2048)
$hash = [Security.Cryptography.HashAlgorithmName]::SHA256
$padding = [Security.Cryptography.RSASignaturePadding]::Pkcs1
$caRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Anvil v3 Development CA',$caKey,$hash,$padding)
$caRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$true,0,$true))
$caRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,$true))
$ca = $caRequest.CreateSelfSigned($now.AddMinutes(-1),$expires)
$leafRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Anvil v3 Development',$leafKey,$hash,$padding)
$leafRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
$leafRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,$true))
$usage = [Security.Cryptography.OidCollection]::new()
[void]$usage.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
$leafRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($usage,$true))
$san = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName('localhost')
$san.AddIpAddress([Net.IPAddress]::Parse('127.0.0.1'))
$san.AddIpAddress([Net.IPAddress]::Parse('172.27.253.53'))
$leafRequest.CertificateExtensions.Add($san.Build())
$serial = [Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
$leaf = $leafRequest.Create($ca,$now,$expires.AddSeconds(-1),$serial)
[IO.File]::WriteAllText((Join-Path $tls.FullName 'ca.cert.pem'),$ca.ExportCertificatePem())
[IO.File]::WriteAllBytes((Join-Path $tls.FullName 'ca.cer'),$ca.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
[IO.File]::WriteAllText((Join-Path $tls.FullName 'ca.key.pem'),$caKey.ExportPkcs8PrivateKeyPem())
[IO.File]::WriteAllText((Join-Path $tls.FullName 'server.cert.pem'),$leaf.ExportCertificatePem())
[IO.File]::WriteAllText((Join-Path $tls.FullName 'server.key.pem'),$leafKey.ExportPkcs8PrivateKeyPem())
$store = [Security.Cryptography.X509Certificates.X509Store]::new('Root','CurrentUser')
$store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
try {
  if ($store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$ca.Thumbprint,$false).Count) { throw 'ROOT_ALREADY_PRESENT' }
  $store.Add([Security.Cryptography.X509Certificates.X509Certificate2]::new($ca.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert)))
  if ($store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$ca.Thumbprint,$false).Count -ne 1) { throw 'ROOT_TRUST_NOT_VERIFIED' }
} finally { $store.Close() }
$receipt = [ordered]@{ kind='ANVIL_V3_DEV_HTTPS'; subject=$ca.Subject; thumbprint=$ca.Thumbprint; leafThumbprint=$leaf.Thumbprint; notAfter=$expires.ToString('o'); san=@('localhost','127.0.0.1','172.27.253.53'); store='CurrentUser/Root'; keyOwnerSid=$sid.Value; keyAccess='current-user-and-SYSTEM-only'; revoke='개발 HTTPS 검증 종료 또는 만료 때 정확 thumbprint만 회수' }
[IO.File]::WriteAllText((Join-Path $tls.FullName 'receipt.json'),($receipt|ConvertTo-Json -Depth 3))
$receipt|ConvertTo-Json -Depth 3
$caKey.Dispose()
$leafKey.Dispose()
