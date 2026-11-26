"""Stage a verified Blueprint revision into an existing Capacitor www directory."""
import argparse
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def git(*args):
    return subprocess.check_output(["git", *args])


def historical_blobs(ref, name):
    # Follow the file's changes on main, newest first. Skip commits deleting it.
    revisions = git("log", "--first-parent", "--diff-filter=AM", "--format=%H", ref,
                    "--", name).decode().splitlines()
    for revision in revisions:
        yield git("show", f"{revision}:{name}")


def wrapper_entry(ref, name, current, incoming):
    # The Mac wrapper can append script elements for its native share bridge.
    # Only carry those elements forward when the rest matches a known web version.
    tags = re.compile(rb'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*>\s*</script>', re.I)
    def split(data):
        match = re.search(rb'</body\s*>', data, re.I)
        if not match:
            return data, []
        tail = data[:match.start()]
        hooks = []
        while True:
            scripts = list(tags.finditer(tail))
            if not scripts or tail[scripts[-1].end():].strip():
                break
            last = scripts[-1]
            if b'blueprint-native-share-' not in last.group().lower():
                break
            hooks.insert(0, last.group())
            tail = tail[:last.start()]
        return tail.rstrip() + data[match.start():], hooks
    clean, hooks = split(current)
    for base in historical_blobs(ref, name):
        if current == base:
            return incoming
        if hooks and clean == split(base)[0]:
            return re.sub(rb'</body\s*>', lambda m: b'\n'.join(hooks) + b'\n' + m.group(),
                          incoming, count=1, flags=re.I)
    raise SystemExit(f"Unrecognized local edits in {name}. Review the wrapper copy before staging.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("www", type=Path)
    parser.add_argument("--ref", default="origin/main")
    args = parser.parse_args()
    target = args.www.resolve()
    if not (target / "index.html").is_file():
        parser.error("Pass the existing Capacitor web directory containing index.html.")
    ref = git("rev-parse", "--verify", args.ref + "^{commit}").decode().strip()
    sw = git("show", ref + ":sw.js").decode()
    manifest = re.search(r'const ASSETS\s*=\s*\[([^\]]+)\]', sw)
    if not manifest:
        parser.error("Cannot read the service worker asset list.")
    names = re.findall(r"'\./([^']*)'", manifest.group(1))
    if "index.html" not in names or any(Path(n).is_absolute() or any(part in ('', '.', '..') for part in n.split('/')) or '\\' in n for n in names if n):
        parser.error("Unexpected web asset list.")
    with tempfile.TemporaryDirectory() as work:
        stage = Path(work)
        for name in dict.fromkeys(["sw.js", *filter(None, names)]):
            new = git("show", f"{ref}:{name}")
            dest = target / name
            if dest.exists():
                current = dest.read_bytes()
                if current == new:
                    continue
                if name == "index.html":
                    new = wrapper_entry(ref, name, current, new)
                elif current not in historical_blobs(ref, name):
                    raise SystemExit(f"Unrecognized local edits in {name}. Review before staging.")
            (stage / name).parent.mkdir(parents=True, exist_ok=True)
            (stage / name).write_bytes(new)
        for source in stage.rglob('*'):
            if not source.is_file():
                continue
            dest = target / source.relative_to(stage)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
    print(f"Staged Blueprint {ref[:12]} into {target}")


if __name__ == "__main__":
    main()
