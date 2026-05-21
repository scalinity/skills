#!/usr/bin/env bash
# detect_scale.sh
#
# Auto-generates a Project Scale table for a README by counting
# files, tests, migrations, entities, and ADRs in the current repo.
#
# Usage: run from the project root. Emits a markdown table to stdout.
# Redact or hand-edit as needed before pasting into README.
#
# All metrics fail gracefully — if a directory doesn't exist, the
# row is simply skipped rather than erroring out.

set -u
# Deliberately no `set -e` — we want partial output when directories don't exist.

emit_row() {
  # emit_row "Label" <count>
  # Skips emitting if count is 0 or empty — keeps output focused.
  local label="$1"
  local count="$2"
  if [[ -n "$count" && "$count" -gt 0 ]]; then
    printf "| %s | %s |\n" "$label" "$count"
  fi
}

echo "| Metric | Count |"
echo "|---|---|"

# --- iOS / Swift ---
SWIFT_FILES=$(find . -name "*.swift" -not -path "./node_modules/*" -not -path "./.build/*" -not -path "./DerivedData/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "Swift source files" "$SWIFT_FILES"

# Feature modules — convention: `Features/<Feature>/` directly under the app target
for candidate in */Features Stir/Features App/Features; do
  if [[ -d "$candidate" ]]; then
    FEATURES=$(find "$candidate" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Feature modules" "$FEATURES"
    break
  fi
done

# Core Data entities
XCDATAMODEL_CONTENTS=$(find . -path "*.xcdatamodeld/*.xcdatamodel/contents" 2>/dev/null | head -1)
if [[ -n "$XCDATAMODEL_CONTENTS" ]]; then
  ENTITIES=$(grep -c "<entity name=" "$XCDATAMODEL_CONTENTS" 2>/dev/null | tr -d ' ')
  emit_row "Core Data entities" "$ENTITIES"
fi

# --- Web / JavaScript / TypeScript ---
TS_FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./dist/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "TypeScript source files" "$TS_FILES"

JS_FILES=$(find . -type f \( -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./dist/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "JavaScript source files" "$JS_FILES"

# --- Python ---
PY_FILES=$(find . -name "*.py" -not -path "./.venv/*" -not -path "./venv/*" -not -path "./__pycache__/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "Python source files" "$PY_FILES"

# --- Rust ---
RS_FILES=$(find . -name "*.rs" -not -path "./target/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "Rust source files" "$RS_FILES"

# --- Go ---
GO_FILES=$(find . -name "*.go" -not -path "./vendor/*" 2>/dev/null | wc -l | tr -d ' ')
emit_row "Go source files" "$GO_FILES"

# --- Supabase backend ---
for mig_dir in Backend/supabase/migrations supabase/migrations; do
  if [[ -d "$mig_dir" ]]; then
    MIGRATIONS=$(find "$mig_dir" -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Supabase migrations" "$MIGRATIONS"
    break
  fi
done

for fn_dir in Backend/supabase/functions supabase/functions; do
  if [[ -d "$fn_dir" ]]; then
    # Exclude _shared and any hidden dirs
    EDGE_FNS=$(find "$fn_dir" -mindepth 1 -maxdepth 1 -type d ! -name "_shared" ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Edge Functions (Deno/TypeScript)" "$EDGE_FNS"
    break
  fi
done

for test_dir in Backend/supabase/tests supabase/tests tests; do
  if [[ -d "$test_dir" ]]; then
    BACKEND_TESTS=$(find "$test_dir" -name "*_test.ts" -o -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Backend test files" "$BACKEND_TESTS"
    break
  fi
done

# --- Generic SQL migrations (non-Supabase) ---
for mig_dir in migrations db/migrations prisma/migrations; do
  if [[ -d "$mig_dir" ]]; then
    SQL_MIGS=$(find "$mig_dir" -name "*.sql" 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Database migrations" "$SQL_MIGS"
    break
  fi
done

# --- iOS tests ---
for test_dir in StirTests Tests iOS/Tests; do
  if [[ -d "$test_dir/Unit" ]]; then
    IOS_UNIT=$(find "$test_dir/Unit" -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
    emit_row "iOS unit test files" "$IOS_UNIT"
    break
  fi
done

# --- ADRs ---
if [[ -d "docs/decisions" ]]; then
  ADRS=$(find docs/decisions -name "[0-9]*.md" -not -name "*TEMPLATE*" -not -name "README*" 2>/dev/null | wc -l | tr -d ' ')
  emit_row "Architecture Decision Records" "$ADRS"
fi

# --- Runbooks ---
if [[ -d "docs/runbooks" ]]; then
  RUNBOOKS=$(find docs/runbooks -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  emit_row "Ops runbooks" "$RUNBOOKS"
fi

# --- Design tokens (SwiftUI pattern) ---
for tok_dir in Stir/DesignSystem/Tokens DesignSystem/Tokens; do
  if [[ -d "$tok_dir" ]]; then
    TOKEN_FILES=$(find "$tok_dir" -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
    emit_row "Design token files" "$TOKEN_FILES"
    break
  fi
done

# --- Total git log commits (useful for showing project velocity) ---
if git rev-parse --git-dir > /dev/null 2>&1; then
  COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
  emit_row "Git commits" "$COMMITS"
fi
