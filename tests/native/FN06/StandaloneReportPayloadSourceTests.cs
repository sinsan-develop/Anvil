// 미래 순수 SOURCE만. compile/RunAll/Capture/worker/OS 실행하지 않았다.
// 이 시험은 직렬화 정보 대조만 다루며 peer/origin/ACK/완료 권위를 검증하지 않는다.
using System;
using System.IO;
internal static class StandaloneReportPayloadSourceTests
{
    const string Run="r1-source",Commit="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Report="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    static readonly DateTime Issued=new DateTime(638000000000000000L,DateTimeKind.Utc);
    static readonly DateTime Until=new DateTime(638000000300000000L,DateTimeKind.Utc);
    // 아래 offset은 magic20/run9/commit40/report32 code unit인 수기 계약 기준이다.
    const int VersionOffset=44,RunLengthOffset=48,IssuedOffset=154,UntilOffset=162,ReportLengthOffset=170,RowCountOffset=238,FirstRowCountOffset=242;
    static string[][] Rows()
    {
        return new[]{new string[0],new[]{"","\0\uD800|\r\n\uDC00"},new[]{"ok"},new string[0],new string[0],new string[0],new string[0],new string[0],new string[0]};
    }
    // 제품 encoder/decoder를 사용하지 않는 시험 전용 binary 작성이다.
    static void Text(BinaryWriter writer,string value)
    {
        writer.Write((uint)value.Length);foreach(char codeUnit in value)writer.Write((ushort)codeUnit);
    }
    static byte[] Payload(string[][] rows)
    {
        using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream))
        {
            Text(writer,"ANVIL.QA.C_REPORT.V1");writer.Write((uint)1);Text(writer,Run);Text(writer,Commit);
            writer.Write(Issued.Ticks);writer.Write(Until.Ticks);Text(writer,Report);writer.Write((uint)rows.Length);
            foreach(string[] row in rows){writer.Write((uint)row.Length);foreach(string value in row)Text(writer,value);}
            writer.Flush();return stream.ToArray();
        }
    }
    static void Validate(byte[] payload,string[][] rows)
    {DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(payload,Run,Commit,Issued,Until,Report,rows);}
    static void Reject(Action action)
    {
        bool rejected=false;try{action();}
        catch(InvalidOperationException error)
        {if(error.Message!="DEVELOPMENT_RECOVERY_NATIVE_UNVERIFIED"||error.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("REPORT_PAYLOAD_REJECTION_EXPECTED");
    }
    static byte[] Change32(byte[] original,int offset,uint value)
    {
        byte[] bytes=(byte[])original.Clone();for(int index=0;index<4;index++)bytes[offset+index]=(byte)(value>>(8*index));return bytes;
    }
    static byte[] Change64(byte[] original,int offset,long value)
    {
        byte[] bytes=(byte[])original.Clone();for(int index=0;index<8;index++)bytes[offset+index]=(byte)((ulong)value>>(8*index));return bytes;
    }
    static void ExactRowsAndRawCodeUnitsArePreserved()
    {
        // 제거될 방어: decode 중 빈 행/빈 문자열 생략 또는 invalid surrogate 치환.
        string[][] rows=Rows();byte[] bytes=Payload(rows);
        if(bytes.Length!=306||bytes[0]!=20||bytes[4]!=65||bytes[5]!=0||bytes[VersionOffset]!=1||bytes[RowCountOffset]!=9||bytes[FirstRowCountOffset]!=0)
            throw new InvalidOperationException("REPORT_TEST_LITERAL_LAYOUT_INVALID");
        Validate(bytes,rows);
        string[][] decoded=DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(bytes,Run,Commit,Issued,Until,Report);
        if(decoded.Length!=9||decoded[0].Length!=0||decoded[1][1]!=rows[1][1])throw new InvalidOperationException("STRICT_DECODE_RAW_ROWS_EXPECTED");
        decoded[1][1]="changed";
        string[][] again=DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(bytes,Run,Commit,Issued,Until,Report);
        if(again[1][1]!=rows[1][1])throw new InvalidOperationException("STRICT_DECODE_PRIVATE_ROWS_EXPECTED");
        string[][] changed=Rows();changed[1][1]="\0\uFFFD|\r\n\uFFFD";Reject(()=>Validate(bytes,changed));
        changed=Rows();changed[0]=new[]{""};Reject(()=>Validate(bytes,changed));
        changed=Rows();changed[2][0]="OK";Reject(()=>Validate(bytes,changed));
        changed=Rows();string[] swap=changed[1];changed[1]=changed[2];changed[2]=swap;Reject(()=>Validate(bytes,changed));
    }
    static void EveryTruncationAndTrailingByteAreRejected()
    {
        // 제거될 방어: remaining 검사 또는 마지막 EOF의 정확 일치.
        string[][] rows=Rows();byte[] bytes=Payload(rows);
        for(int length=0;length<bytes.Length;length++)
        {byte[] cut=new byte[length];Array.Copy(bytes,cut,length);Reject(()=>Validate(cut,rows));}
        byte[] extra=new byte[bytes.Length+1];Array.Copy(bytes,extra,bytes.Length);Reject(()=>Validate(extra,rows));
        Reject(()=>Validate(null,rows));Reject(()=>Validate(new byte[16385],rows));
    }
    static void HeaderAndOriginalIdentityAreMatched()
    {
        // 제거될 방어: magic/version/run/commit/reportId 비교 중 어느 하나.
        string[][] rows=Rows();byte[] bytes=Payload(rows),bad=(byte[])bytes.Clone();bad[4]=66;Reject(()=>Validate(bad,rows));
        Reject(()=>Validate(Change32(bytes,VersionOffset,0),rows));Reject(()=>Validate(Change32(bytes,VersionOffset,2),rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,"r1-other",Commit,Issued,Until,Report,rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,new string('c',40),Issued,Until,Report,rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,Commit,Issued,Until,new string('c',32),rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,Commit,Issued.AddTicks(1),Until,Report,rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,Commit,Issued,Until.AddTicks(1),Report,rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,Commit,DateTime.SpecifyKind(Issued,DateTimeKind.Unspecified),Until,Report,rows));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.ValidateOriginal(bytes,Run,Commit,Issued,Issued,Report,rows));
    }
    static void InvalidTicksAndUntrustedCountsAreRejectedBeforeAllocation()
    {
        // 제거될 방어: signed tick 범위/순서, UInt32 count 상한 확인 전 int 변환.
        string[][] rows=Rows();byte[] bytes=Payload(rows);
        foreach(long ticks in new[]{-1L,0L,DateTime.MaxValue.Ticks+1,long.MaxValue})
        {Reject(()=>Validate(Change64(bytes,IssuedOffset,ticks),rows));Reject(()=>Validate(Change64(bytes,UntilOffset,ticks),rows));}
        Reject(()=>Validate(Change64(bytes,UntilOffset,Issued.Ticks),rows));
        foreach(uint count in new[]{0U,8U,10U,0x80000000U,UInt32.MaxValue})Reject(()=>Validate(Change32(bytes,RowCountOffset,count),rows));
        foreach(uint count in new[]{9U,0x80000000U,UInt32.MaxValue})Reject(()=>Validate(Change32(bytes,FirstRowCountOffset,count),rows));
        foreach(uint count in new[]{257U,0x80000000U,UInt32.MaxValue})
        {
            Reject(()=>Validate(Change32(bytes,0,count),rows));Reject(()=>Validate(Change32(bytes,RunLengthOffset,count),rows));
            Reject(()=>Validate(Change32(bytes,ReportLengthOffset,count),rows));
            Reject(()=>Validate(Change32(bytes,254,count),rows)); // 둘째 행 둘째 field의 text 길이
        }
        string[][] wrong=Rows();wrong[1]=new string[9];Reject(()=>Validate(bytes,wrong));
        wrong=Rows();wrong[1]=null;Reject(()=>Validate(bytes,wrong));
        wrong=Rows();wrong[2][0]=null;Reject(()=>Validate(bytes,wrong));
        wrong=Rows();wrong[2][0]=new string('x',257);Reject(()=>Validate(bytes,wrong));
        Reject(()=>Validate(bytes,null));Reject(()=>Validate(bytes,new string[8][]));
    }
    static void FieldAndTotalByteLimitsAreExact()
    {
        // 제거될 방어: 256 code unit/8 field/16384 bytes 경계의 > / >= 또는 payload 전체 cap.
        string[][] rows=Rows();rows[2]=new string[8];for(int field=0;field<8;field++)rows[2][field]="";
        rows[2][0]=new string('x',256);Validate(Payload(rows),rows);
        rows[2][0]=new string('x',257);Reject(()=>Validate(Payload(rows),rows));
        rows=Rows();rows[2]=new string[9];for(int field=0;field<9;field++)rows[2][field]="";Reject(()=>Validate(Payload(rows),rows));
        // Header242 + 행count36 + 31개의 (4+512) + (4+106) = 16384.
        rows=new string[9][];int left=31;
        for(int row=0;row<9;row++)
        {
            int fields=Math.Min(left,8);rows[row]=new string[fields];left-=fields;
            for(int field=0;field<fields;field++)rows[row][field]=new string('x',256);
        }
        rows[4]=new[]{new string('y',53)};byte[] boundary=Payload(rows);
        if(boundary.Length!=16384)throw new InvalidOperationException("REPORT_TEST_CAP_LAYOUT_INVALID");
        Validate(boundary,rows);rows[4][0]+= "z";Reject(()=>Validate(Payload(rows),rows));
    }
    internal static void RunAll()
    {
        ExactRowsAndRawCodeUnitsArePreserved();EveryTruncationAndTrailingByteAreRejected();HeaderAndOriginalIdentityAreMatched();
        InvalidTicksAndUntrustedCountsAreRejectedBeforeAllocation();FieldAndTotalByteLimitsAreExact();
    }
}