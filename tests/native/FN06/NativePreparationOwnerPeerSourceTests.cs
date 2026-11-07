// 실제 OS/파일 호출 없는 미래 C# 시험 source. 이번 compile/RunAll NOT_RUN.
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
internal static class NativePreparationOwnerPeerSourceTests {
 internal sealed class Kernel:NativeOwnerKernel {
  internal uint Type=3,Flags,OtherServer;internal bool Alive=true,WrongAsar,ChangedFile,ChangeDuringHash;internal long Created=1;internal int Opens,Closes,StreamOpens;
  internal Stream Reader=new MemoryStream(),Writer=new MemoryStream();readonly Dictionary<IntPtr,NativeOwnerFileObservation> files=new Dictionary<IntPtr,NativeOwnerFileObservation>();readonly HashSet<IntPtr> closed=new HashSet<IntPtr>();int next=100;
  internal override IntPtr Standard(int n){return new IntPtr(n==-10?1:2);}internal override uint FileType(IntPtr h){return Type;}internal override uint PipeFlags(IntPtr h){return Flags;}
  internal override uint ServerPid(IntPtr h){return h==new IntPtr(2)&&OtherServer!=0?OtherServer:77;}internal override uint SelfPid(){return 88;}
  internal override IntPtr OpenProcess(uint pid){Opens++;return new IntPtr(pid==77?3:4);}
  internal override NativeOwnerProcessObservation Process(IntPtr h){return h==new IntPtr(3)?new NativeOwnerProcessObservation(77,Created,@"C:\Anvil\Anvil.exe",Alive):new NativeOwnerProcessObservation(88,2,@"C:\Anvil\NativeOwner.exe",true);}
  internal override IntPtr OpenFile(string path,bool directory){var h=new IntPtr(next++);files[h]=new NativeOwnerFileObservation("file:"+h,path,directory?0:100,directory?16u:0u);return h;}
  internal override NativeOwnerFileObservation File(IntPtr h){var f=files[h];return ChangedFile?new NativeOwnerFileObservation(f.Identity+"changed",f.Path,f.Length,f.Attributes):f;}
  internal override NativeOwnerFileHashes HashFile(IntPtr h,bool asar,Action check){check();if(ChangeDuringHash){Created++;check();}var f=files[h];return new NativeOwnerFileHashes(new string(asar?(WrongAsar?'f':'b'):f.Path.EndsWith("Anvil.exe")?'a':'d',64),asar?new string('c',64):null);}
  internal override Stream Input(IntPtr h){StreamOpens++;return Reader;}internal override Stream Output(IntPtr h){StreamOpens++;return Writer;}
  internal override bool Close(IntPtr h){if(!closed.Add(h))throw new InvalidOperationException("DUPLICATE_OWNED_CLOSE");Closes++;return true;}
 }
 internal static NativeOwnerBudget Budget(){return new NativeOwnerBudget(()=>DateTime.SpecifyKind(new DateTime(2030,1,1),DateTimeKind.Utc),()=>0);}
 internal static NativePreparationOwnerParentBasisSource Basis(){return NativePreparationOwnerParentBasisSource.Read(new NativePreparationOwnerParentBasisSourceTests.Resources());}
 internal static void RunAll(){var k=new Kernel();var lease=NativePreparationOwnerPeerSource.Open(Basis(),k,Budget());lease.Check();NativePreparationOwnerParentBasisSourceTests.Require(lease.HelperHash==new string('d',64));lease.Dispose();int closed=k.Closes;lease.Dispose();NativePreparationOwnerParentBasisSourceTests.Require(closed>0&&closed==k.Closes&&lease.CleanupSettled);
  foreach(var bad in new[]{new Kernel{Type=1},new Kernel{Flags=1},new Kernel{OtherServer=99},new Kernel{Alive=false},new Kernel{WrongAsar=true},new Kernel{ChangeDuringHash=true}})NativePreparationOwnerParentBasisSourceTests.Reject(()=>NativePreparationOwnerPeerSource.Open(Basis(),bad,Budget()));
  k=new Kernel();lease=NativePreparationOwnerPeerSource.Open(Basis(),k,Budget());k.Created++;NativePreparationOwnerParentBasisSourceTests.Reject(()=>lease.Check());lease.Dispose();
  k=new Kernel();lease=NativePreparationOwnerPeerSource.Open(Basis(),k,Budget());k.ChangedFile=true;NativePreparationOwnerParentBasisSourceTests.Reject(()=>lease.Check());lease.Dispose();
  k=new Kernel();lease=NativePreparationOwnerPeerSource.Open(Basis(),k,Budget());lease.OpenStreams();lease.BeginIO();lease.Dispose();NativePreparationOwnerParentBasisSourceTests.Require(k.Closes==0&&!lease.CleanupSettled&&!lease.WhenDrained.IsCompleted);lease.EndIO();NativePreparationOwnerParentBasisSourceTests.Require(k.Closes>0&&lease.CleanupSettled&&lease.WhenDrained.IsCompleted);int n=k.Closes;lease.Dispose();NativePreparationOwnerParentBasisSourceTests.Require(n==k.Closes);
 }
}
