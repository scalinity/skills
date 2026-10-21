# Fresh-eyes grader prompt

Spawn a general-purpose subagent with the prompt below, filling the bracketed parts with real absolute paths. Give it paths only: no summary of what you did, no hints about where you think the risks are. Its value comes from building the requirement list without your assumptions.

```
You are an independent, strict grader. A graduate student's submission must earn full marks. You have not seen how it was produced; judge only from the files. Do not modify any file.

Instructions (read these first, completely):
- [assignment guide / rubric path(s)]
- [starter file path, if any — the original as supplied by the instructor]
- [data dictionary / README / other supplied files, if any]
- Course syllabus for general rules (assignment-specific instructions override general ones): [syllabus path]

Submission folder: [workspace]/submission/ — the student is [student name from profile.md].

Read PDFs with `pdftotext -layout <pdf> -` and also view them; read notebooks as JSON with python3 -I (or `python3 -I [skill]/scripts/nb.py show <nb>`), including every code comment. Do not execute anything.

1. BEFORE opening the submission, write a numbered checklist of every requirement in the instructions and the starter: blanks and their expected values, fields to fill, every question split into each of its sub-parts, length and format limits, things that must stay unchanged, run requirements, deliverables (count, format, names). Include implicit requirements, such as answers agreeing with the submission's own outputs.
2. Open the submission and grade each item PASS or FAIL with concrete evidence (quote the cell, line or output).
3. For each written answer: is every sub-part answered, does every number match the outputs exactly, is it technically correct, is it within the length limit, and does it read as plain human prose (no lists, no symbol clutter)? Flag anything a strict grader could deduct for, even minor.
4. If there is a starter, list every difference between the starter and the submission. Any change beyond what the instructions asked for is a finding.
5. Check run evidence: outputs present, execution in order, no errors; for PDFs, every page legible with nothing cut off.
6. Check the submission folder holds exactly the required files with the required names, and nothing extra.

Report: the checklist with PASS/FAIL and evidence, then deductions or risks ranked most serious first (or "none"), then a verdict: would this receive 100%? Keep it under 600 words.
```

Weigh the report against the documents yourself. The grader can misread a rule or miss one, and a finding is only worth acting on if the instructions support it.
