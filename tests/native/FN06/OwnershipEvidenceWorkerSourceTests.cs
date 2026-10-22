// D1 시험 SOURCE만. 컴파일/실행 NOT_RUN; 미래 승인된 harness가 RunAll을 호출한다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceWorkerSourceTests
{
    private const string Run = "70000000-0000-4000-8000-000000000001";
    private static readonly DateTime Now = new DateTime(2026, 10, 23, 0, 0, 0, DateTimeKind.Utc);
    private static void Reject(string[] input)
    {
        bool rejected = false;
        try { OwnershipEvidenceWorkerProfile.Parse(input, Now); }
        catch (InvalidOperationException) { rejected = true; }
        if (!rejected) throw new InvalidOperationException("WORKER_PROFILE_REJECTION_EXPECTED");
    }
    public static void RunAll()
    {
        var profile = OwnershipEvidenceWorkerProfile.Parse(new[] { Run, "1", "2026-10-23T00:00:02.000Z" }, Now);
        if (profile.RunId != Run || profile.Generation != 1 || profile.ExpiresAt != Now.AddSeconds(2) ||
            profile.MaximumElapsed != TimeSpan.FromSeconds(2)) throw new InvalidOperationException("WORKER_PROFILE_MISMATCH");
        Reject(null);
        Reject(new[] { Run, "1", "2026-10-23T00:00:02.000Z", "shell" });
        Reject(new[] { "not-a-run", "1", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { "00000000-0000-0000-0000-000000000000", "1", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { "70000000-0000-6000-8000-000000000001", "1", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { "70000000-0000-4000-7000-000000000001", "1", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { Run, "0", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { Run, "+1", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { Run, "01", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { Run, "9007199254740992", "2026-10-23T00:00:02.000Z" });
        Reject(new[] { Run, "1", "2026-10-23T00:00:00.000Z" });
        Reject(new[] { Run, "1", "2026-10-22T23:59:59.999Z" });
        Reject(new[] { Run, "1", "2026-10-23T00:02:00.001Z" });
        Reject(new[] { Run, "1", "2026-10-23T00:00:02+09:00" });
        Reject(new[] { Run, "1", "2026-10-23T00:00:02Z" });
    }
}
