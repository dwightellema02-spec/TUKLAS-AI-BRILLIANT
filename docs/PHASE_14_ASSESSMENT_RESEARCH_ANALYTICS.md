# Tuklas AI — Phase 14: Assessment & Research Analytics

## 1. Executive Summary & Core Principle

Phase 14 introduces a rigorous, empirical **Assessment & Research Analytics Engine** to Tuklas AI, grounded strictly in actual student learning evidence. 

### Core Principles
1. **Raw Learning Evidence as the Source of Truth**: All research metrics derive directly from verifiable learning actions: question attempts, scores, time taken, hint usage, retries, mistake classifications, guided checkpoints, and historical mastery.
2. **Deterministic & Versioned Calculations**: No arbitrary AI scores or hallucinated research measurements. Calculations are centralized in `src/lib/research/` under configuration version `RESEARCH_V1`.
3. **Strict Non-Causal Analytics**: Pre-test vs. post-test comparisons and intervention tracking use precise observational language ("observed increase of +X points") rather than unfounded causal claims ("Tuklas caused an improvement").
4. **IDOR & Scoped Authorization**: Teachers can only access research profiles and raw attempts for students enrolled in their assigned classes.
5. **Standardized Data Export**: Full support for downloading standardized metrics summaries, raw attempt evidence, and comparative cohort CSVs for independent educational research.

---

## 2. The Four Primary Research Metrics

| Metric | Focus | Deterministic Formula / Evidence Source |
| :--- | :--- | :--- |
| **ACCURACY** | Task correctness | $\frac{\text{valid correct attempts}}{\text{total valid scored attempts}}$ (strictly excludes abandoned/system errors) |
| **UNDERSTANDING** | Independent conceptual grasp | Multi-factor: 50% non-hint accuracy, 20% guided checkpoints, 15% question format diversity, 15% penalty on conceptual mistakes |
| **APPLICATION** | Concept transfer & higher-order reasoning | Evaluates questions tagged with `APPLICATION` or `HIGHER_ORDER` cognitive levels, with extra weighting for multi-step reasoning |
| **CONSISTENCY** | Longitudinal stability & streak stability | Windowed segmentation variance across sequential attempt windows combined with streak stability factor |

---

## 3. Architecture & Modular Services

```
src/lib/research/
├── research-types.ts      # Core TypeScript interfaces (profiles, metrics, comparisons, evidence)
├── research-config.ts     # Centralized thresholds (minAttempts, levels, weights, version)
├── accuracy.ts            # Deterministic AccuracyCalculator
├── understanding.ts       # Multi-dimensional UnderstandingCalculator
├── application.ts         # Cognitive level & transfer ApplicationCalculator
├── consistency.ts         # Longitudinal variance & streak ConsistencyCalculator
├── comparison.ts          # PrePostComparator (empirical pre/post cohort comparison)
├── research-service.ts    # Aggregates student profiles, difficult skills, mistakes, interventions
├── research-export.ts     # Standardized CSV generators (metrics, raw attempts, comparisons)
└── index.ts               # Module barrel entrypoint
```

---

## 4. API Endpoints

- `GET /api/teacher/research/profile/:studentId` (Teacher/Admin, IDOR scoped to enrolled students)
- `GET /api/teacher/research/comparison` (Pre/post cohort evaluation with skill-level breakdown)
- `GET /api/teacher/research/difficult-skills` (Empirical flags: accuracy < 65% or hint reliance > 40%)
- `GET /api/teacher/research/mistakes` (Aggregated mistake taxonomy with pedagogical actions)
- `GET /api/teacher/research/interventions` (Non-causal intervention tracking)
- `GET /api/teacher/research/time-series` (Longitudinal trajectory data points)
- `GET /api/teacher/research/export/metrics.csv` (Standardized research metric summary download)
- `GET /api/teacher/research/export/attempts.csv` (Raw empirical question attempt export)
- `GET /api/teacher/research/export/comparison.csv` (Pre/post comparative analysis export)

---

## 5. Automated Verification Results

All 25 automated tests in `scripts/test-phase14-research.ts` execute cleanly and pass:
- Deterministic Accuracy Metric: **PASS**
- Multi-Dimensional Understanding Metric: **PASS**
- Application & Transfer Metric: **PASS**
- Consistency & Longitudinal Stability Metric: **PASS**
- Student Research Profile Generation: **PASS**
- Pre/Post-Test Comparative Analytics: **PASS**
- Difficult Skills & Mistake Aggregation: **PASS**
- Non-Causal Intervention Observations: **PASS**
- Standardized CSV Exporters: **PASS**
- Mistake Evaluation & Question Attempt Persistence: **PASS**
