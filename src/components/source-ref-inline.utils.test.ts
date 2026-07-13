import { describe, expect, it } from 'vitest';
import { splitSourceRefSegments } from './source-ref-inline.utils';

describe('splitSourceRefSegments', () => {
  it('splits two comma-separated citations', () => {
    const s = 'SRC-018 Section 8.3, SRC-019 Section 3.1';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'ref', text: 'SRC-018 Section 8.3', sourceId: 'SRC-018', location: 'Section 8.3' },
      { kind: 'text', text: ', ' },
      { kind: 'ref', text: 'SRC-019 Section 3.1', sourceId: 'SRC-019', location: 'Section 3.1' },
    ]);
  });

  it('parses section symbol and stops before unrelated tail', () => {
    const s = 'SRC-018 §3.2, Islam 2025';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'ref', text: 'SRC-018 §3.2', sourceId: 'SRC-018', location: '§3.2' },
      { kind: 'text', text: ', Islam 2025' },
    ]);
  });

  it('includes steps clause', () => {
    const s = 'SRC-018 Section 8.2 steps 3-4';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'ref', text: 'SRC-018 Section 8.2 steps 3-4', sourceId: 'SRC-018', location: 'Section 8.2 steps 3-4' },
    ]);
  });

  it('parses Section + Figure', () => {
    const s = 'SRC-018 Section 4 Figure 4, SRC-019 Section 4.12';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'ref', text: 'SRC-018 Section 4 Figure 4', sourceId: 'SRC-018', location: 'Section 4 Figure 4' },
      { kind: 'text', text: ', ' },
      { kind: 'ref', text: 'SRC-019 Section 4.12', sourceId: 'SRC-019', location: 'Section 4.12' },
    ]);
  });

  it('parses parenthetical location', () => {
    const s = 'See SRC-018 (Section 8.1) for recovery.';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'ref', text: 'SRC-018 (Section 8.1)', sourceId: 'SRC-018', location: '(Section 8.1)' },
      { kind: 'text', text: ' for recovery.' },
    ]);
  });

  it('handles bare id before comma', () => {
    const s = 'SRC-007, SRC-008';
    expect(splitSourceRefSegments(s)).toEqual([
      { kind: 'ref', text: 'SRC-007', sourceId: 'SRC-007', location: '' },
      { kind: 'text', text: ', ' },
      { kind: 'ref', text: 'SRC-008', sourceId: 'SRC-008', location: '' },
    ]);
  });
});
