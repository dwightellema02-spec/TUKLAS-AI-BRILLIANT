/**
 * Phase 22: Lexical retrieval (BM25) over chunks.
 * No embedding service is required; math-aware tokenisation keeps numbers and operators
 * ("-5", "+", "absolute value") searchable.
 */

export interface Retrievable {
  id: string;
  text: string;
  title?: string;
}

const STOPWORDS = new Set(
  "a an and are as at be but by do does for from had has have how i if in into is it its me my no not of on or our so than that the their then there these they this to too us was we were what when where which who why will with you your can could should would please tell show explain give about".split(" ")
);

export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const tokens: string[] = [];
  // Words and (signed) numbers; "-5" is kept distinct from "5".
  const re = /-?\d+(?:\.\d+)?|[a-z][a-z']*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lowered)) !== null) {
    const tok = m[0];
    if (!STOPWORDS.has(tok) && tok.length > 0) tokens.push(tok);
  }
  // Light stemming: plural -> singular.
  return tokens.map((t) => (t.length > 3 && /[a-z]s$/.test(t) && !/ss$/.test(t) ? t.slice(0, -1) : t));
}

export interface ScoredResult<T> {
  item: T;
  score: number;
}

export function bm25Rank<T extends Retrievable>(
  query: string,
  items: T[],
  opts: { topK?: number; minScore?: number } = {}
): ScoredResult<T>[] {
  const topK = opts.topK ?? 3;
  const minScore = opts.minScore ?? 1.0;
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0 || items.length === 0) return [];

  const docs = items.map((item) => {
    const toks = tokenize(`${item.title || ""} ${item.text}`);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { item, tf, len: toks.length };
  });

  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / N || 1;
  const k1 = 1.4;
  const b = 0.75;

  const df = new Map<string, number>();
  for (const q of queryTokens) {
    df.set(q, docs.filter((d) => d.tf.has(q)).length);
  }

  const scored = docs.map((d) => {
    let score = 0;
    for (const q of queryTokens) {
      const f = d.tf.get(q) || 0;
      if (f === 0) continue;
      const n = df.get(q) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgLen)));
    }
    return { item: d.item, score };
  });

  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);
}
