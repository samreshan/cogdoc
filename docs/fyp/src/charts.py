"""Generate the two evaluation charts for the FYP document.

Data is taken verbatim from fastapi/eval_results_real_embeddings.json (no fabrication).
Outputs (150 dpi, no color decoration beyond two greyscale shades to match the
minimal-academic style):
  - 16_chart_f1_by_class.png   : per-verdict precision/recall/F1
  - 17_chart_recall_by_k.png   : vector vs keyword Recall@1/3/5
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Always resolve output relative to this script (docs/fyp), not the cwd.
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "diagrams")

# ---------------------------------------------------------------- per-class F1
classes = ["Supported", "Partially\nSupported", "Unsupported", "Insufficient\nEvidence"]
precision = [1.00, 1.00, 0.71, 0.55]
recall    = [0.69, 0.67, 0.83, 1.00]
f1        = [0.82, 0.80, 0.77, 0.71]

import numpy as np
x = np.arange(len(classes))
w = 0.26

fig, ax = plt.subplots(figsize=(8.2, 4.2), dpi=150)
b1 = ax.bar(x - w, precision, w, label="Precision", color="#4a4a4a")
b2 = ax.bar(x,     recall,    w, label="Recall",    color="#9a9a9a")
b3 = ax.bar(x + w, f1,        w, label="F1-score",  color="#cdcdcd")
ax.axhline(0.70, color="#222", linestyle=(0, (4, 3)), linewidth=1.0)
ax.text(3.45, 0.705, "target 0.70", fontsize=7, color="#222", ha="right")

ax.set_xticks(x); ax.set_xticklabels(classes, fontsize=9)
ax.set_ylim(0, 1.12)
ax.set_ylabel("Score", fontsize=10)
ax.set_title("Figure 7.2: Per-verdict Precision, Recall and F1 (held-out test, n=31)", fontsize=10)
ax.legend(fontsize=8, loc="upper center", ncol=3, frameon=False)
ax.grid(axis="y", color="#e3e3e3", linewidth=0.7)
ax.set_axisbelow(True)
for s in ["top", "right"]:
    ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(f"{OUT}/16_chart_f1_by_class.png", dpi=150, bbox_inches="tight")
plt.close(fig)

# ---------------------------------------------------------------- recall by k
k_labels = ["Recall@1", "Recall@3", "Recall@5"]
vector  = [0.5375, 0.7375, 0.8875]
keyword = [0.4875, 0.7250, 0.8625]
deltas  = [5.0, 1.25, 2.5]

xk = np.arange(len(k_labels))
fig, ax = plt.subplots(figsize=(7.2, 4.0), dpi=150)
wb = 0.36
ax.bar(xk - wb/2, vector,  wb, label="Vector (Gemini)", color="#4a4a4a")
ax.bar(xk + wb/2, keyword, wb, label="Keyword (Jaccard)", color="#b5b5b5")
ax.axhline(0.80, color="#222", linestyle=(0, (4, 3)), linewidth=1.0)
ax.text(2.45, 0.805, "target 0.80", fontsize=7, color="#222", ha="right")

for i, (v, k, d) in enumerate(zip(vector, keyword, deltas)):
    ax.text(i - wb/2, v + 0.015, f"{v:.2f}", ha="center", fontsize=7.5)
    ax.text(i + wb/2, k + 0.015, f"{k:.2f}", ha="center", fontsize=7.5)
    ax.text(i, max(v, k) + 0.07, f"+{d:.1f}pp", ha="center", fontsize=7.5, color="#222")

ax.set_xticks(xk); ax.set_xticklabels(k_labels, fontsize=9)
ax.set_ylim(0, 1.05)
ax.set_ylabel("Recall", fontsize=10)
ax.set_title("Figure 7.3: Vector vs Keyword Retrieval Recall by cut-off k", fontsize=10)
ax.legend(fontsize=8, loc="lower right", frameon=False)
ax.grid(axis="y", color="#e3e3e3", linewidth=0.7)
ax.set_axisbelow(True)
for s in ["top", "right"]:
    ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(f"{OUT}/17_chart_recall_by_k.png", dpi=150, bbox_inches="tight")
plt.close(fig)

print("charts written:", f"{OUT}/16_chart_f1_by_class.png", f"{OUT}/17_chart_recall_by_k.png")
