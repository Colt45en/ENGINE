/**
 * Word Engine Integration
 * Provides safe JSON parsing and word record coalescing for telemetry ingestion
 */

export type WordRecord = {
  word: string;
  context?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Safe JSON parser that doesn't throw
 */
export function safeJSON<T = unknown>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

/**
 * Coalesces raw word record data into a clean WordRecord
 */
export function coalesceWordRecord(raw: unknown): WordRecord | null {
  if (!raw || typeof raw !== "object") return null;
  
  const obj = raw as Record<string, unknown>;
  
  // Must have a word field
  if (typeof obj.word !== "string" || !obj.word.trim()) return null;

  const record: WordRecord = {
    word: obj.word.trim(),
  };

  if (typeof obj.context === "string") {
    record.context = obj.context;
  }

  if (typeof obj.timestamp === "number") {
    record.timestamp = obj.timestamp;
  }

  if (obj.metadata && typeof obj.metadata === "object") {
    record.metadata = obj.metadata as Record<string, unknown>;
  }

  return record;
}

/**
 * Extract tags from metadata via reflection
 */
export function extractTags(metadata?: Record<string, unknown>): string[] {
  if (!metadata) return [];
  
  const tags: string[] = [];
  
  // Look for common tag fields
  if (Array.isArray(metadata.tags)) {
    tags.push(...metadata.tags.filter((t): t is string => typeof t === "string"));
  }
  
  if (typeof metadata.category === "string") {
    tags.push(`category:${metadata.category}`);
  }
  
  if (typeof metadata.type === "string") {
    tags.push(`type:${metadata.type}`);
  }

  return tags;
}

/**
 * Heuristic semantic bootstrapping
 * Provides weak supervision for words based on simple rules
 */
export function heuristicSemanticTags(word: string): string[] {
  const tags: string[] = [];
  const lower = word.toLowerCase();

  // Verb forms
  if (lower.endsWith("ing")) tags.push("verb:progressive");
  if (lower.endsWith("ed")) tags.push("verb:past");
  if (lower.endsWith("s") && !lower.endsWith("ss")) tags.push("verb:third-person");

  // Noun forms
  if (lower.endsWith("ness")) tags.push("noun:abstract");
  if (lower.endsWith("tion") || lower.endsWith("sion")) tags.push("noun:action");
  if (lower.endsWith("ity") || lower.endsWith("ability")) tags.push("noun:quality");
  if (lower.endsWith("ment")) tags.push("noun:result");

  // Adjective forms
  if (lower.endsWith("able") || lower.endsWith("ible")) tags.push("adj:capable");
  if (lower.endsWith("ful")) tags.push("adj:full-of");
  if (lower.endsWith("less")) tags.push("adj:without");
  if (lower.endsWith("ous") || lower.endsWith("ious")) tags.push("adj:characterized-by");
  if (lower.endsWith("ive")) tags.push("adj:tending-to");

  // Adverb forms
  if (lower.endsWith("ly")) tags.push("adverb");

  // Comparative/Superlative
  if (lower.endsWith("er") && lower.length > 4) tags.push("comparative");
  if (lower.endsWith("est") && lower.length > 5) tags.push("superlative");

  return tags;
}

/**
 * Process a batch of word records from telemetry
 */
export function processWordBatch(rawBatch: string[]): WordRecord[] {
  const records: WordRecord[] = [];

  for (const raw of rawBatch) {
    const parsed = safeJSON(raw);
    const record = coalesceWordRecord(parsed);
    
    if (record) {
      // Enrich with heuristic tags if not present
      const existingTags = extractTags(record.metadata);
      const heuristicTags = heuristicSemanticTags(record.word);
      
      if (!record.metadata) {
        record.metadata = {};
      }
      
      const allTags = [...new Set([...existingTags, ...heuristicTags])];
      if (allTags.length > 0) {
        record.metadata.tags = allTags;
      }
      
      records.push(record);
    }
  }

  return records;
}
