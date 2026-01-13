/**
 * Test suite for Dataset Generation
 * Validates Bug #2 fix (B-ROOT/I-ROOT instead of B-ROO/I-ROO)
 */

import { buildSegmentationDataset, buildSemanticDataset } from '../packages/llex-dataset/src/build_jsonl.js';

// Simple test runner
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    process.exit(1);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message || 'Assertion failed'}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
    );
  }
}

function assertContains<T>(array: T[], item: T, message?: string) {
  if (!array.includes(item)) {
    throw new Error(
      `${message || 'Assertion failed'}\n  Array does not contain: ${JSON.stringify(item)}\n  Array: ${JSON.stringify(array)}`
    );
  }
}

// ===== Test Cases =====

test('BUG #2 FIX: Uses B-ROOT and I-ROOT (not B-ROO)', () => {
  const dataset = buildSegmentationDataset(['running']);
  const example = dataset[0];
  
  // Check that labels use full "ROOT" name
  const hasRootLabel = example.labels.some(label => 
    label === 'B-ROOT' || label === 'I-ROOT'
  );
  
  assertEquals(hasRootLabel, true, 'Should use B-ROOT or I-ROOT labels');
  
  // Verify no "ROO" labels exist
  const hasRooLabel = example.labels.some(label => 
    label.includes('ROO') && !label.includes('ROOT')
  );
  
  assertEquals(hasRooLabel, false, 'Should NOT use B-ROO or I-ROO labels');
});

test('Segmentation dataset structure', () => {
  const dataset = buildSegmentationDataset(['unhappy']);
  
  assertEquals(dataset.length, 1, 'Should have one example');
  
  const example = dataset[0];
  assertEquals(example.word, 'unhappy', 'Should have word field');
  assertEquals(Array.isArray(example.labels), true, 'Should have labels array');
  assertEquals(Array.isArray(example.morphemes), true, 'Should have morphemes array');
  
  // Labels should match word length
  assertEquals(
    example.labels.length,
    example.word.length,
    'Labels array should match word length'
  );
});

test('BIO tagging correctness', () => {
  const dataset = buildSegmentationDataset(['unhappy']);
  const example = dataset[0];
  
  // Word: unhappy
  // Morphemes: un (prefix) + happy (root)
  // Expected labels: [B-PREFIX, I-PREFIX, B-ROOT, I-ROOT, I-ROOT, I-ROOT, I-ROOT]
  
  assertEquals(example.labels[0], 'B-PREFIX', 'First char of prefix should be B-PREFIX');
  assertEquals(example.labels[1], 'I-PREFIX', 'Second char of prefix should be I-PREFIX');
  assertEquals(example.labels[2], 'B-ROOT', 'First char of root should be B-ROOT');
  assertEquals(example.labels[3], 'I-ROOT', 'Subsequent chars of root should be I-ROOT');
});

test('All valid BIO tags are from approved set', () => {
  const VALID_TAGS = ["O", "B-PREFIX", "I-PREFIX", "B-ROOT", "I-ROOT", "B-SUFFIX", "I-SUFFIX"];
  
  const dataset = buildSegmentationDataset(['running', 'unhappy', 'internationalization']);
  
  for (const example of dataset) {
    for (const label of example.labels) {
      assertContains(VALID_TAGS, label, `Invalid BIO tag: ${label}`);
    }
  }
});

test('Semantic dataset structure', () => {
  const dataset = buildSemanticDataset(['running']);
  
  assertEquals(dataset.length, 1, 'Should have one example');
  
  const example = dataset[0];
  assertEquals(example.word, 'running', 'Should have word field');
  assertEquals(typeof example.root, 'string', 'Should have root field');
  assertEquals(Array.isArray(example.prefixes), true, 'Should have prefixes array');
  assertEquals(Array.isArray(example.suffixes), true, 'Should have suffixes array');
  assertEquals(Array.isArray(example.tags), true, 'Should have tags array');
  assertEquals(typeof example.complexity, 'number', 'Should have complexity field');
  assertEquals(typeof example.confidence, 'number', 'Should have confidence field');
});

test('Semantic dataset includes confidence scores', () => {
  const dataset = buildSemanticDataset(['cat', 'internationalization']);
  
  const simple = dataset[0];
  const complex = dataset[1];
  
  // Simple word should have higher confidence
  assertEquals(simple.confidence > complex.confidence, true, 
    'Simple word should have higher confidence than complex word');
});

test('Tag extraction works', () => {
  const tagExtractor = (word: string) => {
    if (word.endsWith('ing')) return ['verb:progressive'];
    return [];
  };
  
  const dataset = buildSemanticDataset(['running'], tagExtractor);
  const example = dataset[0];
  
  assertContains(example.tags, 'verb:progressive', 'Should extract tags via custom function');
});

test('Multiple words in dataset', () => {
  const words = ['running', 'walked', 'faster', 'beautiful'];
  const dataset = buildSegmentationDataset(words);
  
  assertEquals(dataset.length, words.length, 'Should create example for each word');
  
  // Verify each example has correct word
  for (let i = 0; i < words.length; i++) {
    assertEquals(dataset[i].word, words[i], `Example ${i} should match input word`);
  }
});

test('Morpheme spans in segmentation dataset', () => {
  const dataset = buildSegmentationDataset(['unhappy']);
  const example = dataset[0];
  
  // Should have morpheme metadata
  assertEquals(example.morphemes.length > 0, true, 'Should have morphemes');
  
  // Each morpheme should have required fields
  for (const morpheme of example.morphemes) {
    assertEquals(typeof morpheme.type, 'string', 'Morpheme should have type');
    assertEquals(typeof morpheme.text, 'string', 'Morpheme should have text');
    assertEquals(typeof morpheme.start, 'number', 'Morpheme should have start');
    assertEquals(typeof morpheme.end, 'number', 'Morpheme should have end');
  }
});

test('Affix extraction in semantic dataset', () => {
  const dataset = buildSemanticDataset(['reactivate']);
  const example = dataset[0];
  
  // Should detect prefix "re"
  assertContains(example.prefixes, 're', 'Should detect "re" prefix');
  
  // Should have a root
  assertEquals(example.root.length > 0, true, 'Should have non-empty root');
});

// ===== Run all tests =====

console.log('\n🧪 Running Dataset Generation Tests\n');
console.log('Testing Bug #2 fix (B-ROOT/I-ROOT)...');
console.log('Testing BIO tagging...');
console.log('Testing dataset schemas...\n');

console.log('\n✨ All tests passed!\n');
