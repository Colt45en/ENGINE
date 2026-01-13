import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLLEMorphologyV2 } from "../../llex-morpho/src/morphology.v2.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FIX BUG #2: Use full names B-ROOT/I-ROOT instead of B-ROO/I-ROO
const BIO_TAGS = ["O", "B-PREFIX", "I-PREFIX", "B-ROOT", "I-ROOT", "B-SUFFIX", "I-SUFFIX"] as const;
type BIOTag = typeof BIO_TAGS[number];

type SegmentationExample = {
  word: string;
  labels: BIOTag[];
  morphemes: Array<{
    type: string;
    text: string;
    start: number;
    end: number;
  }>;
};

type SemanticExample = {
  word: string;
  root: string;
  prefixes: string[];
  suffixes: string[];
  tags: string[];
  complexity: number;
  confidence: number; // ✅ HIGH-LEVERAGE IMPROVEMENT #1
};

/**
 * Builds segmentation dataset (BIO labels for char-level tagging)
 */
export function buildSegmentationDataset(words: string[]): SegmentationExample[] {
  const morpho = createLLEMorphologyV2();
  const examples: SegmentationExample[] = [];

  for (const word of words) {
    const result = morpho(word);
    const labels: BIOTag[] = Array(result.word.length).fill("O");

    for (const m of result.morphemes) {
      let prefix: "PREFIX" | "ROOT" | "SUFFIX";
      
      // Map type to BIO prefix
      if (m.type === "prefix") prefix = "PREFIX";
      else if (m.type === "root") prefix = "ROOT";
      else prefix = "SUFFIX";

      // First char gets B-, rest get I-
      for (let i = m.start; i < m.end; i++) {
        if (i === m.start) {
          labels[i] = `B-${prefix}` as BIOTag;
        } else {
          labels[i] = `I-${prefix}` as BIOTag;
        }
      }
    }

    examples.push({
      word: result.word,
      labels,
      morphemes: result.morphemes.map(m => ({
        type: m.type,
        text: m.text,
        start: m.start,
        end: m.end,
      })),
    });
  }

  return examples;
}

/**
 * Builds semantic dataset (affix presence + root for classification)
 */
export function buildSemanticDataset(
  words: string[],
  tagExtractor?: (word: string) => string[]
): SemanticExample[] {
  const morpho = createLLEMorphologyV2();
  const examples: SemanticExample[] = [];

  for (const word of words) {
    const result = morpho(word);
    const tags = tagExtractor ? tagExtractor(word) : [];

    examples.push({
      word: result.word,
      root: result.root,
      prefixes: [...result.prefixes],
      suffixes: [...result.suffixes],
      tags,
      complexity: result.complexity,
      confidence: result.confidence,
    });
  }

  return examples;
}

/**
 * Writes dataset to JSONL file
 */
export function writeJSONL<T>(filename: string, data: T[]): void {
  const lines = data.map(item => JSON.stringify(item)).join("\n");
  fs.writeFileSync(filename, lines, "utf-8");
  console.log(`✅ Wrote ${data.length} examples to ${filename}`);
}

/**
 * Reads JSONL file
 */
export function readJSONL<T>(filename: string): T[] {
  const content = fs.readFileSync(filename, "utf-8");
  return content
    .split("\n")
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as T);
}

// ===== Example usage =====

if (import.meta.url === `file://${process.argv[1]}`) {
  const sampleWords = [
    "reactivate",
    "unhappiness",
    "preprocessing",
    "internationalization",
    "counterproductive",
    "underestimated",
    "running",
    "walked",
    "faster",
    "beautiful",
  ];

  console.log("🔧 Building segmentation dataset...");
  const segData = buildSegmentationDataset(sampleWords);
  
  const outDir = path.join(__dirname, "../../../data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  writeJSONL(path.join(outDir, "segmentation.jsonl"), segData);

  console.log("\n🔧 Building semantic dataset...");
  const semData = buildSemanticDataset(sampleWords, (word) => {
    // Simple heuristic tag extraction (could be replaced with real logic)
    const tags: string[] = [];
    if (word.endsWith("ing")) tags.push("verb:progressive");
    if (word.endsWith("ed")) tags.push("verb:past");
    if (word.endsWith("ness")) tags.push("noun");
    if (word.endsWith("ly")) tags.push("adverb");
    return tags;
  });
  
  writeJSONL(path.join(outDir, "semantic.jsonl"), semData);

  console.log("\n✅ Dataset generation complete!");
  console.log(`\n📊 Sample segmentation example:`);
  console.log(JSON.stringify(segData[0], null, 2));
  console.log(`\n📊 Sample semantic example:`);
  console.log(JSON.stringify(semData[0], null, 2));
}
