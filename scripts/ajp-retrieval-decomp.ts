/**
 * AJP curation decomposition WITH REAL RETRIEVAL — separates the two halves of curation
 * impact: corpus CONTENT vs RETRIEVAL quality. Runnable (needs a Gemini key for embeddings).
 *
 *   GEMINI_API_KEY=... GEMINI_MODEL=gemini-flash-latest npm run ajp:retrieval
 *
 * Task: equipment-specific FACT RECALL — exact Optomec HD2 / site-SOP values a general model
 * cannot guess (gas-flow recipes, shutdown timing, standoff range, cleaning protocol). Each
 * question is scored against the corpus ground truth over three context conditions:
 *   - none      : closed-book (model PRIORS only)
 *   - retrieved : top-k chunks from the real dense retriever over public/ajp-corpus.json
 *   - oracle    : the gold chunk that actually contains the answer (perfect retrieval)
 * Attribution:
 *   CONTENT value    = acc(oracle)    - acc(none)      -- worth of the curated knowledge
 *   RETRIEVAL gap    = acc(oracle)    - acc(retrieved) -- what the retriever leaves on the table
 *   real-RAG value   = acc(retrieved) - acc(none)      -- what a deployed RAG actually delivers
 */
import './_env';
import { readFileSync } from 'node:fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiCompleter, retryCompleter, throttleCompleter, type Completer } from '../src/engine/colreg-sim';

interface Chunk { id: string; section: string; text: string; embedding: number[] }
const corpus: Chunk[] = JSON.parse(
  readFileSync(new URL('../public/ajp-corpus.json', import.meta.url), 'utf8'),
).chunks;

function cosine(a: number[], b: number[]) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

// Equipment-specific recall questions. `answer` = ALL regexes must match the model's reply.
// `gold` = distinctive substring in the corpus chunk that holds the answer (oracle context).
interface Q { id: string; q: string; answer: RegExp[]; gold: string }
const questions: Q[] = [
  { id: 'shutdown', q: 'When shutting down the three AJP gas flows, in what order and with what wait times between them?',
    answer: [/atomizer[\s\S]{0,50}10\s*s[\s\S]{0,60}exhaust[\s\S]{0,50}60\s*s[\s\S]{0,50}sheath/i], gold: 'atomizer -> wait 10 s -> exhaust -> wait 60 s -> sheath' },
  { id: 'flows150', q: 'For a 150 µm nozzle, what are the recommended sheath, atomizer, and exhaust gas flow rates (sccm)?',
    answer: [/55\s*-?\s*60\s*sccm/i, /600\s*sccm/i, /570\s*sccm/i], gold: 'sheath flow of 55-60 sccm, an atomizer flow of ~600 sccm' },
  { id: 'standoff', q: 'What is the nominal allowed standoff distance range between the nozzle and the substrate?',
    answer: [/3\s*[~\-–to ]{1,4}5\s*mm/i], gold: 'range of allowed distances is nominally 3 ~ 5 mm' },
  { id: 'inklevel', q: 'How far below the small hole on the side of the jet should the ink level be kept?',
    answer: [/15\s*mm/i], gold: 'ink level is 15mm below the small hole' },
  { id: 'cleaning', q: 'What is the cleaning protocol for non-critical parts (which solvents, and for how long each)?',
    answer: [/branson/i, /10\s*min/i], gold: 'Water (10min x 2 times), Branson' },
  { id: 'flows200', q: 'For a 200 µm nozzle, what sheath gas flow is recommended (sccm)?',
    answer: [/80\s*-?\s*90\s*sccm/i], gold: 'nozzle size of 200 µm, a sheath flow of 80-90 sccm' },
  { id: 'reenable', q: 'After a stop, how long until the motion controller automatically re-enables the axes?',
    answer: [/10\s*s(econds)?/i], gold: 'After 10 seconds the motion controller will automatically re-enable' },
];

async function embed(key: string, text: string): Promise<number[]> {
  const m = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-embedding-001' });
  return (await m.embedContent(text)).embedding.values;
}

function prompt(q: string, context: string): string {
  return `You are an operator of an Optomec HD2 aerosol jet printer. Answer the question precisely with specific values.
Use your own knowledge together with any reference notes below.

REFERENCE NOTES:
${context || '(none provided)'}

QUESTION: ${q}

Answer in one or two sentences with the specific values.`;
}

async function accuracy(complete: Completer, mode: 'none' | 'retrieved' | 'oracle', key: string): Promise<number> {
  let correct = 0;
  for (const q of questions) {
    let context = '';
    if (mode === 'oracle') {
      const gold = corpus.find((c) => c.text.includes(q.gold));
      context = gold ? `[${gold.id}] ${gold.text}` : '';
    } else if (mode === 'retrieved') {
      const qe = await embed(key, q.q);
      context = corpus.map((c) => ({ c, s: cosine(qe, c.embedding) }))
        .sort((a, b) => b.s - a.s).slice(0, 5).map((m) => `[${m.c.id}] ${m.c.text}`).join('\n\n');
    }
    const reply = await complete(prompt(q.q, context));
    const ok = q.answer.every((re) => re.test(reply));
    if (process.env.AJP_DEBUG) console.error(`  [${q.id} ${mode}] ${ok ? 'OK ' : 'MISS'} :: ${reply.replace(/\s+/g, ' ').slice(0, 120)}`);
    if (ok) correct++;
  }
  return correct / questions.length;
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('Set GEMINI_API_KEY (needed for gemini-embedding-001 retrieval).'); return; }
  const model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
  const rpm = Number(process.env.GEMINI_RPM ?? 5);
  const complete = throttleCompleter(retryCompleter(geminiCompleter(key, model)), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  try {
    const none = await accuracy(complete, 'none', key);
    const retrieved = await accuracy(complete, 'retrieved', key);
    const oracle = await accuracy(complete, 'oracle', key);
    const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
    console.log(`\n── ${model} — AJP fact recall accuracy over ${questions.length} equipment-specific questions ──`);
    console.log(`  none (priors only)     ${pct(none)}`);
    console.log(`  retrieved (real RAG)   ${pct(retrieved)}`);
    console.log(`  oracle (gold chunk)    ${pct(oracle)}`);
    console.log('  attribution:');
    console.log(`    CONTENT value   acc(oracle)-acc(none)      = ${pct(oracle - none)}   (worth of the curated knowledge)`);
    console.log(`    RETRIEVAL gap   acc(oracle)-acc(retrieved) = ${pct(oracle - retrieved)}   (what the retriever leaves on the table)`);
    console.log(`    real-RAG value  acc(retrieved)-acc(none)   = ${pct(retrieved - none)}   (what a deployed RAG delivers)`);
  } catch (e) {
    console.error(`\nFailed: ${(e as Error).message}`);
  }
}

main();
