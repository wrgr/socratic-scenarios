/**
 * A fictional-fact knowledge base — the second-domain corpus for the necessity instrument.
 *
 * Every entity and value here is INVENTED (a research world that does not exist), so no model can
 * have memorized these facts. That is the whole point: for a fictional fact the ONLY way to answer
 * is to read the corpus, so a competent model must be corpus-bound at baseline (necessity ≈ 1). The
 * dose-response then TEACHES these facts into the weights and shows necessity fall — a known-groups
 * construct-validation with no simulator, just an answer checker. Mirrors the COLREG corpus (a set
 * of ablatable nodes), but the objective is answer-accuracy rather than control-regret.
 */

/** One atomic, ablatable corpus item: an attribute of a fictional entity. */
export interface Fact {
  id: string;
  entity: string;
  /** Attribute key (also the localization component). */
  attr: string;
  value: string;
  /** A plausible but FALSE value for the counterfactual corpus (the necessity probe). */
  counterfactualValue: string;
  /** Rendered corpus sentence (contains the entity, an attribute keyword, and the value). */
  text: (value: string) => string;
}

/** A question whose answer requires exactly one supporting fact. */
export interface QAItem {
  id: string;
  factId: string;
  question: string;
  /** The correct answer (the supporting fact's value). */
  answer: string;
}

// ── The world: five fictional deep-space research outposts, five attributes each ────────────────
// Attribute templates embed the entity, a distinctive attribute keyword, and the value, so the KB
// renders as natural reference sentences (no machine tags a real model could shortcut on).
const ATTRS: Record<string, { text: (e: string, v: string) => string; ask: (e: string) => string[] }> = {
  mineral: {
    text: (e, v) => `The primary mineral extracted at ${e} is ${v}.`,
    ask: (e) => [
      `What is the primary mineral extracted at ${e}?`,
      `Which mineral does ${e} mine?`,
      `${e}'s main mineral export is what?`,
    ],
  },
  commander: {
    text: (e, v) => `The station commander of ${e} is ${v}.`,
    ask: (e) => [
      `Who is the station commander of ${e}?`,
      `Name the commander in charge of ${e}.`,
      `${e} is commanded by whom?`,
    ],
  },
  power: {
    text: (e, v) => `${e} is powered by ${v}.`,
    ask: (e) => [
      `How is ${e} powered?`,
      `What is the power source of ${e}?`,
      `${e} draws its power from what?`,
    ],
  },
  established: {
    text: (e, v) => `${e} was established in the year ${v}.`,
    ask: (e) => [
      `In what year was ${e} established?`,
      `When was ${e} founded?`,
      `${e} was established in which year?`,
    ],
  },
  climate: {
    text: (e, v) => `The prevailing climate at ${e} is ${v}.`,
    ask: (e) => [
      `What is the prevailing climate at ${e}?`,
      `Describe the climate of ${e}.`,
      `${e}'s climate is best described as what?`,
    ],
  },
};

// Invented (entity, attribute → value, counterfactual) rows. Values are single distinctive tokens
// (or short phrases) so the answer checker is unambiguous.
const WORLD: { entity: string; vals: Record<string, [string, string]> }[] = [
  { entity: 'Kervan Station', vals: {
    mineral: ['veltricite', 'dornalium'], commander: ['Aada Nurmi', 'Ravi Okonkwo'],
    power: ['tidal flux coils', 'a thorium pile'], established: ['2231', '2244'],
    climate: ['ammonia fog', 'iron-dust storms'] } },
  { entity: 'Brenol Outpost', vals: {
    mineral: ['dornalium', 'veltricite'], commander: ['Ravi Okonkwo', 'Aada Nurmi'],
    power: ['a thorium pile', 'tidal flux coils'], established: ['2244', '2231'],
    climate: ['iron-dust storms', 'ammonia fog'] } },
  { entity: 'Sable Reach', vals: {
    mineral: ['quarnite', 'lumen salt'], commander: ['Petra Vhlka', 'Odell Marsh'],
    power: ['a fusion spindle', 'geothermal vents'], established: ['2258', '2261'],
    climate: ['perpetual twilight', 'methane rain'] } },
  { entity: 'Ilmar Depot', vals: {
    mineral: ['lumen salt', 'quarnite'], commander: ['Odell Marsh', 'Petra Vhlka'],
    power: ['geothermal vents', 'a fusion spindle'], established: ['2261', '2258'],
    climate: ['methane rain', 'perpetual twilight'] } },
  { entity: 'Thorne Array', vals: {
    mineral: ['cobalt glass', 'veltricite'], commander: ['Suri Tenzin', 'Aada Nurmi'],
    power: ['a helium siphon', 'tidal flux coils'], established: ['2249', '2231'],
    climate: ['static haze', 'ammonia fog'] } },
];

/** Build the full fact set + a question set (paraphrases) per fact. */
export function buildKB(): { facts: Fact[]; items: QAItem[] } {
  const facts: Fact[] = [];
  const items: QAItem[] = [];
  for (const { entity, vals } of WORLD) {
    const slug = entity.split(' ')[0].toUpperCase();
    for (const [attr, [value, counterfactualValue]] of Object.entries(vals)) {
      const id = `FACT-${slug}-${attr}`;
      facts.push({ id, entity, attr, value, counterfactualValue, text: (v) => ATTRS[attr].text(entity, v) });
      ATTRS[attr].ask(entity).forEach((q, i) => items.push({ id: `${id}-q${i}`, factId: id, question: q, answer: value }));
    }
  }
  return { facts, items };
}

/** Render the corpus (optionally ablating one fact and/or swapping one to its counterfactual). */
export function renderKB(
  facts: Fact[],
  opts: { ablateId?: string; counterfactualId?: string } = {},
): string {
  const lines = facts
    .filter((f) => f.id !== opts.ablateId)
    .map((f) => `- ${f.text(f.id === opts.counterfactualId ? f.counterfactualValue : f.value)}`);
  return lines.join('\n');
}

/** Build the QA prompt. `strict` = the corpus-binding positive control (answer only from facts). */
export function buildQAPrompt(question: string, kbText: string, strict = true): string {
  const rule = strict
    ? 'Answer using ONLY the reference facts below. If the facts do not contain the answer, reply exactly "I don\'t know". Give the shortest exact answer (a name, word, or year), nothing else.'
    : 'Answer the question. Prefer the reference facts below when relevant. Give the shortest exact answer, nothing else.';
  return `${rule}\n\nReference facts:\n${kbText || '(no facts provided)'}\n\nQuestion: ${question}\nAnswer:`;
}
