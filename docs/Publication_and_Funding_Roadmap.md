# MediLedger Nigeria — Publication & Funding Roadmap

Reference this after completing the build and research paper.

---

## Publication Potential

Your strongest publishable angle is the **federated learning + differential privacy on FHIR data in a LMIC context with USSD access**. That combination does not exist in the literature for Nigeria specifically. The USSD fallback alone is a contribution — most federated health AI papers assume smartphones and ignore the 70% of Nigerians on feature phones.

### Best-fit venues

| Venue | Why it fits | Tier |
|---|---|---|
| **ACM DEV** (Computing & Development) | LMIC-focused tech; USSD + federated learning in Nigeria is a perfect fit | A-tier for the topic |
| **IEEE HEALTHCOM** | Health + blockchain + AI trifecta | Strong conference |
| **JMIR mHealth & uHealth** | Mobile/USSD health in low-resource settings | High-impact journal |
| **Nature Digital Medicine** | Federated learning + differential privacy in clinical AI | Top-tier; harder but worth a shot |
| **Hedera ecosystem research track** | You built something novel on their stack — they publish case studies | Easier win, good visibility |

---

## Funding Opportunities

### Highest probability — apply immediately after graduation

**HBAR Foundation Grants**
- URL: https://hbarfoundation.org
- The most obvious match. They fund projects building on Hedera. You have three Solidity contracts, HTS (HEAL token), and HCS audit topics deployed. Applications are rolling; grants go up to $250K. This is practically made for MediLedger.

**Lacuna Fund**
- URL: https://lacunafund.org
- Funds health data infrastructure in underrepresented regions. Your Nigeria-specific FHIR pipeline + NDA 2023 compliance story is exactly their mandate.

**Google for Startups Africa**
- URL: https://startup.google.com/programs/black-founders-fund/africa/
- Equity-free cash + Cloud credits. The AI Health Guardian + responsible AI angle fits their AI-for-social-good criteria.

**Tony Elumelu Foundation**
- URL: https://www.tonyelumelufoundation.org
- $5K seed + mentorship, specifically for African entrepreneurs. Low barrier, high legitimacy. Applications open every January.

**Grand Challenges Canada — Stars in Global Health**
- URL: https://www.grandchallenges.ca/programs/stars-in-global-health/
- Designed for bold ideas in global health from people in LMICs. Your differential privacy + federated learning framing is exactly their "bold idea" language.

**NHIA (National Health Insurance Authority)**
- No external URL needed — this is your primary regulator.
- The system is built for NHIA. A pilot proposal could get you a letter of support (useful for every other grant application) or direct procurement interest. Approach after your first publication is accepted.

**Wellcome Trust**
- URL: https://wellcome.org/grant-funding
- Has active Nigeria health research funding streams. Your NDA 2023 compliance + patient data sovereignty framing is compelling to them.

---

## Recommended Sequencing

```
1. Finish build + research paper
         │
         ▼
2. Submit to ACM DEV or IEEE HEALTHCOM
   (check current deadlines — typically 3–6 month cycles)
         │
         ▼
3. Apply to HBAR Foundation (rolling — can do this before paper is published)
         │
         ▼
4. Tony Elumelu Foundation (January cohort, every year)
         │
         ▼
5. Lacuna Fund + Grand Challenges Canada
   (stronger applications once first publication is accepted)
         │
         ▼
6. Approach NHIA directly with pilot proposal
```

The publication gives credibility for the larger grants. HBAR Foundation does not require a publication — they need a deployed Hedera project, which already exists.

---

## Supervisor Strategy

Your supervisor's name on the paper matters. If they have existing grants or international collaborations, ask whether MediLedger can be listed as a research output under that umbrella. That is how student projects often get their first real funding line — the supervisor's institutional affiliation opens doors that a solo student application cannot.

---

## Core Research Contribution (for abstract / grant applications)

> MediLedger Nigeria presents a privacy-preserving, patient-governed health data ecosystem for low-resource settings. The system combines Hedera Hashgraph-anchored consent and audit trails, a federated TabNet diagnostic model with Opacus differential privacy (ε ≤ 1.0, δ = 1e-5), and a USSD-first access layer serving feature phone users — addressing the clinical data fragmentation and digital exclusion challenges specific to Nigeria's 220-million-person healthcare environment, under the Nigeria Data Protection Act 2023 and NHIA Act 2022.

Use this or a version of it in every application.
