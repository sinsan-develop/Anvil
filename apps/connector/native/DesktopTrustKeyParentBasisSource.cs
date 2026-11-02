using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;

// 외부 파일/assembly/CLI의 basis는 수용하지 않는다. 실제 resource는 후속 build에서 내장한다.
internal interface IDesktopTrustKeyResources {
 string[] Names(); bool IsLocalEmbedded(string name); Stream Open(string name);
}
internal sealed class DesktopTrustKeyParentBasisSource {
 internal const string ResourceName="Anvil.Desktop.TrustKeyHost.ParentBasis.v1";
 internal readonly string SignerId,ParentExeHash,ParentAsarHash,ParentHeaderHash;
 internal readonly long SignerVersion;
 DesktopTrustKeyParentBasisSource(Dictionary<string,object> value){
  SignerId=DesktopTrustKeyHostSource.Id(value,"signerId");SignerVersion=DesktopTrustKeyHostSource.Positive(value["signerVersion"]);
  ParentExeHash=Hash(value,"parentExeHash");ParentAsarHash=Hash(value,"parentAsarHash");ParentHeaderHash=Hash(value,"parentHeaderHash");
 }
 static string Hash(Dictionary<string,object> v,string key){string value=DesktopTrustKeyHostSource.Text(v,key);if(value==new string('0',64)||!System.Text.RegularExpressions.Regex.IsMatch(value,@"\A[0-9a-f]{64}\z"))throw Invalid();return value;}
 internal static Exception Invalid(){return new InvalidOperationException("DESKTOP_TRUST_UNAVAILABLE");}
 internal static DesktopTrustKeyParentBasisSource Read(IDesktopTrustKeyResources resources){
  if(resources==null)throw Invalid();try{
   var names=resources.Names();if(names==null||names.Length!=1||names[0]!=ResourceName||!resources.IsLocalEmbedded(ResourceName))throw Invalid();
   using(var input=resources.Open(ResourceName))using(var buffer=new MemoryStream()){
    if(input==null||!input.CanRead)throw Invalid();var block=new byte[1024];int count;
    while((count=input.Read(block,0,block.Length))!=0){if(count<0||buffer.Length+count>8192)throw Invalid();buffer.Write(block,0,count);}
    byte[] bytes=buffer.ToArray();try{var value=DesktopTrustKeyHostSource.Parse(bytes,false);DesktopTrustKeyHostSource.Exact(value,"schemaVersion,purpose,namespace,signerId,signerVersion,parentExeHash,parentAsarHash,parentHeaderHash");
     if(DesktopTrustKeyHostSource.Positive(value["schemaVersion"])!=1||DesktopTrustKeyHostSource.Text(value,"purpose")!="DESKTOP_TRUST_SIGNER_PARENT_BASIS"||DesktopTrustKeyHostSource.Text(value,"namespace")!="ANVIL_DESKTOP_TRUST_SIGNER_V1")throw Invalid();
     return new DesktopTrustKeyParentBasisSource(value);
    }finally{Array.Clear(bytes,0,bytes.Length);Array.Clear(block,0,block.Length);}
   }
  }catch{throw Invalid();}
 }
 internal sealed class OwnAssemblyResources:IDesktopTrustKeyResources {
  // 생성자는 assembly/resource 조회도 수행하지 않는다.
  public string[] Names(){return typeof(DesktopTrustKeyParentBasisSource).Assembly.GetManifestResourceNames();}
  public bool IsLocalEmbedded(string name){var assembly=typeof(DesktopTrustKeyParentBasisSource).Assembly;var info=assembly.GetManifestResourceInfo(name);
   // CLR 공개 API는 manifest resource의 private flag 자체를 노출하지 않는다.
   // private 명시는 후속 정확 build 입력에서 고정한다. local/embedded는 여기서 실제 검산한다.
   return info!=null&&info.ReferencedAssembly==null&&info.FileName==null&&info.ResourceLocation==(ResourceLocation.Embedded|ResourceLocation.ContainedInManifestFile);
  }
  public Stream Open(string name){if(name!=ResourceName)throw Invalid();return typeof(DesktopTrustKeyParentBasisSource).Assembly.GetManifestResourceStream(ResourceName);}
 }
}
