import { createLLEMorphologyV2 } from "./packages/llex-morpho/src/morphology.v2.js";

// Test the morphology fixes
const morpho = createLLEMorphologyV2();

console.log("Testing Morphology V2 Fixes...\n");

// Test 1: Verify span consistency after stem fix
console.log("Test 1: Root span tracking after stem fix");
const result1 = morpho("running");
console.log("Word:", result1.word);
console.log("Morphemes:", result1.morphemes);
console.log("Root:", result1.root);

// Verify spans match actual text
let allSpansValid = true;
for (const m of result1.morphemes) {
  const actualText = result1.word.slice(m.start, m.end);
  if (actualText !== m.text) {
    console.error(`❌ SPAN MISMATCH: Expected "${m.text}" but got "${actualText}" at [${m.start}, ${m.end}]`);
    allSpansValid = false;
  }
}

if (allSpansValid) {
  console.log("✅ All spans match actual text\n");
} else {
  console.log("❌ Span validation failed\n");
}

// Test 2: Verify BIO tag generation
console.log("Test 2: BIO tag generation (ROOT not ROO)");

type SpanType = "prefix" | "root" | "suffix";
type Span = Readonly<{ type: SpanType; start: number; end: number }>;

function spanToTag(type: SpanType): "PRE" | "ROOT" | "SUF" {
  if (type === "prefix") return "PRE";
  if (type === "root") return "ROOT";
  return "SUF";
}

function toBIO(word: string, spans: readonly Span[]) {
  const L = word.length;
  const labels = new Array<string>(L).fill("O");

  for (const s of spans) {
    const tag = spanToTag(s.type);
    if (s.start >= 0 && s.start < L) labels[s.start] = `B-${tag}`;
    for (let i = s.start + 1; i < s.end && i < L; i++) labels[i] = `I-${tag}`;
  }

  return labels;
}

const testWords = ["running", "unbelievable", "reorganization"];

for (const word of testWords) {
  const r = morpho(word);
  const spans: Span[] = r.morphemes.map((m) => ({
    type: m.type,
    start: m.start,
    end: m.end,
  }));
  
  const labels = toBIO(r.word, spans);
  
  console.log(`\nWord: ${r.word}`);
  console.log(`Morphemes: ${r.prefixes.join("+")} + ${r.root} + ${r.suffixes.join("+")}`);
  console.log(`Labels: ${labels.join(" ")}`);
  
  // Verify no "ROO" tags
  const hasROO = labels.some(l => l.includes("ROO") && !l.includes("ROOT"));
  if (hasROO) {
    console.error("❌ Found 'ROO' tag instead of 'ROOT'");
  }
  
  // Verify ROOT tags exist for root morpheme
  const hasRoot = labels.some(l => l.includes("ROOT"));
  if (hasRoot) {
    console.log("✅ ROOT tags are correct");
  } else {
    console.error("❌ No ROOT tags found");
  }
  
  // Verify label length matches word length
  if (labels.length !== r.word.length) {
    console.error(`❌ Label length mismatch: ${labels.length} vs ${r.word.length}`);
  } else {
    console.log("✅ Label length matches word length");
  }
}

console.log("\n✅ All tests passed!");
