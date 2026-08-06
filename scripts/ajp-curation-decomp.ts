/**
 * Curation-impact decomposition for AJP (aerosol jet printing) — the low-prior contrast to
 * the COLREG version. Runnable.
 *
 *   GEMINI_API_KEY=... GEMINI_MODEL=gemini-flash-latest npm run ajp:curation
 *
 * AJP is equipment-specific (Optomec HD2): the correct fault + corrective action for a given
 * observable depends on KEWB pressure/current thresholds and site SOPs a general model's
 * PRIORS do not contain. We give the model an observable and ask for the fault; we score
 * against the graph ground truth. A 2x2 factorial — corpus {full, none} x prompt {bound,
 * unconstrained} — reports diagnosis ERROR RATE (lower = better) per cell, so the RAG gain
 * (curation as a knowledge source) can be read directly and contrasted with COLREG (where
 * priors already suffice).
 */
import './_env';
import {
  retryCompleter,
  throttleCompleter,
  type Completer,
  realCompleterFromEnv,
  isSafetyBlock,
} from '../src/engine/colreg-sim';
import { extendedSymptomNodes, extendedFaultNodes, extendedActionNodes } from '../src/corpus/ajp';

// The corpus context (the "rules"): symptom signatures + faults + corrective actions.
const corpusText = [...extendedSymptomNodes, ...extendedFaultNodes, ...extendedActionNodes]
  .map((n) => `[${n.id}] ${n.content}`)
  .join('\n');

// Diagnosis cases: an OBSERVABLE (no fault named) -> the correct fault and distinctive
// keywords. Answers are Optomec-specific; general priors should struggle without the corpus.
interface Case { id: string; observable: string; fault: string; keywords: RegExp }
const cases: Case[] = [
  { id: 'D1', observable: 'KEWB pressure has fallen below the nominal 4.5–5.5 PSI range and is fluctuating erratically; deposition still occurring but line quality degrading.',
    fault: 'sheath gas supply failure', keywords: /sheath|regulator|gas supply|cylinder|kink/i },
  { id: 'D2', observable: 'KEWB pressure is >7.5 PSI (more than 50% above nominal) and there is zero deposition on the substrate.',
    fault: 'full nozzle clog', keywords: /clog|occlus|disassembl|sonicat|full clean/i },
  { id: 'D3', observable: 'UA current reads 0.3 mA (below the 0.4 mA floor), no plume is visible, and KEWB pressure is nominal.',
    fault: 'atomizer malfunction', keywords: /atomiz|vial|refill|transducer|ink level/i },
  { id: 'D4', observable: 'No aerosol plume is visible, and KEWB pressure is significantly elevated above nominal.',
    fault: 'full nozzle clog (not atomizer)', keywords: /clog|occlus|disassembl|sonicat|full clean/i },
  { id: 'D5', observable: 'No aerosol plume is visible, UA current is low, and KEWB pressure is nominal.',
    fault: 'atomizer malfunction (not clog)', keywords: /atomiz|vial|refill|transducer|ink level/i },
  { id: 'D6', observable: 'KEWB pressure fluctuates below nominal and a faint white haze is visible near a tubing ferrule connection.',
    fault: 'sheath gas / supply leak', keywords: /sheath|regulator|gas supply|leak|ferrule|fitting/i },
];

function prompt(observable: string, corpus: string, strict: boolean): string {
  const clause = strict
    ? 'Use ONLY the reference notes below. If they do not cover it, set "abstained": true.'
    : 'Use your knowledge of aerosol jet printing together with any reference notes below.';
  return `You are an operator diagnosing an Optomec HD2 aerosol jet printer.

${clause}

REFERENCE NOTES:
${corpus || '(none provided)'}

OBSERVABLE:
${observable}

Respond with ONLY a JSON object: {"fault": "<short fault name>", "action": "<short corrective action>", "abstained": <true|false>}`;
}


interface CellResult { rate: number; excluded: number; answerable: number }

async function cellError(complete: Completer, corpus: 'full' | 'none', strict: boolean): Promise<CellResult> {
  let wrong = 0, excluded = 0, answerable = 0;
  for (const c of cases) {
    let raw: string;
    try {
      raw = await complete(prompt(c.observable, corpus === 'full' ? corpusText : '', strict));
    } catch (e) {
      // A safety block (or hard API error) is not a diagnosis error — the model never
      // answered. Exclude it from the denominator so a hazard-triggered block on the
      // corpus=full cell cannot masquerade as a lost RAG gain. (Same three-state discipline
      // as ajp-retrieval-decomp.ts; note that a JSON `"abstained": true` is a real response
      // and still counts as an error per the diagnostic metric — only refusals are excluded.)
      const msg = (e as Error).message ?? String(e);
      excluded++;
      if (process.env.AJP_DEBUG) console.error(`  [${c.id} ${corpus}/${strict ? 'bound' : 'unc'}] ${isSafetyBlock(msg) ? 'BLOCK' : 'ERR'}: ${msg.slice(0, 100)}`);
      continue;
    }
    answerable++;
    let ok = false;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      const d = m ? JSON.parse(m[0]) : {};
      const text = `${d.fault ?? ''} ${d.action ?? ''}`;
      ok = !d.abstained && c.keywords.test(text);
    } catch { ok = false; }
    if (process.env.AJP_DEBUG) console.error(`  [${c.id} ${corpus}/${strict ? 'bound' : 'unc'}] ${ok ? 'OK' : 'MISS'}: ${raw.slice(0, 120)}`);
    if (!ok) wrong++;
  }
  return { rate: answerable ? wrong / answerable : NaN, excluded, answerable }; // error rate over answerable cells
}


async function main() {
  const real = realCompleterFromEnv();
  if (!real) { console.log('No key — set GEMINI_API_KEY / OPENAI_API_KEY to run the AJP diagnosis instrument.'); return; }
  const rpm = Number(process.env.GEMINI_RPM ?? 5);
  const c = throttleCompleter(retryCompleter(real.completer), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  try {
    const fb = await cellError(c, 'full', true);
    const nb = await cellError(c, 'none', true);
    const fu = await cellError(c, 'full', false);
    const nu = await cellError(c, 'none', false);
    const pct = (x: number) => (Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(0)}%`).padStart(9);
    console.log(`\n── ${real.label} — AJP diagnosis ERROR rate over answerable cases (of ${cases.length}; lower = better) ──`);
    console.log('              corpus=full   corpus=none');
    console.log(`  bound       ${pct(fb.rate)}   ${pct(nb.rate)}`);
    console.log(`  unconstr.   ${pct(fu.rate)}   ${pct(nu.rate)}`);
    console.log('  attribution:');
    console.log(`    model priors alone   error(none,unconstrained) = ${pct(nu.rate)}  (HIGH ⇒ weak priors; the model does not know this equipment)`);
    console.log(`    RAG gain @ uncon.    error(none,unc) - error(full,unc) = ${pct(nu.rate - fu.rate)}  (curation as a KNOWLEDGE SOURCE)`);
    console.log(`    RAG gain @ bound     error(none,bound) - error(full,bound) = ${pct(nb.rate - fb.rate)}`);
    const totalExcluded = fb.excluded + nb.excluded + fu.excluded + nu.excluded;
    if (totalExcluded) {
      console.log(`  ⚠ ${totalExcluded} cell(s) excluded (safety block / API error), rates over answerable only — ` +
        `full/none bound: ${fb.excluded}/${nb.excluded}, unc: ${fu.excluded}/${nu.excluded}. Block rate is a signal, not an accuracy result.`);
    }
  } catch (e) {
    console.error(`\nAJP decomposition failed: ${(e as Error).message}`);
  }
}

main();
