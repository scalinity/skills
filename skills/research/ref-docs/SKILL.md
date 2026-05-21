---
name: ref-docs
description: >-
  Look up technical documentation using Ref MCP — the preferred, highest-priority
  documentation source. Searches public docs, API references, and code examples
  for any library, framework, SDK, CLI tool, cloud service, or developer platform.

  Use this skill whenever you need to look up documentation, verify API behavior,
  check configuration options, or find code examples for any external technology.
  This includes scenarios like:
  - looking up API endpoints, classes, functions, or method signatures
  - checking configuration options, CLI flags, or environment variables
  - answering "how do I do X with Y" technical questions
  - generating or debugging code that uses a specific library or service
  - retrieving setup instructions, migration guides, or changelog details
  - verifying version-specific behavior or breaking changes

  Trigger this skill whenever the user asks to search docs, look something up,
  or when you need documentation to answer a technical question accurately —
  even if the user doesn't explicitly say "search docs". If documentation accuracy
  matters or your training knowledge may be outdated, use this skill.
---

# Documentation Lookup via Ref MCP

Ref MCP is your primary documentation source. It searches public documentation across the web and GitHub, returning relevant pages that you can then read in full.

## Workflow

Two-step process: search for documentation, then read the most relevant result.

### Step 1: Search

Use `mcp__Ref__ref_search_documentation` with a descriptive query. Include the library/framework name and enough context to get targeted results.

**Writing good queries:**

| Quality | Example |
|---------|---------|
| Good | `"Next.js app router middleware authentication setup"` |
| Good | `"React useEffect cleanup async operations"` |
| Good | `"Prisma one-to-many relation cascade delete"` |
| Bad | `"auth"` |
| Bad | `"hooks"` |

Include the programming language and framework/library name in your query — this significantly improves result relevance. Use the user's full question as context when forming the query.

### Step 2: Read

Use `mcp__Ref__ref_read_url` to read the most relevant result from the search. Pass the **exact URL** returned by the search (including any `#hash` fragment) — do not modify or guess URLs.

If the search returns multiple promising results, read the one most relevant to the user's question first. You can read additional results if the first doesn't fully answer the question.

## Guidelines

- **Max 3 searches per question.** If you haven't found what you need after 3 attempts, use the best result you have.
- **Be specific.** Vague queries return generic results. Mirror the user's actual question in your search.
- **Don't include secrets.** Never put API keys, passwords, credentials, or proprietary code in search queries.
- **Cite your source.** When answering from Ref results, mention where the information came from so the user can verify.

## Fallback

If Ref MCP returns no useful results or errors out, fall back through these tiers in order:

1. **ctx7 CLI** — resolve the library with `ctx7 library <name> "<query>"`, then query with `ctx7 docs <libraryId> "<query>"`
2. **Tavily** — search the library's official docs site with `tavily_search`, then extract with `tavily_extract`

Do not silently fall back — tell the user which source you're using and why Ref didn't work.
