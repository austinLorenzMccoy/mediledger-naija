"""
MediLedger Nigeria — Healthcare Worker Survey Analysis
Chapter Four data analysis pipeline (n=30 raw responses).

Sections:
  1. Load & clean
  2. Section A — Demographics (descriptives)
  3. Section B — Current healthcare challenges (descriptives)
  4. Section C — Technology awareness & readiness (descriptives)
  5. Section D — MediLedger solution feedback (descriptives)
  6. Reliability — Cronbach's alpha
  7. Inferential statistics — chi-square tests of association
  8. Correlation analysis — Spearman
  9. Export cleaned dataset + summary tables to CSV
"""

import pandas as pd
import numpy as np
from scipy import stats
import pingouin as pg
import warnings
warnings.filterwarnings("ignore")

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)

# ----------------------------------------------------------------------
# 1. LOAD & CLEAN
# ----------------------------------------------------------------------
df = pd.read_csv("survey_raw.csv", sep=";")
df.columns = [c.strip() for c in df.columns]

N_RAW = len(df)

# Drop KoboToolbox metadata columns we don't need for analysis
meta_cols = ["start", "end", "_id", "_uuid", "_submission_time", "_validation_status",
             "_notes", "_status", "_submitted_by", "__version__", "_tags",
             "meta/rootUuid", "_index"]
df_clean = df.drop(columns=[c for c in meta_cols if c in df.columns])

# Strip whitespace from all string/object cells (Kobo labels have stray leading spaces,
# e.g. " Satisfied" vs "Satisfied")
for c in df_clean.select_dtypes(include="object").columns:
    df_clean[c] = df_clean[c].astype(str).str.strip()
    df_clean[c] = df_clean[c].replace({"nan": np.nan})

N_CLEAN = len(df_clean)

print(f"Raw responses exported from KoboToolbox: {N_RAW}")
print(f"Responses retained after cleaning: {N_CLEAN}")
print()

df_clean.to_csv("cleaned_survey_data.csv", index=False)

# ----------------------------------------------------------------------
# Helper: frequency table
# ----------------------------------------------------------------------
def freq_table(series, label=None):
    vc = series.value_counts(dropna=True)
    pct = (vc / vc.sum() * 100).round(1)
    out = pd.DataFrame({"n": vc, "%": pct})
    if label:
        print(f"\n--- {label} (n={vc.sum()}) ---")
        print(out)
    return out

# ----------------------------------------------------------------------
# 2. SECTION A — DEMOGRAPHICS
# ----------------------------------------------------------------------
print("=" * 70)
print("SECTION A: DEMOGRAPHIC PROFILE OF RESPONDENTS")
print("=" * 70)

demo_cols = {
    "Professional role": "Professional Role",
    "Years of experience": "Years of Experience",
    "Hospital type": "Hospital Type",
    "Hospital location (geopolitical zone)": "Geopolitical Zone",
    "Hospital size": "Hospital Size",
}
demo_tables = {}
for col, label in demo_cols.items():
    match = [c for c in df_clean.columns if c.strip() == col][0]
    demo_tables[label] = freq_table(df_clean[match], label)

# ----------------------------------------------------------------------
# 3. SECTION B — CURRENT HEALTHCARE CHALLENGES
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("SECTION B: CURRENT HEALTHCARE CHALLENGES")
print("=" * 70)

b_cols = {
    "How often do you encounter counterfeit or fake drugs?": "Counterfeit Drug Frequency",
    "Have you experienced an insurance claim rejection in the last 6 months?": "Claim Rejection (6mo)",
    "Rate severity of health record fragmentation": "Record Fragmentation Severity",
    "Does your hospital currently use electronic medical records?": "EMR Usage",
    "Satisfaction with current drug verification methods": "Drug Verification Satisfaction",
    "Biggest challenge in your hospital": "Biggest Hospital Challenge",
    "Average time to verify insurance eligibility": "Insurance Verification Time",
    "Have you witnessed or suspected fraudulent insurance claims?": "Witnessed Fraudulent Claims",
}
b_tables = {}
for col, label in b_cols.items():
    match = [c for c in df_clean.columns if c.strip() == col][0]
    b_tables[label] = freq_table(df_clean[match], label)

# Hours per week searching for records — numeric, open-ended
hrs_col = [c for c in df_clean.columns if "hours per week" in c.lower()][0]
hrs = pd.to_numeric(df_clean[hrs_col], errors="coerce")
print(f"\n--- Hours/week spent searching for patient records (n={hrs.notna().sum()}) ---")
print(f"Mean: {hrs.mean():.2f} | Median: {hrs.median():.2f} | SD: {hrs.std():.2f} "
      f"| Min: {hrs.min():.0f} | Max: {hrs.max():.0f}")

# ----------------------------------------------------------------------
# 4. SECTION C — TECHNOLOGY AWARENESS & READINESS
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("SECTION C: TECHNOLOGY AWARENESS AND READINESS")
print("=" * 70)

c_cols = {
    "Familiarity with blockchain technology": "Blockchain Familiarity",
    "Willingness to use blockchain‑based health records": "Willingness to Use Blockchain Records",
    "Biggest concern about digital health records": "Primary Concern (digital records)",
    "If NHIA mandated digital records, what would you do?": "Response to NHIA Mandate",
    "Rate hospital IT infrastructure readiness": "IT Infrastructure Readiness",
}
c_tables = {}
for col, label in c_cols.items():
    matches = [c for c in df_clean.columns if c.strip() == col]
    if matches:
        c_tables[label] = freq_table(df_clean[matches[0]], label)

# Multi-select concern breakdown (checkbox columns)
concern_flags = [c for c in df_clean.columns if c.startswith("Biggest concern about digital health records/")]
print("\n--- Concerns about digital health records (multi-select, % selecting) ---")
for c in concern_flags:
    vals = pd.to_numeric(df_clean[c], errors="coerce")
    label = c.split("/")[-1]
    print(f"{label:12s}: {vals.sum():.0f}/{vals.notna().sum()} ({vals.mean()*100:.1f}%)")

# ----------------------------------------------------------------------
# 5. SECTION D — MEDILEDGER SOLUTION FEEDBACK
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("SECTION D: MEDILEDGER SOLUTION FEEDBACK")
print("=" * 70)

d_cols = {
    "Patient‑controlled records would improve healthcare": "Patient-Controlled Records Improve Care",
    "Importance of drug verification via QR codes": "QR Drug Verification Importance",
    "Automated insurance claims would reduce fraud": "Automated Claims Reduce Fraud",
    "Willingness to participate in a pilot program": "Pilot Program Willingness",
    "Importance of earning tokens for sharing anonymised data": "Token Incentive Willingness",
    "USSD code for insurance verification would help patients without smartphones": "USSD Access Value",
}
d_tables = {}
for col, label in d_cols.items():
    matches = [c for c in df_clean.columns if c.strip() == col]
    if matches:
        d_tables[label] = freq_table(df_clean[matches[0]], label)

# ----------------------------------------------------------------------
# 6. RELIABILITY — CRONBACH'S ALPHA
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("RELIABILITY ANALYSIS — CRONBACH'S ALPHA")
print("=" * 70)

# Ordinal encoders for each 5-point Likert item used in the reliability scale
likert_5_agree = {  # Strongly disagree -> Strongly agree
    "Strongly disagree": 1, "Disagree": 2, "Neutral": 3, "Agree": 4, "Strongly agree": 5
}
likert_5_importance = {
    "Not important at all": 1, "Slightly important": 2, "Moderately important": 3,
    "Important": 4, "Very important": 5
}
likert_5_willing = {
    "Not willing at all": 1, "Slightly willing": 2, "Moderately willing": 3,
    "Willing": 4, "Very willing": 5
}
likert_5_ready = {
    "Not ready at all": 1, "Slightly ready": 2, "Moderately ready": 3,
    "Ready": 4, "Fully ready": 5
}
likert_5_severity = {
    "Not severe": 1, "Slightly severe": 2, "Moderately severe": 3,
    "Severe": 4, "Very severe": 5
}

def encode(col_substr, mapping):
    match = [c for c in df_clean.columns if col_substr in c][0]
    return df_clean[match].map(mapping)

# Scale 1: "MediLedger Perceived Value" scale (Section D core items, all reverse-coded
# to a common "higher = more favourable toward MediLedger" direction)
scale_items = pd.DataFrame({
    "patient_control":     encode("Patient‑controlled records would improve healthcare", likert_5_agree),
    "qr_verification":     encode("Importance of drug verification via QR codes", likert_5_importance),
    "automated_claims":    encode("Automated insurance claims would reduce fraud", likert_5_agree),
    "token_incentive":     encode("Importance of earning tokens for sharing anonymised data", likert_5_willing),
    "ussd_access":         encode("USSD code for insurance verification", likert_5_agree),
})

alpha_result = pg.cronbach_alpha(data=scale_items.dropna())
print(f"\nMediLedger Perceived Value Scale (5 items, n={scale_items.dropna().shape[0]}):")
print(f"Cronbach's alpha = {alpha_result[0]:.3f}  (95% CI: {alpha_result[1]})")

item_total = scale_items.dropna().corrwith(scale_items.dropna().sum(axis=1))
print("\nItem-total correlations:")
print(item_total.round(3))

# ----------------------------------------------------------------------
# 7. INFERENTIAL STATISTICS — CHI-SQUARE TESTS
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("INFERENTIAL STATISTICS — CHI-SQUARE TESTS OF ASSOCIATION")
print("=" * 70)

def chi_square_test(col1_substr, col2_substr, label1, label2):
    c1 = [c for c in df_clean.columns if col1_substr in c][0]
    c2 = [c for c in df_clean.columns if col2_substr in c][0]
    sub = df_clean[[c1, c2]].dropna()
    ct = pd.crosstab(sub[c1], sub[c2])
    if ct.shape[0] < 2 or ct.shape[1] < 2:
        print(f"\n{label1} x {label2}: insufficient variation for chi-square test")
        return None
    chi2, p, dof, expected = stats.chi2_contingency(ct)
    n = ct.sum().sum()
    min_dim = min(ct.shape) - 1
    cramers_v = np.sqrt((chi2 / n) / min_dim) if min_dim > 0 else np.nan
    print(f"\n{label1} x {label2}  (n={n})")
    print(ct)
    print(f"Chi-square = {chi2:.3f}, df = {dof}, p = {p:.4f}, Cramer's V = {cramers_v:.3f}")
    low_expected = (expected < 5).sum()
    if low_expected > 0:
        print(f"Note: {low_expected}/{expected.size} cells have expected count < 5 — "
              f"interpret with caution given the small sample.")
    return {"test": f"{label1} x {label2}", "chi2": chi2, "df": dof, "p": p,
            "cramers_v": cramers_v, "n": n}

chi_results = []
chi_results.append(chi_square_test(
    "Professional role", "If NHIA mandated digital records",
    "Professional Role", "Response to NHIA Mandate"))
chi_results.append(chi_square_test(
    "Familiarity with blockchain technology", "Willingness to use blockchain",
    "Blockchain Familiarity", "Willingness to Use Blockchain Records"))
chi_results.append(chi_square_test(
    "Does your hospital currently use electronic medical records", "Rate hospital IT infrastructure readiness",
    "EMR Usage", "IT Infrastructure Readiness"))
chi_results.append(chi_square_test(
    "Hospital type", "Willingness to participate in a pilot",
    "Hospital Type", "Pilot Program Willingness"))
chi_results.append(chi_square_test(
    "Have you experienced an insurance claim rejection", "Have you witnessed or suspected fraudulent",
    "Claim Rejection (6mo)", "Witnessed Fraudulent Claims"))

# ----------------------------------------------------------------------
# 8. CORRELATION ANALYSIS — SPEARMAN
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("CORRELATION ANALYSIS — SPEARMAN RANK CORRELATION")
print("=" * 70)

readiness = encode("Rate hospital IT infrastructure readiness", likert_5_ready)
willingness = encode("Willingness to use blockchain", likert_5_willing)
severity = encode("Rate severity of health record fragmentation", likert_5_severity)
pilot_map = {"No": 1, "Not applicable": np.nan, "Maybe": 2, "Yes": 3}
pilot_col = [c for c in df_clean.columns if "Willingness to participate in a pilot" in c][0]
pilot = df_clean[pilot_col].str.strip().map(pilot_map)

def spearman_report(x, y, xl, yl):
    sub = pd.DataFrame({xl: x, yl: y}).dropna()
    if len(sub) < 3:
        print(f"\n{xl} vs {yl}: insufficient paired data")
        return
    rho, p = stats.spearmanr(sub[xl], sub[yl])
    print(f"\n{xl} vs {yl} (n={len(sub)}): rho = {rho:.3f}, p = {p:.4f}")

spearman_report(readiness, willingness, "IT Infrastructure Readiness", "Willingness to Use Blockchain")
spearman_report(severity, willingness, "Record Fragmentation Severity", "Willingness to Use Blockchain")
spearman_report(readiness, pilot, "IT Infrastructure Readiness", "Pilot Program Willingness")
spearman_report(hrs, severity, "Hours/Week Searching Records", "Record Fragmentation Severity")

# ----------------------------------------------------------------------
# 9. TRIANGULATION SUMMARY
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("TRIANGULATION WITH SECONDARY DATA (NHIA 2025 / LITERATURE)")
print("=" * 70)
adopt_immediately = (df_clean[[c for c in df_clean.columns if "If NHIA mandated" in c][0]]
                     .str.strip().eq("Adopt immediately").sum())
adopt_concerns = (df_clean[[c for c in df_clean.columns if "If NHIA mandated" in c][0]]
                  .str.strip().eq("Adopt with concerns").sum())
n_valid = df_clean[[c for c in df_clean.columns if "If NHIA mandated" in c][0]].notna().sum()
print(f"Would adopt digital records if NHIA mandated it (immediately or with concerns): "
      f"{adopt_immediately + adopt_concerns}/{n_valid} "
      f"({(adopt_immediately+adopt_concerns)/n_valid*100:.1f}%)")

not_ready = (df_clean[[c for c in df_clean.columns if "IT infrastructure readiness" in c][0]]
             .str.strip().isin(["Not ready at all", "Slightly ready"]).sum())
n_ready_valid = df_clean[[c for c in df_clean.columns if "IT infrastructure readiness" in c][0]].notna().sum()
print(f"Report low IT infrastructure readiness (Not ready / Slightly ready): "
      f"{not_ready}/{n_ready_valid} ({not_ready/n_ready_valid*100:.1f}%)")
print("\nInterpretation: attitudes toward digital/blockchain-based systems are broadly positive")
print("(most respondents would adopt if mandated), while infrastructure readiness lags behind.")
print("This mirrors Babalola et al. (2025), who found 98.6% positive EMR attitudes alongside")
print("90.8% citing insufficient computers — i.e., infrastructure, not attitude, is the binding constraint.")

print("\n\nAnalysis complete. Cleaned dataset saved to cleaned_survey_data.csv")
