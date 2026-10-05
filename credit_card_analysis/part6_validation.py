"""
Part 6 — ตรวจสอบความถูกต้องของแบบจำลอง (Validation)
รันต่อจาก Part 5 ใน notebook เดียวกัน (ใช้ logit, gbm, W_train, W_test, X_train, X_test, y_train, y_test)

ตอบ 3 คำถาม
    1. Gini / AUC และ KS บนชุดทดสอบเป็นเท่าไร
    2. อัตราผิดนัดที่คาดการณ์ (ค่าเฉลี่ยของ P) ตรงกับอัตราจริงในแต่ละช่วงคะแนนไหม (calibration)
    3. แบบจำลอง overfit ไหม — เทียบชุดฝึก vs ชุดทดสอบ + ทำ 5-fold cross-validation

ช่วงคะแนน = แบ่งลูกค้าในชุดทดสอบเป็น 10 กลุ่มเท่า ๆ กันตาม P(ผิดนัด) (decile)
    กลุ่ม 1 = เสี่ยงต่ำสุด 10%, กลุ่ม 10 = เสี่ยงสูงสุด 10%
"""

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedKFold

assert "logit" in globals() and "gbm" in globals(), "ยังไม่มีแบบจำลอง — รัน Part 5 ก่อน"

MODELS = {                                                     # ชื่อ -> (แบบจำลอง, X ฝึก, X ทดสอบ)
    "Logistic Regression": (logit, W_train, W_test),
    "Gradient Boosting": (gbm, X_train, X_test),
}


def ks_stat(y, p):
    """KS = ระยะห่างสูงสุดระหว่างสัดส่วนสะสมของคนผิดนัด (TPR) กับคนไม่ผิดนัด (FPR)"""
    fpr, tpr, thr = roc_curve(y, p)
    k = np.argmax(tpr - fpr)
    return tpr[k] - fpr[k], thr[k]


def show(title, table):                                        # Colab = ตาราง HTML, นอก notebook = ข้อความ
    print("\n" + "=" * 70 + f"\n{title}\n" + "=" * 70)
    try:
        from IPython import get_ipython
        from IPython.display import display
        if get_ipython() is None:
            raise ImportError
        display(table.style.hide(axis="index").format(precision=3, thousands=","))
    except ImportError:
        print(table.round(3).to_string(index=False))


# ----------------------------------------------------------------------
# 1) Gini / AUC / KS บนชุดฝึกและชุดทดสอบ
# ----------------------------------------------------------------------
probs, rows = {}, []
for name, (model, Xtr, Xte) in MODELS.items():
    p_tr, p_te = model.predict_proba(Xtr)[:, 1], model.predict_proba(Xte)[:, 1]
    probs[name] = p_te
    auc_tr, auc_te = roc_auc_score(y_train, p_tr), roc_auc_score(y_test, p_te)
    ks_tr, ks_te = ks_stat(y_train, p_tr)[0], ks_stat(y_test, p_te)[0]
    rows.append({"แบบจำลอง": name,
                 "AUC ฝึก": auc_tr, "AUC ทดสอบ": auc_te,
                 "Gini ฝึก": 2 * auc_tr - 1, "Gini ทดสอบ": 2 * auc_te - 1,
                 "KS ฝึก": ks_tr, "KS ทดสอบ": ks_te})
metrics = pd.DataFrame(rows)
show("1) Gini / AUC / KS  (Gini = 2×AUC − 1)", metrics)
print("เกณฑ์ทั่วไปในงานสินเชื่อ: Gini > 0.4 และ KS > 0.3 = ใช้งานได้, Gini > 0.6 / KS > 0.4 = ดี")

# ----------------------------------------------------------------------
# 2) Calibration: อัตราผิดนัดที่คาดการณ์ vs อัตราจริง ในแต่ละช่วงคะแนน
# ----------------------------------------------------------------------
cal_tables = {}
for name, p in probs.items():
    band = pd.qcut(pd.Series(p, index=y_test.index).rank(method="first"), 10, labels=range(1, 11))
    t = pd.DataFrame({"p": p, "y": y_test.values, "band": band.values}).groupby("band", observed=True).agg(
        n=("y", "size"), p_min=("p", "min"), p_max=("p", "max"), pred=("p", "mean"), actual=("y", "mean"))
    t.columns = ["จำนวน", "P_ต่ำสุด", "P_สูงสุด", "คาดการณ์", "จริง"]   # ตั้งชื่อไทยทีหลัง (keyword ภาษาไทยใน agg ใช้ไม่ได้)
    t["ต่าง (จุด%)"] = (t["จริง"] - t["คาดการณ์"]) * 100
    t["จับคนผิดนัดสะสม (กลุ่มนี้ถึง 10)"] = (t["จริง"] * t["จำนวน"])[::-1].cumsum()[::-1] / (y_test.sum())  # จากกลุ่มเสี่ยงสุดลงมา
    t = t.reset_index().rename(columns={"band": "ช่วงคะแนน"})
    for c in ["P_ต่ำสุด", "P_สูงสุด", "คาดการณ์", "จริง", "จับคนผิดนัดสะสม (กลุ่มนี้ถึง 10)"]:
        t[c] = t[c] * 100                                      # แสดงเป็น %
    cal_tables[name] = t
    show(f"2) {name}: อัตราผิดนัดคาดการณ์ vs จริง (%) แยก 10 ช่วงคะแนน", t)
    mae = t["ต่าง (จุด%)"].abs().mean()
    print(f"คลาดเคลื่อนเฉลี่ย = {mae:.1f} จุด%  |  "
          f"อัตราผิดนัดรวม: คาดการณ์ {p.mean():.1%} vs จริง {y_test.mean():.1%}  |  "
          f"10% เสี่ยงสุดจับคนผิดนัดได้ {t['จับคนผิดนัดสะสม (กลุ่มนี้ถึง 10)'].iloc[-1]:.0f}% ของทั้งหมด")

# ----------------------------------------------------------------------
# 3) Overfit: 5-fold cross-validation บนชุดฝึก
#    แบ่งชุดฝึกเป็น 5 ส่วน ฝึก 4 ทดสอบ 1 วนครบ 5 รอบ -> AUC 5 ค่า
#    ถ้า AUC แต่ละรอบใกล้กัน (SD ต่ำ) และใกล้ AUC ทดสอบ = เสถียร ไม่ overfit
#    (logistic: คำนวณ WoE ใหม่จากส่วนที่ใช้ฝึกในแต่ละรอบ ไม่ให้ข้อมูลรั่ว)
# ----------------------------------------------------------------------
def woe_transform(Xa, ya, Xb):
    Wa, Wb = pd.DataFrame(index=Xa.index), pd.DataFrame(index=Xb.index)
    for col in FEATURES:
        edges = fit_bins(Xa[col], col)
        ba, bb = apply_bins(Xa[col], col, edges), apply_bins(Xb[col], col, edges)
        w = fit_woe(ba, ya)
        Wa[col], Wb[col] = ba.map(w), bb.map(w).fillna(0)
    return Wa, Wb


cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
cv_auc = {name: [] for name in MODELS}
for tr, va in cv.split(X_train, y_train):
    Xa, Xb, ya, yb = X_train.iloc[tr], X_train.iloc[va], y_train.iloc[tr], y_train.iloc[va]
    Wa, Wb = woe_transform(Xa, ya, Xb)
    m = clone(logit).fit(Wa, ya)
    cv_auc["Logistic Regression"].append(roc_auc_score(yb, m.predict_proba(Wb)[:, 1]))
    m = clone(gbm).fit(Xa, ya)
    cv_auc["Gradient Boosting"].append(roc_auc_score(yb, m.predict_proba(Xb)[:, 1]))

of_rows = []
for _, r in metrics.iterrows():
    a = np.array(cv_auc[r["แบบจำลอง"]])
    gap = r["AUC ฝึก"] - r["AUC ทดสอบ"]
    of_rows.append({"แบบจำลอง": r["แบบจำลอง"],
                    "AUC ฝึก": r["AUC ฝึก"], "AUC CV เฉลี่ย": a.mean(), "AUC CV SD": a.std(),
                    "AUC ทดสอบ": r["AUC ทดสอบ"], "ฝึก − ทดสอบ": gap,
                    "ผล": "overfit เล็กน้อย" if gap > 0.03 else "ไม่ overfit"})
overfit = pd.DataFrame(of_rows)
show("3) ตรวจ overfit: ชุดฝึก vs 5-fold CV vs ชุดทดสอบ", overfit)
for name, a in cv_auc.items():
    print(f"{name}: AUC 5 รอบ = {', '.join(f'{x:.3f}' for x in a)}")

# ----------------------------------------------------------------------
# 4) กราฟ: (ซ้าย) calibration  (ขวา) KS ของ logistic regression
# ----------------------------------------------------------------------
COLORS = {"Logistic Regression": "#2a78d6", "Gradient Boosting": "#eb6834"}
INK, INK_2, GRID = "#0b0b0b", "#52514e", "#e4e3df"
plt.rcParams.update({"axes.edgecolor": GRID, "xtick.color": INK_2, "ytick.color": INK_2,
                     "axes.labelcolor": INK_2, "figure.facecolor": "#fcfcfb", "axes.facecolor": "#fcfcfb"})
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

lim = max(t[["คาดการณ์", "จริง"]].max().max() for t in cal_tables.values()) * 1.08
ax1.plot([0, lim], [0, lim], color=INK_2, linestyle="--", linewidth=1)
ax1.text(lim * 0.62, lim * 0.50, "dashed = perfect calibration\n(predicted = actual)", fontsize=9, color=INK_2)
for name, t in cal_tables.items():
    ax1.plot(t["คาดการณ์"], t["จริง"], marker="o", markersize=7, linewidth=2,
             color=COLORS[name], label=name)
ax1.set_xlim(0, lim), ax1.set_ylim(0, lim)
ax1.set_xlabel("Predicted default rate (%)"), ax1.set_ylabel("Actual default rate (%)")
ax1.set_title("Calibration by score decile (test set)", loc="left", color=INK)
ax1.legend(frameon=False, loc="upper left")

p = probs["Logistic Regression"]
order = np.argsort(-p)                                         # เรียงจากเสี่ยงมากไปน้อย
yy = y_test.values[order]
x = np.arange(1, len(yy) + 1) / len(yy) * 100
cum_bad, cum_good = np.cumsum(yy) / yy.sum() * 100, np.cumsum(1 - yy) / (1 - yy).sum() * 100
k = np.argmax(cum_bad - cum_good)
ax2.plot(x, cum_bad, color=COLORS["Logistic Regression"], linewidth=2, label="Defaulters (cumulative %)")
ax2.plot(x, cum_good, color=INK_2, linewidth=2, label="Non-defaulters (cumulative %)")
ax2.vlines(x[k], cum_good[k], cum_bad[k], color=INK, linewidth=1.5)
ax2.text(x[k] + 2, (cum_bad[k] + cum_good[k]) / 2, f"KS = {(cum_bad[k] - cum_good[k]) / 100:.3f}",
         color=INK, fontsize=10, va="center")
ax2.set_xlabel("% of customers (sorted by predicted risk, high → low)")
ax2.set_ylabel("Cumulative %")
ax2.set_title("KS chart — Logistic Regression (test set)", loc="left", color=INK)
ax2.legend(frameon=False, loc="lower right")
for ax in (ax1, ax2):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
fig.tight_layout()
plt.show()

# ----------------------------------------------------------------------
# 5) สรุป
# ----------------------------------------------------------------------
print("\n=== สรุป ===")
for _, r in metrics.iterrows():
    t = cal_tables[r["แบบจำลอง"]]
    o = overfit.set_index("แบบจำลอง").loc[r["แบบจำลอง"]]
    print(f"* {r['แบบจำลอง']}: Gini ทดสอบ {r['Gini ทดสอบ']:.3f} (AUC {r['AUC ทดสอบ']:.3f}), "
          f"KS {r['KS ทดสอบ']:.3f} | อัตราผิดนัดกลุ่มเสี่ยงต่ำสุด {t['จริง'].iloc[0]:.1f}% -> "
          f"สูงสุด {t['จริง'].iloc[-1]:.1f}% | คาดการณ์คลาดเฉลี่ย {t['ต่าง (จุด%)'].abs().mean():.1f} จุด% | "
          f"{o['ผล']} (ฝึก − ทดสอบ = {o['ฝึก − ทดสอบ']:.3f}, CV SD = {o['AUC CV SD']:.3f})")
