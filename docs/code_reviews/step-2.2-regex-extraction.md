# Code Review: Step 2.2 — Regex Value Extraction

> **Date**: 2026-07-29  
> **Reviewer**: GitHub Copilot (DeepSeek V4 Pro)  
> **Status**: ✅ Approve with minor fixes

---

## Files Reviewed

| File | Purpose |
|---|---|
| `backend/app/utils/regex_extractor.py` | Core utility — regex patterns & value normalizers |
| `backend/tests/test_regex_extractor.py` | Unit tests for parser functions and full extraction |
| `backend/scripts/run_regex_extraction.py` | Pipeline runner — queries DB, runs extraction, stores results |
| `backend/app/database.py` | Added `supabase_admin` client export |
| `backend/app/config.py` | Already included `SUPABASE_SERVICE_KEY` |

---

## Summary

This is solid, well-structured code. The core extraction utility is clean, the tests are meaningful, and the pipeline runner is robust with good error handling for both real and mock environments.

---

## ✅ What's Good

| Aspect | Notes |
|---|---|
| **Architecture** | Clean separation: `regex_extractor.py` (pure logic), `run_regex_extraction.py` (orchestration), `test_regex_extractor.py` (tests). No business logic leaks into the script. |
| **Normalization** | Percentages → `float`, monetary → `float`, dates → ISO `YYYY-MM-DD`. This is exactly what downstream AI agents need. |
| **Context extraction** | ±200 char boundary with `max(0, start-200)` / `min(len(text), end+200)` is correct and well-tested. |
| **Overlap detection** | Shared `matched_spans` across all three pattern passes, with dates processed first (highest specificity), then percentages, then monetary. Correct ordering. |
| **`database.py` change** | Adding `supabase_admin` as a separate client using `SUPABASE_SERVICE_KEY` is the right pattern for admin scripts that need to bypass RLS. |
| **Pipeline runner** | Handles mock vs. real Supabase gracefully, with clear logging. The fallback to process any available bill when no `ingested` bills exist is pragmatic for dev. |
| **Test coverage** | Covers digit %, word %, monetary with multipliers, multiple date formats, and context boundary clamping. |

---

## ⚠️ Issues to Fix
**IMPORTANT** Remember to update the implementation log to reflect the review changes made.
**ALSO IMPORTANT** No need to run the tests again, just make the required changes if necessary.

### 1. `.?` is too permissive in monetary regex (Priority: Low)

**File**: `backend/app/utils/regex_extractor.py`  
**Line**: ~150 (monetary_pattern)

```python
# Current:
r'\b(?:(?:kes|ksh|kshs)\.?\s*\d+...'
#                          ^^
# Fix:
r'\b(?:(?:kes|ksh|kshs)\.?\s*\d+...'
#                          ^^^ should be \.? (escaped dot, optional)
```

The `.?` after currency prefixes matches **any** character (e.g., `kesX500` would incorrectly match). Use `\.?` instead.

**Action**: Change `.?` to `\.?` in the monetary pattern.

- [x] Fixed

---

### 2. Multi-word number percentages silently produce wrong values (Priority: Medium)

**File**: `backend/app/utils/regex_extractor.py`

The `percentage_pattern` generates alternatives from individual words in `WORDS_TO_NUM`. For text like `"twenty five per cent"`, the regex matches `"twenty"` alone (not `"twenty five"`), and the parser returns `20.0` instead of the true `25.0`. For `"twenty-five per cent"`, it matches only `"five per cent"` → `5.0`.

Real Kenyan legislation frequently uses forms like "twenty-five per cent" or "fifteen per cent" (the latter works since "fifteen" is a single word).

**Suggested fix** (choose one):

- **Option A (quick)**: Add a note in the module docstring documenting this as a known limitation.
- **Option B (better)**: Extend the regex to handle `word+word` patterns before single-word fallback, e.g.:
  ```
  (?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(?:one|two|three|...|nine)
  ```

- [x] Fixed (or documented)

---

### 3. Ambiguous DD-MM-YYYY vs MM-DD-YYYY date ordering (Priority: Low)

**File**: `backend/app/utils/regex_extractor.py` — `parse_date_value()`

The function tries `YYYY-MM-DD` first (unambiguous), then `DD-MM-YYYY`. But `03/04/2026` could be March 4 or April 3. The code assumes DD-MM-YYYY (common in Kenya), which is reasonable, but there's no comment documenting this assumption.

**Action**: Add a comment documenting the DD-MM-YYYY assumption and note that word-form patterns (e.g., "29th July 2026") are unambiguous and preferred.

- [x] Fixed

---

### 4. Consider adding edge-case tests (Priority: Low)

**File**: `backend/tests/test_regex_extractor.py`

The current tests cover happy paths well. Consider adding:

- Empty text input → returns `[]`
- Text with zero matches → returns `[]`
- Overlapping date + percentage in same text span (verify date wins)

- [x] Added

---

## Code Quality Scores

| Criteria | Rating | Notes |
|---|---|---|
| Readability | ⭐⭐⭐⭐ | Clear function names, good docstrings, logical flow |
| Test coverage | ⭐⭐⭐⭐ | Covers main paths; could add no-match and edge cases |
| Error handling | ⭐⭐⭐⭐⭐ | Script handles mock/real, missing bills, API failures |
| Maintainability | ⭐⭐⭐⭐ | Well-factored; regex patterns are centralized |
| Correctness | ⭐⭐⭐ | Minor regex issues noted above; core logic is sound |

---

## Verdict

**Approve with minor fixes.** The code is solid, well-tested, and ready to move to Step 2.3 (Gemini Client Setup). The issues above are edge cases that won't affect the current seed data but could surface with real parliamentary bills. Fixing them now will save debugging time later.

