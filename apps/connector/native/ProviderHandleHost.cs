using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

// SOURCE ONLY. Not registered in a build/run script. No credential/key/generic exec API.
// A future fixed caller must validate exact immutable prepared/current command context,
// helper binary identity and bounded private pipes. Stdin metadata is not authorization.
internal static class ProviderHandleHost {
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=16384,RecursionLimit=4};
 static int Main(string[] args){
  char[] chars=new char[16385];byte[] plain=null;string output=null;
  try{
   if(args.Length!=0)throw new Exception();int count=0,n;
   while(count<chars.Length&&(n=Console.In.Read(chars,count,chars.Length-count))>0)count+=n;
   if(count<1||count>16384)throw new Exception();
   string text=new string(chars,0,count);Array.Clear(chars,0,chars.Length);
   var request=Json.Deserialize<Dictionary<string,object>>(text);string operation=Text(request,"operation");
   bool create=operation=="CREATE_PROVIDER_HANDLE";
   if(!create&&operation!="RESOLVE_PROVIDER_HANDLE")throw new Exception();
   string[] keys=(create?"bindingHash,capsule,capturedAt,claimId,kind,operation,usableBefore":"bindingHash,capturedAt,ciphertextHash,claimId,kind,operation,usableBefore").Split(',');
   if(!request.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(keys))throw new Exception();
   // All fields have constrained ASCII syntax. Exact canonical comparison also rejects
   // duplicate keys/aliases/whitespace accepted by a permissive JSON parser.
   string canonical="{"+String.Join(",",keys.Select(k=>Json.Serialize(k)+":"+Json.Serialize(Text(request,k))))+"}";
   if(!String.Equals(text,canonical,StringComparison.Ordinal))throw new Exception();
   string id=Text(request,"claimId"),binding=Text(request,"bindingHash"),kind=Text(request,"kind"),at=Text(request,"capturedAt"),until=Text(request,"usableBefore");
   if(create){
    plain=Decode(Text(request,"capsule"));
    string digest=ProviderHandleFiles.CapturePrepared(id,binding,kind,at,until,plain);
    output=Json.Serialize(new{ok=true,data=new{ciphertextHash=digest}});
   }else{
    string digest=Text(request,"ciphertextHash");plain=ProviderHandleFiles.ResolvePrepared(id,binding,kind,at,until,digest);
    output=Json.Serialize(new{ok=true,data=new{ciphertextHash=digest,plaintext=Encode(plain)}});
   }
   if(output.Length>16384)throw new Exception();Console.OutputEncoding=Utf8;Console.Out.Write(output);Console.Out.Flush();return 0;
  }catch{
   // Never echo input, runtime paths, native exception details, handles or ciphertext.
   try{Console.Out.Write("{\"ok\":false,\"error\":\"PROVIDER_HANDLE_HOST_UNAVAILABLE\"}");Console.Out.Flush();}catch{/* Broken pipe: no second error channel or raw runtime exception. */}
   return 1;
  }finally{
   Array.Clear(chars,0,chars.Length);if(plain!=null)Array.Clear(plain,0,plain.Length);
   // Managed input/base64/output strings cannot be guaranteed erased by the CLR.
  }
 }
 static string Text(Dictionary<string,object> value,string key){object data;if(value==null||!value.TryGetValue(key,out data)||!(data is string))throw new Exception();return(string)data;}
 static string Encode(byte[] bytes){return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');}
 static byte[] Decode(string text){
  if(text.Length<1||text.Length>5462||!Regex.IsMatch(text,@"\A[A-Za-z0-9_-]+\z",RegexOptions.CultureInvariant))throw new Exception();
  byte[] bytes=null;try{
   string v=text.Replace('-','+').Replace('_','/');bytes=Convert.FromBase64String(v.PadRight((v.Length+3)/4*4,'='));
   if(bytes.Length<1||bytes.Length>4096||Encode(bytes)!=text)throw new Exception();byte[] result=bytes;bytes=null;return result;
  }finally{if(bytes!=null)Array.Clear(bytes,0,bytes.Length);}
 }
}
