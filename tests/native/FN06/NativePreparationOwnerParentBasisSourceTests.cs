// source 시험만 작성한다. compile/RunAll/실제 assembly resource 조회는 실행하지 않는다.
using System;
using System.IO;
using System.Text;
internal static class NativePreparationOwnerParentBasisSourceTests {
 internal const string Id="be140001-0000-4000-8000-000000000011";
 internal sealed class Resources:INativeOwnerResources {
  internal byte[] Bytes;internal string Raw=Valid();internal string[] Entries=new[]{NativePreparationOwnerParentBasisSource.ResourceName};internal bool Local=true;internal int Opens;
  public string[] Names(){return Entries;}public bool IsLocalEmbedded(string name){return Local;}public Stream Open(string name){Opens++;return new MemoryStream(Bytes??Encoding.UTF8.GetBytes(Raw),false);}
 }
 internal static string Valid(){return "{\"factoryId\":\""+Id+"\",\"factoryVersion\":1,\"parentAsarHash\":\""+new string('b',64)+"\",\"parentExeHash\":\""+new string('a',64)+"\",\"parentHeaderHash\":\""+new string('c',64)+"\",\"physicalNamespace\":\"ANVIL_NATIVE_OWNER_FACTORY_V1\",\"purpose\":\"NATIVE_PREPARATION_PARENT_PACKAGE_BASIS\",\"schemaVersion\":1}";}
 internal static void Require(bool value){if(!value)throw new InvalidOperationException("HOST_SOURCE_EXPECTATION");}
 internal static void Reject(Action body){bool rejected=false;try{body();}catch(InvalidOperationException e){if(e.Message!="NATIVE_OWNER_UNAVAILABLE")throw;rejected=true;}Require(rejected);}
 internal static void RunAll(){var r=new Resources();var b=NativePreparationOwnerParentBasisSource.Read(r);Require(b.FactoryId==Id&&b.FactoryVersion==1&&r.Opens==1);
  r=new Resources{Entries=new string[0]};Reject(()=>NativePreparationOwnerParentBasisSource.Read(r));Require(r.Opens==0);
  r=new Resources{Entries=new[]{NativePreparationOwnerParentBasisSource.ResourceName,NativePreparationOwnerParentBasisSource.ResourceName}};Reject(()=>NativePreparationOwnerParentBasisSource.Read(r));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Local=false}));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Raw=Valid().Replace("\"schemaVersion\":1","\"schemaVersion\":1,\"schemaVersion\":1")}));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Raw=new string('x',8193)}));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Raw=Valid().Replace(new string('a',64),"bad")}));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Bytes=new byte[]{255}}));
  Reject(()=>NativePreparationOwnerParentBasisSource.Read(new Resources{Raw=Valid().Replace(new string('a',64),new string('0',64))}));
 }
}
