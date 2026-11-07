{
  "targets": [{
    "target_name": "fn16_posix_safe_handle",
    "sources": ["addon.c"],
    "defines": ["NAPI_VERSION=8", "_GNU_SOURCE"],
    "cflags": ["-std=c11", "-fPIC", "-Wall", "-Wextra", "-Wpedantic", "-pthread"],
    "ldflags": ["-pthread"],
    "libraries": ["-lm"],
    "conditions": [["OS != 'linux' or target_arch != 'x64'", {"type": "none"}]]
  }]
}
