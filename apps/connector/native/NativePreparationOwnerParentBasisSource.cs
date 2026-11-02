using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;

// 외부 파일/assembly/CLI의 basis는 수용하지 않는다. 실제 resource는 후속 build에서 내장한다.
internal interface INativeOwnerResources {
 string[] Names(); bool IsLocalEmbedded(string name); Stream Open(string name);
}
internal sealed class NativePreparationOwnerParentBasisSource {
 internal const string ResourceName="Anvil.Native.NativePreparationOwner.ParentBasis.v1";
 internal readonly string FactoryId,ParentExeHash,ParentAsarHash,ParentHeaderHash;
 internal readonly long FactoryVersion;
 NativePreparationOwnerParentBasisSource(Dictionary<string,object> value){
  FactoryId=NativePreparationOwnerBridgeSource.Id(value,"factoryId");FactoryVersion=NativePreparationOwnerBridgeSource.Positive(value["factoryVersion"]);
  ParentExeHash=Hash(value,"parentExeHash");ParentAsarHash=Hash(value,"parentAsarHash");ParentHeaderHash=Hash(value,"parentHeaderHash");
 }
 static string Hash(Dictionary<string,object> v,string key){string value=NativePreparationOwnerBridgeSource.Text(v,key);if(value==new string('0',64)||!System.Text.RegularExpressions.Regex.IsMatch(value,@"\A[0-9a-f]{64}\z"))throw Invalid();return value;}
 internal static Exception Invalid(){return new InvalidOperationException("NATIVE_OWNER_UNAVAILABLE");}
 internal static NativePreparationOwnerParentBasisSource Read(INativeOwnerResources resources){
  if(resources==null)throw Invalid();try{
   var names=resources.Names();if(names==null||names.Length!=1||names[0]!=ResourceName||!resources.IsLocalEmbedded(ResourceName))throw Invalid();
   using(var input=resources.Open(ResourceName))using(var buffer=new MemoryStream()){
    if(input==null||!input.CanRead)throw Invalid();var block=new byte[1024];int count;
    while((count=input.Read(block,0,block.Length))!=0){if(count<0||buffer.Length+count>8192)throw Invalid();buffer.Write(block,0,count);}
    byte[] bytes=buffer.ToArray();try{var value=NativePreparationOwnerBridgeSource.Parse(bytes,false);NativePreparationOwnerBridgeSource.Exact(value,"schemaVersion,purpose,physicalNamespace,factoryId,factoryVersion,parentExeHash,parentAsarHash,parentHeaderHash");
     if(NativePreparationOwnerBridgeSource.Positive(value["schemaVersion"])!=1||NativePreparationOwnerBridgeSource.Text(value,"purpose")!="NATIVE_PREPARATION_PARENT_PACKAGE_BASIS"||NativePreparationOwnerBridgeSource.Text(value,"physicalNamespace")!="ANVIL_NATIVE_OWNER_FACTORY_V1")throw Invalid();
     return new NativePreparationOwnerParentBasisSource(value);
    }finally{Array.Clear(bytes,0,bytes.Length);Array.Clear(block,0,block.Length);}
   }
  }catch{throw Invalid();}
 }
 internal sealed class OwnAssemblyResources:INativeOwnerResources {
  // 생성자는 assembly/resource 조회도 수행하지 않는다.
  public string[] Names(){return typeof(NativePreparationOwnerParentBasisSource).Assembly.GetManifestResourceNames();}
  public bool IsLocalEmbedded(string name){var assembly=typeof(NativePreparationOwnerParentBasisSource).Assembly;var info=assembly.GetManifestResourceInfo(name);
   // CLR 공개 API는 manifest resource의 private flag 자체를 노출하지 않는다.
   // private 명시는 후속 정확 build 입력에서 고정한다. local/embedded는 여기서 실제 검산한다.
   return info!=null&&info.ReferencedAssembly==null&&info.FileName==null&&info.ResourceLocation==(ResourceLocation.Embedded|ResourceLocation.ContainedInManifestFile);
  }
  public Stream Open(string name){if(name!=ResourceName)throw Invalid();return typeof(NativePreparationOwnerParentBasisSource).Assembly.GetManifestResourceStream(ResourceName);}
 }
}
