#!/usr/bin/env python3
"""Notebook helpers for the /assignment skill.

  nb.py show NOTEBOOK              print every cell: id, type, source and outputs
  nb.py images NOTEBOOK OUTDIR     save each PNG output as OUTDIR/cell<N>.png
  nb.py check NOTEBOOK [STARTER]   pre-submission checks; with STARTER, list every change from it

Run with python3 -I. `check` validates the format too when nbformat is importable
(it is in any environment that has nbconvert).
"""
import base64
import difflib
import json
import os
import re
import sys

PLACEHOLDERS = ("___", "YOUR CODE HERE", "NotImplementedError")
# Characters that read as machine-written in a short answer: em/en dashes, arrows, math symbols, bullets.
PLAIN = re.compile(r"[^\w\s.,'\"()%/:;?!-]")


def load(path):
    with open(path) as f:
        return json.load(f)


def text(cell):
    return "".join(cell["source"])


def show(path):
    for i, c in enumerate(load(path)["cells"]):
        print("\n===== cell %d [%s] id=%s exec=%s" % (i, c["cell_type"], c.get("id"), c.get("execution_count")))
        print(text(c))
        for o in c.get("outputs", []):
            kind = o["output_type"]
            if kind == "stream":
                print("--- %s ---\n%s" % (o["name"], "".join(o["text"])), end="")
            elif kind == "error":
                print("--- ERROR %s: %s" % (o["ename"], o["evalue"]))
            else:
                data = o.get("data", {})
                if "image/png" in data:
                    print("--- [image/png]")
                elif "text/plain" in data:
                    print("--- output ---\n" + "".join(data["text/plain"]))


def images(path, outdir):
    os.makedirs(outdir, exist_ok=True)
    for i, c in enumerate(load(path)["cells"]):
        for o in c.get("outputs", []):
            png = o.get("data", {}).get("image/png")
            if png:
                out = os.path.join(outdir, "cell%d.png" % i)
                with open(out, "wb") as f:
                    f.write(base64.b64decode(png))
                print(out)


def keyed(nb):
    cells = nb["cells"]
    if all(c.get("id") for c in cells):
        return [(c["id"], c) for c in cells]
    return [(str(i), c) for i, c in enumerate(cells)]


def added_words(old, new):
    a, b = old.split(), new.split()
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return " ".join(" ".join(b[j1:j2]) for tag, _, _, j1, j2 in sm.get_opcodes() if tag in ("insert", "replace"))


def changes(nb, starter):
    print("\n--- every change from the starter (each must be one the instructions asked for) ---")
    old = dict(keyed(starter))
    new_keys = {k for k, _ in keyed(nb)}
    for k in old:
        if k not in new_keys:
            print("[%s] cell removed" % k)
    prose = []
    for k, c in keyed(nb):
        if k not in old:
            print("[%s] cell added (%s)" % (k, c["cell_type"]))
            continue
        a, b = text(old[k]), text(c)
        for line in difflib.unified_diff(a.splitlines(), b.splitlines(), lineterm="", n=0):
            if not line.startswith(("---", "+++", "@@")):
                print("[%s] %s" % (k, line[:200]))
        if c["cell_type"] == "markdown" and a != b:
            prose.append((k, added_words(a, b)))
    if prose:
        print("\n--- written text added to markdown cells ---")
        for k, words in prose:
            sentences = len(re.findall(r"[.!?](?:\s|$)", words))
            odd = sorted(set(PLAIN.findall(words)))
            print("[%s] sentences=%d words=%d symbols_to_review=%s" % (k, sentences, len(words.split()), odd or "none"))


def check(path, starter_path=None):
    nb = load(path)
    try:
        import nbformat
        nbformat.validate(nbformat.read(path, as_version=4))
        print("format: valid nbformat %s.%s" % (nb["nbformat"], nb["nbformat_minor"]))
    except ImportError:
        print("format: skipped (nbformat not importable; run with the environment's python to validate)")
    code = [c for c in nb["cells"] if c["cell_type"] == "code"]
    counts = [c.get("execution_count") for c in code]
    print("execution counts:", counts, "| in order 1..N:", counts == list(range(1, len(code) + 1)))
    errors = [(c.get("id"), o["ename"]) for c in code for o in c.get("outputs", []) if o["output_type"] == "error"]
    print("error outputs:", errors or "none")
    stderr = [(c.get("id"), "".join(o["text"])[:120]) for c in code for o in c.get("outputs", []) if o.get("name") == "stderr"]
    print("stderr outputs:", stderr or "none")
    print("code cells with no output (fine if they print nothing by design):", [c.get("id") for c in code if not c.get("outputs")] or "none")
    left = [(c.get("id"), p) for c in code for p in PLACEHOLDERS if p in text(c)]
    print("placeholders left in code:", left or "none")
    if starter_path:
        changes(nb, load(starter_path))


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "show" and len(args) == 1:
        show(*args)
    elif cmd == "images" and len(args) == 2:
        images(*args)
    elif cmd == "check" and len(args) in (1, 2):
        check(*args)
    else:
        sys.exit(__doc__)
