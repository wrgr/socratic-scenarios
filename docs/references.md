# TeachMe Annotated References

## 1. Zone of Proximal Development and Scaffolding

### Vygotsky, L. S. (1978). *Mind in Society*. Harvard University Press.
Vygotsky formalizes the Zone of Proximal Development (ZPD): instruction is most effective when tasks are just beyond current independent capability but achievable with guidance. TeachMe operationalizes this in retrieval scoring by boosting content one level above current learner proficiency, rather than serving only semantically similar text.

### Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and Psychiatry, 17*(2), 89-100.
This paper introduces scaffolding as dynamic support calibrated to learner state and progressively withdrawn as competence grows. TeachMe's proficiency signal serves as the calibration layer, selecting chunks that support current performance without collapsing into over-simplified repetition.

## 2. Transfer of Learning

### Barnett, S. M., & Ceci, S. J. (2002). When and where do we apply what we learn? *Psychological Bulletin, 128*(4), 612-637.
Barnett and Ceci provide a taxonomy for near and far transfer across context, modality, and time. TeachMe uses this distinction directly in scenario/problem design, separating common-failure transfer tasks (near) from uncommon-failure and cross-domain diagnostics (far).

### Bransford, J. D., Brown, A. L., & Cocking, R. R. (Eds.) (2000). *How People Learn*. National Academy Press.
This synthesis shows that transfer improves when learners build conceptual structure and repeatedly apply principles in varied contexts. TeachMe's transfer-scenario chunk type and cross-domain assessment problems are intended to create exactly this pattern of varied, principle-based application.

### Perkins, D. N., & Salomon, G. (1992). Transfer of learning. In *International Encyclopedia of Education* (2nd ed.).
Perkins and Salomon distinguish low-road transfer (automatic, context-similar) from high-road transfer (effortful abstraction). TeachMe's systematic-troubleshooting concept and far-transfer prompts are designed to foster high-road transfer rather than brittle parameter memorization.

## 3. Adaptive and Intelligent Tutoring Systems

### VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197-221.
VanLehn's meta-analysis suggests that high-quality adaptive tutoring can approach substantial fractions of human tutoring effectiveness. TeachMe frames retrieval adaptation as a tractable mechanism inside this broader ITS tradition: changing *what* content appears based on learner state.

### Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253-278.
Knowledge tracing established the value of updating latent learner models from observed performance. TeachMe uses a lightweight proficiency model rather than full Bayesian tracing, but follows the same core principle of linking interaction evidence to future instructional decisions.

## 4. Retrieval-Augmented Generation and Retrieval Systems

### Lewis, P., et al. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *NeurIPS 2020*.
RAG demonstrates that retrieval quality strongly shapes downstream answer quality in knowledge-intensive settings. TeachMe extends that logic from generic QA relevance to pedagogy-aware relevance, introducing proficiency, role, and transfer signals in addition to semantic similarity.

### Guu, K., et al. (2020). REALM: Retrieval-augmented language model pre-training. *ICML 2020*.
REALM shows that retrieval can be integrated as a first-class component of model behavior rather than post-hoc context stuffing. TeachMe similarly treats retrieval as a first-order instructional mechanism, where ranking policy directly affects learning outcomes.

## 5. Situated and Role-Based Learning

### Lave, J., & Wenger, E. (1991). *Situated Learning: Legitimate Peripheral Participation*. Cambridge University Press.
Situated learning argues that knowledge is inseparable from participation in authentic practice contexts. TeachMe reflects this by role-tagging content and designing prompts around realistic maker tasks rather than abstract quiz-only interaction.

### Collins, A., Brown, J. S., & Newman, S. E. (1989). Cognitive apprenticeship. In L. B. Resnick (Ed.), *Knowing, Learning, and Instruction*.
Cognitive apprenticeship emphasizes modeling, coached practice, articulation, and increasing complexity. TeachMe's chunk mix (explanations, procedures, examples, transfer scenarios) mirrors this progression from explicit modeling toward independent diagnostic reasoning.

## 6. Cognitive Load Theory

### Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science, 12*(2), 257-285.
Sweller shows that instructional design must manage working-memory limits to avoid overload and ineffective search behavior. TeachMe's ZPD calibration and role filtering are intended to reduce extraneous load by avoiding advanced or context-mismatched chunks for novice learners.

### Sweller, J. (1994). Cognitive load theory, learning difficulty, and instructional design. *Learning and Instruction, 4*(4), 295-312.
This paper clarifies intrinsic, extraneous, and germane load distinctions and links them to instructional sequencing decisions. TeachMe's retrieval calibration can be read as load management: constrain extraneous difficulty while preserving germane challenge through near-ZPD chunk selection.

### Paas, F., Renkl, A., & Sweller, J. (2003). Cognitive load theory and instructional design. *Educational Psychologist, 38*(1), 1-4.
This work extends cognitive load guidance into practical design recommendations, including progressive complexity and structured support. TeachMe applies this by sequencing content from foundational repair steps toward transfer-oriented diagnostics as proficiency rises.

## 7. Effect Size and Educational Research Methods

### Cohen, J. (1988). *Statistical Power Analysis for the Behavioral Sciences* (2nd ed.). Erlbaum.
Cohen's d provides a standardized lens to compare intervention impact across studies and scales. TeachMe reports Cohen's d for semantic vs. calibrated conditions to communicate practical significance, not only raw score differences.

### Hattie, J. (2009). *Visible Learning*. Routledge.
Hattie emphasizes interpreting effect magnitude in educational decision-making and comparing interventions through aggregated evidence. TeachMe's study reporting follows this orientation by pairing effect size with confidence intervals and p-values.

## 8. Personalized and Mastery-Based Learning

### Bloom, B. S. (1984). The 2 sigma problem. *Educational Researcher, 13*(6), 4-16.
Bloom's 2-sigma problem highlights the large gains produced by individualized tutoring relative to conventional classroom instruction. TeachMe positions retrieval calibration as a scalable micro-adaptation strategy that may recover part of those individualized gains in digital environments.

### Koedinger, K. R., Corbett, A. T., & Perfetti, C. (2012). The Knowledge-Learning-Instruction framework: Bridging the science-practice chasm to enhance robust student learning. *Cognitive Science, 36*(5), 757-798.
The KLI framework connects knowledge component structure, learning processes, and instructional decisions. TeachMe aligns with this framework by explicitly mapping concept structure and learner proficiency to retrieval policy and then evaluating outcomes via transfer-focused metrics.

## 9. Operational Capability and Reliability Metrics

### Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution.
Accelerate established software-delivery performance metrics that became the basis of DORA's deployment-frequency, lead-time, change-failure, and recovery-speed measurement model. TeachMe can map its operational projections onto these same dimensions when moving from simulation to production operations.

### DORA (2026). DORA's software delivery performance metrics.
DORA documents the current five-metric model and clarifies metric evolution (for example, MTTR reframed as failed-deployment recovery time). This is useful for keeping metric naming and interpretation aligned with current industry research conventions.

### Beyer, B., Jones, C., Petoff, J., & Murphy, N. R. (Eds.). (2016). *Site Reliability Engineering: How Google Runs Production Systems*. O'Reilly.
SRE formalizes SLI/SLO/error-budget thinking for reliability management and links reliability targets to operational decision-making. TeachMe's proposed operational metric layer uses this framing for availability, latency, and error-rate objective tracking.

### NIST SP 800-61r3 (2025). *Incident Response Recommendations and Considerations for Cybersecurity Risk Management*.
NIST SP 800-61r3 provides a structured incident-response lifecycle focused on improving detection, response, and recovery effectiveness and efficiency. TeachMe's detect/contain/recover time metrics align with this lifecycle framing for operational capability evaluation.

### ISO 9241-11:2018. *Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts*.
ISO 9241-11 defines effectiveness and efficiency as outcomes of use. For operational evaluation, this supports tracking both whether problems are solved (effectiveness) and the resources/time required (efficiency), rather than speed-only reporting.

### FinOps Foundation (2026). *Framework Capability: Unit Economics*.
FinOps unit economics guidance supports per-unit cost metrics tied to organizational value (for example cost per resolved case or cost per successful outcome). This provides a practical literature-backed anchor for the cost component of TeachMe's operational capability model.
