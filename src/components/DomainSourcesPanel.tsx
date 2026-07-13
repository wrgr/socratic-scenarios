/**
 * Domain Sources — the AJP equipment/process fact sources behind the corpus,
 * as opposed to the pedagogy/AI-methodology bibliography in REFERENCE_SECTIONS.
 *
 * Three catalogs, all computed rather than hand-maintained so this view can't
 * silently drift from what's actually cited/ingested:
 *  - Citation registry: every SRC-### source-ref-registry.ts entry (external
 *    third-party documents), cross-referenced against the live corpus graph
 *    for real citation counts.
 *  - Internal tacit-knowledge docs: KB-DOC-## entries (authored by this
 *    project, not a third party), same cross-reference treatment.
 *  - Dense-retrieval corpus: the documents actually chunked and indexed for
 *    hybrid retrieval (public/ajp-corpus.json), including ones that failed
 *    to parse or haven't been ingested yet.
 */
import { useEffect, useState } from 'react';
import { getRegistryUsageReport, getKbDocUsageReport } from '../corpus/source-usage';

interface CorpusSourceSummary {
  id: string;
  label: string;
  chunks: number;
  status: string;
}

interface CorpusSourceStub {
  id: string;
  label: string;
  status: string;
}

interface CorpusSourceExcluded {
  id: string;
  label: string;
  reason: string;
}

interface CorpusManifest {
  sourcesSummary?: CorpusSourceSummary[];
  stubs?: CorpusSourceStub[];
  excluded?: CorpusSourceExcluded[];
}

function useCorpusManifest() {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}ajp-corpus.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not ok'))))
      .then((data: CorpusManifest) => { if (!cancelled) setManifest(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  return { manifest, error };
}

export function DomainSourcesPanel() {
  const registry = getRegistryUsageReport();
  const kbDocs = getKbDocUsageReport();
  const { manifest, error } = useCorpusManifest();

  const uncited = registry.filter((r) => r.citedByNodeIds.length === 0);
  const cited = registry.filter((r) => r.citedByNodeIds.length > 0);

  const kbDocsCited = kbDocs.filter((d) => d.citedByNodeIds.length > 0);
  const kbDocsSurfacedOnly = kbDocs.filter((d) => d.citedByNodeIds.length === 0 && d.surfacedElsewhere);
  const kbDocsOrphaned = kbDocs.filter((d) => d.citedByNodeIds.length === 0 && !d.surfacedElsewhere);

  const summary = manifest?.sourcesSummary ?? [];
  const indexed = summary.filter((s) => s.status === 'ok' && s.chunks > 0);
  const notParsed = summary.filter((s) => s.status !== 'ok' || s.chunks === 0);
  const stubs = manifest?.stubs ?? [];
  const excludedSources = manifest?.excluded ?? [];

  return (
    <div className="domain-sources">
      <p className="domain-sources-intro">
        Every document backing AJP domain facts — the citation registry that powers inline
        source popovers, and the corpus actually chunked and indexed for retrieval. All lists
        are computed from the live corpus, not hand-maintained. Sources dropped after a
        sensitivity review (unconfirmed vendor rights, or raw configuration from a real
        deployment) are listed under "Excluded" below rather than silently vanishing.
      </p>

      <div className="domain-sources-group">
        <h4 className="ajp-reference-topic-title">Citation registry ({registry.length})</h4>
        <ul className="domain-sources-list">
          {cited.map((r) => (
            <li key={r.id} className="domain-source-row">
              <div className="domain-source-main">
                <span className="domain-source-id">{r.id}</span>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="ajp-reference-link">
                    {r.title}
                  </a>
                ) : (
                  <span className="ajp-reference-title">{r.title}</span>
                )}
              </div>
              <span className="domain-source-badge domain-source-badge--used">
                Cited by {r.citedByNodeIds.length} node{r.citedByNodeIds.length > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>

        {uncited.length > 0 && (
          <>
            <h4 className="ajp-reference-topic-title domain-sources-subheading">
              Registered but not cited ({uncited.length})
            </h4>
            <p className="domain-sources-hint">
              These are in the registry and would resolve correctly if cited, but no corpus node
              references them yet — flagged so they don't quietly go stale or get mistaken for
              active citations.
            </p>
            <ul className="domain-sources-list">
              {uncited.map((r) => (
                <li key={r.id} className="domain-source-row">
                  <div className="domain-source-main">
                    <span className="domain-source-id">{r.id}</span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="ajp-reference-link">
                        {r.title}
                      </a>
                    ) : (
                      <span className="ajp-reference-title">{r.title}</span>
                    )}
                  </div>
                  <span className="domain-source-badge domain-source-badge--unused">Not cited</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="domain-sources-group">
        <h4 className="ajp-reference-topic-title">Internal tacit-knowledge docs ({kbDocs.length})</h4>
        <p className="domain-sources-hint">
          Authored by this project ({'docs/kb-candidates/01–10'}), not third-party sources —
          cited as KB-DOC-## labels rather than clickable SRC-### popovers.
        </p>
        <ul className="domain-sources-list">
          {kbDocsCited.map((d) => (
            <li key={d.id} className="domain-source-row">
              <div className="domain-source-main">
                <span className="domain-source-id">{d.id}</span>
                <span className="ajp-reference-title">{d.title}</span>
              </div>
              <span className="domain-source-badge domain-source-badge--used">
                Cited by {d.citedByNodeIds.length} node{d.citedByNodeIds.length > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>

        {kbDocsSurfacedOnly.length > 0 && (
          <>
            <h4 className="ajp-reference-topic-title domain-sources-subheading">
              Surfaced as a reference, not cited on a node ({kbDocsSurfacedOnly.length})
            </h4>
            <ul className="domain-sources-list">
              {kbDocsSurfacedOnly.map((d) => (
                <li key={d.id} className="domain-source-row">
                  <div className="domain-source-main">
                    <span className="domain-source-id">{d.id}</span>
                    <span className="ajp-reference-title">{d.title}</span>
                  </div>
                  <span className="domain-source-badge domain-source-badge--info">
                    Downloadable in Mission/Pedagogy panel
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {kbDocsOrphaned.length > 0 && (
          <>
            <h4 className="ajp-reference-topic-title domain-sources-subheading">
              Not surfaced anywhere in the app ({kbDocsOrphaned.length})
            </h4>
            <p className="domain-sources-hint">
              Not cited on a corpus node and not bundled as a reference — currently authoring-only
              content with no path to a learner.
            </p>
            <ul className="domain-sources-list">
              {kbDocsOrphaned.map((d) => (
                <li key={d.id} className="domain-source-row">
                  <div className="domain-source-main">
                    <span className="domain-source-id">{d.id}</span>
                    <span className="ajp-reference-title">{d.title}</span>
                  </div>
                  <span className="domain-source-badge domain-source-badge--unused">Not surfaced</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="domain-sources-group">
        <h4 className="ajp-reference-topic-title">Dense-retrieval corpus documents</h4>
        {error && <p className="domain-sources-hint">Corpus manifest unavailable — run `npm run ingest` to generate it.</p>}
        {manifest && (
          <>
            <ul className="domain-sources-list">
              {indexed.map((s) => (
                <li key={s.id} className="domain-source-row">
                  <div className="domain-source-main">
                    <span className="ajp-reference-title">{s.label}</span>
                  </div>
                  <span className="domain-source-badge domain-source-badge--used">
                    {s.chunks} chunk{s.chunks !== 1 ? 's' : ''} indexed
                  </span>
                </li>
              ))}
            </ul>

            {notParsed.length > 0 && (
              <>
                <h4 className="ajp-reference-topic-title domain-sources-subheading">
                  Not parsed ({notParsed.length})
                </h4>
                <p className="domain-sources-hint">
                  Ingestion ran but produced no usable chunks — commonly a paywalled or
                  inaccessible source at fetch time.
                </p>
                <ul className="domain-sources-list">
                  {notParsed.map((s) => (
                    <li key={s.id} className="domain-source-row">
                      <div className="domain-source-main">
                        <span className="ajp-reference-title">{s.label}</span>
                      </div>
                      <span className="domain-source-badge domain-source-badge--not-parsed" title={s.status}>
                        Not parsed
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {stubs.length > 0 && (
              <>
                <h4 className="ajp-reference-topic-title domain-sources-subheading">
                  Not yet ingested ({stubs.length})
                </h4>
                <ul className="domain-sources-list">
                  {stubs.map((s) => (
                    <li key={s.id} className="domain-source-row">
                      <div className="domain-source-main">
                        <span className="ajp-reference-title">{s.label}</span>
                      </div>
                      <span className="domain-source-badge domain-source-badge--not-ingested">Not ingested</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {excludedSources.length > 0 && (
              <>
                <h4 className="ajp-reference-topic-title domain-sources-subheading">
                  Excluded — sensitivity review ({excludedSources.length})
                </h4>
                <p className="domain-sources-hint">
                  Deliberately left out of the public corpus: unnumbered vendor documents with
                  unconfirmed redistribution rights, and raw machine-configuration exports from a
                  real deployment. The general knowledge they contained is preserved, abstracted,
                  in the knowledge graph where noted.
                </p>
                <ul className="domain-sources-list">
                  {excludedSources.map((s) => (
                    <li key={s.id} className="domain-source-row">
                      <div className="domain-source-main">
                        <span className="ajp-reference-title">{s.label}</span>
                      </div>
                      <span className="domain-source-badge domain-source-badge--excluded" title={s.reason}>
                        Excluded
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
