/** Fuse keyword and semantic passage ranks while checking explicit source and entity constraints. */
import type { DenseChunk, DenseMatch } from './dense-retrieval';

export interface PassageEvidence {
  status: 'passages-found' | 'insufficient-evidence' | 'unavailable';
  message: string;
}

export interface PassageRanking {
  matches: DenseMatch[];
  evidence: PassageEvidence;
}

interface DocumentTerms { chunk: DenseChunk; terms: Map<string, number>; length: number }
interface PassageIndex { documents: DocumentTerms[]; frequency: Map<string, number>; averageLength: number; identifiers: Set<string> }
const indexes = new WeakMap<DenseChunk[], PassageIndex>();
const STOP = new Set(('a an and are as at be been before by can could did do does for from had has have how i if in into is it its may must of on or our should so some than that the their them there these they this those to using was we were what when where which who why will with without would you your according specified recommend recommended review study paper please tell explain give show find help want know about').split(' '));

/** Normalize ordinary inflections and comparison phrases without inventing domain facts. */
export function passageTerms(text: string): string[] {
  return text.toLowerCase().replace(/([a-z])-\s+([a-z])/g, '$1$2')
    .replace(/at least|minimum/g, ' lowerbound ').replace(/at most|maximum/g, ' upperbound ')
    .replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
    .filter((term) => term.length > 2 && !STOP.has(term))
    .map((term) => term.length > 6 && term.endsWith('ing') ? term.slice(0, -3).replace(/([b-df-hj-np-tv-z])\1$/, '$1')
      : term.length > 5 && term.endsWith('ies') ? `${term.slice(0, -3)}y`
      : term.length > 5 && term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : term)
    .filter((term) => !STOP.has(term));
}

function indexFor(chunks: DenseChunk[]): PassageIndex {
  const cached = indexes.get(chunks);
  if (cached) return cached;
  const frequency = new Map<string, number>();
  const documents = chunks.map((chunk) => {
    const terms = new Map<string, number>();
    const tokens = passageTerms(`${chunk.source} ${chunk.section} ${chunk.text}`);
    for (const token of tokens) terms.set(token, (terms.get(token) ?? 0) + 1);
    for (const token of terms.keys()) frequency.set(token, (frequency.get(token) ?? 0) + 1);
    return { chunk, terms, length: tokens.length };
  });
  const index = { documents, frequency, averageLength: documents.reduce((n, d) => n + d.length, 0) / Math.max(1, documents.length),
    identifiers: new Set(chunks.flatMap((chunk) => (`${chunk.id} ${chunk.source} ${chunk.text}`.match(/\b[a-z]{1,12}[-_\s]?\d{3,}(?:[-_][a-z0-9]+)*\b/gi) ?? [])
      .map((id) => id.toLowerCase().replace(/[^a-z0-9]/g, '')))) };
  indexes.set(chunks, index);
  return index;
}

/** Identify requested part/model IDs independently of similarity scores. */
export function missingPassageIdentifiers(query: string, chunks: DenseChunk[]): string[] {
  const ids = query.match(/\b[a-z]{1,12}[-_]?\d{3,}(?:[-_][a-z0-9]+)*\b/gi) ?? [];
  const identifiers = indexFor(chunks).identifiers;
  return ids.filter((id) => !identifiers.has(id.toLowerCase().replace(/[^a-z0-9]/g, '')));
}

function requestedSources(query: string, chunks: DenseChunk[]): Set<string> | null {
  if (!/\b(manuals?|reviews?|stud(?:y|ies)|papers?|according)\b/i.test(query)) return null;
  const labels = [...new Set(chunks.map((chunk) => chunk.source))];
  const terms = new Set(passageTerms(query));
  const leading = labels.map((label) => ({ label, name: label.match(/^[a-z]+/i)?.[0].toLowerCase() }));
  const named = leading.filter(({ name }) => name && leading.filter((item) => item.name === name).length === 1 && new RegExp(`\\b${name}\\b`, 'i').test(query));
  if (named.length) return new Set(named.map((item) => item.label));
  const frequencies = new Map<string, number>();
  for (const label of labels) for (const term of new Set(passageTerms(label))) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const scored = labels.map((label) => {
    const overlap = [...new Set(passageTerms(label))].filter((term) => terms.has(term));
    return { label, overlap, score: overlap.reduce((sum, term) => sum + Math.log(1 + labels.length / (frequencies.get(term) ?? 1)), 0) };
  }).filter((item) => item.overlap.length >= 2 || item.overlap.some((term) => frequencies.get(term) === 1 && !['process', 'train', 'quality', 'safety', 'print'].includes(term)));
  // A distinctive author/journal/title term outranks generic words such as
  // aerosol/jet/printing shared by several labels. Keep every explicitly named
  // source for comparison questions instead of silently choosing just one.
  const explicit = scored.filter((item) => item.overlap.some((term) => frequencies.get(term) === 1));
  if (explicit.length) return new Set(explicit.map((item) => item.label));
  const kind = /\bmanuals?\b/i.test(query) ? 'manual' : /\breviews?\b/i.test(query) ? 'review' : /\bstud(?:y|ies)\b/i.test(query) ? 'study' : null;
  const sameKind = scored.filter((item) => kind && item.label.toLowerCase().includes(kind));
  sameKind.sort((a, b) => b.score - a.score);
  if (!sameKind.length) return null;
  return new Set(sameKind.filter((item) => item.score >= sameKind[0].score * 0.95).map((item) => item.label));
}

function keywordScore(document: DocumentTerms, query: string[], index: PassageIndex): number {
  let score = 0;
  const length = document.length / Math.max(1, index.averageLength);
  for (const term of query) {
    const tf = document.terms.get(term) ?? 0;
    if (!tf) continue;
    const df = index.frequency.get(term) ?? 0;
    const idf = Math.log(1 + (index.documents.length - df + 0.5) / (df + 0.5));
    score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * length));
  }
  return score;
}

/** Reject passages missing the kind of quantitative evidence a question explicitly requests. */
function hasRequestedQuantity(query: string, text: string): boolean {
  const requirements: Array<[RegExp, RegExp]> = [
    [/\b(magnification|magnify)\b/i, /\d+\s*[xX]\b/],
    [/\b(torque)\b/i, /\d+(?:\.\d+)?\s*(?:in[\s-]*lb|n[\s-]*m|newton|foot|ft)/i],
    [/\b(temperature|chiller)\b.*\b(setting|recommend|what|specified)\b|what.*\b(temperature)\b/i, /\d+(?:\.\d+)?\s*[°\uf0b0]?\s*(?:c\b|f\b|degrees)/i],
    [/\b(volume|amount)\b.*\b(solvent|ink|material)\b|\b(solvent|ink|material)\b.*\b(volume|amount)\b/i, /\d+(?:\.\d+)?\s*(?:ml|milliliter|millilitre|liter|litre)\b/i],
  ];
  return requirements.every(([question, evidence]) => !question.test(query) || evidence.test(text));
}

/** Rank candidate passages; source constraints and absent identifiers apply before display/context assembly. */
export function rankPassages(query: string, chunks: DenseChunk[], semantic: DenseMatch[] = [], topK = 5, minScore = 0): PassageRanking {
  if (!chunks.length) return { matches: [], evidence: { status: 'unavailable', message: 'The document corpus is unavailable.' } };
  const missing = missingPassageIdentifiers(query, chunks);
  if (missing.length) return { matches: [], evidence: { status: 'insufficient-evidence', message: `No source passage mentions ${missing.join(', ')}. Check the identifier or provide its documentation.` } };
  const index = indexFor(chunks);
  const terms = [...new Set(passageTerms(query))];
  const labels = [...new Set(chunks.map((chunk) => chunk.source))].map((label) => new Set(passageTerms(label)));
  // Equipment and document-title words cannot establish support for an unknown
  // capability. Measure topic coverage after removing shared source framing.
  const topic = terms.filter((term) => labels.filter((label) => label.has(term)).length < 3);
  const known = topic.filter((term) => index.frequency.has(term));
  if (!known.length || (topic.length >= 3 && known.length / topic.length < 0.6)) {
    return { matches: [], evidence: { status: 'insufficient-evidence', message: 'No source passage directly supports this question. Try a more specific equipment or procedure description.' } };
  }
  const sources = requestedSources(query, chunks);
  const candidates = index.documents.filter((d) => !sources || sources.has(d.chunk.source));
  const lexical = candidates.map((d) => ({ chunk: d.chunk, raw: keywordScore(d, terms, index) }))
    .filter((item) => item.raw > 0).sort((a, b) => b.raw - a.raw);
  const semanticRanks = new Map(semantic.filter((m) => !sources || sources.has(m.chunk.source)).map((m, i) => [m.chunk.id, { rank: i + 1, score: m.score }]));
  const lexicalRanks = new Map(lexical.map((m, i) => [m.chunk.id, i + 1]));
  const ranked = candidates.map(({ chunk }) => {
    const lexRank = lexicalRanks.get(chunk.id);
    const sem = semanticRanks.get(chunk.id);
    const lex = lexRank ? lexical[lexRank - 1].raw : 0;
    return { chunk, score: sem?.score ?? 1 - Math.exp(-lex / 10),
      rankingScore: (lexRank ? 0.65 / (10 + lexRank) : 0) + (sem ? 0.35 / (10 + sem.rank) : 0) };
  }).filter((m) => m.rankingScore > 0 && m.score >= minScore && hasRequestedQuantity(query, m.chunk.text))
    .sort((a, b) => b.rankingScore - a.rankingScore).slice(0, topK);
  return { matches: ranked, evidence: ranked.length
    ? { status: 'passages-found', message: 'Retrieved passages are candidates for evidence. Verify the answer in the cited text; similarity is not answer confidence.' }
    : { status: 'insufficient-evidence', message: 'No passage was found with the specific evidence requested. Consult the source document or provide additional documentation.' } };
}
