/** Content for AJP background model: flow, pillars, references, and whitepaper link. */
import whitepaperUrl from '../../docs/whitepaper.pdf?url';
import operationalCorpusDesignUrl from '../../docs/kb-candidates/09_operational_corpus_research_design.md?url';
import tacitElicitationReviewUrl from '../../docs/kb-candidates/10_tacit_elicitation_methods_review.md?url';

export const WHITEPAPER_URL = whitepaperUrl;

export const WHITEPAPER_MAIN_POINTS = [
  'All Narrator responses are drawn verbatim from a typed knowledge graph — no generation from model weights — eliminating hallucination risk for safety-critical content.',
  'A two-agent architecture (Mentor + Narrator) separates teaching from machine simulation; a Prompt Enricher pre-processes queries before retrieval fires.',
  'Four instructional modes map to training progression: Socratic for onboarding, Scenario for supervised practice, Reachback Lookup for field operations, Retrieval Lab for inspection.',
  'Graph retrieval traverses causal chains (symptom → fault → corrective action) and always co-retrieves safety hazards, making safe procedures non-optional.',
] as const;

export const FLOW_STEPS = [
  {
    title: 'Signals',
    detail: 'Operator observations + machine telemetry start the evidence chain.',
    expansion: {
      callout: 'If it isn’t captured, it can’t be coached — signals are your evidence ledger.',
      checklist: [
        'What changed? (symptom + magnitude)',
        'When did it change? (timeline + triggering event)',
        'What else was true? (telemetry + environment + operator observations)',
      ],
      paragraphs: [
        'This is the moment you turn “something feels off” into a crisp, shareable incident record. You capture what changed, when it changed, and what the system was doing at the time — so troubleshooting starts from evidence, not intuition alone.',
        'TeachMe treats signals as first-class data: tacit cues (sound, smell, vibration, visual artifacts) plus telemetry (pressure, flow, temperature, logs). When those are tagged together, retrieval can pull the right procedure, the right fault signature, and the right safety warnings for this exact situation.',
      ],
    },
  },
  {
    title: 'Retrieval',
    detail: 'Graph + corpus retrieval surfaces grounded procedure and fault context.',
    expansion: {
      callout: 'Retrieval is not search — it’s selecting the next-best evidence and action.',
      checklist: [
        'What fault family matches these signals?',
        'What’s the safest next diagnostic step?',
        'What would change your mind? (disconfirming evidence)',
      ],
      paragraphs: [
        'Retrieval is the “reach-back” layer: it finds the few pieces of knowledge that actually move the incident forward — not a wall of search results. The graph provides structure (fault → symptoms → consequences → actions). The corpus provides the nuance (step order, tool setup, common failure modes, and expert heuristics).',
        'Hybrid retrieval combines both so the mentor can cite specific sources and explain why they were chosen. The goal is confidence you can defend: “we recommended this because it matches these signals, at this proficiency level, with these safety constraints.”',
      ],
    },
  },
  {
    title: 'Mentor Loop',
    detail: 'Socratic probing checks reasoning quality, not only final answer selection.',
    expansion: {
      callout: 'We coach the reasoning, not the guess — explanation quality is the skill.',
      checklist: [
        'Evidence: what did you observe?',
        'Mechanism: how does that cause the symptom?',
        'Next test: what would confirm or falsify it?',
      ],
      paragraphs: [
        'Instead of asking “what’s the answer?”, the mentor asks “what’s your evidence, what’s your mechanism, and what would falsify your hypothesis?” That’s how you build durable troubleshooting skill — the kind that transfers when the surface details change.',
        'TeachMe uses short-response probing plus grounded feedback: it can point to retrieved procedures or fault signatures, highlight missing evidence, and nudge the learner toward the next best diagnostic action (not just the final label).',
      ],
    },
  },
  {
    title: 'Safety Gate',
    detail: 'High-risk procedures require mastery thresholds before progression.',
    expansion: {
      callout: 'High-consequence steps require “prove you know” — not “try and see.”',
      checklist: [
        'Identify the hazard and the control',
        'Explain the critical step and why it matters',
        'Demonstrate the prerequisite concept confidently',
      ],
      paragraphs: [
        'Some actions are not “learn by trying.” The safety gate ensures learners demonstrate prerequisite understanding before they’re guided through high-consequence procedures — especially when a wrong step can cause damage, contamination, or injury.',
        'The point is clarity and accountability: the gate can say exactly what’s missing (concept, step, or hazard awareness) and what evidence would clear it. As the corpus grows and validation improves, the thresholds can be tuned transparently.',
      ],
    },
  },
  {
    title: 'Transfer',
    detail: 'Assessment targets novel scenarios to validate skill transfer, not memorization.',
    expansion: {
      callout: 'If it doesn’t transfer, it didn’t learn — it just memorized the last case.',
      checklist: [
        'Can you explain the underlying mechanism?',
        'Can you generalize to a new surface form?',
        'Can you choose a safe next step under uncertainty?',
      ],
      paragraphs: [
        'Transfer is where you find out if training actually worked. Near-transfer checks whether the learner can repeat a known pattern. Far-transfer checks whether they can recognize the same underlying mechanism when the symptoms look different.',
        'TeachMe treats transfer as the north star metric, because that’s what matters operationally: fewer escalations, faster time-to-isolation, safer actions under pressure, and fewer repeat incidents from shallow “pattern match” learning.',
      ],
    },
  },
] as const;

export const PILLARS = [
  {
    title: 'Mission Impact',
    points: [
      'Reduce avoidable downtime by accelerating correct fault isolation and response.',
      'Improve first-pass recovery quality with explicit safety gating on critical actions.',
      'Create auditable training evidence that links retrieval decisions to learner outcomes.',
    ] as const,
    expansion: {
      callout: 'Operational value = fewer escalations, faster isolation, safer first-pass actions.',
      checklist: ['Time-to-isolation', 'First-pass recovery quality', 'Repeat-incident rate', 'Safety compliance'],
      paragraphs: [
        'The claim is operational: shorten time-to-isolation and increase first-pass recovery quality by improving how people reason under uncertainty — with retrieval that surfaces the right evidence at the right time.',
        'Equally important is auditability. If an incident review asks “why did we recommend that?”, the system can show the retrieved sources, the learner context, and the gating criteria — and link those decisions to measured outcomes over time.',
      ],
    },
  },
  {
    title: 'Educational Approach',
    points: [
      'Proficiency-calibrated retrieval aligns instruction to learner readiness, not just keyword overlap.',
      'Optimizes for far transfer — applying skills in new scenarios — not rote same-context recall.',
      'Socratic mentoring enforces explanation quality, which builds durable reasoning over time.',
    ] as const,
    expansion: {
      callout: 'We rank by instructional utility — not just semantic overlap.',
      checklist: ['ZPD-fit difficulty', 'Role-relevant framing', 'Transfer-targeted examples', 'Explain-before-advance'],
      paragraphs: [
        'Most learning tools optimize for content relevance. TeachMe optimizes for instructional fit: what will this learner be able to use *right now* to move one step forward without overload or busywork.',
        'Proficiency-calibrated retrieval shapes *what* the learner sees; Socratic mentoring shapes *how* they justify it. Together they encourage explanation quality, deliberate practice, and transfer — not just “getting the right answer.”',
      ],
    },
  },
  {
    title: 'Why AI?',
    points: [
      'AI acts as an adaptive reasoning coach, not a static FAQ or script player.',
      'Natural-language evaluation handles nuanced, partial responses that multiple-choice cannot.',
      'Transparent score breakdowns make AI behavior inspectable and defensible for operators and trainers.',
    ] as const,
    expansion: {
      callout: 'AI is the tutor layer — the system stays inspectable and policy-driven.',
      checklist: ['Adaptive probes', 'Free-text evaluation', 'Grounded feedback', 'Transparent retrieval + gates'],
      paragraphs: [
        'AI earns its place here by doing the tutoring work that doesn’t scale: generating tailored probes, evaluating free-text reasoning, and adapting guidance to learner state — without turning the system into a black box.',
        'TeachMe keeps the “why” inspectable: retrieval sources are visible, scoring signals are explicit, and safety gates are explainable. That makes the system usable for training teams, not just impressive in a demo.',
      ],
    },
  },
] as const;

export type ReferenceItem = {
  title: string;
  summary: string;
  href?: string;
  bullets?: readonly string[];
};

export type ReferenceTopic = {
  topic: string;
  items: ReferenceItem[];
};

export const REFERENCE_SECTIONS: ReferenceTopic[] = [
  {
    topic: 'Learning pedagogy and transfer',
    items: [
      {
        title: 'Vygotsky — zone of proximal development (overview)',
        summary:
          'Frames learning as socially supported stretch just beyond independent performance; motivates matching task difficulty and hints to current competence.',
        href: 'https://plato.stanford.edu/entries/vygotsky/',
      },
      {
        title: 'Bransford, Brown & Cocking — How People Learn',
        summary:
          'Synthesizes research on expertise, transfer, and formative assessment; argues for deep understanding over decontextualized memorization.',
        href: 'https://nap.edu/catalog/9853',
      },
      {
        title: 'Sweller — cognitive load theory',
        summary:
          'Explains how instructional design can add extraneous load; supports sequencing and chunking choices in retrieval and UI presentation.',
        href: 'https://doi.org/10.1016/0959-4752(88)90023-7',
      },
    ],
  },
  {
    topic: 'Intelligent tutoring and learner modeling',
    items: [
      {
        title: 'Corbett & Anderson — knowledge tracing',
        summary:
          'Classic representation of skill acquisition over practice; informs why TeachMe tracks per-concept proficiency rather than a single global score.',
        href: 'https://doi.org/10.1016/S0364-0213(99)80016-0',
      },
    ],
  },
  {
    topic: 'Retrieval-augmented instruction',
    items: [
      {
        title: 'Lewis et al. — Retrieval-Augmented Generation',
        summary:
          'Shows that grounding generation in retrieved passages improves factual reliability; TeachMe extends the idea from grounding to pedagogical ranking.',
        href: 'https://arxiv.org/abs/2005.11401',
      },
    ],
  },
  {
    topic: 'Operational corpus and tacit knowledge',
    items: [
      {
        title: 'Operational corpus research design (TeachMe draft)',
        summary:
          'Outlines how to build an operational corpus that pairs graph structure with expert-elicited tacit cues for in-operation mentoring.',
        href: operationalCorpusDesignUrl,
      },
      {
        title: 'Tacit elicitation methods review (TeachMe draft)',
        summary:
          'Surveys interview and observation techniques for capturing unstated expert judgment relevant to troubleshooting tasks.',
        href: tacitElicitationReviewUrl,
      },
    ],
  },
  {
    topic: 'Whitepaper',
    items: [
      {
        title: 'TeachMe AJP — Retrieval-Augmented Operational Training for the Optomec HD2',
        summary:
          'Full system whitepaper: knowledge graph design, two-agent architecture, four instructional modes, retrieval system, and operational deployment considerations.',
        href: whitepaperUrl,
        bullets: WHITEPAPER_MAIN_POINTS,
      },
    ],
  },
];
