/** LLE Morphology v2 - WITH FIX FOR ROOT SPAN DRIFT */

export function createLLEMorphologyV2() {
  const morphemePatterns = {
    prefixes: [
      "counter","inter","trans","pseudo","proto","super","multi","under","over",
      "anti","auto","micro","macro","semi","sub","pre","re","un","dis","out","up","down",
    ],
    suffixes: [
      "ization","ational","acious","ically","fulness","lessly","ations",
      "ability","ation","sion","ness","ment",
      "able","ible","ward","wise","ship","hood","dom","ism","ist",
      "ize","ise","fy","ate","ent","ant","ive","ous","eous","ious","al","ic","ical","ar","ary",
      "ing","ed","er","est","ly","s",
    ],
  } as const;

  // longest-match first
  const prefixes = [...morphemePatterns.prefixes].sort((a, b) => b.length - a.length);
  const suffixes = [...morphemePatterns.suffixes].sort((a, b) => b.length - a.length);

  type MorphemeType = "prefix" | "root" | "suffix";
  type Morpheme = Readonly<{ type: MorphemeType; text: string; start: number; end: number }>;

  type Result = Readonly<{
    original: string;
    word: string;
    prefixes: readonly string[];
    root: string;
    suffixes: readonly string[];
    morphemes: readonly Morpheme[];
    complexity: number;
    confidence: number; // ✅ HIGH-LEVERAGE IMPROVEMENT #1: Confidence scores for active learning
  }>;

  function minimalStemFix(stem: string, lastSuffix: string): string {
    // Example rule (tiny and safe): if stem ends with 'e' and suffix is 'ing', drop 'e'
    if (lastSuffix === "ing" && /e$/.test(stem)) return stem.replace(/e$/, "");
    return stem;
  }

  return function morpho(input: string): Result {
    const original = input ?? "";
    const word = original.toLowerCase().trim();

    const foundPrefixes: string[] = [];
    const foundSuffixes: string[] = [];

    // ---- Prefix scan (from start, multi-affix) ----
    let consumedStart = 0;
    let search = true;

    while (search) {
      search = false;
      for (const pre of prefixes) {
        if (word.startsWith(pre, consumedStart)) {
          foundPrefixes.push(pre);
          consumedStart += pre.length;
          search = true;
          break;
        }
      }
    }

    // ---- Suffix scan (from end, multi-affix) ----
    let consumedEnd = word.length;
    search = true;

    while (search) {
      search = false;
      for (const suf of suffixes) {
        const startIdx = consumedEnd - suf.length;
        // keep at least 2 chars for root to reduce garbage splits
        if (startIdx > consumedStart + 1 && word.slice(startIdx, consumedEnd) === suf) {
          foundSuffixes.unshift(suf);
          consumedEnd = startIdx;
          search = true;
          break;
        }
      }
    }

    // ---- Root slice ----
    let root = word.slice(consumedStart, consumedEnd);

    // ✅ FIX BUG #1: if minimalStemFix changes root length, adjust consumedEnd so spans remain truthful
    const lastSuf = foundSuffixes[foundSuffixes.length - 1] ?? "";
    const fixedRoot = minimalStemFix(root, lastSuf);

    if (fixedRoot !== root) {
      const delta = root.length - fixedRoot.length; // positive if root got shorter
      root = fixedRoot;
      consumedEnd -= delta; // keep indices consistent relative to original `word`
      if (consumedEnd < consumedStart) consumedEnd = consumedStart; // hard safety clamp
    }

    // ---- Rebuild morpheme spans in original word coordinate space ----
    const morphemes: Morpheme[] = [];
    let cursor = 0;

    for (const p of foundPrefixes) {
      morphemes.push({ type: "prefix", text: p, start: cursor, end: cursor + p.length });
      cursor += p.length;
    }

    const rootStart = cursor;
    const rootEnd = rootStart + root.length;
    morphemes.push({ type: "root", text: root, start: rootStart, end: rootEnd });
    cursor = rootEnd;

    for (const s of foundSuffixes) {
      morphemes.push({ type: "suffix", text: s, start: cursor, end: cursor + s.length });
      cursor += s.length;
    }

    const complexity = foundPrefixes.length + foundSuffixes.length;
    
    // ✅ HIGH-LEVERAGE IMPROVEMENT #1: Confidence scores for active learning
    const confidence = 1 / (1 + complexity);

    return {
      original,
      word,
      prefixes: foundPrefixes,
      root,
      suffixes: foundSuffixes,
      morphemes,
      complexity,
      confidence,
    };
  };
}
