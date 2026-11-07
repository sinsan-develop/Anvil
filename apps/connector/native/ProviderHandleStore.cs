using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

// SOURCE ONLY: DPAPI capsule core. No Main, pipe, filesystem or process API.
// CREATE/RESOLVE host registration awaits root/ACL/identity/lock/quota/current-command
// implementation and separately allowed native verification. This is not a store host.
internal static class ProviderHandleStore {
 static readonly UTF8Encoding Utf8 = new UTF8Encoding(false,true);
 static InvalidOperationException Invalid() { return new InvalidOperationException("PROVIDER_HANDLE_CAPSULE_INVALID"); }
 static void CheckBinding(string binding,string kind) {
  if(binding==null||!Regex.IsMatch(binding,@"\A[0-9a-f]{64}\z",RegexOptions.CultureInvariant)
   ||(kind!="THREAD"&&kind!="TURN"))throw Invalid();
 }
 static byte[] Entropy(string binding) { return Utf8.GetBytes("ANVIL-V3:PROVIDER-HANDLE:V1:"+binding); }
 static void Validate(byte[] bytes,string binding,string kind) {
  CheckBinding(binding,kind);
  if(bytes==null||bytes.Length<1||bytes.Length>4096)throw Invalid();
  var json=new JavaScriptSerializer {MaxJsonLength=4096,RecursionLimit=4};
  string text=Utf8.GetString(bytes);
  var value=json.Deserialize<Dictionary<string,object>>(text);
  if(value==null||!value.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(new[]{"bindingHash","schemaVersion","threadId","turnId"})
   ||!(value["schemaVersion"] is int)||(int)value["schemaVersion"]!=1
   ||!(value["bindingHash"] is string)||(string)value["bindingHash"]!=binding
   ||!(value["threadId"] is string)||!Handle((string)value["threadId"])
   ||(kind=="THREAD"?value["turnId"]!=null:!(value["turnId"] is string)||!Handle((string)value["turnId"])))throw Invalid();
  // ASCII identifiers/hash make this exact canonical form. Reject duplicates, BOM,
  // escaping aliases and whitespace even if a permissive JSON parser accepts them.
  string canonical="{\"bindingHash\":\""+binding+"\",\"schemaVersion\":1,\"threadId\":\""+(string)value["threadId"]+"\",\"turnId\":"
   +(value["turnId"]==null?"null":"\""+(string)value["turnId"]+"\"")+"}";
  if(!String.Equals(text,canonical,StringComparison.Ordinal))throw Invalid();
 }
 static bool Handle(string value) { return Regex.IsMatch(value,@"\A[A-Za-z0-9._:-]{1,512}\z",RegexOptions.CultureInvariant); }
 internal static byte[] ProtectCapsule(byte[] plaintext,string bindingHash,string kind) {
  byte[] copy=null,entropy=null,encrypted=null;
  try {
   if(plaintext==null||plaintext.Length<1||plaintext.Length>4096)throw Invalid();
   copy=(byte[])plaintext.Clone();Validate(copy,bindingHash,kind);entropy=Entropy(bindingHash);
   encrypted=ProtectedData.Protect(copy,entropy,DataProtectionScope.CurrentUser);
   if(encrypted.Length<1||encrypted.Length>8192)throw Invalid();
   byte[] result=encrypted;encrypted=null;return result;
  } catch { throw Invalid(); }
  finally {
   if(copy!=null)Array.Clear(copy,0,copy.Length);
   if(entropy!=null)Array.Clear(entropy,0,entropy.Length);
   if(encrypted!=null)Array.Clear(encrypted,0,encrypted.Length);
  }
 }
 internal static byte[] UnprotectCapsule(byte[] ciphertext,string bindingHash,string kind) {
  byte[] copy=null,entropy=null,plaintext=null;
  try {
   CheckBinding(bindingHash,kind);
   if(ciphertext==null||ciphertext.Length<1||ciphertext.Length>8192)throw Invalid();
   copy=(byte[])ciphertext.Clone();entropy=Entropy(bindingHash);
   plaintext=ProtectedData.Unprotect(copy,entropy,DataProtectionScope.CurrentUser);
   Validate(plaintext,bindingHash,kind);
   byte[] result=plaintext;plaintext=null;return result;
  } catch { throw Invalid(); }
  finally {
   if(copy!=null)Array.Clear(copy,0,copy.Length);
   if(entropy!=null)Array.Clear(entropy,0,entropy.Length);
   if(plaintext!=null)Array.Clear(plaintext,0,plaintext.Length);
  }
 }
}
