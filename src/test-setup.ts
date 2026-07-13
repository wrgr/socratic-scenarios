/**
 * Vitest global setup: boot the active domain (default: AJP) so tests that
 * import the retrieval graph (`allNodes`/`allEdges`) or call getActiveDomain()
 * see a bound domain, exactly as main.tsx does at app startup.
 */
import { bootActiveDomain } from './domains/boot';

bootActiveDomain();
