/**
 * AJP Corpus Ingestion Pipeline — LightRAG pattern in TypeScript.
 *
 * Fetches public SOPs and peer literature, extracts text via Gemini Flash
 * (including PDF multimodal extraction), chunks and embeds with text-embedding-004,
 * then saves to public/ajp-corpus.json for dense retrieval at runtime.
 *
 * Usage:
 *   npx tsx scripts/ingest-corpus.ts
 *   # reads VITE_GEMINI_API_KEY from .env or environment
 *
 * Flags:
 *   --allow-partial       Exit 0 even if some sources failed (default: exit 1 on any failure).
 *   --retry-failed-only   Only re-run sources that failed in the existing public/ajp-corpus.json,
 *                          carrying over chunks from sources that already succeeded.
 *   --extract=local|gemini  PDF text extraction mode (default: local). "local" parses the PDF's
 *                          own text layer with pdf-parse — no LLM call, no quota use, but no
 *                          heading/boilerplate cleanup. "gemini" uses Gemini Flash's multimodal
 *                          extraction for nicer output, falling back to local automatically if
 *                          the Gemini call fails (e.g. free-tier quota exceeded).
 *
 * Add to package.json scripts:
 *   "ingest": "npx tsx scripts/ingest-corpus.ts"
 *
 * Sources 1-2 (public SOPs + peer literature): processed automatically.
 * Sources 3-4 (Optomec manual + expert sessions): print acquisition instructions.
 *
 * Output: public/ajp-corpus.json with { generatedAt, sourcesSummary, chunks[] }
 *
 * Extraction and embedding calls are retried with exponential backoff on Gemini
 * 429/503 errors (see scripts/lib/with-retry.ts). A source that still fails after
 * retries is reported loudly at the end and, by default, fails the whole run
 * (process.exitCode = 1) rather than silently shipping a partial corpus.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import { scrubText } from './scrub';
import { chunkWords } from './lib/chunk-text';
import { withRetry } from './lib/with-retry';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(ROOT, 'public', 'ajp-corpus.json');
const NODE_EMBEDDINGS_PATH = join(ROOT, 'public', 'ajp-node-embeddings.json');
const EMBEDDING_MODEL = 'gemini-embedding-001';
// Use the full 3072-dim output — already unit-normalized by the API, no
// post-processing required. Keeps chunks, nodes, and runtime queries in
// the same vector space at full quality.
const ENV_PATH = join(ROOT, '.env');

// ─── Config ───────────────────────────────────────────────────────

function loadApiKey(): string {
  // 1. Environment variable (CI / shell)
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
  // 2. .env file
  if (existsSync(ENV_PATH)) {
    const env = readFileSync(ENV_PATH, 'utf-8');
    const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  throw new Error(
    'VITE_GEMINI_API_KEY not found. Set it in your environment or .env file.',
  );
}

// ─── Source Definitions ───────────────────────────────────────────

interface IngestSource {
  id: string;
  label: string;
  /** Remote URL to fetch. Omit when using localPath. */
  url?: string;
  /** Absolute path to a local file. Takes precedence over url. */
  localPath?: string;
  /**
   * pdf       — PDF via Gemini multimodal (remote URL or local file)
   * html      — HTML via fetch + tag-strip
   * docx      — Word document via macOS textutil conversion
   * xml-sequences — KEWB Sequences/*.xml files → prose via custom extractor
   * xml-config    — KEWB Config/*.xml files → prose via custom extractor
   */
  format: 'pdf' | 'html' | 'docx' | 'xml-sequences' | 'xml-config';
  /** Person or org who curated / supplied this source (for provenance tracing). */
  curatedBy?: string;
  /**
   * Source category for provenance and retrieval filtering.
   * oem-corecorpus — Authoritative OEM documentation (procedures, parameters, Q&A)
   * schema         — Machine structure definitions (sequences, device topology)
   * config         — Operational configuration (alarms, user variables, thresholds)
   */
  sourceCategory?: 'oem-corecorpus' | 'schema' | 'config';
}

const ACTIVE_SOURCES: IngestSource[] = [
  {
    id: 'stanford-snf-sop',
    label: 'Stanford SNF Optomec AJ300 Manual (2018)',
    url: 'https://snfguide.stanford.edu/files/sections/diplayfiles/final_copy_of_optomec_manual_0.pdf',
    format: 'pdf',
  },
  {
    id: 'boise-state-iml-sop',
    label: 'Boise State IML AJP SOP v1.0 (2020)',
    url: 'https://www.boisestate.edu/coen-imfl/wp-content/uploads/sites/690/2020/04/AJP-SOP_ver1.0_Final.pdf',
    format: 'pdf',
  },
  {
    id: 'pmc9412835',
    label: 'AJP Review — PMC 9412835',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9412835/',
    format: 'html',
  },
  {
    id: 'nature-line-quality',
    label: 'AJP Line Quality Study — Nature Scientific Reports',
    url: 'https://www.nature.com/articles/s41598-023-47544-4',
    format: 'html',
  },
  {
    id: 'frontiers-fault-analysis',
    label: 'AJP Fault Analysis — Frontiers Manufacturing Technology',
    url: 'https://www.frontiersin.org/journals/manufacturing-technology/articles/10.3389/fmtec.2025.1558209/full',
    format: 'html',
  },
  // ── Eddie-curated papers ─────────────────────────────────────────
  // localPath is relative to a gitignored local-sources/ directory you populate
  // yourself — see local-sources/README.md. Never commit an absolute path here.
  {
    id: 'chen-2018-overspray',
    label: 'Chen 2018 — Droplet Sizes and Overspray in AJP (Adv. Eng. Mater.)',
    localPath: './local-sources/review-articles/chen-2018-overspray.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },
  {
    id: 'gu-2017-fillets',
    label: 'Gu 2017 — AJP Fillets for Electrical Connections Between DLS (Adv. Mater. Technol.)',
    localPath: './local-sources/review-articles/gu-2017-fillets.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },
  {
    id: 'fisher-2023-sensors',
    label: 'Fisher 2023 — AJP Sensors for Environmental/Safety/Health Monitoring Review (Adv. Mater. Technol.)',
    localPath: './local-sources/review-articles/fisher-2023-sensors.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },
  {
    id: 'secor-2018-principles',
    label: 'Secor 2018 — Principles of Aerosol Jet Printing (Flex. Print. Electron.)',
    localPath: './local-sources/review-articles/secor-2018-principles.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },
  {
    id: 'wilkinson-2019-review',
    label: 'Wilkinson 2019 — Review of AJP Non-Traditional Hybrid Process (Int. J. Adv. Manuf. Technol.)',
    localPath: './local-sources/review-articles/wilkinson-2019-review.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },
  {
    id: 'salary-2019-state-of-art',
    label: 'Salary 2019 — State-of-the-Art Review on AJP Additive Manufacturing (MSEC 2019)',
    localPath: './local-sources/review-articles/salary-2019-state-of-art.pdf',
    format: 'pdf',
    curatedBy: 'Eddie',
  },

  // ── HD2 OEM Documentation — officially-numbered vendor manuals ──
  // These are the numbered PDFs (P/N ####) issued by Optomec, distinct from the
  // unnumbered "HD2 Documentation" .docx trio (Training Manual/Q&A/Definitions),
  // whose authorship/redistribution rights are unconfirmed — see EXCLUDED_SOURCES.
  {
    id: 'hd2-motion-vision-kewb',
    label: 'AJ HD2 Motion and Vision Manual with KEWB (OEM P/N 9001094)',
    localPath: './local-sources/oem-manuals/9001094-motion-vision-kewb.pdf',
    format: 'pdf',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-health-safety',
    label: 'AJ Health and Safety Guidelines (OEM P/N 9000876)',
    localPath: './local-sources/oem-manuals/9000876-health-safety.pdf',
    format: 'pdf',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-process-manual',
    label: 'Aerosol Jet Process Manual (OEM P/N 9000983)',
    localPath: './local-sources/oem-manuals/9000983-process-manual.pdf',
    format: 'pdf',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-process-dev-session11',
    label: 'AJ Process Development Techniques — Session 11 (OEM 24450)',
    localPath: './local-sources/process-guides/24450-process-dev-session11.pdf',
    format: 'pdf',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-block-diagram',
    label: 'HD2 Hardware Block Diagram (Dec 2022)',
    localPath: './local-sources/oem-manuals/hd2-block-diagram.pdf',
    format: 'pdf',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },

  // ── HD2 Documentation — unnumbered .docx (promoted from EXCLUDED, 2026-07-13) ──
  // Extracted text (scrubbed via scrubText) is ingested; the raw .docx is never
  // shipped (gitignored local-sources/). Redistribution rights for these unnumbered
  // docs are unconfirmed — flagged for later legal review, not a rebuild gate.
  {
    id: 'hd2-training-manual',
    label: 'HD2 Training Manual',
    localPath: './local-sources/hd2-documentation/hd2-training-manual.docx',
    format: 'docx',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-qanda',
    label: 'HD2 Questions and Answers',
    localPath: './local-sources/hd2-documentation/hd2-qanda.docx',
    format: 'docx',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
  {
    id: 'hd2-definitions',
    label: 'HD2 Definitions — Component Glossary',
    localPath: './local-sources/hd2-documentation/hd2-definitions.docx',
    format: 'docx',
    curatedBy: 'OEM',
    sourceCategory: 'oem-corecorpus',
  },
];

/**
 * Sources deliberately excluded from the public corpus after a sensitivity
 * review (2026-07), kept here (not deleted) so the exclusion is documented
 * rather than silently invisible. Surfaced in the app's Domain Sources panel
 * as "Excluded (sensitivity review)".
 */
export const EXCLUDED_SOURCES = [
  {
    id: 'hd2-sequences',
    label: 'KEWB Sequence Files — Canonical HD2 Procedure Schema',
    reason:
      'Raw exported machine configuration (Sequences/*.xml) from a real deployed HD2, not ' +
      'vendor-published documentation — contains real recipe/toolpath filenames identifying ' +
      'the specific deployment. The general procedure-sequence knowledge derived from this is ' +
      'preserved, abstracted, in the knowledge graph (src/corpus/ajp/canonical-steps.ts).',
  },
  {
    id: 'hd2-alarms',
    label: 'KEWB Alarm Catalog (Config/Alarms.xml)',
    reason:
      'Raw exported machine configuration from a real deployed HD2. The alarm-severity ' +
      'knowledge itself is preserved, abstracted, in the knowledge graph ' +
      '(src/corpus/ajp/design-faults.ts, FAULT-BUBBLER-TEMP-*/FAULT-UA-TEMP-* nodes etc.).',
  },
  {
    id: 'hd2-process-config',
    label: 'KEWB Process Configuration — Device Topology (Config/Process_Configuration.xml)',
    reason:
      'Raw exported machine configuration from a real deployed HD2 — contains real network ' +
      'addresses, camera serial numbers, and a chiller COM port for the specific deployment. ' +
      'The device-role knowledge itself is preserved, abstracted, in the knowledge graph ' +
      '(src/corpus/ajp/design-faults.ts, EQUIP-ATM-MFC-001 etc. — generic MFC/heater roles, ' +
      'no real addresses or serials).',
  },
];

const STUB_SOURCES = [
  {
    id: 'hd2-motion-vision-kewb-full',
    label: 'AJ HD2 Full Operator Manual with KEWB Fault Codes',
    note: `
    PARTIAL: The Motion/Vision Manual (9001094) is in ACTIVE_SOURCES. If a separate full
    operator manual (P/N 9000324 or equivalent) exists with additional KEWB fault codes or
    stage homing failure codes, add it:
      Save as: local-sources/oem-manuals/optomec-hd2-full-manual.pdf
      Add to ACTIVE_SOURCES (format: 'pdf', sourceCategory: 'oem-corecorpus')
    `,
  },
  {
    id: 'expert-session-transcripts',
    label: 'AJP Expert Elicitation Transcripts',
    note: `
    REQUIRED: Conduct SME sessions per docs/expert-elicitation-guidelines.md.
    Open gaps:
      - GAP-003/015: Sheath gas flow setpoints (SLPM) for each nozzle size
      - GAP-010: Stage homing failure codes
      - BOOST_MFC role and typical operating setpoint
      - LASER_MFC assist gas type (N2? Ar?) and typical flow rate
    Save transcripts as: docs/expert-sessions/session-1.txt (2.txt, 3.txt)
    Then add to ACTIVE_SOURCES above and re-run this script.
    `,
  },
];

// ─── Text Extraction ──────────────────────────────────────────────

/**
 * "local" parses the PDF's own text layer with pdf-parse — free, instant, no
 * Gemini quota use, but no heading/boilerplate cleanup. "gemini" asks Gemini
 * Flash's multimodal extraction to also clean up structure, at the cost of a
 * generateContent call (and its free-tier quota) per source.
 */
type ExtractMode = 'local' | 'gemini';

const REMOTE_PDF_PROMPT = `Extract the complete text from this AJP (Aerosol Jet Printing) document.
Preserve section headings and the logical structure of the document.
Output plain text — no markdown, no tables (convert table content to prose).
Focus on operational content: procedures, parameters, fault modes, safety warnings.
Skip administrative boilerplate (title pages, approval signatures, TOC).`;

const LOCAL_PDF_PROMPT = `Extract the complete text from this AJP (Aerosol Jet Printing) document.
Preserve section headings and the logical structure of the document.
Output plain text — no markdown, no tables (convert table content to prose).
Focus on technical content: process principles, parameters, fault modes, experimental results, safety warnings.
Skip administrative boilerplate (title pages, approval signatures, TOC, author affiliations).`;

/** Parse a PDF's own text layer — no LLM call, no quota use. */
async function extractPdfTextLocally(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractPdfTextViaGemini(
  buffer: Buffer,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  focusPrompt: string,
): Promise<string> {
  const base64 = buffer.toString('base64');
  const result = await withRetry(
    () => flashModel.generateContent([
      { inlineData: { data: base64, mimeType: 'application/pdf' } },
      focusPrompt,
    ]),
    { onRetry: (attempt, attempts, err, delayMs) => console.warn(
      `  ⟳ retrying extraction (attempt ${attempt + 1}/${attempts}, waiting ${(delayMs / 1000).toFixed(0)}s): ${err instanceof Error ? err.message : err}`,
    ) },
  );
  return result.response.text();
}

/** Extract PDF text per `mode`; "gemini" mode falls back to local parsing if the Gemini call fails. */
async function extractPdfBuffer(
  buffer: Buffer,
  mode: ExtractMode,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  focusPrompt: string,
): Promise<string> {
  if (mode === 'local') return extractPdfTextLocally(buffer);

  try {
    return await extractPdfTextViaGemini(buffer, flashModel, focusPrompt);
  } catch (err) {
    console.warn(
      `  ⚠ Gemini extraction failed, falling back to local PDF parsing: ${err instanceof Error ? err.message : err}`,
    );
    return extractPdfTextLocally(buffer);
  }
}

async function extractPdfText(
  url: string,
  mode: ExtractMode,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<string> {
  console.log(`  Fetching PDF: ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TeachMe-Corpus-Ingestion/1.0' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`  Extracting text from PDF (${Math.round(buffer.byteLength / 1024)} KB, ${mode})…`);
  return extractPdfBuffer(buffer, mode, flashModel, REMOTE_PDF_PROMPT);
}

async function extractLocalPdfText(
  localPath: string,
  mode: ExtractMode,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<string> {
  console.log(`  Reading local PDF: ${localPath}`);
  const buffer = await readFile(localPath);
  console.log(`  Extracting text from local PDF (${Math.round(buffer.byteLength / 1024)} KB, ${mode})…`);
  return extractPdfBuffer(buffer, mode, flashModel, LOCAL_PDF_PROMPT);
}

// ─── DOCX Extraction ─────────────────────────────────────────────

/**
 * Extract plain text from a .docx file using macOS `textutil`.
 * Falls back gracefully if textutil is unavailable.
 */
function extractDocxText(localPath: string): string {
  console.log(`  Extracting DOCX: ${localPath}`);
  try {
    const text = execSync(
      `textutil -convert txt -stdout "${localPath.replace(/"/g, '\\"')}"`,
      { maxBuffer: 10 * 1024 * 1024 },
    ).toString('utf-8');
    if (text.trim().length < 50) throw new Error('textutil returned empty output');
    return text;
  } catch (err) {
    throw new Error(
      `DOCX extraction failed (requires macOS textutil): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── XML Extractors ───────────────────────────────────────────────

/**
 * Extract prose from a directory of KEWB Sequence XML files.
 * Each sequence becomes a paragraph describing its steps in order.
 * Only processes the top-level sequences (not all subsequences) for clarity.
 */
function extractXmlSequences(sequencesDir: string): string {
  const TOP_LEVEL_SEQUENCES = [
    'Machine Start-Up.xml',
    '1 - Cassette Change.xml',
    '2 - UA Leak Check.xml',
    '3 - UA Start Process .xml',
    '4 - Set Z-height with Alignment Camera to Nozzle offset.xml',
    '5 - Load New Part.xml',
    '6 - Print Board with Laser Sintering.xml',
    '6 - Print Board.xml',
    '7 - Shutdown UA Process.xml',
    'Machine Shut Down.xml',
    'Start UA Temperatures.xml',
    'Maint - Home System.xml',
    'UA Shutdown Process.xml',
    '000 - Repair Demonstration.xml',
  ];

  const sections: string[] = [
    'KEWB Canonical Sequence Catalog for Optomec HD2 Aerosol Jet Printer.\n',
    'These sequences define the authoritative procedure ordering for the deployed KEWB system.\n',
  ];

  const files = readdirSync(sequencesDir).filter((f) => f.endsWith('.xml'));

  for (const filename of files) {
    const filePath = join(sequencesDir, filename);
    const isPriority = TOP_LEVEL_SEQUENCES.includes(filename);
    const label = isPriority ? '[PRIMARY SEQUENCE]' : '[SUBSEQUENCE]';

    const raw = readFileSync(filePath, 'utf-8');
    const seqName = (raw.match(/<Sequence Name="([^"]+)"/) || [])[1] || filename.replace('.xml', '');
    const descMatch = raw.match(/<Description><!\[CDATA\[([^\]]+)\]\]>/);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract step descriptions
    const stepMatches = [...raw.matchAll(/<DisplayMessage><!\[CDATA\[([^\]]+)\]\]>/g)];
    const steps = [...new Set(stepMatches.map((m) => m[1].trim()))].filter(Boolean);

    let section = `Sequence: ${seqName} ${label}.\n`;
    if (description) section += `Description: ${description}\n`;
    if (steps.length > 0) {
      section += `Steps in order: ${steps.join(' → ')}.`;
    }
    sections.push(section);
  }

  return sections.join('\n\n');
}

/**
 * Extract prose from a KEWB Config XML file (Alarms.xml, Process_Configuration.xml, etc.)
 * Produces human-readable descriptions of each configured item.
 */
function extractXmlConfig(localPath: string): string {
  const raw = readFileSync(localPath, 'utf-8');
  const filename = localPath.split('/').pop() ?? localPath;

  if (filename === 'Alarms.xml') {
    const sections: string[] = [
      'KEWB Alarm Catalog for Optomec HD2. Severity scale: 0=Information, 1=Warning (Yellow), 2=Error (Orange), 3=Critical (Red).\n',
    ];
    const alarmMatches = [...raw.matchAll(/<Name>([^<]+)<\/Name>[\s\S]*?<Severity>(\d)<\/Severity>/g)];
    const severityNames: Record<string, string> = { '0': 'Information', '1': 'Warning', '2': 'Error', '3': 'Critical' };
    for (const m of alarmMatches) {
      const name = m[1];
      const sev = m[2];
      sections.push(`Alarm: "${name}". Severity: ${sev} (${severityNames[sev] ?? 'Unknown'}). This KEWB alarm fires a message box when triggered.`);
    }
    return sections.join('\n');
  }

  if (filename.includes('Process_Configuration')) {
    const sections: string[] = [
      'KEWB Process Configuration for Optomec HD2. Defines all hardware devices and their operational parameters.\n',
    ];

    // Extract MFC devices
    const mfcMatches = [...raw.matchAll(/<Alicat:MFC Id="[^"]+">[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Alicat:Min>([^<]+)<\/Alicat:Min>[\s\S]*?<Alicat:Max>([^<]+)<\/Alicat:Max>/g)];
    for (const m of mfcMatches) {
      sections.push(`Gas Flow Controller (Alicat MFC): ${m[1]}. Range: ${m[2]}–${m[3]} SCCM. Controlled via KEWB recipe and sequence steps.`);
    }

    // Extract heaters
    const heaterMatches = [...raw.matchAll(/<Omron:Heater Id="[^"]+">[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Omron:Min>([^<]+)<\/Omron:Min>[\s\S]*?<Omron:Max>([^<]+)<\/Omron:Max>/g)];
    for (const m of heaterMatches) {
      sections.push(`Heater Controller (Omron): ${m[1]}. Range: ${m[2]}–${m[3]} °C. Temperature controlled by KEWB.`);
    }

    return sections.join('\n');
  }

  // Generic: return raw text stripped of XML tags
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractHtmlFromUrl(url: string): Promise<string> {
  console.log(`  Fetching HTML: ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TeachMe-Corpus-Ingestion/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const html = await response.text();
  return extractHtmlText(html);
}

// ─── Chunking ─────────────────────────────────────────────────────

/** Split text into overlapping chunks of ~350 words with 50-word overlap. */
function chunkText(
  text: string,
  sourceId: string,
  sourceLabel: string,
  curatedBy?: string,
  sourceCategory?: string,
): Array<{
  id: string;
  source: string;
  section: string;
  text: string;
  curatedBy?: string;
  sourceCategory?: string;
}> {
  return chunkWords(text).map((c) => ({
    id: `${sourceId}-chunk-${c.index}`,
    source: sourceLabel,
    section: c.sectionHint || `Section ${c.index + 1}`,
    text: c.content,
    ...(curatedBy ? { curatedBy } : {}),
    ...(sourceCategory ? { sourceCategory } : {}),
  }));
}

// ─── Embedding ────────────────────────────────────────────────────

interface ChunkWithEmbedding {
  id: string;
  source: string;
  section: string;
  text: string;
  embedding: number[];
  /** Who curated / supplied this chunk's source document (for provenance filtering). */
  curatedBy?: string;
  /** Source category for retrieval filtering: oem-corecorpus | schema | config */
  sourceCategory?: string;
}

/** Embed chunks in batches of 20 to respect API rate limits. */
async function embedChunks(
  chunks: Array<{ id: string; source: string; section: string; text: string; curatedBy?: string; sourceCategory?: string }>,
  embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<ChunkWithEmbedding[]> {
  const BATCH_SIZE = 20;
  const DELAY_MS = 1000; // 1 second between batches
  const results: ChunkWithEmbedding[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`  Embedding chunks ${i + 1}–${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length}…`);

    const embeddings = await Promise.all(
      batch.map((c) => withRetry(
        () => embeddingModel.embedContent(c.text),
        { onRetry: (attempt, attempts, err, delayMs) => console.warn(
          `    ⟳ retrying embedding for ${c.id} (attempt ${attempt + 1}/${attempts}, waiting ${(delayMs / 1000).toFixed(0)}s): ${err instanceof Error ? err.message : err}`,
        ) },
      )),
    );

    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], embedding: embeddings[j].embedding.values });
    }

    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}

// ─── CLI flags ────────────────────────────────────────────────────

interface SourceSummaryEntry { id: string; label: string; chunks: number; status: string }
interface ExistingCorpus { sourcesSummary: SourceSummaryEntry[]; chunks: ChunkWithEmbedding[] }

function loadExistingCorpus(): ExistingCorpus | null {
  if (!existsSync(OUTPUT_PATH)) return null;
  const raw = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
  return { sourcesSummary: raw.sourcesSummary ?? [], chunks: raw.chunks ?? [] };
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== AJP Corpus Ingestion Pipeline ===\n');

  const args = process.argv.slice(2);
  const allowPartial = args.includes('--allow-partial');
  const retryFailedOnly = args.includes('--retry-failed-only');
  const extractModeArg = args.find((a) => a.startsWith('--extract='))?.split('=')[1];
  const extractMode: ExtractMode = extractModeArg === 'gemini' ? 'gemini' : 'local';
  console.log(`PDF extraction mode: ${extractMode}${extractModeArg && extractModeArg !== 'local' && extractModeArg !== 'gemini' ? ` (unrecognized "--extract=${extractModeArg}", defaulting to local)` : ''}\n`);

  const apiKey = loadApiKey();
  const genai = new GoogleGenerativeAI(apiKey);
  const flashModel = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const embeddingModel = genai.getGenerativeModel({ model: EMBEDDING_MODEL });

  // Print stub acquisition notes
  console.log('─── Stub Sources (action required) ───');
  for (const stub of STUB_SOURCES) {
    console.log(`\n[${stub.id}] ${stub.label}:${stub.note}`);
  }
  console.log('─────────────────────────────────────\n');

  console.log('─── Excluded Sources (sensitivity review — not ingested) ───');
  for (const excluded of EXCLUDED_SOURCES) {
    console.log(`  [${excluded.id}] ${excluded.label} — ${excluded.reason}`);
  }
  console.log('──────────────────────────────────────────────────────────\n');

  let sourcesToProcess = ACTIVE_SOURCES;
  const allChunks: ChunkWithEmbedding[] = [];
  const sourcesSummary: SourceSummaryEntry[] = [];

  if (retryFailedOnly) {
    const existing = loadExistingCorpus();
    if (!existing) {
      console.error('--retry-failed-only requires an existing public/ajp-corpus.json to retry against.');
      process.exit(1);
    }
    const failedIds = new Set(existing.sourcesSummary.filter((s) => s.status !== 'ok').map((s) => s.id));
    if (failedIds.size === 0) {
      console.log('No failed sources in the existing corpus — nothing to retry.');
      return;
    }
    console.log(`─── Retrying ${failedIds.size} previously-failed source(s): ${[...failedIds].join(', ')} ───\n`);
    sourcesToProcess = ACTIVE_SOURCES.filter((s) => failedIds.has(s.id));
    // Carry over chunks/summary entries for sources that already succeeded.
    allChunks.push(...existing.chunks.filter((c) => ![...failedIds].some((id) => c.id.startsWith(`${id}-chunk-`))));
    sourcesSummary.push(...existing.sourcesSummary.filter((s) => !failedIds.has(s.id)));
  }

  for (const source of sourcesToProcess) {
    console.log(`\nProcessing: ${source.label}`);
    let rawText: string;

    try {
      if (source.format === 'docx' && source.localPath) {
        rawText = extractDocxText(source.localPath);
      } else if (source.format === 'xml-sequences' && source.localPath) {
        rawText = extractXmlSequences(source.localPath);
      } else if (source.format === 'xml-config' && source.localPath) {
        rawText = extractXmlConfig(source.localPath);
      } else if (source.localPath) {
        rawText = await extractLocalPdfText(source.localPath, extractMode, flashModel);
      } else if (source.format === 'pdf' && source.url) {
        rawText = await extractPdfText(source.url, extractMode, flashModel);
      } else if (source.url) {
        rawText = await extractHtmlFromUrl(source.url);
      } else {
        throw new Error('Source has neither localPath nor url');
      }

      // Sensitivity scrub — codename, deployment framing, site-specific recipe
      // filenames, and OEM employee names — applied before chunking so no rebuild
      // reintroduces them. Single source of truth: scripts/scrub.ts.
      rawText = scrubText(rawText);

      if (rawText.trim().length < 200) {
        throw new Error('Extracted text too short — source may be inaccessible or paywalled');
      }

      console.log(`  Extracted ${rawText.split(/\s+/).length} words`);
      const chunks = chunkText(rawText, source.id, source.label, source.curatedBy, source.sourceCategory);
      console.log(`  Created ${chunks.length} chunks`);

      const embedded = await embedChunks(chunks, embeddingModel);
      allChunks.push(...embedded);

      sourcesSummary.push({ id: source.id, label: source.label, chunks: embedded.length, status: 'ok' });
      console.log(`  ✓ ${source.label} — ${embedded.length} chunks indexed`);
    } catch (err) {
      // Redact any Google API key that Gemini errors echo back, so it can never
      // reach the console log or the committed public/ajp-corpus.json metadata.
      const msg = (err instanceof Error ? err.message : String(err)).replace(/AIza[0-9A-Za-z_-]{30,}/g, '[key-redacted]');
      console.warn(`  ✗ SKIPPED: ${msg}`);
      sourcesSummary.push({ id: source.id, label: source.label, chunks: 0, status: `error: ${msg}` });
    }
  }

  // Restore original ACTIVE_SOURCES ordering (retry-failed-only appends carried-over
  // entries first, then newly-retried ones) so the summary reads predictably.
  const orderIndex = new Map(ACTIVE_SOURCES.map((s, i) => [s.id, i]));
  sourcesSummary.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

  const hardFailures = sourcesSummary.filter((s) => s.status !== 'ok');
  if (hardFailures.length > 0) {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log(`║  ${hardFailures.length} of ${sourcesSummary.length} source(s) FAILED to ingest — corpus is incomplete  `);
    console.log('╚═══════════════════════════════════════════════════════════╝');
    for (const f of hardFailures) {
      console.log(`  ✗ [${f.id}] ${f.label}\n      ${f.status}`);
    }
    console.log('\nRe-run with: npx tsx scripts/ingest-corpus.ts --retry-failed-only');
    if (!allowPartial) {
      console.log('Exiting with a non-zero status because the corpus is incomplete.');
      console.log('Pass --allow-partial to accept a partial corpus and exit 0 anyway.\n');
      process.exitCode = 1;
    } else {
      console.log('Continuing anyway because --allow-partial was passed.\n');
    }
  }

  // Save chunk output
  mkdirSync(join(ROOT, 'public'), { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    model: EMBEDDING_MODEL,
    totalChunks: allChunks.length,
    sourcesSummary,
    stubs: STUB_SOURCES.map((s) => ({ id: s.id, label: s.label, status: 'not-ingested' })),
    excluded: EXCLUDED_SOURCES.map((s) => ({ id: s.id, label: s.label, reason: s.reason })),
    chunks: allChunks,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  const fileSizeKB = Math.round(JSON.stringify(output).length / 1024);

  if (retryFailedOnly) {
    console.log(`\n=== Retry Complete ===`);
    console.log(`Output: public/ajp-corpus.json (${fileSizeKB} KB)`);
    console.log(`Total chunks: ${allChunks.length}`);
    for (const s of sourcesSummary) {
      const icon = s.status === 'ok' ? '✓' : '✗';
      console.log(`  ${icon} ${s.label}: ${s.chunks} chunks`);
    }
    console.log('\n(Skipped graph node embeddings — unaffected by source retries. Run a full `npm run ingest` to refresh those.)');
    return;
  }

  // ─── Graph Node Embeddings ─────────────────────────────────────
  // Bake Gemini vectors for every graph node so runtime doesn't pay a
  // cold-start embedding call. Loaded by graph-utils.buildNodeEmbeddingCache.
  console.log('\n─── Graph Node Embeddings ───');
  const { allNodes } = await import('../src/engine/retrieval/graph-utils.ts');
  console.log(`Embedding ${allNodes.length} graph nodes…`);

  const nodeEmbeddings: Array<{ id: string; type: string; content: string; embedding: number[] }> = [];
  const NODE_BATCH = 20;
  const NODE_DELAY_MS = 1000;
  for (let i = 0; i < allNodes.length; i += NODE_BATCH) {
    const batch = allNodes.slice(i, i + NODE_BATCH);
    console.log(`  Embedding nodes ${i + 1}–${Math.min(i + NODE_BATCH, allNodes.length)} of ${allNodes.length}…`);
    const embs = await Promise.all(batch.map((n) => withRetry(
      () => embeddingModel.embedContent(n.content),
      { onRetry: (attempt, attempts, err, delayMs) => console.warn(
        `    ⟳ retrying node embedding for ${n.id} (attempt ${attempt + 1}/${attempts}, waiting ${(delayMs / 1000).toFixed(0)}s): ${err instanceof Error ? err.message : err}`,
      ) },
    )));
    batch.forEach((n, j) => nodeEmbeddings.push({
      id: n.id,
      type: n.type,
      content: n.content,
      embedding: embs[j].embedding.values,
    }));
    if (i + NODE_BATCH < allNodes.length) {
      await new Promise((r) => setTimeout(r, NODE_DELAY_MS));
    }
  }

  const nodeOutput = {
    generatedAt: new Date().toISOString(),
    model: EMBEDDING_MODEL,
    totalNodes: nodeEmbeddings.length,
    nodes: nodeEmbeddings,
  };
  writeFileSync(NODE_EMBEDDINGS_PATH, JSON.stringify(nodeOutput));
  const nodeFileSizeKB = Math.round(JSON.stringify(nodeOutput).length / 1024);

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Output: public/ajp-corpus.json (${fileSizeKB} KB)`);
  console.log(`Output: public/ajp-node-embeddings.json (${nodeFileSizeKB} KB, ${nodeEmbeddings.length} nodes)`);
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`Total chunks: ${allChunks.length}`);
  for (const s of sourcesSummary) {
    const icon = s.status === 'ok' ? '✓' : '✗';
    console.log(`  ${icon} ${s.label}: ${s.chunks} chunks`);
  }
  console.log(`\nRun the app — InOperationView will automatically use dense retrieval.`);
}

main().catch((err) => {
  console.error('\nIngestion failed:', err);
  process.exit(1);
});
