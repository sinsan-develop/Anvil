// 신규 합성 준비 worker SOURCE. D1에서 컴파일/호출/프로세스 실행하지 않는다.
// 존재·종료는 인증/OS 소유·writer 회수·파일 sandbox 증명이 아니다.
using System;
using System.Diagnostics;
using System.Globalization;
using System.Threading;
namespace Anvil.Native.OwnershipEvidence
{
    internal sealed class OwnershipEvidenceWorkerProfile
    {
        public string RunId { get; private set; }
        public long Generation { get; private set; }
        public DateTime ExpiresAt { get; private set; }
        public TimeSpan MaximumElapsed { get; private set; }
        private OwnershipEvidenceWorkerProfile() { }
        private static InvalidOperationException Invalid()
        {
            return new InvalidOperationException("OWNERSHIP_EVIDENCE_WORKER_PROFILE_INVALID");
        }
        // 순수 입력 검사. 기존 QA root/run/기한 또는 자유 실행 profile을 수용하지 않는다.
        public static OwnershipEvidenceWorkerProfile Parse(string[] input, DateTime now)
        {
            if (input == null || input.Length != 3 || now.Kind != DateTimeKind.Utc) throw Invalid();
            Guid run;
            long generation;
            DateTime expires;
            if (input[0] == null || input[0].Length != 36 ||
                !Guid.TryParseExact(input[0], "D", out run) || run.ToString("D") != input[0] ||
                "12345".IndexOf(input[0][14]) < 0 || "89ab".IndexOf(input[0][19]) < 0 ||
                input[1] == null || input[1].Length < 1 || input[1].Length > 16 ||
                !long.TryParse(input[1], NumberStyles.None, CultureInfo.InvariantCulture, out generation) ||
                generation < 1 || generation > 9007199254740991L ||
                generation.ToString(CultureInfo.InvariantCulture) != input[1] ||
                input[2] == null || input[2].Length != 24 ||
                !DateTime.TryParseExact(input[2], "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out expires) ||
                expires.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture) != input[2]) throw Invalid();
            TimeSpan budget = expires - now;
            if (budget <= TimeSpan.Zero || budget > TimeSpan.FromSeconds(120)) throw Invalid();
            return new OwnershipEvidenceWorkerProfile
            {
                RunId = input[0], Generation = generation, ExpiresAt = expires, MaximumElapsed = budget
            };
        }
    }
    internal static class OwnershipEvidenceWorker
    {
        // 외부 명령/파일/Secret/stdin/out/network/자식 생성·resume/회수 기능은 없다.
        // 미래 Host가 별도 허가 아래 suspended로 생성할 합성 대상일 뿐 Agent가 아니다.
        public static int Main(string[] input)
        {
            try
            {
                if (Environment.OSVersion.Platform != PlatformID.Win32NT) return 64;
                long start = Stopwatch.GetTimestamp(), frequency = Stopwatch.Frequency;
                DateTime now = DateTime.UtcNow;
                var profile = OwnershipEvidenceWorkerProfile.Parse(input, now);
                if (frequency <= 0) return 70;
                while (true)
                {
                    long current = Stopwatch.GetTimestamp();
                    if (current < start) return 70;
                    double elapsedMs = ((double)current - start) * 1000.0 / frequency;
                    double remainingMs = profile.MaximumElapsed.TotalMilliseconds - elapsedMs;
                    if (remainingMs <= 0 || DateTime.UtcNow >= profile.ExpiresAt) return 0;
                    // 고정 monotonic budget은 wall clock이 뒤로 가도 늘어나지 않는다.
                    Thread.Sleep((int)Math.Max(1, Math.Min(25, Math.Ceiling(remainingMs))));
                }
            }
            catch
            {
                // 원 예외·인자·환경 경로를 stdout/stderr에 노출하지 않는다.
                return 64;
            }
        }
    }
}
