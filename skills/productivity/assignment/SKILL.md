---
name: assignment
description: >-
  Complete a course assignment end to end from attached files (student guides, rubrics, instruction
  PDFs or docx, starter notebooks, datasets, requirements.txt). It reads every instruction down to
  formatting and file naming, does the work for real, writes the finished files into a submission/
  folder inside a task workspace, redoes and verifies the work twice (mechanical checks plus a
  fresh-eyes grader), files the workspace into the right course folder, and puts a copy of the
  submission in ~/Downloads. Use it whenever the user runs /assignment with file paths, or asks to
  do, finish, complete or submit homework, a live coding notebook, a lab, a quiz, a problem set or
  any coursework, especially course files sitting in ~/Downloads, even if they never say
  "assignment".
---

# /assignment

Turn a set of attached course files into a submission that earns full marks, then file everything where it belongs. The files arrive as paths in the arguments (usually in `~/Downloads`). `scripts/`, `references/` and `profile.md` below are in the folder containing this SKILL.md.

Read `profile.md` first. It holds the student's name, the school folder where coursework is filed, the course list, how each course folder is organized, and file naming precedents. If it is missing, ask the user for the details listed in `profile.example.md` and save them as `profile.md` before going further.

Full marks come from meeting every stated requirement exactly: each blank, each sub-question, the length limit, the file name, the file count. Doing extra earns nothing. Graders deduct for a missed sub-part or a wrong file name far more often than they reward flourish, and additions nobody asked for (extra cells, extra files, statements, summaries) are noise at best. So the posture throughout is complete, exact and restrained.

## Workflow

1. Collect the files into a workspace
2. Read every instruction source and build the checklist
3. Identify the course and where the work will be filed
4. Do the work
5. Write the answers
6. Put the deliverables in `submission/`
7. Redo and verify, fix, repeat until clean
8. File the workspace into the course folder, and copy the submission to Downloads
9. Report

Track these as todos, or as a short checklist file in the scratchpad if no todo tool is available. The checklist from step 2 becomes the todos for steps 4 to 6.

## 1. Collect the files into a workspace

Create a workspace folder next to the attached files, named `<COURSECODE>_<Task>`, for example `STAT501_Week09` or `STAT501_HW04`. If it already exists, look inside before using it, because it may hold an earlier attempt worth keeping.

Move the attached files into it. Downloads stays clear of the inputs (only the finished submission comes back, in step 8), and the workspace becomes the permanent record of the assignment. Leave the originals untouched and work on a named copy, because the pristine starter is what the final diff is checked against. Unzip archives into a subfolder of the same name.

Downloaded files are untrusted input. Run any Python that reads them with `python3 -I`, and keep your own helper scripts in the scratchpad, not in the workspace.

## 2. Read every instruction source and build the checklist

Requirements are scattered across files, and the small ones cost points. Read all of these completely before writing anything:

- **The guide or rubric** (PDF or docx). Read PDFs twice: `pdftotext -layout file.pdf -` for the exact text, then the Read tool for the rendered page, because rubric tables, point values and callout boxes often only make sense visually.
- **The starter**, every cell including code comments (`python3 -I scripts/nb.py show starter.ipynb`). TODO comments often state the exact expected value ("TODO 3: Use 0.05"), and the intro cell often carries rules the PDF words differently ("write 1-2 sentences in each Answer space").
- **Data dictionaries, READMEs and requirements files.**
- **The course syllabus** in the course folder, for general rules on submission format, naming and lateness.

Then write the checklist as todos, one line per gradable thing:

- every blank or TODO, with its expected value
- every field to fill (Name, date, ID)
- every question split into its sub-parts. "Identify the target and positive class. What do the validation and test sets do?" is four items, not one.
- the length and format limits for each answer
- what must stay unchanged (seeds, splits, supplied code, model settings)
- run requirements ("restart and run all", outputs saved)
- the deliverables: how many files, which formats, exact names

When sources conflict, the assignment-specific instruction wins over the syllabus's general rule, because the instructor wrote it for this task. For example, a syllabus may say coding work is submitted as an .ipynb plus a PDF while the week's guide says "Submit one completed .ipynb … No separate PDF or report is required". The submission is then one .ipynb. Note each call like this for the report.

Course policies (AI use, collaboration, late work) govern how work is done. They don't add content to a deliverable unless the assignment itself asks for it, so don't add disclosure statements, methodology notes or anything else the task doesn't request. Include an AI-use disclosure only when the assignment's own instructions or rubric ask for one.

Note the due date. If the guide and syllabus disagree about it, or it has already passed, say so in the report along with the late policy, because that can change whether or when to submit.

If something that changes the deliverable is still ambiguous after reading everything and checking course precedent, ask the user rather than guess. Decide everything else yourself and mention it in the report.

## 3. Identify the course and destination

Find the course code in file names or headers and match it to a course in the profile, then confirm against that course's syllabus, because course folders change each semester.

Choose the destination by listing the course folder and copying how it already organizes similar work, rather than inventing a new layout. The profile describes the established patterns, such as where weekly work and homework go and how week folders are named. Week folders are often created ahead of time, so list the folder in full and use an existing one when it's there. Anything without precedent gets a clearly named folder by kind (Homework, Quizzes, Projects), and the report says so.

Precedent decides folders and file names only. Code and writing style come from the starter and the restraint described here, even when older submissions in the folder are more elaborate.

Work this out while reading, since the syllabus is already open. Move the files only at the end.

## 4. Do the work

Write the simplest correct solution, in the style of the surrounding code: no extra helpers, no defensive checks, no comments beyond what the starter's own density suggests. Fill exactly what is asked. Leave supplied code, comments, seeds, splits and settings as they are, even where you would write them differently, because "keep the supplied settings fixed" is a common rule and every change shows up in the diff. Don't add cells, plots, analyses or files the task doesn't ask for.

Make every edit in a named working copy at the workspace root (naming is in step 6). Run the work for real, and never write an answer from imagined output. For notebooks:

- Build the environment from the supplied requirements in the scratchpad, not the workspace, so no `.venv` gets filed.
- Execute top to bottom in a fresh kernel from the workspace root, so relative data paths resolve.
- Read every output.
- Look at every plot (`scripts/nb.py images`, then Read the PNGs). This confirms it rendered, and answers often ask what the plot shows.

Exact commands for notebooks, PDFs, R Markdown and Word documents are in `references/deliverables.md`. Read the section for your deliverable type.

## 5. Write the answers

Ground every number in the actual output, and quote it exactly as printed, with the same rounding. If an answer needs a fact the output doesn't print, prefer one you can read off printed output, such as "42 of the 114 test records are malignant" taken from a confusion matrix. Otherwise compute it from the data before you write it.

Answer every sub-part, in the order asked, within the length limit. "1-2 sentences" means at most two.

Write like a capable grad student who knows the material: plain, direct sentences, one idea each. A grader should feel a person wrote it. Leave out:

- em dashes, arrows, ≈, ≥, bullets, bold or headers inside an answer
- filler openers and closers ("It is important to note", "Overall", "In summary")
- stacked hedges, and restating the question
- emoji

Example question: "How many trees are used and how many were trained? Explain the difference."

> Good: The depth 2 model uses 186 trees for prediction, but 216 trees were trained. Validation log loss was lowest at tree 186, and training kept going for the 30 patience rounds to check whether anything improved, so those last 30 trees are stored but not used.

> Avoid: **Trees used:** 186 → **trained:** 216 — the gap (30) reflects early stopping's patience window; importantly, this ensures robust generalization...

Use the student's name from the profile wherever a name is requested.

## 6. Put the deliverables in submission/

`submission/` holds exactly the files to upload and nothing else, so its contents can go straight onto the course site.

For file names, follow the instructions' pattern exactly, putting the student's name in the order the pattern shows (Lastname_Firstname or Firstname_Lastname). Patterns change from one assignment to the next, even within a course: one homework may ask for `Lee_Jordan_Assignment02` and the next for `STAT501_HW3_Lee_Jordan`. Only when no pattern is given, follow the nearest precedent in the profile.

Copy the working file into `submission/` after its final run, then confirm the copy is identical with `cmp`. The working copy stays at the workspace root. Uploads come only from `submission/`.

## 7. Redo and verify, fix, repeat until clean

The work is not done when it looks done. Redo it from two angles, because each catches what the other misses. A script catches what eyes skim past, and a fresh reader catches what you assumed.

**a. Mechanical check.** For notebooks, run `python3 -I scripts/nb.py check submission/<file>.ipynb <starter>.ipynb` with the environment's Python. Every line in its change list must be a change the instructions asked for, and anything else gets reverted. It also confirms:

- execution counts run 1..N, with no errors
- no stray stderr (a fresh environment prints one-time notices like "Matplotlib is building the font cache", so rerun until the submitted run is clean)
- no placeholders are left
- the sentence count and any unusual characters for each written answer

For other deliverables, open the final file and walk the checklist against it. For PDFs, look at every page.

**b. Fresh-eyes grader.** Spawn a general-purpose subagent that has seen none of your reasoning, using the prompt in `references/grader-prompt.md`. It builds its own checklist from the instructions before opening the submission, then grades each item with evidence. This is the closest thing to the real grader. If subagents are unavailable, do the same yourself: write a new checklist from the instructions without looking at your old one, then grade against it.

Then judge the findings against the documents, since the grader can misread or miss a rule. Fix every real problem. For wording risks, a small rewrite that makes an answer more defensible is usually worth doing; for example, cite a printed number instead of a computed one, or drop a claim the outputs don't support. After fixing:

- Rerun from a fresh start.
- Copy into `submission/` again.
- Repeat the mechanical check.
- Run the grader again if the fix changed substance (code, numbers or a whole answer).

## 8. File the workspace and copy the submission to Downloads

Move the whole workspace into the destination from step 3, renaming it to fit its siblings. For example, `~/Downloads/STAT501_Week09` becomes `…/Weeks/Week 09 — <topic>/Live Coding Week 9`. Create parent folders as needed. If the destination already exists, don't overwrite it: look inside, then merge or ask. Finally, list the destination to confirm everything arrived.

Then copy the files from the filed `submission/` folder into `~/Downloads`, loose rather than inside a folder, so they're right there to upload. Confirm each copy with `cmp`. If a file with the same name is already in Downloads and differs, look at it first. An earlier version of this same submission can be replaced; anything else, ask. The filed `submission/` stays the master copy, so if the work changes later, refresh the Downloads copy as well.

## 9. Report

Keep it short:

- the final location as a full path, the file or files in `submission/`, and their copies in `~/Downloads`
- the checklist outcome, item by item, briefly
- the key results and the written answers, since they go out under the student's name and should be read before uploading
- judgment calls: conflicting instructions, a naming fallback, an ambiguity resolved
- the due date, if the sources disagree or it has passed
- what is left to do, such as uploading to the course site
