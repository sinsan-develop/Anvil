using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

// 신뢰 등록용 고정 연산만 제공한다. 개인키/credential 평문 반환·명령 실행 API는 없다.
internal static class ProtectedStore {
 static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 65536, RecursionLimit = 8 };
 static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
 static readonly byte[] SpkiPrefix = Hex("3059301306072A8648CE3D020106082A8648CE3D03010703420004");
 static string Root;
 static int Main(string[] args) {
  try {
   if(args.Length!=1)throw new Exception();Root=Path.GetFullPath(args[0]);CheckPath(Root,true);
   char[] chars=new char[65537];int count=0,n;
   while(count<chars.Length&&(n=Console.In.Read(chars,count,chars.Length-count))>0)count+=n;
   if(count>65536)throw new Exception();
   var request=Json.Deserialize<Dictionary<string,object>>(new string(chars,0,count));Array.Clear(chars,0,chars.Length);
   var result=Run(request);Console.Out.Write(Json.Serialize(new {ok=true,data=result}));return 0;
  }catch{Console.Out.Write("{\"ok\":false,\"error\":\"PROTECTED_STORE_FAILED\"}");return 1;}
 }
 static object Run(Dictionary<string,object> r) {
  string op=Text(r,"operation");
  if(op=="CREATE_KEY") {
   Exact(r,"operation,keyId");string id=Id(r,"keyId");
   using(var key=CngKey.Create(CngAlgorithm.ECDsaP256,null,new CngKeyCreationParameters {Provider=CngProvider.MicrosoftSoftwareKeyStorageProvider,ExportPolicy=CngExportPolicies.AllowPlaintextExport,KeyUsage=CngKeyUsages.Signing})) {
    byte[] secret=key.Export(CngKeyBlobFormat.EccPrivateBlob);
    try{Save(id,"key",secret);return Public(key,id);}finally{Array.Clear(secret,0,secret.Length);}
   }
  }
  if(op=="PUBLIC_KEY"||op=="SIGN_PROOF") {
   Exact(r,op=="PUBLIC_KEY"?"operation,keyId":"operation,keyId,payload");string id=Id(r,"keyId");byte[] secret=Load(id,"key");
   try{using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob)) {
    if(op=="PUBLIC_KEY")return Public(key,id);
    var payload=Payload(r);if(Text(payload,"publicKeyFingerprint")!=Hash(Spki(key)))throw new Exception();
    using(var signer=new ECDsaCng(key)){byte[] signature=signer.SignHash(Digest(Canonical(payload)));if(signature.Length!=64)throw new Exception();return new {signature=B64(signature)};}
   }}finally{Array.Clear(secret,0,secret.Length);}
  }
  if(op=="VERIFY_PROOF") {
   Exact(r,"operation,publicKeySpki,signature,payload");byte[] spki=Unbase(Text(r,"publicKeySpki"),91),signature=Unbase(Text(r,"signature"),64);var payload=Payload(r);
   if(!spki.Take(SpkiPrefix.Length).SequenceEqual(SpkiPrefix)||Hash(spki)!=Text(payload,"publicKeyFingerprint"))return new {valid=false};
   byte[] blob=new byte[72];Buffer.BlockCopy(Hex("4543533120000000"),0,blob,0,8);Buffer.BlockCopy(spki,SpkiPrefix.Length,blob,8,64);
   using(var key=CngKey.Import(blob,CngKeyBlobFormat.EccPublicBlob))using(var verifier=new ECDsaCng(key))return new {valid=verifier.VerifyHash(Digest(Canonical(payload)),signature)};
  }
  if(op=="STORE_CREDENTIAL") {
   Exact(r,"operation,credentialId,token");string id=Id(r,"credentialId"),token=Text(r,"token");if(!Regex.IsMatch(token,@"\Aav3ct1_[A-Za-z0-9_-]{43}\z",RegexOptions.CultureInvariant))throw new Exception();Unbase(token.Substring(7),32);
   byte[] bytes=Utf8.GetBytes(token);try{Save(id,"credential",bytes);return new {credentialId=id,digest=Hash(bytes)};}finally{Array.Clear(bytes,0,bytes.Length);}
  }
  if(op=="CREDENTIAL_MATCHES") {
   Exact(r,"operation,credentialId,digest");string id=Id(r,"credentialId"),expected=Text(r,"digest");RequireHash(expected);byte[] bytes=Load(id,"credential");
   try{byte[] a=Utf8.GetBytes(Hash(bytes)),b=Utf8.GetBytes(expected);int difference=0;for(int i=0;i<a.Length;i++)difference|=a[i]^b[i];return new {matches=difference==0};}finally{Array.Clear(bytes,0,bytes.Length);}
  }
  throw new Exception();
 }
 static Dictionary<string,object> Payload(Dictionary<string,object> r) {
  object value;if(!r.TryGetValue("payload",out value))throw new Exception();var p=value as Dictionary<string,object>;if(p==null)throw new Exception();
  Exact(p,"protocolVersion,installationId,registrationId,scopeDigest,publicKeyFingerprint,serverNonce,clientNonce,expiresAt");
  if(!(p["protocolVersion"] is int)||(int)p["protocolVersion"]!=1)throw new Exception();Id(p,"installationId");Id(p,"registrationId");RequireHash(Text(p,"scopeDigest"));RequireHash(Text(p,"publicKeyFingerprint"));Unbase(Text(p,"serverNonce"),32);Unbase(Text(p,"clientNonce"),32);
  string expires=Text(p,"expiresAt");DateTime parsed;if(!DateTime.TryParseExact(expires,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out parsed))throw new Exception();return p;
 }
 static byte[] Canonical(Dictionary<string,object> p) {
  // 허용 필드는 ASCII UUID/hash/base64url/ISO 시각뿐이므로 양쪽 JSON escaping이 동일하다.
  return Utf8.GetBytes("{"+String.Join(",",p.Keys.OrderBy(x=>x,StringComparer.Ordinal).Select(k=>Json.Serialize(k)+":"+Json.Serialize(p[k])))+"}");
 }
 static object Public(CngKey key,string id){byte[] bytes=Spki(key);return new {keyId=id,publicKeySpki=B64(bytes),fingerprint=Hash(bytes)};}
 static byte[] Spki(CngKey key) {
  byte[] blob=key.Export(CngKeyBlobFormat.EccPublicBlob);if(blob.Length!=72||!blob.Take(8).SequenceEqual(Hex("4543533120000000")))throw new Exception();byte[] bytes=new byte[91];Buffer.BlockCopy(SpkiPrefix,0,bytes,0,SpkiPrefix.Length);Buffer.BlockCopy(blob,8,bytes,SpkiPrefix.Length,64);return bytes;
 }
 static byte[] Entropy(string id,string kind){return Utf8.GetBytes("ANVIL-V3:"+(kind=="key"?"HOST-KEY:":"CREDENTIAL:")+id);}
 static void Save(string id,string kind,byte[] bytes) {
  string path=Path.Combine(Root,id+"."+kind);CheckPath(Root,true);byte[] encrypted=ProtectedData.Protect(bytes,Entropy(id,kind),DataProtectionScope.CurrentUser);
  using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){file.Write(encrypted,0,encrypted.Length);file.Flush(true);}
 }
 static byte[] Load(string id,string kind) {
  string path=Path.Combine(Root,id+"."+kind);CheckPath(path,false);byte[] encrypted;
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.None)){if(file.Length<1||file.Length>8192)throw new Exception();encrypted=new byte[(int)file.Length];int offset=0,n;while(offset<encrypted.Length&&(n=file.Read(encrypted,offset,encrypted.Length-offset))>0)offset+=n;if(offset!=encrypted.Length)throw new Exception();}
  return ProtectedData.Unprotect(encrypted,Entropy(id,kind),DataProtectionScope.CurrentUser);
 }
 static void CheckPath(string path,bool directory) {
  string current=path;while(current!=null){var attributes=File.GetAttributes(current);if((attributes&FileAttributes.ReparsePoint)!=0)throw new Exception();if(current==path&&((attributes&FileAttributes.Directory)!=0)!=directory)throw new Exception();current=Path.GetDirectoryName(current);}
 }
 static void Exact(Dictionary<string,object> value,string keys){if(value==null||!value.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(keys.Split(',').OrderBy(k=>k,StringComparer.Ordinal)))throw new Exception();}
 static string Text(Dictionary<string,object> value,string key){object data;if(!value.TryGetValue(key,out data)||!(data is string))throw new Exception();return (string)data;}
 static string Id(Dictionary<string,object> value,string key){string id=Text(value,key);if(!Regex.IsMatch(id,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z",RegexOptions.CultureInvariant))throw new Exception();return id;}
 static void RequireHash(string value){if(!Regex.IsMatch(value,@"\A[0-9a-f]{64}\z",RegexOptions.CultureInvariant))throw new Exception();}
 static byte[] Digest(byte[] bytes){using(var sha=SHA256.Create())return sha.ComputeHash(bytes);}
 static string Hash(byte[] bytes){return BitConverter.ToString(Digest(bytes)).Replace("-","").ToLowerInvariant();}
 static string B64(byte[] bytes){return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');}
 static byte[] Unbase(string text,int length){if(text.Length>4096||!Regex.IsMatch(text,@"\A[A-Za-z0-9_-]+\z",RegexOptions.CultureInvariant))throw new Exception();string standard=text.Replace('-','+').Replace('_','/');byte[] bytes=Convert.FromBase64String(standard.PadRight((standard.Length+3)/4*4,'='));if(bytes.Length!=length||B64(bytes)!=text)throw new Exception();return bytes;}
 static byte[] Hex(string value){return Enumerable.Range(0,value.Length/2).Select(i=>Byte.Parse(value.Substring(i*2,2),NumberStyles.HexNumber,CultureInfo.InvariantCulture)).ToArray();}
}
