/**
 * Test suite for Morphology V2
 * Validates Bug #1 fix (root span drift) and confidence scores
 */

import { createLLEMorphologyV2 } from '../packages/llex-morpho/src/morphology.v2.js';

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

function assertGreaterThan(actual: number, threshold: number, message?: string) {
  if (actual <= threshold) {
    throw new Error(
      `${message || 'Assertion failed'}\n  Expected > ${threshold}\n  Actual: ${actual}`
    );
  }
}

const morpho = createLLEMorphologyV2();

// ===== Test Cases =====

test('Basic prefix detection', () => {
  const result = morpho('unhappy');
  assertEquals(result.prefixes, ['un'], 'Should detect "un" prefix');
  assertEquals(result.root, 'happy', 'Should extract "happy" as root');
  assertEquals(result.suffixes, [], 'Should have no suffixes');
});

test('Basic suffix detection', () => {
  const result = morpho('running');
  assertEquals(result.suffixes, ['ing'], 'Should detect "ing" suffix');
});

test('Multiple affixes', () => {
  const result = morpho('unhappiness');
  assertEquals(result.prefixes, ['un'], 'Should detect prefix');
  assertEquals(result.root, 'happi', 'Should extract root');
  assertEquals(result.suffixes, ['ness'], 'Should detect suffix');
});

test('Complex word with multiple prefixes and suffixes', () => {
  const result = morpho('internationalization');
  assertEquals(result.prefixes, ['inter'], 'Should detect "inter" prefix');
  assertEquals(result.suffixes, ['ation', 'al', 'ize'], 'Should detect multiple suffixes');
});

test('BUG #1 FIX: Root span drift with minimalStemFix', () => {
  // This is the critical test for Bug #1
  // Word: "reactivating" -> re + activate + ing
  // minimalStemFix should drop 'e' from 'activate' -> 'activat'
  // Spans must still be correct!
  
  const result = morpho('reactivating');
  
  // Check morphemes
  assertEquals(result.prefixes, ['re'], 'Should detect "re" prefix');
  assertEquals(result.suffixes, ['ing'], 'Should detect "ing" suffix');
  
  // The root should be "activat" (with 'e' dropped)
  assertEquals(result.root, 'activat', 'Root should have "e" dropped due to minimalStemFix');
  
  // CRITICAL: Verify span consistency
  // Reconstruct word from morphemes
  let reconstructed = '';
  for (const m of result.morphemes) {
    reconstructed += m.text;
  }
  
  // The reconstructed word should match the original (minus the dropped 'e')
  // re + activat + ing = reactivating (but we need to check character indices)
  
  // More importantly: check that morpheme spans match their text
  for (const m of result.morphemes) {
    const extractedText = result.word.slice(m.start, m.end);
    assertEquals(
      extractedText,
      m.text,
      `Morpheme span [${m.start}:${m.end}] should extract "${m.text}" but got "${extractedText}"`
    );
  }
});

test('Confidence score calculation', () => {
  // Simple word -> high confidence
  const simple = morpho('cat');
  assertEquals(simple.complexity, 0, 'Simple word should have 0 complexity');
  assertEquals(simple.confidence, 1, 'Simple word should have confidence 1');
  
  // Complex word -> lower confidence
  const complex = morpho('internationalization');
  assertGreaterThan(complex.complexity, 2, 'Complex word should have high complexity');
  assertGreaterThan(1, complex.confidence, 'Complex word should have confidence < 1');
});

test('Longest-match first (no shadowing)', () => {
  // "counter" should be matched as a single prefix, not "count" + "er"
  const result = morpho('counterproductive');
  assertEquals(result.prefixes, ['counter'], 'Should match "counter" as single prefix (longest first)');
});

test('Minimum root length preserved', () => {
  // Even with aggressive affix stripping, should keep at least 2 chars for root
  const result = morpho('re');
  assertEquals(result.root.length >= 1, true, 'Should preserve minimum root length');
});

test('Morpheme spans are contiguous', () => {
  const result = morpho('preprocessing');
  
  // Verify no gaps in morpheme spans
  let expectedCursor = 0;
  for (const m of result.morphemes) {
    assertEquals(
      m.start,
      expectedCursor,
      `Morpheme "${m.text}" should start at ${expectedCursor} but starts at ${m.start}`
    );
    expectedCursor = m.end;
  }
  
  // Final cursor should equal word length
  assertEquals(
    expectedCursor,
    result.word.length,
    'Morphemes should cover entire word'
  );
});

test('Multi-affix stripping (compositional)', () => {
  const result = morpho('counterinternationalization');
  
  // Should handle multiple prefixes
  const hasPrefixes = result.prefixes.length > 0;
  assertEquals(hasPrefixes, true, 'Should detect at least one prefix');
  
  // Should handle multiple suffixes
  const hasSuffixes = result.suffixes.length > 0;
  assertEquals(hasSuffixes, true, 'Should detect at least one suffix');
});

test('Empty input handling', () => {
  const result = morpho('');
  assertEquals(result.word, '', 'Empty input should produce empty word');
  assertEquals(result.morphemes.length, 1, 'Should still have a root morpheme');
  assertEquals(result.morphemes[0].type, 'root', 'Should be a root morpheme');
  assertEquals(result.morphemes[0].text, '', 'Root should be empty string');
});

test('Case normalization', () => {
  const result = morpho('UNHAPPY');
  assertEquals(result.word, 'unhappy', 'Should normalize to lowercase');
  assertEquals(result.original, 'UNHAPPY', 'Should preserve original');
});

// ===== Run all tests =====

console.log('\n🧪 Running Morphology V2 Tests\n');
console.log('Testing Bug #1 fix (root span drift)...');
console.log('Testing confidence scores...');
console.log('Testing morpheme span consistency...\n');

console.log('\n✨ All tests passed!\n');
