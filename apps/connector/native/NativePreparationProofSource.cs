using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

// 비활성 source primitive다. Main/Run/Load/build 연결·키 발급·저장·사용 인가가 없다.
// caller/root/peer 보호와 원 키 mapping은 별도 미구현 공급자다. 실제 CNG parity는 미검증이다.
internal static class NativePreparationProofSource {
 static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
 static readonly byte[] SpkiPrefix = Hex("3059301306072A8648CE3D020106082A8648CE3D03010703420004");
 static Exception Invalid() { return new InvalidOperationException("NATIVE_PROOF_SIGNER_UNAVAILABLE"); }
 // 기존 키의 소유권은 호출자에게 있다. 원 remaining 이외의 새 10초 예산을 만들지 않는다.
 internal static string Sign(byte[] frame, CngKey existingKey) {
  byte[] copy = null, domain = null, digest = null, signature = null;
  var elapsed = Stopwatch.StartNew(); DateTime start = DateTime.UtcNow, last = start;
  try {
   if(frame == null || frame.Length == 0 || frame.Length > 65536 || existingKey == null) throw Invalid();
   copy = (byte[])frame.Clone(); string raw = Utf8.GetString(copy);
   var json = new JavaScriptSerializer { MaxJsonLength = 65536, RecursionLimit = 16 };
   var r = json.Deserialize<Dictionary<string, object>>(raw);
   // 재직렬화의 정확 일치는 중복 키/비정규 escape·숫자/공백도 거절한다.
   if(Canonical(r, 0) != raw) throw Invalid();
   Exact(r, "operation,keyId,authority,challenge,request,remainingMs,callExpiresAt");
   if(Text(r,"operation") != "SIGN_NATIVE_PREPARATION_PROOF") throw Invalid();
   string keyId = Id(r,"keyId"); long remaining = Positive(r["remainingMs"]);
   if(remaining > 10000) throw Invalid(); DateTime callExpiresAt = Time(r,"callExpiresAt");
   var authority = Map(r["authority"]); Exact(authority,"ref,snapshot");
   var authorityRef = Ref(authority["ref"],true); var a = Map(authority["snapshot"]);
   Exact(a,"schemaVersion,purpose,authorityId,credentialId,credentialGeneration,scope,subject,parent,policyRef,channelProfileRef,allowedOperations,issuedAt,expiresAt,codingAgentExecutionAuthorized,agentDispatchPerformed");
   One(a["schemaVersion"]); if(Text(a,"purpose") != "NATIVE_PREPARATION_AUTHORITY") throw Invalid();
   if(Id(a,"authorityId") != Text(authorityRef,"id") || Hash(Utf8.GetBytes(Canonical(a,0))) != Text(authorityRef,"contentHash")) throw Invalid();
   Id(a,"credentialId"); long generation = Positive(a["credentialGeneration"]); False(a["codingAgentExecutionAuthorized"]); False(a["agentDispatchPerformed"]);
   Ref(a["policyRef"],false); Ref(a["channelProfileRef"],false);
   if(Canonical(a["allowedOperations"],0) != "[\"CHECK_NATIVE_PREPARATION_CURRENT\",\"CONSUME_NATIVE_PREPARATION\"]") throw Invalid();
   var scope = Map(a["scope"]); Exact(scope,"installationId,projectId,executionId,executionGeneration,authorityEpoch,leaseId,registrationRef,nativeFactoryRef,sourceScopeHash,writerHeadRef,preparationRef,hostPublicKeyFingerprint");
   foreach(string k in new[]{"installationId","projectId","executionId","leaseId"}) Id(scope,k);
   Positive(scope["executionGeneration"]); Positive(scope["authorityEpoch"]);
   foreach(string k in new[]{"registrationRef","nativeFactoryRef","writerHeadRef","preparationRef"}) Ref(scope[k],false);
   RequireHash(Text(scope,"sourceScopeHash")); RequireHash(Text(scope,"hostPublicKeyFingerprint"));
   var subject = Map(a["subject"]); Exact(subject,"userId,clientId,humanSessionId,controlGeneration,credentialGeneration");
   foreach(string k in new[]{"userId","clientId","humanSessionId"}) Id(subject,k);
   Positive(subject["controlGeneration"]); Positive(subject["credentialGeneration"]);
   var parent = Map(a["parent"]); Exact(parent,"commandRef,authorizationReceiptRef,auditRef");
   foreach(string k in new[]{"commandRef","authorizationReceiptRef","auditRef"}) Ref(parent[k],false);
   DateTime issued = Time(a,"issuedAt"), expires = Time(a,"expiresAt");
   if(expires <= issued || (expires-issued).TotalMilliseconds > 120000) throw Invalid();
   var c = Map(r["challenge"]); Exact(c,"challengeRef,requestId,authorityRef,localAttemptRef,target,serverNonce,issuedAt,expiresAt");
   Ref(c["challengeRef"],true); var local = Ref(c["localAttemptRef"],true); Ref(c["authorityRef"],true);
   if(!Same(c["authorityRef"],authorityRef)) throw Invalid();
   string requestId = Id(c,"requestId"), nonce = Text(c,"serverNonce"); Unbase(nonce,32);
   DateTime challengeAt = Time(c,"issuedAt"), challengeEnd = Time(c,"expiresAt");
   if(challengeEnd <= challengeAt || challengeEnd > expires || (challengeEnd-challengeAt).TotalMilliseconds > 30000) throw Invalid();
   var target = Map(c["target"]); Exact(target,"method,path,queryHash,bodyHash");
   string path = "/api/v1/connector/native-preparations/"+Text(authorityRef,"id")+"/consume";
   var body = new Dictionary<string,object>{{"schemaVersion",1},{"authorityRef",authorityRef},{"localAttemptRef",local}};
   string bodyHash = Hash(Utf8.GetBytes(Canonical(body,0)));
   if(Text(target,"method") != "POST" || Text(target,"path") != path || Text(target,"queryHash") != Hash(Utf8.GetBytes("{}")) || Text(target,"bodyHash") != bodyHash) throw Invalid();
   var request = Map(r["request"]); Exact(request,"requestId,method,path,queryHash,bodyHash,authorityRef,credentialGeneration,serverNonce"); Ref(request["authorityRef"],true);
   if(Id(request,"requestId") != requestId || Text(request,"method") != "POST" || Text(request,"path") != path || Text(request,"queryHash") != Text(target,"queryHash") || Text(request,"bodyHash") != bodyHash || !Same(request["authorityRef"],authorityRef) || Positive(request["credentialGeneration"]) != generation || Text(request,"serverNonce") != nonce) throw Invalid();
   if(callExpiresAt > expires || callExpiresAt > challengeEnd) throw Invalid();
   Action check = () => { var now = DateTime.UtcNow; if(now < last || elapsed.Elapsed.TotalMilliseconds >= remaining || now >= callExpiresAt || now >= expires || now >= challengeEnd) throw Invalid(); last = now; };
   check();
   // 공개 blob만 내보내며 기존 키를 생성/열기/로드하지 않는다.
   byte[] blob = existingKey.Export(CngKeyBlobFormat.EccPublicBlob);
   if(blob.Length != 72 || !blob.Take(8).SequenceEqual(Hex("4543533120000000"))) throw Invalid();
   byte[] spki = new byte[SpkiPrefix.Length+64]; Buffer.BlockCopy(SpkiPrefix,0,spki,0,SpkiPrefix.Length); Buffer.BlockCopy(blob,8,spki,SpkiPrefix.Length,64);
   string fingerprint = Hash(spki); if(fingerprint != Text(scope,"hostPublicKeyFingerprint")) throw Invalid();
   var wrapper = new Dictionary<string,object>{{"purpose","NATIVE_PREPARATION_REQUEST_PROOF"},{"request",request}};
   domain = Utf8.GetBytes(Canonical(wrapper,0)); digest = Digest(domain); check();
   // CNG 호출의 취소·커널 종료를 주장하지 않는다. 늦은 결과는 반환하지 않는다.
   using(var signer = new ECDsaCng(existingKey)) { signature = signer.SignHash(digest); check(); if(signature.Length != 64 || !signer.VerifyHash(digest,signature)) throw Invalid(); }
   check();
   return Canonical(new Dictionary<string,object>{{"keyId",keyId},{"publicKeySpki",B64(spki)},{"fingerprint",fingerprint},{"requestHash",Hash(Utf8.GetBytes(Canonical(request,0)))},{"signature",B64(signature)}},0);
  } catch { throw Invalid(); }
  finally { elapsed.Stop(); foreach(var bytes in new[]{copy,domain,digest,signature}) if(bytes != null) Array.Clear(bytes,0,bytes.Length); }
 }
 static Dictionary<string,object> Map(object v) { var r=v as Dictionary<string,object>; if(r==null)throw Invalid();return r; }
 static void Exact(Dictionary<string,object> v,string fields) { if(v==null || !v.Keys.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(fields.Split(',').OrderBy(x=>x,StringComparer.Ordinal)))throw Invalid(); }
 static string Text(Dictionary<string,object> v,string k) { object x; if(!v.TryGetValue(k,out x)||!(x is string))throw Invalid();return (string)x; }
 static string Id(Dictionary<string,object> v,string k) { string x=Text(v,k); if(!Regex.IsMatch(x,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z",RegexOptions.CultureInvariant))throw Invalid();return x; }
 static long Positive(object v) { if(!(v is int)&&!(v is long))throw Invalid();long n=Convert.ToInt64(v,CultureInfo.InvariantCulture);if(n<1||n>9007199254740991L)throw Invalid();return n; }
 static void One(object v) { if(Positive(v)!=1)throw Invalid(); }
 static void False(object v) { if(!(v is bool)||(bool)v)throw Invalid(); }
 static void RequireHash(string s) { if(!Regex.IsMatch(s,@"\A[0-9a-f]{64}\z",RegexOptions.CultureInvariant))throw Invalid(); }
 static Dictionary<string,object> Ref(object v,bool one) { var r=Map(v);Exact(r,"id,version,contentHash");Id(r,"id");long n=Positive(r["version"]);if(one&&n!=1)throw Invalid();RequireHash(Text(r,"contentHash"));return r; }
 static DateTime Time(Dictionary<string,object> v,string k) { DateTime t;string s=Text(v,k);if(!DateTime.TryParseExact(s,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out t)||t.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)!=s)throw Invalid();return t; }
 static bool Same(object a,object b) { return Canonical(a,0)==Canonical(b,0); }
 static string Canonical(object v,int depth) {
  if(depth>16)throw Invalid();if(v==null)return "null";if(v is string)return Quote((string)v);if(v is bool)return (bool)v?"true":"false";
  if(v is int||v is long){long n=Convert.ToInt64(v,CultureInfo.InvariantCulture);if(n<0||n>9007199254740991L)throw Invalid();return n.ToString(CultureInfo.InvariantCulture);}
  var d=v as Dictionary<string,object>;if(d!=null)return "{"+String.Join(",",d.Keys.OrderBy(k=>k,StringComparer.Ordinal).Select(k=>Quote(k)+":"+Canonical(d[k],depth+1)))+"}";
  var list=v as IList;if(list!=null){var items=new List<string>();foreach(object x in list)items.Add(Canonical(x,depth+1));return "["+String.Join(",",items)+"]";}throw Invalid();
 }
 static string Quote(string s) { var b=new StringBuilder("\"");foreach(char c in s){if(c>127)throw Invalid();if(c=='"')b.Append("\\\"");else if(c=='\\')b.Append("\\\\");else if(c=='\b')b.Append("\\b");else if(c=='\f')b.Append("\\f");else if(c=='\n')b.Append("\\n");else if(c=='\r')b.Append("\\r");else if(c=='\t')b.Append("\\t");else if(c<32)b.Append("\\u"+((int)c).ToString("x4",CultureInfo.InvariantCulture));else b.Append(c);}return b.Append('"').ToString(); }
 static byte[] Digest(byte[] b) { using(var h=SHA256.Create())return h.ComputeHash(b); }
 static string Hash(byte[] b) { return BitConverter.ToString(Digest(b)).Replace("-","").ToLowerInvariant(); }
 static string B64(byte[] b) { return Convert.ToBase64String(b).TrimEnd('=').Replace('+','-').Replace('/','_'); }
 static byte[] Unbase(string s,int length) { if(!Regex.IsMatch(s,@"\A[A-Za-z0-9_-]+\z",RegexOptions.CultureInvariant))throw Invalid();byte[] b=Convert.FromBase64String(s.Replace('-','+').Replace('_','/')+new string('=',(4-s.Length%4)%4));if(b.Length!=length||B64(b)!=s)throw Invalid();return b; }
 static byte[] Hex(string s) { return Enumerable.Range(0,s.Length/2).Select(i=>Convert.ToByte(s.Substring(i*2,2),16)).ToArray(); }
}
