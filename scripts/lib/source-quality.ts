/** Reject blocked or truncated extractions before they can replace reviewed corpus data. */
import { scrubText } from '../scrub';

/** Reject inaccessible content before source-specific cleanup or chunking. */
export function assertSourceContent(text: string): void {
  const head = text.slice(0, 1000);
  if (/client challenge|checking your browser|javascript is disabled in your browser|verify (?:that )?you are human/i.test(head)) {
    throw new Error('Source returned a browser challenge instead of document content');
  }
  if (text.trim().length < 200) throw new Error('Extracted text too short — source may be inaccessible or paywalled');
}

/** Validate source text and apply the existing scrub and revision-log policies. */
export function prepareSourceText(text: string, omitRevisionLog = false): string {
  assertSourceContent(text);
  // The OEM process manual's revision log contains employee names; remove the
  // whole log, including continuation pages, rather than maintaining a name list.
  const withoutDownloadMetadata = text.replace(/^.*Downloaded from.*(?:\r?\n|$)/gmi, '');
  const withoutLog = omitRevisionLog
    ? withoutDownloadMetadata.replace(/\bRevisions\b[\s\S]*?(?=\bDisclaimer\b)/, '')
    : withoutDownloadMetadata;
  const result = scrubText(withoutLog);
  assertSourceContent(result);
  return result;
}

/** Reject unfinished or heavily condensed model output relative to the PDF text layer. */
export function assertCompletePdfText(text: string, reference: string, finishReason: string | undefined): void {
  if (finishReason !== 'STOP') throw new Error(`PDF model extraction did not finish normally: ${finishReason ?? 'unknown'}`);
  const count = (value: string): number => value.split(/\s+/).filter(Boolean).length;
  if (count(reference) > 200 && count(text) < count(reference) * 0.8) {
    throw new Error('PDF model extraction retained less than 80% of the local text; using complete local extraction');
  }
}

/** Identify one corpus source by its exact chunk-ID namespace, avoiding prefix collisions. */
export function chunkBelongsToSource(chunkId: string, sourceId: string): boolean {
  return chunkId.startsWith(`${sourceId}-chunk-`);
}

/** Reject incompatible or invalid vectors before replacing any corpus chunks. */
export function assertEmbedding(values: number[], dimensions = 3072): void {
  if (values.length !== dimensions || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid embedding: expected ${dimensions} finite values`);
  }
}

/** Keep provider errors useful without echoing API keys into logs or corpus metadata. */
export function safeSourceError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/AIza[0-9A-Za-z_-]{30,}/g, '[key-redacted]');
}
