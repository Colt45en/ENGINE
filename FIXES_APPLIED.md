# LLE Morphology Engine - Fixes Applied

This repository contains the fixed implementation of the LLE (Linguistic Language Engine) Morphology system.

## Issues Fixed

### 1. Root Span Drift After `minimalStemFix` ✅

**Problem:** When the `minimalStemFix` function modified the root (e.g., removing 'e' before 'ing'), the span indices would become inconsistent with the actual word characters.

**Solution:** The fixed `morphology.v2.ts` now adjusts `consumedEnd` when the root length changes:
```typescript
if (fixedRoot !== root) {
  const delta = root.length - fixedRoot.length;
  root = fixedRoot;
  consumedEnd -= delta; // Keep indices consistent
  if (consumedEnd < consumedStart) consumedEnd = consumedStart;
}
```

This ensures that all morpheme spans always match the actual characters in the word.

### 2. BIO Tag Mismatch (ROO vs ROOT) ✅

**Problem:** The dataset builder and training code had inconsistent BIO tags - using `B-ROO` instead of `B-ROOT`.

**Solution:** 
- Updated `build_jsonl.ts` to use correct `spanToTag()` function that returns "ROOT" (not "ROO")
- Updated `segtag_dataset.py` to define tags as: `["O", "B-PRE", "I-PRE", "B-ROOT", "I-ROOT", "B-SUF", "I-SUF"]`

### 3. Label Length Validation ✅

**Enhancement:** Added a sanity check in the dataset builder to ensure labels always match word length:
```typescript
if (labels.length !== r.word.length) {
  throw new Error(`Label length mismatch for ${r.word}: ${labels.length} vs ${r.word.length}`);
}
```

## Project Structure

```
.
├── packages/
│   ├── llex-morpho/
│   │   └── src/
│   │       └── morphology.v2.ts    # Fixed morphology engine
│   ├── llex-dataset/
│   │   └── src/
│   │       ├── build_jsonl.ts      # Fixed dataset builder
│   │       └── sample_words.txt    # Sample words for testing
│   └── data/
│       └── processed/
│           ├── segtag.jsonl        # Generated segmentation dataset
│           └── class.jsonl         # Generated classification dataset
├── training/
│   ├── segtag_dataset.py           # Fixed PyTorch dataset loader
│   └── requirements.txt
├── test_morphology.ts              # TypeScript tests
└── validate_fixes.py               # Python validation script
```

## Running the Code

### Generate Dataset

```bash
npm install
cd packages/llex-dataset
npx tsx src/build_jsonl.ts
```

### Run Tests

```bash
# TypeScript tests
npx tsx test_morphology.ts

# Python validation
python3 validate_fixes.py
```

## Verification

All tests pass and verify:
- ✅ Span indices always match actual word characters
- ✅ BIO tags use B-ROOT/I-ROOT (not B-ROO)
- ✅ Label lengths always match word lengths
- ✅ Dataset and training code are aligned

## Example Output

For the word "running":
```json
{
  "word": "running",
  "spans": [
    {"type": "root", "start": 0, "end": 4},
    {"type": "suffix", "start": 4, "end": 7}
  ],
  "labels": ["B-ROOT", "I-ROOT", "I-ROOT", "I-ROOT", "B-SUF", "I-SUF", "I-SUF"],
  "morphemes": ["runn", "ing"]
}
```

Note: The root "runn" is correctly extracted (the 'e' was dropped by `minimalStemFix`), and the spans [0:4] and [4:7] correctly map to "runn" and "ing".
