using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

// Reads one installed body. It does not verify a signature, select an issuer, or authorize custody.
internal static class NormalStartKeeperInstallationSlotSource
{
    const int MaximumBodyBytes = 8192, ProtectedRegistrationIndex = 4;
    const string SystemSid = "S-1-5-18";
    const uint DriveFixed = 3, FileOpen = 1, ShareRead = 1, VolumeNameGuid = 1;
    const uint ReadData = 1, Traverse = 0x20, ReadAttributes = 0x80, ReadControl = 0x20000, Synchronize = 0x100000;
    const uint DirectoryFile = 1, SyncNonAlert = 0x20, NonDirectoryFile = 0x40, OpenReparsePoint = 0x200000;
    const uint ObjCaseInsensitive = 0x40, ObjDontReparse = 0x1000, BackupSemantics = 0x02000000;
    const uint DirectoryAttribute = 0x10, ReparseAttribute = 0x400;

    internal struct FileIdentity : IEquatable<FileIdentity>
    {
        internal readonly ulong Volume, Low, High;
        internal FileIdentity(ulong volume, ulong low, ulong high) { Volume = volume; Low = low; High = high; }
        internal bool Usable { get { return Volume != 0 && (Low != 0 || High != 0); } }
        public bool Equals(FileIdentity other) { return Volume == other.Volume && Low == other.Low && High == other.High; }
    }

    // These expectations must be supplied by the independent protected installation source.
    internal sealed class Binding
    {
        internal readonly FileIdentity ProgramData;
        internal readonly string SignerSid, KeeperSid;
        internal readonly DateTime ExpiresAt;
        readonly string[] parts;
        readonly FileIdentity[] identities;
        internal Binding(FileIdentity programData, FileIdentity[] installed, string installation, string registration,
            long epoch, string signer, string keeper, DateTime expiresAt)
        {
            if (!programData.Usable || installed == null || installed.Length != 7 || !CanonicalId(installation)
                || !CanonicalId(registration) || epoch < 1 || expiresAt.Kind != DateTimeKind.Utc
                || !CanonicalSid(signer) || !CanonicalSid(keeper) || signer == keeper || signer == SystemSid || keeper == SystemSid)
                throw Invalid();
            ProgramData = programData;
            SignerSid = signer;
            KeeperSid = keeper;
            ExpiresAt = expiresAt;
            parts = new[] { "Anvil", "KeeperInstall", "v1", installation, registration, epoch.ToString(CultureInfo.InvariantCulture), "installation.json" };
            identities = (FileIdentity[])installed.Clone();
            var seen = new HashSet<FileIdentity> { ProgramData };
            foreach (FileIdentity identity in identities)
                if (!identity.Usable || identity.Volume != ProgramData.Volume || !seen.Add(identity)) throw Invalid();
        }
        internal string[] SlotParts { get { return (string[])parts.Clone(); } }
        internal FileIdentity ExpectedAt(int index) { return identities[index]; }
    }

    sealed class SlotHandle : SafeHandleZeroOrMinusOneIsInvalid
    {
        internal bool CloseSucceeded { get; private set; }
        internal SlotHandle(IntPtr value) : base(true) { SetHandle(value); }
        protected override bool ReleaseHandle()
        {
            CloseSucceeded = CloseHandle(handle);
            return CloseSucceeded;
        }
    }

    sealed class Pin
    {
        internal readonly SlotHandle Handle;
        internal readonly Facts Initial;
        internal readonly bool Directory, Secured;
        internal Pin(SlotHandle handle, Facts facts, bool directory, bool secured)
        { Handle = handle; Initial = facts; Directory = directory; Secured = secured; }
    }

    struct Facts
    {
        internal FileIdentity Identity;
        internal long Size, Written, Changed;
        internal uint Attributes;
        internal bool Same(Facts other)
        { return Identity.Equals(other.Identity) && Size == other.Size && Written == other.Written && Changed == other.Changed && Attributes == other.Attributes; }
    }

    internal static byte[] Read(Binding expected, bool keeperSide, DesktopTrustKeyBudget budget, Action current)
    {
        if (expected == null || budget == null || current == null) throw Invalid();
        var read = budget.Slice(expected.ExpiresAt, 2000);
        string requiredSid = keeperSide ? expected.KeeperSid : expected.SignerSid;
        // Synchronous OS calls may return late. The budget rejects late results, without promising interruption.
        Action check = () => { current(); budget.Check(); read.Check(); };
        var owned = new List<SlotHandle>(24);
        var pins = new List<Pin>(24);
        byte[] payload = null;
        bool clean = true;
        try
        {
            check();
            CheckLocalSid(requiredSid);
            string known = KnownProgramData();
            check();
            SlotHandle parent = OpenVolume(known.Substring(0, 3), owned);
            FileIdentity volume = Observe(parent, true).Identity;
            PinHandle(parent, true, false, expected, volume, pins, check);
            string[] knownParts = known.Substring(3).Split('\\');
            if (knownParts.Length > 16) throw Invalid();
            foreach (string part in knownParts)
            {
                check();
                parent = Relative(parent, part, true, false, owned);
                PinHandle(parent, true, false, expected, volume, pins, check);
            }
            CompareExpected(pins[pins.Count - 1].Initial.Identity, expected.ProgramData, volume);
            string[] parts = expected.SlotParts;
            for (int i = 0; i < parts.Length; i++)
            {
                bool directory = i < parts.Length - 1, secured = i >= ProtectedRegistrationIndex;
                check();
                parent = Relative(parent, parts[i], directory, secured, owned);
                FileIdentity seen = PinHandle(parent, directory, secured, expected, volume, pins, check);
                CompareExpected(seen, expected.ExpectedAt(i), volume);
            }
            payload = AtRest(pins, expected, requiredSid, check);
        }
        finally
        {
            for (int i = owned.Count - 1; i >= 0; i--)
            {
                try { owned[i].Dispose(); clean &= owned[i].CloseSucceeded; }
                catch { clean = false; }
            }
            if (!clean)
            {
                if (payload != null) Array.Clear(payload, 0, payload.Length);
                throw new InvalidOperationException("NORMAL_START_KEEPER_INSTALLATION_SLOT_CLOSE_UNKNOWN");
            }
        }
        if (payload == null) throw Invalid();
        try { check(); CheckLocalSid(requiredSid); return payload; }
        catch { Array.Clear(payload, 0, payload.Length); throw; }
    }

    static byte[] AtRest(List<Pin> pins, Binding expected, string requiredSid, Action check)
    {
        CheckAll(pins, expected, requiredSid, check);
        var leaf = pins[pins.Count - 1];
        byte[] original = ReadExactly(leaf.Handle, leaf.Initial.Size, check);
        bool retained = false;
        try
        {
            CheckAll(pins, expected, requiredSid, check);
            byte[] readback = ReadExactly(leaf.Handle, leaf.Initial.Size, check);
            try { if (!SameBytes(original, readback)) throw Invalid(); }
            finally { Array.Clear(readback, 0, readback.Length); }
            CheckAll(pins, expected, requiredSid, check);
            retained = true;
            return original;
        }
        finally { if (!retained) Array.Clear(original, 0, original.Length); }
    }

    static bool SameBytes(byte[] first, byte[] second)
    {
        if (first.Length != second.Length) return false;
        for (int i = 0; i < first.Length; i++) if (first[i] != second[i]) return false;
        return true;
    }

    static byte[] ReadExactly(SlotHandle file, long length, Action check)
    {
        if (length < 1 || length > MaximumBodyBytes) throw Invalid();
        byte[] bytes = new byte[(int)length], buffer = new byte[Math.Min(4096, (int)length)], tail = new byte[1];
        bool retained = false;
        try
        {
            check();
            long position;
            if (!SetFilePointerEx(file.DangerousGetHandle(), 0, out position, 0) || position != 0) throw Invalid();
            uint actual;
            for (int offset = 0; offset < bytes.Length;)
            {
                check();
                uint count = (uint)Math.Min(buffer.Length, bytes.Length - offset);
                if (!ReadFile(file.DangerousGetHandle(), buffer, count, out actual, IntPtr.Zero) || actual == 0 || actual > count) throw Invalid();
                Buffer.BlockCopy(buffer, 0, bytes, offset, (int)actual);
                offset += (int)actual;
                check();
            }
            check();
            if (!ReadFile(file.DangerousGetHandle(), tail, 1, out actual, IntPtr.Zero) || actual != 0) throw Invalid();
            check();
            retained = true;
            return bytes;
        }
        finally
        {
            Array.Clear(buffer, 0, buffer.Length);
            Array.Clear(tail, 0, tail.Length);
            if (!retained) Array.Clear(bytes, 0, bytes.Length);
        }
    }

    static void CheckLocalSid(string expected)
    {
        using (var identity = WindowsIdentity.GetCurrent())
            if (identity.User == null || identity.User.Value != expected) throw Invalid();
    }

    static FileIdentity PinHandle(SlotHandle handle, bool directory, bool secured, Binding expected, FileIdentity volume, List<Pin> pins, Action check)
    {
        check();
        Facts facts = Observe(handle, directory);
        if (facts.Identity.Volume != volume.Volume) throw Invalid();
        if (secured) CheckAcl(handle, directory, expected);
        pins.Add(new Pin(handle, facts, directory, secured));
        check();
        return facts.Identity;
    }

    static void CompareExpected(FileIdentity seen, FileIdentity expected, FileIdentity volume)
    {
        if (!seen.Equals(expected) || seen.Volume != volume.Volume) throw Invalid();
    }

    static void CheckAll(List<Pin> pins, Binding expected, string requiredSid, Action check)
    {
        check();
        CheckLocalSid(requiredSid);
        foreach (Pin pin in pins)
        {
            check();
            if (!pin.Initial.Same(Observe(pin.Handle, pin.Directory))) throw Invalid();
            if (pin.Secured) CheckAcl(pin.Handle, pin.Directory, expected);
        }
        check();
    }

    static void CheckAcl(SlotHandle handle, bool directory, Binding expected)
    {
        IntPtr owner, group, acl, sacl, descriptor;
        uint status = GetSecurityInfo(handle.DangerousGetHandle(), 1, 5, out owner, out group, out acl, out sacl, out descriptor);
        try
        {
            if (status != 0 || descriptor == IntPtr.Zero || owner == IntPtr.Zero || acl == IntPtr.Zero) throw Invalid();
            uint size = GetSecurityDescriptorLength(descriptor);
            if (size < 20 || size > 8192) throw Invalid();
            byte[] bytes = new byte[(int)size];
            try
            {
                Marshal.Copy(descriptor, bytes, 0, bytes.Length);
                ValidateAcl(new RawSecurityDescriptor(bytes, 0), directory, expected);
            }
            finally { Array.Clear(bytes, 0, bytes.Length); }
        }
        finally { if (descriptor != IntPtr.Zero && LocalFree(descriptor) != IntPtr.Zero) throw Invalid(); }
    }

    static void ValidateAcl(RawSecurityDescriptor descriptor, bool directory, Binding expected)
    {
        if (descriptor.Owner == null || descriptor.Owner.Value != SystemSid
            || (descriptor.ControlFlags & ControlFlags.DiscretionaryAclProtected) == 0
            || (descriptor.ControlFlags & ControlFlags.DiscretionaryAclPresent) == 0
            || descriptor.DiscretionaryAcl == null || descriptor.DiscretionaryAcl.Count != 3) throw Invalid();
        int requiredAccess = (int)(ReadControl | ReadAttributes | Synchronize | (directory ? Traverse : ReadData));
        var seen = new HashSet<string>();
        foreach (GenericAce record in descriptor.DiscretionaryAcl)
        {
            var ace = record as CommonAce;
            if (ace == null || ace.IsCallback || ace.AceFlags != AceFlags.None || ace.AceQualifier != AceQualifier.AccessAllowed) throw Invalid();
            string sid = ace.SecurityIdentifier.Value;
            if (!seen.Add(sid) || !(sid == SystemSid ? ace.AccessMask == (int)FileSystemRights.FullControl
                : (sid == expected.SignerSid || sid == expected.KeeperSid) && ace.AccessMask == requiredAccess)) throw Invalid();
        }
        if (!seen.Contains(SystemSid) || !seen.Contains(expected.SignerSid) || !seen.Contains(expected.KeeperSid)) throw Invalid();
    }

    static SlotHandle OpenVolume(string drive, List<SlotHandle> owned)
    {
        if (GetDriveTypeW(drive) != DriveFixed) throw Invalid();
        var handle = Own(CreateFileW(@"\\?\" + drive, ReadAttributes | Traverse | Synchronize, ShareRead,
            IntPtr.Zero, 3, BackupSemantics | OpenReparsePoint, IntPtr.Zero), owned);
        var volumePath = new StringBuilder(64);
        uint n = GetFinalPathNameByHandleW(handle.DangerousGetHandle(), volumePath, (uint)volumePath.Capacity, VolumeNameGuid);
        Guid volume;
        string root = volumePath.ToString();
        if (n != 49 || root.Length != 49 || !root.StartsWith(@"\\?\Volume{", StringComparison.OrdinalIgnoreCase)
            || root[47] != '}' || root[48] != '\\' || !Guid.TryParseExact(root.Substring(11, 36), "D", out volume) || volume == Guid.Empty
            || GetDriveTypeW(root) != DriveFixed) throw Invalid();
        var fs = new StringBuilder(32);
        uint serial, component, flags;
        if (!GetVolumeInformationByHandleW(handle.DangerousGetHandle(), null, 0, out serial, out component, out flags, fs, (uint)fs.Capacity)
            || !String.Equals(fs.ToString(), "NTFS", StringComparison.Ordinal)) throw Invalid();
        return handle;
    }

    static SlotHandle Relative(SlotHandle parent, string part, bool directory, bool secured, List<SlotHandle> owned)
    {
        if (part.Length < 1 || part.Length > 255 || part == "." || part == ".." || part.EndsWith(".", StringComparison.Ordinal)
            || part.EndsWith(" ", StringComparison.Ordinal) || part.IndexOfAny(new[] { '\\', '/', ':', '\0' }) >= 0) throw Invalid();
        IntPtr chars = IntPtr.Zero, name = IntPtr.Zero;
        try
        {
            chars = Marshal.StringToHGlobalUni(part);
            name = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));
            var value = new UnicodeString { Length = (ushort)(part.Length * 2), MaximumLength = (ushort)((part.Length + 1) * 2), Buffer = chars };
            Marshal.StructureToPtr(value, name, false);
            var objectAttributes = new ObjectAttributes { Length = Marshal.SizeOf(typeof(ObjectAttributes)),
                RootDirectory = parent.DangerousGetHandle(), ObjectName = name, Attributes = ObjCaseInsensitive | ObjDontReparse };
            uint access = ReadAttributes | Synchronize | (secured ? ReadControl : 0) | (directory ? Traverse : ReadData);
            uint options = OpenReparsePoint | SyncNonAlert | (directory ? DirectoryFile : NonDirectoryFile);
            IntPtr handle;
            IoStatus status;
            int result = NtCreateFile(out handle, access, ref objectAttributes, out status, IntPtr.Zero, 0, ShareRead, FileOpen, options, IntPtr.Zero, 0);
            SlotHandle ownedHandle = Valid(handle) ? Own(handle, owned) : null;
            if (result != 0 || status.Status != IntPtr.Zero || ownedHandle == null) throw Invalid();
            return ownedHandle;
        }
        finally
        {
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (chars != IntPtr.Zero) Marshal.FreeHGlobal(chars);
        }
    }

    static SlotHandle Own(IntPtr value, List<SlotHandle> owned)
    {
        if (!Valid(value)) throw Invalid();
        var handle = new SlotHandle(value);
        owned.Add(handle);
        return handle;
    }

    static bool Valid(IntPtr handle) { return handle != IntPtr.Zero && handle != new IntPtr(-1); }

    static Facts Observe(SlotHandle handle, bool directory)
    {
        IntPtr raw = handle.DangerousGetHandle();
        FileId id;
        BasicInfo basic;
        StandardInfo standard;
        AttributeTag tag;
        if (GetFileType(raw) != 1
            || !GetFileId(raw, 18, out id, (uint)Marshal.SizeOf(typeof(FileId)))
            || !GetBasic(raw, 0, out basic, (uint)Marshal.SizeOf(typeof(BasicInfo)))
            || !GetStandard(raw, 1, out standard, (uint)Marshal.SizeOf(typeof(StandardInfo)))
            || !GetTag(raw, 9, out tag, (uint)Marshal.SizeOf(typeof(AttributeTag)))) throw Invalid();
        var identity = new FileIdentity(id.Volume, id.Low, id.High);
        if (!identity.Usable || (tag.Attributes & ReparseAttribute) != 0 || tag.ReparseTag != 0 || tag.Attributes != basic.Attributes
            || standard.DeletePending != 0 || (standard.Directory != 0) != directory || ((tag.Attributes & DirectoryAttribute) != 0) != directory
            || !directory && (standard.NumberOfLinks != 1 || standard.EndOfFile < 1 || standard.EndOfFile > MaximumBodyBytes)) throw Invalid();
        // The size and timestamps of shared directories can change for unrelated entries.
        return new Facts { Identity = identity, Size = directory ? 0 : standard.EndOfFile, Written = directory ? 0 : basic.Written,
            Changed = directory ? 0 : basic.Changed, Attributes = tag.Attributes };
    }

    static string KnownProgramData()
    {
        Guid folder = new Guid("62AB5D82-FDC1-4DC3-A9DD-070D1D495D97");
        IntPtr name = IntPtr.Zero;
        try
        {
            if (SHGetKnownFolderPath(ref folder, 0x4000, IntPtr.Zero, out name) != 0 || name == IntPtr.Zero) throw Invalid();
            string known = Marshal.PtrToStringUni(name);
            if (String.IsNullOrEmpty(known) || known.Length <= 3 || known.Length > 1024 || known[1] != ':' || known[2] != '\\'
                || !((known[0] >= 'A' && known[0] <= 'Z') || (known[0] >= 'a' && known[0] <= 'z'))
                || !String.Equals(Path.GetFullPath(known), known, StringComparison.Ordinal) || known.EndsWith("\\", StringComparison.Ordinal)) throw Invalid();
            return known;
        }
        finally { if (name != IntPtr.Zero) Marshal.FreeCoTaskMem(name); }
    }

    static bool CanonicalId(string value)
    { Guid id; return Guid.TryParseExact(value, "D", out id) && id != Guid.Empty && id.ToString("D") == value; }
    static bool CanonicalSid(string value)
    {
        try { return value != null && value.Length <= 184 && new SecurityIdentifier(value).Value == value; }
        catch (ArgumentException) { return false; }
    }
    static Exception Invalid() { return new InvalidOperationException("NORMAL_START_KEEPER_INSTALLATION_SLOT_UNAVAILABLE"); }

    [StructLayout(LayoutKind.Sequential)] struct UnicodeString { internal ushort Length, MaximumLength; internal IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)] struct ObjectAttributes
    {
        internal int Length;
        internal IntPtr RootDirectory, ObjectName;
        internal uint Attributes;
        internal IntPtr SecurityDescriptor, SecurityQualityOfService;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoStatus { internal IntPtr Status, Information; }
    [StructLayout(LayoutKind.Sequential)] struct FileId { internal ulong Volume, Low, High; }
    [StructLayout(LayoutKind.Sequential)] struct BasicInfo { internal long Created, Accessed, Written, Changed; internal uint Attributes; }
    [StructLayout(LayoutKind.Sequential)] struct StandardInfo { internal long AllocationSize, EndOfFile; internal uint NumberOfLinks; internal byte DeletePending, Directory; }
    [StructLayout(LayoutKind.Sequential)] struct AttributeTag { internal uint Attributes, ReparseTag; }

    [DllImport("shell32.dll", ExactSpelling = true)] static extern int SHGetKnownFolderPath(ref Guid folder, uint flags, IntPtr token, out IntPtr name);
    [DllImport("ntdll.dll", ExactSpelling = true)] static extern int NtCreateFile(out IntPtr handle, uint access, ref ObjectAttributes attributes,
        out IoStatus status, IntPtr allocation, uint fileAttributes, uint share, uint disposition, uint options, IntPtr ea, uint eaLength);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] static extern uint GetDriveTypeW(string root);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] static extern IntPtr CreateFileW(string path,
        uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] static extern bool GetVolumeInformationByHandleW(
        IntPtr handle, StringBuilder volume, uint volumeSize, out uint serial, out uint maxComponent, out uint flags, StringBuilder fs, uint fsSize);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] static extern uint GetFinalPathNameByHandleW(
        IntPtr handle, StringBuilder name, uint length, uint flags);
    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] static extern uint GetFileType(IntPtr file);
    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", ExactSpelling = true, SetLastError = true)] static extern bool GetFileId(IntPtr file, int kind, out FileId info, uint length);
    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", ExactSpelling = true, SetLastError = true)] static extern bool GetBasic(IntPtr file, int kind, out BasicInfo info, uint length);
    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", ExactSpelling = true, SetLastError = true)] static extern bool GetStandard(IntPtr file, int kind, out StandardInfo info, uint length);
    [DllImport("kernel32.dll", EntryPoint = "GetFileInformationByHandleEx", ExactSpelling = true, SetLastError = true)] static extern bool GetTag(IntPtr file, int kind, out AttributeTag info, uint length);
    [DllImport("advapi32.dll", ExactSpelling = true)] static extern uint GetSecurityInfo(IntPtr handle, int type, uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll", ExactSpelling = true)] static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll", ExactSpelling = true)] static extern IntPtr LocalFree(IntPtr memory);
    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] static extern bool SetFilePointerEx(IntPtr handle, long distance, out long position, uint method);
    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] static extern bool ReadFile(IntPtr handle, [Out] byte[] bytes, uint count, out uint read, IntPtr overlapped);
    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] static extern bool CloseHandle(IntPtr handle);
}
