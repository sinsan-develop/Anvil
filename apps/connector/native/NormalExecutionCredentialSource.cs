using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// private owned-host protocol. 서버 공개 API/legacy protected-store protocol을 변경하지 않는다.
// caller scope는 선택자다. 직접 HTTPS challenge의 bootstrapBinding 검산 전에는 권위가 아니다.
internal sealed class NormalExecutionCredentialSource : IDisposable {
 const int Limit=2812587, Chunk=48000;
 readonly DesktopTrustKeyRootSource owner;readonly Func<Dictionary<string,object>> registered;
 readonly Action current;readonly Func<int> remaining;readonly Func<DateTime> clock;
 Dictionary<string,object> upload;MemoryStream incoming;string inputHandle;byte[] output;int outputOffset;string outputHandle,outputHash;DateTime outputExpiry;bool unknown,bootstrapInput;string activeCA;
 static Dictionary<string,object> Map(object o){return DesktopTrustKeyHostSource.Map(o);}
 static string S(Dictionary<string,object> d,string k){return DesktopTrustKeyHostSource.Text(d,k);}
 static string Id(Dictionary<string,object> d,string k){return DesktopTrustKeyHostSource.Id(d,k);}
 static long N(object n){return DesktopTrustKeyHostSource.Nonnegative(n);}
 static string J(object o){return DesktopTrustKeyHostSource.Canonical(o,0);}
 static byte[] B(object o){return Encoding.UTF8.GetBytes(J(o));}
 static string H(byte[] b){return DesktopTrustKeyHostSource.Hash(b);}
 static string H(object o){return H(B(o));}
 static DateTime At(Dictionary<string,object> d,string k){return DesktopTrustKeyHostSource.Time(d,k);}
 static void Exact(Dictionary<string,object> d,string k){DesktopTrustKeyHostSource.Exact(d,k);}
 static Exception Invalid(){return new Exception("NORMAL_EXECUTION_UNAVAILABLE");}
 static string B64(byte[] b){return Convert.ToBase64String(b).TrimEnd('=').Replace('+','-').Replace('/','_');}
 static byte[] Decode(string s,int max){if(s.Length<1||s.Length>max*4/3+4||s.Any(c=>!Char.IsLetterOrDigit(c)&&c!='_'&&c!='-'))throw Invalid();string x=s.Replace('-','+').Replace('_','/');byte[] b=Convert.FromBase64String(x.PadRight((x.Length+3)/4*4,'='));if(b.Length>max||B64(b)!=s)throw Invalid();return b;}
 internal NormalExecutionCredentialSource(DesktopTrustKeyRootSource root,Func<Dictionary<string,object>> record,Action check,Func<int> left,Func<DateTime> now){owner=root;registered=record;current=check;remaining=left;clock=now;}
 void Check(){current();owner.Check();if(unknown||remaining()<1)throw Invalid();}
 Dictionary<string,object> Record(string attempt){Check();var r=registered();if(r==null||S(r,"state")!="REGISTERED"||Id(r,"attemptId")!=attempt)throw Invalid();
  var c=Map(r["credential"]);var g=Map(r["registration"]);if(S(c,"storageState")!="STORED"||At(c,"expiresAt")<=clock()||At(g,"registrationExpiresAt")<=clock())throw Invalid();return r;}
 internal object Dispatch(string operation,Dictionary<string,object> value){
  Check();try{
   if(operation=="NORMAL_EXECUTION_BOOTSTRAP")return Bootstrap(value);
   if(operation=="NORMAL_EXECUTION_BOOTSTRAP_BEGIN"){Exact(value,"attemptId,total,hash");Record(Id(value,"attemptId"));if(incoming!=null||N(value["total"])<1||N(value["total"])>2097152||!DesktopTrustKeyHostSource.IsHash(value["hash"]))throw Invalid();bootstrapInput=true;upload=new Dictionary<string,object>{{"bodyLength",value["total"]},{"bodyHash",value["hash"]}};incoming=new MemoryStream();inputHandle=Guid.NewGuid().ToString("D");return new Dictionary<string,object>{{"handle",inputHandle}};}
   if(operation=="NORMAL_EXECUTION_READ"){Exact(value,"handle,offset");if(output==null||S(value,"handle")!=outputHandle||N(value["offset"])!=outputOffset)throw Invalid();return Next();}
   if(operation=="NORMAL_EXECUTION_BEGIN"){
    if(incoming!=null||output!=null)throw Invalid();Header(value,false);upload=value;incoming=new MemoryStream();inputHandle=Guid.NewGuid().ToString("D");return new Dictionary<string,object>{{"handle",inputHandle}};
   }
   if(operation=="NORMAL_EXECUTION_WRITE"){
    Exact(value,"handle,offset,bytes");if(incoming==null||S(value,"handle")!=inputHandle||N(value["offset"])!=incoming.Length)throw Invalid();
    byte[] b=Decode(S(value,"bytes"),Chunk);try{if(b.Length==0||incoming.Length+b.Length>N(upload["bodyLength"]))throw Invalid();incoming.Write(b,0,b.Length);return new Dictionary<string,object>{{"handle",inputHandle},{"offset",incoming.Length}};}finally{Array.Clear(b,0,b.Length);}
   }
   if(operation=="NORMAL_EXECUTION_EXECUTE"){
    Exact(value,"handle");if(incoming==null||S(value,"handle")!=inputHandle||incoming.Length!=N(upload["bodyLength"]))throw Invalid();
    byte[] body=incoming.ToArray();var header=upload;bool bootstrap=bootstrapInput;ClearInput();try{if(H(body)!=S(header,"bodyHash"))throw Invalid();return bootstrap?(object)Bootstrap(Parse(body)):Call(header,body);}finally{Array.Clear(body,0,body.Length);}
   }
   if(operation=="NORMAL_EXECUTION_CALL"){
    if(incoming!=null||output!=null)throw Invalid();Header(value,true);byte[] body=value["body"]==null?new byte[0]:Encoding.UTF8.GetBytes(S(value,"body"));
    try{return Call(value,body);}finally{Array.Clear(body,0,body.Length);}
   }
   throw Invalid();
  }catch{unknown=true;ClearInput();ClearOutput();throw;}
 }
 void Header(Dictionary<string,object> h,bool inline){Exact(h,inline?"attemptId,slotId,kind,request,bodyLength,bodyHash,bodyIsNull,body":"attemptId,slotId,kind,request,bodyLength,bodyHash,bodyIsNull");
  Id(h,"attemptId");Id(h,"slotId");if(!new[]{"PREPARE","REQUEST"}.Contains(S(h,"kind"))||N(h["bodyLength"])>2097152||!DesktopTrustKeyHostSource.IsHash(h["bodyHash"])||!(h["bodyIsNull"] is bool))throw Invalid();
  var r=Map(h["request"]);Exact(r,"method,path,query,body,auth,expiresAt");if(r["body"]!=null)throw Invalid();
 }
 Dictionary<string,object> LoadSlot(string id,Dictionary<string,object> record){
  byte[] raw=ProtectedStore.LoadNormalOwned(owner,id,"execution",current);try{
   var s=Parse(raw);Exact(s,"purpose,slotId,recordHash,origin,scope,scopeDigest,receiptRef,expiresAt,credential,caHash");
   if(S(s,"purpose")!="NORMAL_EXECUTION_SLOT_V1"||Id(s,"slotId")!=id||S(s,"recordHash")!=H(record)||S(s,"origin")!=S(record,"origin")||At(s,"expiresAt")<=clock())throw Invalid();
   Token(S(s,"credential"));return s;
  }finally{Array.Clear(raw,0,raw.Length);}
 }
 static void Token(string token){if(!token.StartsWith("av3ex1_",StringComparison.Ordinal))throw Invalid();byte[] b=Decode(token.Substring(7),32);try{if(b.Length!=32)throw Invalid();}finally{Array.Clear(b,0,b.Length);}}
 static string Base(Dictionary<string,object> scope){return "/api/v1/connectors/"+Id(scope,"connectorId")+"/executions/"+Id(scope,"executionId");}
 static string Stamp(DateTime t){return t.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture);}
 string Nonce(){byte[] b=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(b);try{return B64(b);}finally{Array.Clear(b,0,b.Length);}}
 Dictionary<string,object> Bootstrap(Dictionary<string,object> v){
  Exact(v,"attemptId,origin,scope,ca");var record=Record(Id(v,"attemptId"));if(S(v,"origin")!=S(record,"origin"))throw Invalid();activeCA=S(v,"ca");using(var pins=Pins(activeCA)){}
  var scope=Map(v["scope"]);Exact(scope,"projectId,connectorId,executionId,executionGeneration,grantRef,credentialGeneration");
  var gref=DesktopTrustKeyHostSource.Ref(scope["grantRef"]);var registration=Map(record["registration"]);
  if(Id(scope,"projectId")!=Id(record,"projectId")||Id(scope,"connectorId")!=Id(Map(registration["connectorRef"]),"id")||
   N(scope["executionGeneration"])<1||N(scope["credentialGeneration"])<1)throw Invalid();
  string slotId=Id(gref,"id"),recordHash=H(record),basePath=Base(scope);
  // INSERT-only marker: 응답 유실/저장 실패를 재발급으로 바꾸지 않는다.
  ProtectedStore.SaveNormalOwned(owner,slotId,"exchange",B(new Dictionary<string,object>{{"grantRef",gref},{"state","STARTED"}}),current);
  var target=new Dictionary<string,object>{{"method","POST"},{"path",basePath+"/credential-exchange"},{"queryHash",H(new Dictionary<string,object>())},{"bodyHash",H(new Dictionary<string,object>())}};
  var request=ChallengeRequest(scope,"CREDENTIAL_EXCHANGE",target);
  var challenge=Challenge(record,scope,request,null,null,120000);
  var c=Map(challenge["challenge"]);
  var bootstrap=Map(challenge["bootstrapBinding"]);CheckBootstrap(record,scope,c,bootstrap);
  var proof=new Dictionary<string,object>{{"requestId",request["requestId"]},{"grantRef",gref},{"credentialGeneration",scope["credentialGeneration"]},{"scopeDigest",c["scopeDigest"]},{"serverNonce",c["serverNonce"]},{"clientNonce",c["clientNonce"]},{"expiresAt",c["expiresAt"]}};
  var auth=new Dictionary<string,object>{{"schemaVersion",1},{"challengeRef",challenge["ref"]},{"proof",proof},{"signature",Sign(record,"EXECUTION_CREDENTIAL_EXCHANGE",proof)}};
  CheckBootstrap(record,scope,c,bootstrap);if(H(Record(Id(v,"attemptId")))!=recordHash)throw Invalid();
  var answer=Http(record,"POST",basePath+"/credential-exchange","","{}",null,B64(B(auth)),16384);
  Exact(answer,"receiptRef,credential,expiresAt");DesktopTrustKeyHostSource.Ref(answer["receiptRef"]);Token(S(answer,"credential"));
  DateTime end=At(answer,"expiresAt");CheckBootstrap(record,scope,c,bootstrap);if(end<=clock()||end>clock().AddMinutes(15)||H(Record(Id(v,"attemptId")))!=recordHash)throw Invalid();
  var slot=new Dictionary<string,object>{{"purpose","NORMAL_EXECUTION_SLOT_V1"},{"slotId",slotId},{"recordHash",recordHash},{"origin",record["origin"]},{"scope",scope},{"scopeDigest",bootstrap["scopeDigest"]},{"receiptRef",answer["receiptRef"]},{"expiresAt",answer["expiresAt"]},{"credential",answer["credential"]},{"caHash",H(Encoding.UTF8.GetBytes(activeCA))}};
  ProtectedStore.SaveNormalOwned(owner,slotId,"execution-ca",Encoding.UTF8.GetBytes(activeCA),current);
  ProtectedStore.SaveNormalOwned(owner,slotId,"execution",B(slot),current);
  var checkedSlot=LoadSlot(slotId,record);if(H(checkedSlot)!=H(slot))throw Invalid();
  return new Dictionary<string,object>{{"slotId",slotId},{"receiptRef",answer["receiptRef"]},{"origin",record["origin"]},{"scope",scope},{"expiresAt",answer["expiresAt"]},{"caHash",slot["caHash"]}};
 }
 void CheckBootstrap(Dictionary<string,object> record,Dictionary<string,object> scope,Dictionary<string,object> challenge,Dictionary<string,object> b){
  Check();Exact(b,"projectId,connectorId,executionId,executionGeneration,grantRef,credentialGeneration,scopeDigest,registrationRef,reservationRef,publicKeyFingerprint,checkedAt,expiresAt");
  var registration=Map(record["registration"]);var key=Map(record["key"]);
  DesktopTrustKeyHostSource.Ref(b["reservationRef"]);DesktopTrustKeyHostSource.Ref(b["registrationRef"]);
  foreach(string k in new[]{"projectId","connectorId","executionId","executionGeneration","grantRef","credentialGeneration"})if(J(b[k])!=J(scope[k]))throw Invalid();
  if(J(b["registrationRef"])!=J(registration["registrationRef"])||S(b,"publicKeyFingerprint")!=S(key,"fingerprint")||
   !DesktopTrustKeyHostSource.IsHash(b["scopeDigest"])||S(b,"scopeDigest")!=S(challenge,"scopeDigest")||
   At(b,"checkedAt")<At(challenge,"issuedAt")||Math.Abs((clock()-At(b,"checkedAt")).TotalSeconds)>30||
   At(b,"expiresAt")<=At(b,"checkedAt")||At(b,"expiresAt")<=clock()||At(b,"expiresAt")>At(challenge,"expiresAt"))throw Invalid();
 }
 Dictionary<string,object> ChallengeRequest(Dictionary<string,object> scope,string purpose,Dictionary<string,object> target){
  return new Dictionary<string,object>{{"requestId",Guid.NewGuid().ToString("D")},{"purpose",purpose},{"grantRef",scope["grantRef"]},{"credentialGeneration",scope["credentialGeneration"]},{"target",target},{"clientNonce",Nonce()},{"issuedAt",Stamp(clock())}};
 }
 string Sign(Dictionary<string,object> record,string purpose,Dictionary<string,object> request){
  Check();return ProtectedStore.SignNormalOwned(owner,Id(record,"pendingKeyId"),S(Map(record["key"]),"fingerprint"),B(new Dictionary<string,object>{{"purpose",purpose},{"request",request}}),current);
 }
 Dictionary<string,object> Challenge(Dictionary<string,object> record,Dictionary<string,object> scope,Dictionary<string,object> request,string token,string scopeDigest,int ttl){
  var signed=new Dictionary<string,object>(request);signed["signature"]=Sign(record,"EXECUTION_CHALLENGE_REQUEST",request);
  var reply=Http(record,"POST",Base(scope)+"/challenges","",J(signed),token,null,16384);
  Exact(reply,token==null?"ref,challenge,credentialIssued,nonceConsumed,executionAuthorized,dispatchPerformed,bootstrapBinding":"ref,challenge,credentialIssued,nonceConsumed,executionAuthorized,dispatchPerformed");
  foreach(string k in new[]{"credentialIssued","nonceConsumed","executionAuthorized","dispatchPerformed"})if(!(reply[k] is bool)||(bool)reply[k])throw Invalid();
  var r=DesktopTrustKeyHostSource.Ref(reply["ref"]);var c=Map(reply["challenge"]);
  Exact(c,"id,requestId,purpose,grantRef,credentialGeneration,scopeDigest,serverNonce,clientNonce,issuedAt,expiresAt");
  if(Id(c,"id")!=Id(r,"id")||Id(c,"requestId")!=Id(request,"requestId")||S(c,"purpose")!=S(request,"purpose")||J(c["grantRef"])!=J(scope["grantRef"])||
   N(c["credentialGeneration"])!=N(scope["credentialGeneration"])||S(c,"clientNonce")!=S(request,"clientNonce")||!DesktopTrustKeyHostSource.IsHash(c["scopeDigest"])||(scopeDigest!=null&&S(c,"scopeDigest")!=scopeDigest)||
   At(c,"expiresAt")<=clock()||At(c,"expiresAt")<=At(c,"issuedAt")||(At(c,"expiresAt")-At(c,"issuedAt")).TotalMilliseconds>ttl)throw Invalid();
  byte[] nonce=Decode(S(c,"serverNonce"),32);try{if(nonce.Length!=32)throw Invalid();}finally{Array.Clear(nonce,0,nonce.Length);}return reply;
 }
 Dictionary<string,object> Target(Dictionary<string,object> scope,Dictionary<string,object> r,string body){
  string method=S(r,"method"),path=S(r,"path"),query=S(r,"query"),basePath=Base(scope);
  bool valid=method=="GET"&&(path==basePath+"/commands"||System.Text.RegularExpressions.Regex.IsMatch(path,"\\A"+System.Text.RegularExpressions.Regex.Escape(basePath)+"/commands/[a-f0-9-]{36}/materials/[a-f0-9-]{36}\\z"))||
   method=="POST"&&(path==basePath+"/observations"||System.Text.RegularExpressions.Regex.IsMatch(path,"\\A"+System.Text.RegularExpressions.Regex.Escape(basePath)+"/commands/[a-f0-9-]{36}/permit\\z"));
  if(!valid||path.Contains("%")||path.Contains("..")||(method=="GET"&&body!=null)||(method=="POST"&&(body==null||query!="")))throw Invalid();
  var q=new Dictionary<string,object>();if(query!=""){
   if(path!=basePath+"/commands"||!query.StartsWith("?"))throw Invalid();foreach(string pair in query.Substring(1).Split('&')){
    string[] kv=pair.Split('=');if(kv.Length!=2)throw Invalid();string k=Uri.UnescapeDataString(kv[0]),v=Uri.UnescapeDataString(kv[1]);if(q.ContainsKey(k)||!new[]{"waitMs","afterCursor"}.Contains(k))throw Invalid();
    if(k=="waitMs"){int n;if(!Int32.TryParse(v,NumberStyles.None,CultureInfo.InvariantCulture,out n)||n<0||n>10000||n.ToString(CultureInfo.InvariantCulture)!=v)throw Invalid();q[k]=n;}else q[k]=v;
   }
  }
  return new Dictionary<string,object>{{"method",method},{"path",path},{"queryHash",H(q)},{"bodyHash",body==null?H(Encoding.UTF8.GetBytes("null")):H(Parse(Encoding.UTF8.GetBytes(body)))}};
 }
 object Call(Dictionary<string,object> h,byte[] bodyBytes){
  if(bodyBytes.Length!=N(h["bodyLength"])||H(bodyBytes)!=S(h,"bodyHash"))throw Invalid();string body=(bool)h["bodyIsNull"]?null:new UTF8Encoding(false,true).GetString(bodyBytes);
  if(body==null&&bodyBytes.Length!=0)throw Invalid();var record=Record(Id(h,"attemptId"));string recordHash=H(record);
  var slot=LoadSlot(Id(h,"slotId"),record);var scope=Map(slot["scope"]);var r=Map(h["request"]);var target=Target(scope,r,body);
  byte[] caBytes=ProtectedStore.LoadNormalOwned(owner,Id(h,"slotId"),"execution-ca",current);try{if(H(caBytes)!=S(slot,"caHash"))throw Invalid();activeCA=new UTF8Encoding(false,true).GetString(caBytes);}finally{Array.Clear(caBytes,0,caBytes.Length);}
  DateTime end=new[]{At(slot,"expiresAt"),At(r,"expiresAt")}.Min();if(end<=clock())throw Invalid();object result;
  if(S(h,"kind")=="PREPARE"){
   if(r["auth"]!=null)throw Invalid();var request=ChallengeRequest(scope,"EXECUTION_REQUEST",target);
   var reply=Challenge(record,scope,request,S(slot,"credential"),S(slot,"scopeDigest"),30000);var c=Map(reply["challenge"]);
   var proof=new Dictionary<string,object>(target);proof["requestId"]=request["requestId"];proof["grantRef"]=scope["grantRef"];proof["credentialGeneration"]=scope["credentialGeneration"];proof["serverNonce"]=c["serverNonce"];
   var packet=new Dictionary<string,object>{{"schemaVersion",1},{"challengeRef",reply["ref"]},{"proof",proof},{"signature",Sign(record,"EXECUTION_REQUEST_PROOF",proof)}};
   string auth=B64(B(packet));end=new[]{end,At(c,"expiresAt")}.Min();
   var saved=new Dictionary<string,object>{{"slotId",slot["slotId"]},{"target",target},{"authHash",H(Encoding.UTF8.GetBytes(auth))},{"expiresAt",Stamp(end)},{"recordHash",recordHash}};
   ProtectedStore.SaveNormalOwned(owner,Id(request,"requestId"),"execution-proof",B(saved),current);
   result=new Dictionary<string,object>{{"path",r["path"]},{"query",r["query"]},{"auth",auth},{"challengeRef",reply["ref"]},{"requestId",request["requestId"]},{"expiresAt",Stamp(end)}};
  }else{
   byte[] packetBytes=Decode(S(r,"auth"),4096);Dictionary<string,object> packet;try{packet=Parse(packetBytes);}finally{Array.Clear(packetBytes,0,packetBytes.Length);}
   Exact(packet,"schemaVersion,challengeRef,proof,signature");var proof=Map(packet["proof"]);
   byte[] raw=ProtectedStore.LoadNormalOwned(owner,Id(proof,"requestId"),"execution-proof",current);
   try{var saved=Parse(raw);if(S(saved,"slotId")!=Id(h,"slotId")||S(saved,"recordHash")!=recordHash||J(saved["target"])!=J(target)||
    S(saved,"authHash")!=H(Encoding.UTF8.GetBytes(S(r,"auth")))||At(saved,"expiresAt")<=clock())throw Invalid();end=new[]{end,At(saved,"expiresAt")}.Min();}finally{Array.Clear(raw,0,raw.Length);}
   result=Http(record,S(r,"method"),S(r,"path"),S(r,"query"),body,S(slot,"credential"),S(r,"auth"),Limit);
  }
  if(H(Record(Id(h,"attemptId")))!=recordHash||clock()>=end)throw Invalid();output=B(result);if(output.Length<1||output.Length>Limit)throw Invalid();
  outputHandle=Guid.NewGuid().ToString("D");outputHash=H(output);outputOffset=0;outputExpiry=end;return Next();
 }
 object Next(){Check();if(output==null||clock()>=outputExpiry)throw Invalid();int at=outputOffset,n=Math.Min(Chunk,output.Length-at);byte[] part=new byte[n];Buffer.BlockCopy(output,at,part,0,n);outputOffset+=n;
  try{var result=new Dictionary<string,object>{{"handle",outputHandle},{"offset",at},{"total",output.Length},{"hash",outputHash},{"expiresAt",Stamp(outputExpiry)},{"bytes",B64(part)},{"done",outputOffset==output.Length}};if(outputOffset==output.Length)ClearOutput();return result;}finally{Array.Clear(part,0,part.Length);}
 }
 Dictionary<string,object> Http(Dictionary<string,object> record,string method,string path,string query,string body,string token,string auth,int max){
  Check();var req=(HttpWebRequest)WebRequest.Create(S(record,"origin")+path+query);req.Method=method;req.AllowAutoRedirect=false;req.Proxy=null;req.UseDefaultCredentials=false;req.Credentials=null;
  req.SslProtocols=System.Security.Authentication.SslProtocols.Tls12;
  var pins=Pins(activeCA);req.ServerCertificateValidationCallback=(sender,certificate,chain,errors)=>Pinned(pins,certificate,chain,errors);
  req.Timeout=remaining();req.ReadWriteTimeout=remaining();req.AutomaticDecompression=DecompressionMethods.None;req.Accept="application/json";req.KeepAlive=false;
  if(token!=null)req.Headers[HttpRequestHeader.Authorization]="Bearer "+token;if(auth!=null)req.Headers["Anvil-Execution-Auth"]=auth;
  byte[] payload=body==null?null:Encoding.UTF8.GetBytes(body);
  try{if(payload!=null){req.ContentType="application/json";req.ContentLength=payload.Length;using(var s=req.GetRequestStream()){Check();s.Write(payload,0,payload.Length);}}Check();
   using(var response=(HttpWebResponse)req.GetResponse()){
    if(response.StatusCode!=HttpStatusCode.OK||response.ResponseUri.AbsoluteUri!=S(record,"origin")+path+query||
     !response.ContentType.StartsWith("application/json",StringComparison.OrdinalIgnoreCase)||!String.IsNullOrEmpty(response.ContentEncoding)||response.ContentLength>max)throw Invalid();
    using(var stream=response.GetResponseStream())using(var bytes=new MemoryStream()){
     byte[] part=new byte[8192];try{int n;while(true){Check();if(stream.CanTimeout)stream.ReadTimeout=remaining();n=stream.Read(part,0,part.Length);if(n==0)break;Check();if(bytes.Length+n>max)throw Invalid();bytes.Write(part,0,n);}Check();byte[] raw=bytes.ToArray();try{return Parse(raw);}finally{Array.Clear(raw,0,raw.Length);}}
     finally{Array.Clear(part,0,part.Length);if(bytes.Length>0)Array.Clear(bytes.GetBuffer(),0,(int)bytes.Length);}
    }
   }
  }finally{req.Abort();pins.Dispose();if(payload!=null)Array.Clear(payload,0,payload.Length);}
 }
 sealed class Roots:IDisposable{internal readonly List<X509Certificate2> Values=new List<X509Certificate2>();public void Dispose(){foreach(var v in Values)v.Dispose();Values.Clear();}}
 static Roots Pins(string pem){if(pem==null||Encoding.UTF8.GetByteCount(pem)>65536)throw Invalid();var result=new Roots();try{
  var re=new System.Text.RegularExpressions.Regex(@"-----BEGIN CERTIFICATE-----\s*(?<b>[A-Za-z0-9+/=\r\n]+)\s*-----END CERTIFICATE-----");
  var matches=re.Matches(pem);if(matches.Count<1||matches.Count>32||re.Replace(pem,"").Trim()!="")throw Invalid();
  foreach(System.Text.RegularExpressions.Match m in matches){var cert=new X509Certificate2(Convert.FromBase64String(m.Groups["b"].Value));result.Values.Add(cert);
   var basic=cert.Extensions.OfType<X509BasicConstraintsExtension>().SingleOrDefault();if(basic==null||!basic.CertificateAuthority||!cert.SubjectName.RawData.SequenceEqual(cert.IssuerName.RawData))throw Invalid();}
  return result;
 }catch{result.Dispose();throw;}}
 bool Pinned(Roots pins,X509Certificate certificate,X509Chain delivered,SslPolicyErrors errors){IntPtr store=IntPtr.Zero,context=IntPtr.Zero,oid=IntPtr.Zero,oids=IntPtr.Zero;try{
  Check();
  if(certificate==null||(errors&(SslPolicyErrors.RemoteCertificateNameMismatch|SslPolicyErrors.RemoteCertificateNotAvailable))!=0)return false;
  if(delivered!=null&&(delivered.ChainElements.Count>32||delivered.ChainStatus.Any(s=>(s.Status&(X509ChainStatusFlags.Revoked|X509ChainStatusFlags.RevocationStatusUnknown|X509ChainStatusFlags.OfflineRevocation))!=0)))return false;
  store=CertOpenStore(new IntPtr(2),0,IntPtr.Zero,0x00002000,IntPtr.Zero);if(store==IntPtr.Zero)return false;
  foreach(var root in pins.Values)if(!CertAddCertificateContextToStore(store,root.Handle,4,IntPtr.Zero))return false;
  if(delivered!=null)foreach(X509ChainElement e in delivered.ChainElements)if(!CertAddCertificateContextToStore(store,e.Certificate.Handle,4,IntPtr.Zero))return false;
  oid=Marshal.StringToHGlobalAnsi("1.3.6.1.5.5.7.3.1");oids=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(oids,oid);
  var para=new ChainPara();para.cbSize=Marshal.SizeOf(typeof(ChainPara));para.RequestedUsage.Usage.cUsageIdentifier=1;para.RequestedUsage.Usage.rgpszUsageIdentifier=oids;para.dwUrlRetrievalTimeout=remaining();
  // wincrypt.h: sequential default packing, DWORD/BOOL=4, pointer-width alignment. x86=52/x64=96.
  if(para.cbSize!=(IntPtr.Size==8?96:52))return false;
  long ft=clock().ToFileTimeUtc();var stamp=new System.Runtime.InteropServices.ComTypes.FILETIME{dwLowDateTime=(int)ft,dwHighDateTime=(int)(ft>>32)};
  using(var leaf=new X509Certificate2(certificate)){
   // https://learn.microsoft.com/windows/win32/api/wincrypt/nf-wincrypt-certgetcertificatechain
   // CACHE_ONLY_URL_RETRIEVAL | DISABLE_AUTH_ROOT_AUTO_UPDATE | DISABLE_AIA | REVOCATION_CHECK_CACHE_ONLY.
   if(!CertGetCertificateChain(IntPtr.Zero,leaf.Handle,ref stamp,store,ref para,0x80002104,IntPtr.Zero,out context))return false;
   Check();using(var chain=new X509Chain(context)){
    if(chain.ChainElements.Count<1||chain.ChainElements.Count>32||chain.ChainStatus.Any(s=>(s.Status&~X509ChainStatusFlags.UntrustedRoot)!=0))return false;
    var root=chain.ChainElements[chain.ChainElements.Count-1].Certificate;bool valid=pins.Values.Any(p=>p.RawData.SequenceEqual(root.RawData));Check();return valid;
   }
  }
 }catch{return false;}finally{if(context!=IntPtr.Zero)CertFreeCertificateChain(context);if(store!=IntPtr.Zero)CertCloseStore(store,0);if(oids!=IntPtr.Zero)Marshal.FreeHGlobal(oids);if(oid!=IntPtr.Zero)Marshal.FreeHGlobal(oid);}}
 // CERT_CHAIN_PARA / CERT_USAGE_MATCH / CERT_ENHKEY_USAGE, wincrypt.h Microsoft Learn 정본의 field 순서.
 [StructLayout(LayoutKind.Sequential)]struct EnhancedUsage{internal int cUsageIdentifier;internal IntPtr rgpszUsageIdentifier;}
 [StructLayout(LayoutKind.Sequential)]struct UsageMatch{internal int dwType;internal EnhancedUsage Usage;}
 [StructLayout(LayoutKind.Sequential)]struct ChainPara{internal int cbSize;internal UsageMatch RequestedUsage;internal UsageMatch RequestedIssuancePolicy;internal int dwUrlRetrievalTimeout;internal int fCheckRevocationFreshnessTime;internal int dwRevocationFreshnessTime;internal IntPtr pftCacheResync;internal IntPtr pStrongSignPara;internal int dwStrongSignFlags;}
 [DllImport("crypt32.dll",SetLastError=true)]static extern IntPtr CertOpenStore(IntPtr provider,int encoding,IntPtr crypt,int flags,IntPtr parameter);
 [DllImport("crypt32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool CertAddCertificateContextToStore(IntPtr store,IntPtr certificate,int disposition,IntPtr stored);
 [DllImport("crypt32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool CertGetCertificateChain(IntPtr engine,IntPtr certificate,ref System.Runtime.InteropServices.ComTypes.FILETIME time,IntPtr store,ref ChainPara parameters,uint flags,IntPtr reserved,out IntPtr chain);
 [DllImport("crypt32.dll")]static extern void CertFreeCertificateChain(IntPtr chain);
 [DllImport("crypt32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool CertCloseStore(IntPtr store,int flags);
 // JSON 중복 key는 deserializer로 소실되기 전에 거절한다. canonical hash는 파싱한 exact 자료에 적용한다.
 static Dictionary<string,object> Parse(byte[] bytes){string s=new UTF8Encoding(false,true).GetString(bytes);new JsonKeys(s).Check();return new JavaScriptSerializer{MaxJsonLength=Limit,RecursionLimit=32}.Deserialize<Dictionary<string,object>>(s);}
 sealed class JsonKeys {
  readonly string s;int p;internal JsonKeys(string text){s=text;}
  void Space(){while(p<s.Length&&" \r\n\t".IndexOf(s[p])>=0)p++;}
  string Str(){int start=p++;bool escaped=false;while(p<s.Length){char c=s[p++];if(c=='"'&&!escaped)return new JavaScriptSerializer().Deserialize<string>(s.Substring(start,p-start));if(c=='\\'&&!escaped)escaped=true;else escaped=false;}throw Invalid();}
  void Value(int depth){Space();if(depth>32||p>=s.Length)throw Invalid();char c=s[p];if(c=='"'){Str();return;}if(c=='{'||c=='['){
   bool obj=c=='{';p++;Space();var keys=new HashSet<string>(StringComparer.Ordinal);if(p<s.Length&&s[p]==(obj?'}':']')){p++;return;}
   while(true){Space();if(obj){if(p>=s.Length||s[p]!='"'||!keys.Add(Str()))throw Invalid();Space();if(p>=s.Length||s[p++]!=':')throw Invalid();}Value(depth+1);Space();if(p>=s.Length)throw Invalid();char next=s[p++];if(next==(obj?'}':']'))return;if(next!=',')throw Invalid();}
  }int start=p;while(p<s.Length&&",]} \t\r\n".IndexOf(s[p])<0)p++;if(p==start)throw Invalid();}
  internal void Check(){Value(0);Space();if(p!=s.Length)throw Invalid();}
 }
 void ClearInput(){if(incoming!=null){if(incoming.Length>0)Array.Clear(incoming.GetBuffer(),0,(int)incoming.Length);incoming.Dispose();}incoming=null;upload=null;inputHandle=null;bootstrapInput=false;}
 void ClearOutput(){if(output!=null)Array.Clear(output,0,output.Length);output=null;outputOffset=0;outputHandle=null;}
 public void Dispose(){unknown=true;ClearInput();ClearOutput();}
}
internal static partial class ProtectedStore {
 // 일반 Run/STORE_CREDENTIAL은 여전히 av3ct1_만 허용한다. 별도 kind와 DPAPI entropy로 normal 슬롯을 격리한다.
 internal static void SaveNormalOwned(DesktopTrustKeyRootSource owner,string id,string kind,byte[] bytes,Action current){
  if(!new[]{"execution","execution-proof","exchange","execution-ca"}.Contains(kind))throw new Exception();
  lock(OwnedGate){current();owner.Check();string previous=Root;Root=owner.PathValue;byte[] encrypted=null;
   try{if(bytes.Length<1||bytes.Length>(kind=="execution-ca"?65536:8192))throw new Exception();var files=new DirectoryInfo(Root).GetFiles();if(files.Length>=1024||files.Sum(f=>f.Length)>16777216-bytes.Length*2)throw new Exception();
    CheckPath(Root,true);encrypted=ProtectedData.Protect(bytes,Utf8.GetBytes("ANVIL-V3:NORMAL:"+kind+":"+id),DataProtectionScope.CurrentUser);
    using(var file=new FileStream(Path.Combine(Root,id+"."+kind),FileMode.CreateNew,FileAccess.Write,FileShare.None)){file.Write(encrypted,0,encrypted.Length);file.Flush(true);}current();owner.Check();
   }finally{Root=previous;if(encrypted!=null)Array.Clear(encrypted,0,encrypted.Length);Array.Clear(bytes,0,bytes.Length);}
  }
 }
 internal static byte[] LoadNormalOwned(DesktopTrustKeyRootSource owner,string id,string kind,Action current){
  if(!new[]{"execution","execution-proof","execution-ca"}.Contains(kind))throw new Exception();
  lock(OwnedGate){current();owner.Check();string path=Path.Combine(owner.PathValue,id+"."+kind);CheckPath(path,false);byte[] encrypted=null;
   try{using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.None)){if(file.Length<1||file.Length>(kind=="execution-ca"?131072:16384))throw new Exception();encrypted=new byte[(int)file.Length];int off=0,n;while(off<encrypted.Length&&(n=file.Read(encrypted,off,encrypted.Length-off))>0)off+=n;if(off!=encrypted.Length)throw new Exception();}
    current();var clear=ProtectedData.Unprotect(encrypted,Utf8.GetBytes("ANVIL-V3:NORMAL:"+kind+":"+id),DataProtectionScope.CurrentUser);try{current();owner.Check();return clear;}catch{Array.Clear(clear,0,clear.Length);throw;}
   }finally{if(encrypted!=null)Array.Clear(encrypted,0,encrypted.Length);}
  }
 }
 internal static string SignNormalOwned(DesktopTrustKeyRootSource owner,string keyId,string fingerprint,byte[] bytes,Action current){
  lock(OwnedGate){current();owner.Check();string previous=Root;Root=owner.PathValue;byte[] secret=null,signature=null;
   try{secret=Load(keyId,"key");using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob))using(var ecdsa=new ECDsaCng(key)){if(Hash(Spki(key))!=fingerprint)throw new Exception();ecdsa.HashAlgorithm=CngAlgorithm.Sha256;current();signature=ecdsa.SignData(bytes);current();owner.Check();return B64(signature);}}
   finally{Root=previous;if(secret!=null)Array.Clear(secret,0,secret.Length);if(signature!=null)Array.Clear(signature,0,signature.Length);Array.Clear(bytes,0,bytes.Length);}
  }
 }
}
