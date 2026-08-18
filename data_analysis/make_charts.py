"""
MediLedger Nigeria — Healthcare Worker Survey
Chart generation for Chapter Four (n=30).
Outputs PNG files to ./charts/
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import os

os.makedirs("charts", exist_ok=True)

plt.rcParams.update({
    "font.size": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
})

NAVY = "#1B3A5C"
TEAL = "#2E8B8B"
GOLD = "#D4A017"
GREY = "#7F8C8D"
PALETTE = [NAVY, TEAL, GOLD, "#B0413E", GREY, "#6C5B7B"]

df = pd.read_csv("cleaned_survey_data.csv")
df.columns = [c.strip() for c in df.columns]

def col(substr):
    return [c for c in df.columns if substr in c][0]

def bar_chart(series, title, filename, horizontal=False, color=NAVY, order=None, figsize=(7, 4.5)):
    vc = series.value_counts(dropna=True)
    if order:
        vc = vc.reindex([o for o in order if o in vc.index])
    fig, ax = plt.subplots(figsize=figsize)
    pct = vc / vc.sum() * 100
    if horizontal:
        bars = ax.barh(vc.index[::-1], vc.values[::-1], color=color, edgecolor="white")
        ax.set_xlabel("Number of respondents")
        for b, p in zip(bars, pct.values[::-1]):
            ax.text(b.get_width() + 0.15, b.get_y() + b.get_height()/2,
                    f"{int(b.get_width())} ({p:.0f}%)", va="center", fontsize=9.5)
        ax.set_xlim(0, max(vc.values) * 1.28)
    else:
        bars = ax.bar(vc.index, vc.values, color=color, edgecolor="white")
        ax.set_ylabel("Number of respondents")
        plt.xticks(rotation=25, ha="right")
        for b, p in zip(bars, pct.values):
            ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.15,
                    f"{int(b.get_height())} ({p:.0f}%)", ha="center", fontsize=9.5)
        ax.set_ylim(0, max(vc.values) * 1.22)
    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    fig.text(0.99, 0.01, f"n = {vc.sum()}", ha="right", fontsize=8.5, color=GREY, style="italic")
    plt.tight_layout()
    plt.savefig(f"charts/{filename}", dpi=160)
    plt.close()
    print(f"Saved charts/{filename}")

# 1. Professional role
bar_chart(df[col("Professional role")], "Professional Role of Respondents",
          "01_professional_role.png", color=NAVY)

# 2. Geopolitical zone
bar_chart(df[col("geopolitical zone")], "Respondents by Geopolitical Zone",
          "02_geopolitical_zone.png", horizontal=True, color=TEAL)

# 3. EMR usage
bar_chart(df[col("electronic medical records")],
          "Current Electronic Medical Record (EMR) Usage", "03_emr_usage.png",
          color=GOLD, order=["Yes fully digital", "Partially mixed", "No completely paper"])

# 4. Biggest hospital challenge
bar_chart(df[col("Biggest challenge in your hospital")],
          "Biggest Challenge Reported in Respondents' Hospitals", "04_biggest_challenge.png",
          horizontal=True, color=NAVY, figsize=(7.5, 5))

# 5. Blockchain familiarity
bc = df[col("Familiarity with blockchain technology")].replace({"Yes Somewhat": "Somewhat"})
bar_chart(bc, "Familiarity with Blockchain Technology", "05_blockchain_familiarity.png",
          color=TEAL, order=["Yes", "Somewhat", "No"])

# 6. Willingness to use blockchain records
bar_chart(df[col("Willingness to use blockchain")],
          "Willingness to Use Blockchain-Based Health Records", "06_willingness_blockchain.png",
          color=GOLD, order=["Not willing at all", "Slightly willing", "Moderately willing",
                              "Willing", "Very willing"])

# 7. IT infrastructure readiness
bar_chart(df[col("IT infrastructure readiness")],
          "Self-Rated Hospital IT Infrastructure Readiness", "07_it_readiness.png",
          color="#B0413E", order=["Not ready at all", "Slightly ready", "Moderately ready",
                                   "Ready", "Fully ready"])

# 8. Response to NHIA mandate — donut
fig, ax = plt.subplots(figsize=(6, 6))
vc = df[col("If NHIA mandated")].value_counts()
order = ["Adopt immediately", "Adopt with concerns", "Not sure", "Resist"]
vc = vc.reindex([o for o in order if o in vc.index])
colors = [NAVY, TEAL, GOLD, "#B0413E"]
wedges, texts, autotexts = ax.pie(
    vc.values, labels=vc.index, autopct=lambda p: f"{p:.0f}%\n({int(round(p*vc.sum()/100))})",
    colors=colors[:len(vc)], startangle=90, wedgeprops=dict(width=0.42, edgecolor="white"),
    pctdistance=0.79, textprops={"fontsize": 10}
)
ax.set_title("If NHIA Mandated Digital Records, What Would You Do?",
             fontsize=13, fontweight="bold", pad=14)
fig.text(0.5, 0.02, f"n = {vc.sum()}", ha="center", fontsize=8.5, color=GREY, style="italic")
plt.tight_layout()
plt.savefig("charts/08_nhia_mandate_response.png", dpi=160)
plt.close()
print("Saved charts/08_nhia_mandate_response.png")

# 9. Concerns about digital records (multi-select)
concern_cols = [c for c in df.columns if c.startswith("Biggest concern about digital health records/")]
concern_data = {}
for c in concern_cols:
    label = c.split("/")[-1]
    concern_data[label] = pd.to_numeric(df[c], errors="coerce").sum()
concern_series = pd.Series(concern_data).sort_values(ascending=True)
fig, ax = plt.subplots(figsize=(7, 4))
bars = ax.barh(concern_series.index, concern_series.values, color=TEAL, edgecolor="white")
n_total = df[concern_cols[0]].notna().sum()
for b in bars:
    pct = b.get_width() / n_total * 100
    ax.text(b.get_width() + 0.15, b.get_y() + b.get_height()/2,
            f"{int(b.get_width())} ({pct:.0f}%)", va="center", fontsize=9.5)
ax.set_xlabel("Number of respondents selecting concern")
ax.set_xlim(0, concern_series.max() * 1.35)
ax.set_title("Primary Concerns About Digital Health Records (multi-select)",
             fontsize=13, fontweight="bold", pad=12)
fig.text(0.99, 0.01, f"n = {n_total}", ha="right", fontsize=8.5, color=GREY, style="italic")
plt.tight_layout()
plt.savefig("charts/09_concerns_multiselect.png", dpi=160)
plt.close()
print("Saved charts/09_concerns_multiselect.png")

# 10. Diverging stacked bar for Section D Likert items
likert_5_agree = {"Strongly disagree": 1, "Disagree": 2, "Neutral": 3, "Agree": 4, "Strongly agree": 5}
likert_5_importance = {"Not important at all": 1, "Slightly important": 2, "Moderately important": 3,
                        "Important": 4, "Very important": 5}
likert_5_willing = {"Not willing at all": 1, "Slightly willing": 2, "Moderately willing": 3,
                     "Willing": 4, "Very willing": 5}

d_items = {
    "Patient-controlled records\nwould improve healthcare": (col("Patient‑controlled records"), likert_5_agree),
    "QR code drug verification\nis important": (col("Importance of drug verification via QR codes"), likert_5_importance),
    "Automated claims would\nreduce fraud": (col("Automated insurance claims would reduce fraud"), likert_5_agree),
    "Willing to earn tokens for\nsharing anonymised data": (col("Importance of earning tokens for sharing anonymised data"), likert_5_willing),
    "USSD access would help\npatients without smartphones": (col("USSD code for insurance verification"), likert_5_agree),
}

cat_labels_5 = ["1 (Low/Negative)", "2", "3 (Neutral/Moderate)", "4", "5 (High/Positive)"]
data_matrix = []
row_labels = []
for label, (colname, mapping) in d_items.items():
    codes = df[colname].map(mapping)
    counts = codes.value_counts(normalize=True).reindex([1, 2, 3, 4, 5]).fillna(0) * 100
    data_matrix.append(counts.values)
    row_labels.append(label)

data_matrix = np.array(data_matrix)
fig, ax = plt.subplots(figsize=(9, 5.5))
left = np.zeros(len(row_labels))
colors5 = ["#B0413E", "#E8A87C", GREY, TEAL, NAVY]
for i in range(5):
    ax.barh(row_labels, data_matrix[:, i], left=left, color=colors5[i], label=cat_labels_5[i], edgecolor="white")
    for j, val in enumerate(data_matrix[:, i]):
        if val > 6:
            ax.text(left[j] + val/2, j, f"{val:.0f}%", ha="center", va="center",
                    fontsize=8.5, color="white" if i in [0, 4] else "black")
    left += data_matrix[:, i]
ax.set_xlim(0, 100)
ax.set_xlabel("% of respondents")
ax.set_title("Perceptions of Proposed MediLedger Nigeria Features",
             fontsize=13, fontweight="bold", pad=12)
ax.legend(bbox_to_anchor=(0.5, -0.18), loc="upper center", ncol=5, fontsize=8.5, frameon=False)
fig.text(0.99, 0.01, "n = 29-30 per item", ha="right", fontsize=8.5, color=GREY, style="italic")
plt.tight_layout()
plt.savefig("charts/10_mediledger_features_diverging.png", dpi=160, bbox_inches="tight")
plt.close()
print("Saved charts/10_mediledger_features_diverging.png")

# 11. Scatter/jitter: IT readiness vs willingness to use blockchain (with correlation)
readiness_map = {"Not ready at all": 1, "Slightly ready": 2, "Moderately ready": 3, "Ready": 4, "Fully ready": 5}
willing_map = likert_5_willing
r = df[col("IT infrastructure readiness")].map(readiness_map)
w = df[col("Willingness to use blockchain")].map(willing_map)
sub = pd.DataFrame({"readiness": r, "willingness": w}).dropna()
rng = np.random.default_rng(42)
jx = sub["readiness"] + rng.uniform(-0.12, 0.12, len(sub))
jy = sub["willingness"] + rng.uniform(-0.12, 0.12, len(sub))

from scipy import stats as sstats
rho, p = sstats.spearmanr(sub["readiness"], sub["willingness"])

fig, ax = plt.subplots(figsize=(6.5, 5.5))
ax.scatter(jx, jy, s=90, color=NAVY, alpha=0.75, edgecolor="white", linewidth=0.8)
z = np.polyfit(sub["readiness"], sub["willingness"], 1)
xs = np.linspace(1, 5, 50)
ax.plot(xs, np.poly1d(z)(xs), color=GOLD, linewidth=2.2, linestyle="--")
ax.set_xticks([1, 2, 3, 4, 5])
ax.set_yticks([1, 2, 3, 4, 5])
ax.set_xlabel("IT Infrastructure Readiness (1=Not ready, 5=Fully ready)")
ax.set_ylabel("Willingness to Use Blockchain Records\n(1=Not willing, 5=Very willing)")
ax.set_title("IT Infrastructure Readiness vs. Willingness to Adopt\nBlockchain-Based Health Records",
             fontsize=12.5, fontweight="bold", pad=12)
ax.text(0.03, 0.03, f"Spearman's rho = {rho:.3f}\np = {p:.3f}\nn = {len(sub)}",
        transform=ax.transAxes, fontsize=10, va="bottom",
        bbox=dict(boxstyle="round", facecolor="white", edgecolor=GREY, alpha=0.9))
plt.tight_layout()
plt.savefig("charts/11_readiness_vs_willingness_scatter.png", dpi=160)
plt.close()
print("Saved charts/11_readiness_vs_willingness_scatter.png")

# 12. Claim rejection x witnessed fraud (significant chi-square) heatmap-style grouped bar
ct = pd.crosstab(df[col("insurance claim rejection")], df[col("witnessed or suspected fraudulent")])
ct = ct.reindex(["No", "Not applicable", "Yes"])
fig, ax = plt.subplots(figsize=(7, 4.5))
x = np.arange(len(ct.index))
width = 0.25
cats = ["No", "Not sure", "Yes"]
cats = [c for c in cats if c in ct.columns]
for i, cat in enumerate(cats):
    ax.bar(x + (i - 1) * width, ct[cat].values, width, label=f"Witnessed fraud: {cat}",
           color=PALETTE[i], edgecolor="white")
ax.set_xticks(x)
ax.set_xticklabels(ct.index)
ax.set_xlabel("Experienced an insurance claim rejection (last 6 months)")
ax.set_ylabel("Number of respondents")
ax.set_title("Claim Rejection Experience vs. Witnessing Fraudulent Claims\n(chi-square = 12.57, p = 0.014)",
             fontsize=12.5, fontweight="bold", pad=12)
ax.legend(fontsize=9)
fig.text(0.99, 0.01, "n = 30", ha="right", fontsize=8.5, color=GREY, style="italic")
plt.tight_layout()
plt.savefig("charts/12_claimrejection_vs_fraud.png", dpi=160)
plt.close()
print("Saved charts/12_claimrejection_vs_fraud.png")

print("\nAll charts generated in ./charts/")
