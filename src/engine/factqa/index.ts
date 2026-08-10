/** Fact-QA domain — the necessity instrument on an answer-accuracy objective (no simulator). */
export {
  type Fact,
  type QAItem,
  buildKB,
  renderKB,
  buildQAPrompt,
} from './kb';
export { normalizeAnswer, answerCorrect, isAbstention } from './verify';
export {
  runFactProbe,
  runFactQAExperiment,
  boundQALearner,
  memorizedQALearner,
  ignorantQALearner,
  partiallyMemorizedQALearner,
  type FactVerdict,
  type FactQAReport,
  type FactQAConfig,
  type Verdict,
  type LeakMode,
} from './instrument';
