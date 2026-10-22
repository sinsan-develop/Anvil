using System;
using System.Text;

// SOURCE ONLY: 빌드/실행하지 않았다. Node 시험은 DPAPI 성공 증거가 아니다.
internal static class ProviderHandleStoreTests {
 internal static void Run() {
  Roundtrip("THREAD", "null");
  Roundtrip("TURN", "\"qa-turn\"");
 }
 static void Roundtrip(string kind,string turnJson) {
  string binding = new string('a',64);
  byte[] plain=Encoding.UTF8.GetBytes("{\"bindingHash\":\""+binding+"\",\"schemaVersion\":1,\"threadId\":\"qa-thread\",\"turnId\":"+turnJson+"}");
  byte[] cipher=null,roundtrip=null;
  try {
   cipher=ProviderHandleStore.ProtectCapsule(plain,binding,kind);
   roundtrip=ProviderHandleStore.UnprotectCapsule(cipher,binding,kind);
   if(Convert.ToBase64String(plain)!=Convert.ToBase64String(roundtrip))throw new Exception("CAPSULE_ROUNDTRIP_MISMATCH");
   Reject(delegate {ProviderHandleStore.UnprotectCapsule(cipher,new string('b',64),kind);});
   Reject(delegate {ProviderHandleStore.UnprotectCapsule(cipher,binding,kind=="THREAD"?"TURN":"THREAD");});
   byte[] changed=(byte[])cipher.Clone();
   try {changed[0]^=1;Reject(delegate {ProviderHandleStore.UnprotectCapsule(changed,binding,"THREAD");});}
   finally {Array.Clear(changed,0,changed.Length);}
   Reject(delegate {ProviderHandleStore.ProtectCapsule(Encoding.UTF8.GetBytes(" "+Encoding.UTF8.GetString(plain)),binding,"THREAD");});
   Reject(delegate {ProviderHandleStore.ProtectCapsule(new byte[4097],binding,"THREAD");});
   Reject(delegate {ProviderHandleStore.UnprotectCapsule(new byte[8193],binding,"THREAD");});
   Reject(delegate {ProviderHandleStore.ProtectCapsule(new byte[]{255},binding,"THREAD");});
  } finally {
   Array.Clear(plain,0,plain.Length);
   if(cipher!=null)Array.Clear(cipher,0,cipher.Length);
   if(roundtrip!=null)Array.Clear(roundtrip,0,roundtrip.Length);
  }
 }
 static void Reject(Action action) {
  try {action();}catch(InvalidOperationException e){if(e.Message=="PROVIDER_HANDLE_CAPSULE_INVALID"&&e.InnerException==null)return;throw;}
  throw new Exception("EXPECTED_CAPSULE_REJECTION");
 }
}
