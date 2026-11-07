using System;
using System.Text;

// SOURCE ONLY / NOT EXECUTED. Requires separately approved fixed-root preparation
// and native execution. Never add this to a default build/run or an automatic startup.
internal static class ProviderHandleFilesTests {
 internal static void RunWithSeparatelyPreparedRoot() {
  const string id="cb8ab6b1-149c-4b54-af79-bfe3095a4d13";
  string binding=new string('a',64),captured=DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"),until=DateTime.UtcNow.AddMinutes(5).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
  byte[] plain=Encoding.UTF8.GetBytes("{\"bindingHash\":\""+binding+"\",\"schemaVersion\":1,\"threadId\":\"qa-file-thread\",\"turnId\":null}");
  byte[] read=null;
  try {
   string digest=ProviderHandleFiles.CapturePrepared(id,binding,"THREAD",captured,until,plain);
   if(digest!=ProviderHandleFiles.CapturePrepared(id,binding,"THREAD",captured,until,plain))throw new Exception("CIPHERTEXT_REPLACED_ON_RETRY");
   read=ProviderHandleFiles.ResolvePrepared(id,binding,"THREAD",captured,until,digest);
   if(Convert.ToBase64String(read)!=Convert.ToBase64String(plain))throw new Exception("FILE_CAPSULE_MISMATCH");
   Reject(delegate {ProviderHandleFiles.ResolvePrepared(id,binding,"THREAD",captured,until,new string('b',64));});
   Reject(delegate {ProviderHandleFiles.ResolvePrepared(id,binding,"THREAD",captured,"2020-01-01T00:00:00.000Z",digest);});
   Reject(delegate {ProviderHandleFiles.CapturePrepared("../outside",binding,"THREAD",captured,until,plain);});
   // No cleanup here: even QA ciphertext needs exact separately approved cleanup.
   // A failed operation intentionally retains its lock, so destructive fault scenarios
   // must each use separately prepared/approved resources, not this normal retry case.
  }finally{Array.Clear(plain,0,plain.Length);if(read!=null)Array.Clear(read,0,read.Length);}
 }
 static void Reject(Action action) {
  try {action();}catch(InvalidOperationException e){if(e.Message=="PROVIDER_HANDLE_FILE_UNAVAILABLE"&&e.InnerException==null)return;throw;}
  throw new Exception("EXPECTED_FILE_REJECTION");
 }
}
