#!/usr/bin/env python3
"""Test script to verify the Python dataset loader works correctly."""

import sys
import os

# Add training directory to path using relative path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(script_dir, 'training'))

from segtag_dataset import SegTagDataset, TAGS, TAG2ID

print("Testing Python Dataset Loader...\n")

# Verify TAGS are correct
print("Tags defined:", TAGS)
assert "B-ROOT" in TAGS, "B-ROOT tag missing!"
assert "I-ROOT" in TAGS, "I-ROOT tag missing!"
assert "B-ROO" not in TAGS, "B-ROO tag should not exist!"
print("✅ Tag set is correct (ROOT not ROO)\n")

# Load dataset using relative path
dataset_path = os.path.join(script_dir, "packages", "data", "processed", "segtag.jsonl")
dataset = SegTagDataset(dataset_path)

print(f"Loaded {len(dataset)} examples\n")

# Test first few examples
for i in range(min(3, len(dataset))):
    chars, labels = dataset[i]
    row = dataset.rows[i]
    
    print(f"Example {i+1}:")
    print(f"  Word: {row['word']}")
    print(f"  Morphemes: {row['morphemes']}")
    print(f"  Labels: {row['labels'][:10]}...")  # First 10 labels
    print(f"  Char IDs length: {len(chars)}")
    print(f"  Label IDs length: {len(labels)}")
    
    # Verify lengths match
    assert len(chars) == len(labels), f"Length mismatch in example {i}"
    assert len(chars) == len(row['word']), f"Char length doesn't match word length"
    
    # Verify no invalid tags
    for label_str in row['labels']:
        assert label_str in TAG2ID, f"Invalid tag: {label_str}"
    
    print("  ✅ Validated\n")

print("✅ All Python dataset tests passed!")
