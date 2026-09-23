"""Handle-verified local reads used by isolated execution backends."""
from __future__ import annotations

from contextlib import contextmanager
import os
from pathlib import Path
import stat
import time

from .models import BackendRejected


_REPARSE_POINT = 0x400


def _is_reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & _REPARSE_POINT
    )


def _inside(root: Path, candidate: Path) -> bool:
    try:
        return os.path.commonpath((os.path.normcase(str(root)), os.path.normcase(str(candidate)))) == os.path.normcase(str(root))
    except ValueError:
        return False


def physical_identity(path: Path) -> tuple[str, int, int]:
    path = Path(os.path.abspath(path))
    try:
        info = os.lstat(path)
    except OSError as exc:
        raise BackendRejected("PATH_NOT_FOUND") from exc
    if _is_reparse(info):
        raise BackendRejected("REPARSE_PATH_DENIED")
    return os.path.normcase(str(path)), info.st_dev, info.st_ino


def verify_physical_identity(path: Path, expected: tuple[str, int, int]) -> Path:
    path = Path(os.path.abspath(path))
    if physical_identity(path) != expected:
        raise BackendRejected("PHYSICAL_PATH_CHANGED")
    return path


def _chain(root: Path, target: Path, expected_root_identity: tuple[str, int, int] | None = None) -> tuple[tuple[str, int, int], ...]:
    root = Path(os.path.abspath(root))
    if expected_root_identity is not None:
        verify_physical_identity(root, expected_root_identity)
    else:
        physical_identity(root)
    try:
        relative = target.relative_to(root)
    except ValueError as exc:
        raise BackendRejected("PATH_DENIED") from exc
    chain: list[tuple[str, int, int]] = []
    cursor = root
    for part in (".", *relative.parts):
        if part != ".":
            cursor = cursor / part
        try:
            info = os.lstat(cursor)
        except OSError as exc:
            raise BackendRejected("PATH_NOT_FOUND") from exc
        if _is_reparse(info):
            raise BackendRejected("REPARSE_PATH_DENIED")
        chain.append((os.path.normcase(str(cursor)), info.st_dev, info.st_ino))
    return tuple(chain)


def _same_chain(root: Path, target: Path, expected: tuple[tuple[str, int, int], ...],
                expected_root_identity: tuple[str, int, int] | None = None) -> None:
    if _chain(root, target, expected_root_identity) != expected:
        raise BackendRejected("PHYSICAL_PATH_CHANGED")


def _open_descriptor(path: Path) -> int:
    return os.open(path, os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0))


def _component_paths(root: Path, target: Path) -> tuple[Path, ...]:
    relative = target.relative_to(root)
    paths = [root]
    cursor = root
    for part in relative.parts:
        cursor = cursor / part
        paths.append(cursor)
    return tuple(paths)


def _lock_component(path: Path):
    if os.name != "nt":
        flags = getattr(os, "O_PATH", os.O_RDONLY) | getattr(os, "O_NOFOLLOW", 0)
        if path.is_dir(): flags |= getattr(os, "O_DIRECTORY", 0)
        return ("fd", os.open(path, flags))
    import ctypes

    create = ctypes.windll.kernel32.CreateFileW
    create.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32,
                       ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
    create.restype = ctypes.c_void_p
    handle = create(str(path), 0x80000000, 0x00000001, None, 3,
                    0x02000000 | 0x00200000, None)
    invalid = ctypes.c_void_p(-1).value
    if handle in (None, invalid):
        raise BackendRejected("PHYSICAL_PATH_UNVERIFIED")
    return ("handle", handle)


def _unlock_component(locked) -> None:
    kind, value = locked
    if kind == "fd":
        os.close(value)
    else:
        import ctypes
        ctypes.windll.kernel32.CloseHandle(ctypes.c_void_p(value))


@contextmanager
def verified_scope_guard(root: Path, relative_scopes: tuple[str, ...], *,
                         expected_root_identity: tuple[str, int, int] | None = None):
    """Keep scope components stable while a path-reopening child process runs."""
    root = Path(os.path.abspath(root))
    if expected_root_identity is not None:
        verify_physical_identity(root, expected_root_identity)
    expected: list[tuple[Path, tuple[tuple[str, int, int], ...]]] = []
    locked = []
    seen: set[str] = set()
    try:
        for relative in relative_scopes:
            target = root.joinpath(*Path(relative).parts)
            snapshot = _chain(root, target, expected_root_identity)
            expected.append((target, snapshot))
            for component in _component_paths(root, target):
                key = os.path.normcase(str(component))
                if key in seen: continue
                seen.add(key)
                locked.append(_lock_component(component))
        yield
        for target, snapshot in expected:
            _same_chain(root, target, snapshot, expected_root_identity)
    finally:
        for item in reversed(locked):
            _unlock_component(item)


def _final_descriptor_path(descriptor: int) -> Path | None:
    if os.name == "nt":
        import ctypes
        import msvcrt

        handle = msvcrt.get_osfhandle(descriptor)
        get_final = ctypes.windll.kernel32.GetFinalPathNameByHandleW
        get_final.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32]
        get_final.restype = ctypes.c_uint32
        size = get_final(handle, None, 0, 0)
        if not size:
            raise BackendRejected("PHYSICAL_PATH_UNVERIFIED")
        buffer = ctypes.create_unicode_buffer(size + 1)
        if not get_final(handle, buffer, len(buffer), 0):
            raise BackendRejected("PHYSICAL_PATH_UNVERIFIED")
        value = buffer.value
        if value.startswith("\\\\?\\UNC\\"):
            value = "\\\\" + value[8:]
        elif value.startswith("\\\\?\\"):
            value = value[4:]
        return Path(value)
    proc_path = Path(f"/proc/self/fd/{descriptor}")
    if proc_path.exists():
        return Path(os.readlink(proc_path))
    return None


def verified_stat(root: Path, path: Path, *,
                  expected_root_identity: tuple[str, int, int] | None = None) -> os.stat_result:
    expected = _chain(root, path, expected_root_identity)
    info = os.stat(path, follow_symlinks=False)
    _same_chain(root, path, expected, expected_root_identity)
    return info


def verified_scandir(root: Path, path: Path, *, max_entries: int | None = None,
                     deadline: float | None = None,
                     expected_root_identity: tuple[str, int, int] | None = None) -> tuple[Path, ...]:
    expected = _chain(root, path, expected_root_identity)
    children: list[Path] = []
    entries = os.scandir(path)
    try:
        for entry in entries:
            if deadline is not None and time.monotonic() > deadline:
                raise TimeoutError("repository traversal deadline exceeded")
            children.append(Path(entry.path))
            if max_entries is not None and len(children) > max_entries:
                raise BackendRejected("SEARCH_FILE_LIMIT_EXCEEDED")
    finally:
        entries.close()
    _same_chain(root, path, expected, expected_root_identity)
    return children


def verified_read(root: Path, path: Path, maximum: int,
                  expected_identity: tuple[int, int] | None = None, *,
                  expected_root_identity: tuple[str, int, int] | None = None) -> bytes:
    root = Path(os.path.abspath(root))
    expected_chain = _chain(root, path, expected_root_identity)
    before = os.stat(path, follow_symlinks=False)
    descriptor = _open_descriptor(path)
    try:
        opened = os.fstat(descriptor)
        final_path = _final_descriptor_path(descriptor)
        if final_path is not None and not _inside(root, final_path):
            raise BackendRejected("PATH_DENIED")
        observed = (before.st_dev, before.st_ino)
        if (expected_identity is not None and observed != expected_identity) or observed != (opened.st_dev, opened.st_ino):
            raise BackendRejected("PHYSICAL_PATH_CHANGED")
        data = os.read(descriptor, maximum + 1)
        if len(data) > maximum:
            raise BackendRejected("FILE_LIMIT_EXCEEDED")
        _same_chain(root, path, expected_chain, expected_root_identity)
        return data
    finally:
        os.close(descriptor)


__all__ = ["physical_identity", "verify_physical_identity", "verified_read", "verified_scandir",
           "verified_scope_guard", "verified_stat"]
