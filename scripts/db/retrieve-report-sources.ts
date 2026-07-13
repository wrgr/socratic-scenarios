#!/usr/bin/env tsx
/**
 * scripts/db/retrieve-report-sources.ts
 *
 * Multistep source retrieval from deep-research report markdown files:
 * 1) Extract cited URLs
 * 2) Retrieve HTML/PDF content
 * 3) Convert retrieved text into ingest-ready KB markdown files
 * 4) Write a retrieval manifest for auditability
 *
 * Usage:
 *   npm run db:retrieve-report-sources
 *   npx tsx scripts/db/retrieve-report-sources.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const KB_DIR = resolve(ROOT, 'docs/kb-candidates');
const MANIFEST_PATH = resolve(ROOT, 'knowledge/report-source-retrieval.json');

const REPORT_PATHS = [
  resolve(KB_DIR, '09_operational_corpus_research_design.md'),
  resolve(KB_DIR, '10_tacit_elicitation_methods_review.md'),
];

type SourceFormat = 'html' | 'pdf';

interface RetrievalRecord {
  url: string;
  format: SourceFormat;
  outputFile: string | null;
  status: 'ok' | 'skipped' | 'error';
  words: number;
  note?: string;
}

function loadApiKey(): string | null {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;

  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return null;
  const env = readFileSync(envPath, 'utf8');
  const gemini = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
  if (gemini) return gemini;
  const viteGemini = env.match(/^VITE_GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
  return viteGemini ?? null;
}

function extractUrlsFromMarkdown(md: string): string[] {
  const matches = md.match(/https?:\/\/[^\s`|)]+/g) ?? [];
  const cleaned = matches
    .map((u) => u.replace(/[),.;]+$/, '').trim())
    .filter((u) => u.startsWith('http'));
  return Array.from(new Set(cleaned));
}

function inferFormat(url: string): SourceFormat {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('/pdf')) return 'pdf';
  return 'html';
}

function slugFromUrl(url: string): string {
  const normalized = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized.slice(0, 60);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSegments(text: string, wordsPerSegment = 320): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const segments: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const slice = words.slice(i, i + wordsPerSegment);
    if (slice.length < 40) continue;
    segments.push(slice.join(' '));
  }
  return segments;
}

async function extractPdfText(
  url: string,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TeachMe-Source-Retrieval/1.0' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const result = await flashModel.generateContent([
    {
      inlineData: { data: base64, mimeType: 'application/pdf' },
    },
    'Extract plain text focused on operational procedures, parameters, diagnostics, and safety guidance.',
  ]);
  return result.response.text();
}

function buildKbMarkdown(url: string, segments: string[], truncated: boolean): string {
  const lines: string[] = [
    '---',
    'domain: ajp',
    `source: ${url}`,
    'confidence: Medium',
    'chunk_type: external-source-extract',
    'difficulty: advanced',
    'role_context: process-engineer',
    '---',
    '',
    `# Retrieved Source: ${url}`,
    '',
    '## Retrieval Notes',
    '',
    `- Retrieved at: ${new Date().toISOString()}`,
    `- Segment count: ${segments.length}`,
    `- Truncated: ${truncated ? 'yes' : 'no'}`,
    '',
  ];

  for (let i = 0; i < segments.length; i++) {
    lines.push(`## Extract Segment ${i + 1}`);
    lines.push('');
    lines.push(segments[i]);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const urls = new Set<string>();
  for (const reportPath of REPORT_PATHS) {
    if (!existsSync(reportPath)) {
      throw new Error(`Report not found: ${reportPath}`);
    }
    const content = readFileSync(reportPath, 'utf8');
    for (const url of extractUrlsFromMarkdown(content)) urls.add(url);
  }

  const allUrls = Array.from(urls).sort();
  console.log(`Found ${allUrls.length} unique URLs in report files.`);
  if (allUrls.length === 0) return;

  const apiKey = loadApiKey();
  const canProcessPdf = Boolean(apiKey);
  const flashModel = apiKey
    ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' })
    : null;

  const records: RetrievalRecord[] = [];
  let generatedCount = 0;
  let idx = 21;

  for (const url of allUrls) {
    const format = inferFormat(url);
    console.log(`\n[${format.toUpperCase()}] ${url}`);

    if (format === 'pdf' && !canProcessPdf) {
      records.push({
        url,
        format,
        outputFile: null,
        status: 'skipped',
        words: 0,
        note: 'Skipped PDF retrieval: GEMINI_API_KEY not found',
      });
      console.log('  skipped (missing GEMINI_API_KEY for PDF text extraction)');
      continue;
    }

    try {
      let text = '';
      if (format === 'html') {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'TeachMe-Source-Retrieval/1.0' },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        text = stripHtml(await response.text());
      } else {
        text = await extractPdfText(url, flashModel!);
      }

      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 120) {
        records.push({
          url,
          format,
          outputFile: null,
          status: 'skipped',
          words: words.length,
          note: 'Retrieved text too short',
        });
        console.log(`  skipped (${words.length} words, too short)`);
        continue;
      }

      const cappedWords = words.slice(0, 3200);
      const truncated = words.length > cappedWords.length;
      const segments = toSegments(cappedWords.join(' '));
      if (segments.length === 0) {
        records.push({
          url,
          format,
          outputFile: null,
          status: 'skipped',
          words: words.length,
          note: 'No valid segments after chunking',
        });
        console.log('  skipped (no valid segments)');
        continue;
      }

      const fileName = `${String(idx).padStart(2, '0')}_retrieved_${slugFromUrl(url)}.md`;
      const outputPath = resolve(KB_DIR, fileName);
      const markdown = buildKbMarkdown(url, segments, truncated);
      writeFileSync(outputPath, markdown, 'utf8');

      records.push({
        url,
        format,
        outputFile: outputPath,
        status: 'ok',
        words: cappedWords.length,
        note: truncated ? 'Truncated to 3200 words' : undefined,
      });

      idx++;
      generatedCount++;
      console.log(`  ok → ${basename(outputPath)} (${cappedWords.length} words, ${segments.length} segments)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      records.push({
        url,
        format,
        outputFile: null,
        status: 'error',
        words: 0,
        note: message,
      });
      console.log(`  error: ${message}`);
    }
  }

  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reportPaths: REPORT_PATHS,
        generatedCount,
        records,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`\nGenerated ${generatedCount} ingest-ready source file(s).`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Next step: node --import tsx scripts/db/ingest-kb.ts`);
}

main().catch((err) => {
  console.error('retrieve-report-sources failed:', err);
  process.exit(1);
});

