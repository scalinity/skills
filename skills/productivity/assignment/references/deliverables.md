# Working with each deliverable type

Read the section for the deliverable at hand.

- Jupyter notebooks: environment, editing, running
- PDF from a notebook or HTML
- R Markdown
- Word documents and written reports

`S` below is the session scratchpad (or a `mktemp -d` folder if there is none); `SKILL` is this skill's folder.

## Jupyter notebooks

### Environment

Build it in the scratchpad so no `.venv` ends up filed with the coursework:

```bash
uv venv --python 3.12 "$S/venv" -q
uv pip install -q --python "$S/venv/bin/python" -r <workspace>/requirements.txt nbconvert ipykernel
```

- Match the Python version to `metadata.language_info.version` in the starter (Colab notebooks say 3.12); use 3.12 when it is missing.
- Install the supplied requirements exactly, pins included, so the numbers you quote match what the instructor's environment produces. With no requirements file, install what the imports need.
- XGBoost on macOS needs the OpenMP runtime. The error reads `Library not loaded: @rpath/libomp.dylib`; the fix is `brew install libomp`.

### Editing

Copy the starter to the named working copy at the workspace root, then edit by cell id with exact-once replacement, so a typo fails loudly instead of changing the wrong line:

```python
import json, sys
path = sys.argv[1]
nb = json.load(open(path))
edits = {
    "5c0e1dfb": [("pd.read_csv('___')", "pd.read_csv('wdbc.csv')"),
                 ("target = '___'", "target = 'malignant'")],
}
for cell in nb["cells"]:
    for old, new in edits.pop(cell.get("id"), []):
        text = "".join(cell["source"])
        assert text.count(old) == 1, (cell["id"], old)
        cell["source"] = text.replace(old, new).splitlines(keepends=True)
assert not edits, edits
json.dump(nb, open(path, "w"), indent=1, ensure_ascii=False)
open(path, "a").write("\n")
```

Keep cell ids, metadata and the original wording around each blank. When a filled value is wider or narrower than `___`, adjust the padding so trailing comments stay aligned. Put written answers where the template expects them, for example on the same line after `**Answer:**`.

### Running

```bash
"$S/venv/bin/jupyter" nbconvert --to notebook --execute --inplace <workspace>/<working>.ipynb
```

This starts a fresh kernel, runs every cell top to bottom with the notebook's folder as the working directory, and saves the outputs into the file. That is exactly "restart the runtime and run all cells". Keep the working copy beside the data at the workspace root so relative paths like `pd.read_csv('wdbc.csv')` resolve, and copy it into `submission/` only after the final run. For slow cells add `--ExecutePreprocessor.timeout=1200`. The terminal warning "Kernel is running over TCP without encryption" is not saved in the notebook and can be ignored.

The order that works: fill the code, run, read every output with `python3 -I $SKILL/scripts/nb.py show <nb>`, save and look at every plot (`nb.py images <nb> "$S"`, then Read each PNG), write the answers, run again for the clean final copy, copy into `submission/`, then check.

The first run in a new environment can print one-time notices to stderr, such as "Matplotlib is building the font cache". The final run must not include them, and a second run clears them.

## PDF from a notebook or HTML

Only make a PDF when the instructions or the syllabus rule that applies to this task require one. Print HTML with headless Chrome, which keeps notebook styling and embedded plots intact:

```bash
"$S/venv/bin/jupyter" nbconvert --to html <workspace>/<working>.ipynb --output-dir "$S"
$SKILL/scripts/html_to_pdf.sh "$S/<working>.html" <workspace>/submission/<Name>.pdf
```

The script wraps long code lines (printed pages otherwise clip them at the right margin) and stops Chrome once the file is complete (it can hang after writing). Then Read the PDF and look at every page: code fully visible, plots present, answers legible, page count within any limit (`pdfinfo`).

## R Markdown

If the profile lists an earlier build script, reuse it as the pattern. Otherwise render the Rmd to self-contained HTML, then print it with headless Chrome. The render step:

```bash
RSTUDIO_PANDOC=/Applications/RStudio.app/Contents/Resources/app/quarto/bin/tools/aarch64 \
  Rscript -e 'rmarkdown::render("hw.Rmd", quiet = TRUE)'
```

When pandoc is not on the PATH, RStudio's bundled copy at that path works. Print the resulting HTML with `html_to_pdf.sh` and check every page.

## Word documents and written reports

- Read `.docx` instructions with the docx skill, or convert them with RStudio's pandoc (path above) using `-t plain`.
- For a `.docx` deliverable use the docx skill; for a written PDF, write HTML and print it with `html_to_pdf.sh`, or use the pdf skill.
- Formatting rules (font, size, spacing, margins, headings, page or word limits, citation style) are graded like content. List each one in the checklist and confirm it in the final file: open it, count the pages, and check the headings against the required structure.
