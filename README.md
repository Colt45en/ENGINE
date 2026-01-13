# LLE Morphology Pipeline

A production-grade morphological analysis pipeline with machine learning training capabilities. This pipeline implements clean boundaries between morphology, dataset generation, and training, with fixes for common pitfalls.

## 🔥 Architecture

This is a **composable, auditable, trainable, and UI-aligned** pipeline that separates:

- **Morphology** → Structure (character-level span tracking)
- **Structure** → Supervision (BIO labels, semantic tags)
- **Supervision** → Learning (BiLSTM, MLP)
- **Learning** → Runtime inference (with confidence scores)

## ✅ Key Features

### 1. Morphology V2 (`packages/llex-morpho`)

Production-ready morphological analyzer with:

- ✅ **Longest-match first** (sorted affixes) → prevents prefix/suffix shadowing
- ✅ **Multi-affix stripping** → compositional morphology works
- ✅ **Index spans** → UI highlighting + ML supervision alignment
- ✅ **No top-level await** → safe bundling everywhere
- ✅ **Minimal stem hooks** → future phonological rules without overfitting
- ✅ **FIX: Root span drift** → Properly adjusts indices after `minimalStemFix`
- ✅ **Confidence scores** → Ready for active learning

### 2. Dataset Generation (`packages/llex-dataset`)

ML-friendly JSONL schemas:

**Segmentation Dataset**
- Character-level BIO labels with **B-ROOT/I-ROOT** (not B-ROO) ✅
- Explicit morpheme spans
- Reconstructible surface form

**Semantic Dataset**
- Affix presence + root
- Tags preserved
- Complexity and confidence metrics
- Upgrade path to human gold labels

### 3. Training Stubs (`packages/llex-training`)

Baseline models with correct architectures:

- **Character BiLSTM** → Unbeatable for morphology at small scale
- **Affix-count MLP** → Interpretable + fast
- Proper padding + ignore index handling
- Character vocabulary optimization (not `ord(c)`)
- No exotic dependencies

### 4. Word Engine Integration (`packages/llex-word-engine`)

Safe telemetry ingestion:

- `safeJSON` + `coalesceWordRecord` → ingestion doesn't explode
- Tag extraction via metadata reflection
- Heuristic semantic bootstrapping → perfect for weak supervision
- Separation of runtime inference vs dataset generation

## 📦 Project Structure

```
packages/
├── llex-morpho/          # Morphological analysis (TypeScript)
├── llex-dataset/         # Dataset generation (TypeScript)
├── llex-word-engine/     # Word processing & telemetry (TypeScript)
└── llex-training/        # ML training (Python/PyTorch)
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.8
- PyTorch >= 2.0

### Installation

```bash
# Install Node dependencies
npm install

# Install Python dependencies
cd packages/llex-training
pip install -r requirements.txt
```

### Generate Dataset

```bash
# Build sample dataset
npm run build:dataset

# Output: data/segmentation.jsonl, data/semantic.jsonl
```

### Train Models

```bash
# Train segmentation model (Character BiLSTM)
npm run train:segmentation

# Train semantic model (Affix-count MLP)
npm run train:semantic
```

## 🔧 Bug Fixes Applied

### Bug #1: Root Index Drift After `minimalStemFix`

**Problem**: Root was mutated after slicing, causing span math inconsistencies.

**Fix**: Track delta and adjust `consumedEnd`:

```ts
const fixedRoot = minimalStemFix(root, lastSuf ?? '');
const delta = root.length - fixedRoot.length;
root = fixedRoot;
consumedEnd -= delta;
```

### Bug #2: BIO Label Collision (ROO vs ROOT)

**Problem**: Tags used `B-ROO` / `I-ROO` but morphology emits `root`.

**Fix**: Use full names for future transformer compatibility:

```python
BIO_TAGS = ["O", "B-PREFIX", "I-PREFIX", "B-ROOT", "I-ROOT", "B-SUFFIX", "I-SUFFIX"]
```

## 🚀 High-Leverage Improvements Included

### 1. Confidence Scores (Active Learning)

Per-word confidence metric:

```ts
confidence: 1 / (1 + prefixes.length + suffixes.length)
```

**Use cases:**
- Surface low-confidence words in UI
- Prioritize them for human correction
- Feed back as gold labels

### 2. Character Vocabulary Optimization

Instead of `ord(c)`, we build a proper vocabulary:

```python
vocab = {c: i+1 for i, c in enumerate(sorted(set("".join(words))))}
```

**Benefits:**
- Reduces embedding size
- Improves convergence
- Still trivial to maintain

## 📊 Example Output

### Morphology Analysis

```json
{
  "original": "reactivate",
  "word": "reactivate",
  "prefixes": ["re"],
  "root": "activat",
  "suffixes": ["e"],
  "morphemes": [
    {"type": "prefix", "text": "re", "start": 0, "end": 2},
    {"type": "root", "text": "activat", "start": 2, "end": 9},
    {"type": "suffix", "text": "e", "start": 9, "end": 10}
  ],
  "complexity": 2,
  "confidence": 0.333
}
```

### Segmentation Dataset

```json
{
  "word": "reactivate",
  "labels": ["B-PREFIX", "I-PREFIX", "B-ROOT", "I-ROOT", "I-ROOT", "I-ROOT", "I-ROOT", "I-ROOT", "I-ROOT", "B-SUFFIX"],
  "morphemes": [...]
}
```

## 🧪 Testing

Currently, tests are minimal. To add tests:

```bash
# Run tests (when implemented)
npm test
```

## 🔜 Future Enhancements

Potential next steps:

- Convert tagger to tiny Conv-Transformer
- Add ONNX / WASM inference for in-browser tagging
- Design gold-label merge strategy (human + heuristic)
- Add evaluation dashboards (precision by affix type)
- Implement circumfix plugin for paired morphemes

## 📝 License

MIT
