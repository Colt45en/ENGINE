# Quick Start Guide

## What Was Fixed

This PR implements three critical fixes to the LLE Morphology V2 system:

1. **Root Span Drift** - Spans now remain accurate even after stem modifications
2. **BIO Tag Mismatch** - Tags now correctly use `B-ROOT`/`I-ROOT` instead of `B-ROO`
3. **Label Validation** - Added sanity checks to ensure labels always match word length

## Quick Test

Run the comprehensive demo to see all fixes in action:

```bash
npx tsx demo_fixes.ts
```

## Usage Examples

### TypeScript: Morphology Analysis

```typescript
import { createLLEMorphologyV2 } from "./packages/llex-morpho/src/morphology.v2.js";

const morpho = createLLEMorphologyV2();
const result = morpho("running");

console.log(result);
// {
//   word: "running",
//   prefixes: [],
//   root: "runn",           // ✅ stem fix applied
//   suffixes: ["ing"],
//   morphemes: [
//     { type: "root", text: "runn", start: 0, end: 4 },   // ✅ spans match text
//     { type: "suffix", text: "ing", start: 4, end: 7 }
//   ]
// }
```

### Generate Training Dataset

```bash
cd packages/llex-dataset
npx tsx src/build_jsonl.ts
```

This creates:
- `packages/data/processed/segtag.jsonl` - Segmentation training data with correct ROOT tags
- `packages/data/processed/class.jsonl` - Classification training data

### Python: Load Dataset for Training

```python
from training.segtag_dataset import SegTagDataset

dataset = SegTagDataset("packages/data/processed/segtag.jsonl")
chars, labels = dataset[0]  # Get first example

# labels are indices into: ["O", "B-PRE", "I-PRE", "B-ROOT", "I-ROOT", "B-SUF", "I-SUF"]
```

## Verification

All tests pass:
```bash
# TypeScript tests
npx tsx test_morphology.ts

# Python validation
python3 validate_fixes.py

# Full demo
npx tsx demo_fixes.ts
```

## Key Implementation Details

### Fix #1: Span Tracking (morphology.v2.ts)

```typescript
const fixedRoot = minimalStemFix(root, lastSuf);
if (fixedRoot !== root) {
  const delta = root.length - fixedRoot.length;
  root = fixedRoot;
  consumedEnd -= delta;  // ✅ Adjust span boundary
}
```

### Fix #2: BIO Tags (build_jsonl.ts)

```typescript
function spanToTag(type: SpanType): "PRE" | "ROOT" | "SUF" {
  if (type === "prefix") return "PRE";
  if (type === "root") return "ROOT";  // ✅ Not "ROO"
  return "SUF";
}
```

### Fix #3: Validation (build_jsonl.ts)

```typescript
if (labels.length !== r.word.length) {
  throw new Error(`Label length mismatch for ${r.word}`);  // ✅ Fail fast
}
```

## Files Modified

- `packages/llex-morpho/src/morphology.v2.ts` - Fixed span tracking
- `packages/llex-dataset/src/build_jsonl.ts` - Fixed BIO tags and added validation
- `training/segtag_dataset.py` - Fixed tag set to use ROOT

## Next Steps

The fixes are production-ready. For further improvements, consider:
- Replacing `ord()` character IDs with proper character vocabulary
- Adding boundary auxiliary loss for better accuracy
- Expanding morpheme pattern coverage
- Adding more comprehensive tests
