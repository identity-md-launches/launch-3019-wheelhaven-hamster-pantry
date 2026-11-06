#!/usr/bin/env python3
"""Build/check the complete public source download, excluding the ZIP itself and private inputs."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import sys

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "dist/wheelhaven-source.zip"


def source_files():
    # Explicit scope: never traverse Git metadata, task inputs, scratch tools or dependency caches.
    files = [ROOT / name for name in (".gitignore", "LICENSE", "README.md", "DESIGN.md", "VALIDATION.md", "package.json", "server.mjs")]
    files += sorted(p for p in (ROOT / "dist").iterdir() if p.is_file() and p != ARCHIVE)
    files += sorted((ROOT / "test").glob("*.mjs"))
    files += sorted(p for p in (ROOT / "scripts").iterdir() if p.suffix in (".mjs", ".py"))
    for file in files:
        if file.is_symlink() or not file.is_file():
            raise ValueError(f"Missing or nonregular source: {file.relative_to(ROOT)}")
    return {"wheelhaven/" + p.relative_to(ROOT).as_posix(): p for p in files}


def build(files):
    with ZipFile(ARCHIVE, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, file in sorted(files.items()):
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes(), compresslevel=9)


def check(files):
    with ZipFile(ARCHIVE) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != set(files):
            raise ValueError(f"Archive file list differs: {set(names) ^ set(files)}")
        if archive.testzip() is not None:
            raise ValueError("Archive CRC failure")
        for name, file in files.items():
            if archive.read(name) != file.read_bytes():
                raise ValueError(f"Archive is stale: {name}")
    size = sum(p.stat().st_size for p in files.values()) + ARCHIVE.stat().st_size
    if size > 8_388_608:
        raise ValueError(f"Public source and export exceed the 8 MiB budget: {size}")
    print(f"Source archive: {len(files)} files match the final tree byte for byte; source + ZIP {size} bytes.")


if __name__ == "__main__":
    files = source_files()
    if "--check" not in sys.argv:
        build(files)
    check(files)
