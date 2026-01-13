import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLLEMorphologyV2 } from "../../llex-morpho/src/morphology.v2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wordsPath = path.join(__dirname, "sample_words.txt");
const words = fs
  .readFileSync(wordsPath, "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const morpho = createLLEMorphologyV2();

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

const segPath = path.join(__dirname, "../../data/processed/segtag.jsonl");
const clsPath = path.join(__dirname, "../../data/processed/class.jsonl");

fs.mkdirSync(path.dirname(segPath), { recursive: true });

const segOut = fs.createWriteStream(segPath, { flags: "w" });
const clsOut = fs.createWriteStream(clsPath, { flags: "w" });

for (const w of words) {
  const r = morpho(w);

  const spans: Span[] = r.morphemes.map((m) => ({
    type: m.type,
    start: m.start,
    end: m.end,
  }));

  const labels = toBIO(r.word, spans);

  // ✅ Sanity check: label length must match word length
  if (labels.length !== r.word.length) {
    throw new Error(`Label length mismatch for ${r.word}: ${labels.length} vs ${r.word.length}`);
  }

  segOut.write(
    JSON.stringify({
      word: r.word,
      spans,
      labels,
      morphemes: [...r.prefixes, r.root, ...r.suffixes],
    }) + "\n"
  );

  // weak semantic bootstrap (same as before; replace with gold later)
  let semantic: "Action" | "State" | "Structure" | "Property" | "Entity" | "General" = "General";
  const suf = new Set(r.suffixes);

  const looksVerb = ["ize", "ise", "fy", "ate", "ing", "ed"].some((s) => suf.has(s));
  const looksNoun = ["ness", "tion", "sion", "ment", "ism", "ship", "hood", "dom"].some((s) => suf.has(s));
  const looksAdj  = ["ive", "al", "ous", "ical", "ary", "ic"].some((s) => suf.has(s));

  if (looksVerb) semantic = "Action";
  else if (looksAdj) semantic = "Property";
  else if (looksNoun) semantic = "Entity";

  clsOut.write(
    JSON.stringify({
      word: r.word,
      prefixes: r.prefixes,
      root: r.root,
      suffixes: r.suffixes,
      semantic,
    }) + "\n"
  );
}

segOut.end();
clsOut.end();

console.log("Wrote:", segPath);
console.log("Wrote:", clsPath);
