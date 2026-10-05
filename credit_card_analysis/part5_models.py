"""
Part 5 — สร้างแบบจำลอง 2 แบบ ด้วยชุดฝึก (train) และชุดทดสอบ (test)
ต้องการ file UCI_Credit_Card_features.csv จาก Part 3 (+ iv_selection.csv จาก Part 4 ถ้ามี) — cell เดียวจบ

แบบจำลอง
    1. Logistic Regression บนค่า WoE (แบบ scorecard ที่ธนาคารใช้จริง)
         - ตีความได้: เบต้าแต่ละตัวบอกว่าตัวแปรนั้นเพิ่ม/ลดความเสี่ยงเท่าไร
         - WoE คำนวณจาก "ชุดฝึกเท่านั้น" แล้วนำไปใช้กับชุดทดสอบ (กันข้อมูลทดสอบรั่วเข้าโมเดล)
    2. Gradient Boosting (HistGradientBoostingClassifier)
         - ต้นไม้ตัดสินใจหลายร้อยต้นที่เรียนจากความผิดพลาดของต้นก่อนหน้า
         - จับความสัมพันธ์แบบไม่เป็นเส้นตรงและผลร่วมระหว่างตัวแปรได้เอง ไม่ต้องทำ WoE
         - เลือกเพราะมักแม่นที่สุดในข้อมูลตาราง เพื่อดูว่าแม่นกว่า logistic แค่ไหน

การวัดผล (บนชุดทดสอบ)
    AUC   : แยกคนผิดนัด / ไม่ผิดนัด ได้ดีแค่ไหน (0.5 = เดาสุ่ม, 1 = สมบูรณ์)
    Gini  : 2 × AUC − 1 (ตัววัดที่ธนาคารนิยมใช้)
    KS    : ระยะห่างสูงสุดระหว่างการกระจายคะแนนของคนผิดนัดกับคนไม่ผิดนัด
    Precision / Recall / F1 ที่จุดตัด (threshold) — เลือกจุดตัดที่ F1 สูงสุดจากชุดฝึก
"""

import os                                                      # จัดการ path / เดิน folder

import numpy as np                                             # คำนวณตัวเลข
import pandas as pd                                            # จัดการตาราง
from sklearn.ensemble import HistGradientBoostingClassifier    # แบบจำลองที่ 2
from sklearn.linear_model import LogisticRegression            # แบบจำลองที่ 1
from sklearn.metrics import (confusion_matrix, f1_score, precision_score, recall_score,
                             roc_auc_score, roc_curve)
from sklearn.model_selection import train_test_split          # แบ่ง train / test

SEED = 42                                                      # ให้ผลเหมือนเดิมทุกครั้งที่รัน

# ---------- 0) หา file ข้อมูลจาก Part 3 ----------
FEATURE_FILE = "UCI_Credit_Card_features.csv"
if "FEATURE_PATH" in globals() and os.path.isfile(FEATURE_PATH):   # รัน Part 3 แล้ว -> ใช้ path เดิม
    DATA_PATH = FEATURE_PATH
else:                                                          # ยังไม่ได้รัน -> ค้นหา file ใน Drive
    try:
        from google.colab import drive
        drive.mount("/content/drive", force_remount=False)
        roots = ["/content/drive/MyDrive", "/content"]
    except ImportError:
        roots = [os.getcwd()]
    DATA_PATH = next((os.path.join(d, FEATURE_FILE)
                      for r in roots if os.path.isdir(r)
                      for d, _, files in os.walk(r) if FEATURE_FILE in files), None)
    assert DATA_PATH, f"หา {FEATURE_FILE} ไม่เจอ — รัน Part 3 ก่อน"

df = pd.read_csv(DATA_PATH)
print("ใช้ file:", DATA_PATH)

# ---------- 1) ตัวแปรที่ใช้ = ตัวที่ Part 4 เลือกเก็บ ----------
SELECTION = os.path.join(os.path.dirname(DATA_PATH), "iv_selection.csv")
if os.path.isfile(SELECTION):                                  # อ่านผลจาก Part 4
    sel = pd.read_csv(SELECTION)
    FEATURES = sel.loc[sel["ผล"] == "เก็บ", "ตัวแปร"].tolist()
else:                                                          # ไม่มี file -> ใช้รายชื่อจากผล Part 4
    FEATURES = ["PAY_1", "MAX_DELAY", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6", "LIMIT_BAL",
                "PAY_AMT1", "PAY_AMT2", "AVG_UTIL", "PAY_AMT3", "PAY_RATIO", "UTIL_TREND",
                "PAY_AMT6", "PAY_AMT4", "PAY_AMT5", "EDUCATION", "AGE"]
print(f"ใช้ {len(FEATURES)} ตัวแปร: {', '.join(FEATURES)}")

# ---------- 2) แบ่งชุดฝึก 70% / ชุดทดสอบ 30% ----------
# stratify = รักษาสัดส่วนคนผิดนัด (~22%) ให้เท่ากันทั้งสองชุด
X_train, X_test, y_train, y_test = train_test_split(
    df[FEATURES], df["DEFAULT"], test_size=0.3, stratify=df["DEFAULT"], random_state=SEED)
print(f"\nชุดฝึก   : {len(X_train):,} คน (ผิดนัด {y_train.mean():.1%})")
print(f"ชุดทดสอบ : {len(X_test):,} คน (ผิดนัด {y_test.mean():.1%})")


# ----------------------------------------------------------------------
# 3) แบบจำลองที่ 1: Logistic Regression บน WoE
# ----------------------------------------------------------------------
PAY_LIKE = [f"PAY_{i}" for i in range(1, 7)] + ["MAX_DELAY"]   # ตัวแปรรหัสสถานะ -> ใช้ค่าจริง, 3+ รวมกัน


def fit_bins(s, name):
    """หาขอบ Bin จากชุดฝึก (decile สำหรับตัวแปรต่อเนื่อง)"""
    if name in PAY_LIKE or s.nunique() <= 10:
        return None                                            # ใช้ค่าจริงเป็น Bin
    return np.unique(np.quantile(s, np.linspace(0, 1, 11)))


def apply_bins(s, name, edges):
    if name in PAY_LIKE:
        return s.clip(upper=3).astype(int).astype(str)
    if edges is None:
        return s.astype(int).astype(str)
    inner = edges[1:-1]                                        # ใช้ขอบด้านใน -> ค่านอกช่วงของชุดฝึกตกช่องริมสุด
    return pd.Series(np.searchsorted(inner, s, side="right"), index=s.index).astype(str)


def fit_woe(b, y):
    """WoE ของแต่ละ Bin (คำนวณจากชุดฝึก)"""
    t = pd.crosstab(b, y).reindex(columns=[0, 1], fill_value=0)
    good = (t[0] + 0.5) / (t[0].sum() + 0.5 * len(t))
    bad = (t[1] + 0.5) / (t[1].sum() + 0.5 * len(t))
    return np.log(good / bad)


woe_maps, edges_map = {}, {}
W_train, W_test = pd.DataFrame(index=X_train.index), pd.DataFrame(index=X_test.index)
for col in FEATURES:
    edges_map[col] = fit_bins(X_train[col], col)
    b_train = apply_bins(X_train[col], col, edges_map[col])
    b_test = apply_bins(X_test[col], col, edges_map[col])
    woe_maps[col] = fit_woe(b_train, y_train)                 # เรียน WoE จากชุดฝึกเท่านั้น
    W_train[col] = b_train.map(woe_maps[col])
    W_test[col] = b_test.map(woe_maps[col]).fillna(0)          # Bin ที่ไม่เคยเห็นในชุดฝึก -> WoE = 0 (เฉลี่ย)

logit = LogisticRegression(max_iter=1000)
logit.fit(W_train, y_train)

# ----------------------------------------------------------------------
# 4) แบบจำลองที่ 2: Gradient Boosting (ใช้ค่าดิบ ไม่ต้องทำ WoE)
# ----------------------------------------------------------------------
gbm = HistGradientBoostingClassifier(
    learning_rate=0.05, max_iter=300, max_leaf_nodes=15, min_samples_leaf=100,
    l2_regularization=1.0, early_stopping=True, validation_fraction=0.15, random_state=SEED)
gbm.fit(X_train, y_train)


# ----------------------------------------------------------------------
# 5) วัดผล
# ----------------------------------------------------------------------
def ks_stat(y, p):
    fpr, tpr, _ = roc_curve(y, p)
    return np.max(tpr - fpr)


def best_threshold(y, p):
    """จุดตัดที่ F1 สูงสุด (หาจากชุดฝึก แล้วนำไปใช้กับชุดทดสอบ)"""
    grid = np.linspace(0.05, 0.95, 91)
    return grid[np.argmax([f1_score(y, p >= t) for t in grid])]


models = {
    "Logistic Regression (WoE)": (logit, W_train, W_test),
    "Gradient Boosting": (gbm, X_train, X_test),
}
rows, probs = [], {}
for name, (model, Xtr, Xte) in models.items():
    p_train = model.predict_proba(Xtr)[:, 1]                   # ความน่าจะเป็นที่จะผิดนัด
    p_test = model.predict_proba(Xte)[:, 1]
    probs[name] = p_test
    thr = best_threshold(y_train, p_train)
    pred = (p_test >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    auc_tr, auc_te = roc_auc_score(y_train, p_train), roc_auc_score(y_test, p_test)
    rows.append({
        "แบบจำลอง": name,
        "AUC ชุดฝึก": auc_tr,
        "AUC ชุดทดสอบ": auc_te,
        "ต่าง (overfit)": auc_tr - auc_te,
        "Gini": 2 * auc_te - 1,
        "KS": ks_stat(y_test, p_test),
        "จุดตัด": thr,
        "Precision": precision_score(y_test, pred),
        "Recall": recall_score(y_test, pred),
        "F1": f1_score(y_test, pred),
        "จับคนผิดนัดได้": f"{tp:,} / {tp + fn:,}",
        "เตือนผิด (คนดี)": f"{fp:,} / {fp + tn:,}",
    })

results = pd.DataFrame(rows)
print("\n=== 1) ผลบนชุดทดสอบ ===")
print(results.round(3).T.to_string(header=False))

# ----------------------------------------------------------------------
# 6) ตีความ logistic regression: เบต้าของแต่ละตัวแปร
#    บน WoE: WoE ติดลบ = เสี่ยง ดังนั้นเบต้าควรติดลบ (WoE ลด -> โอกาสผิดนัดเพิ่ม)
#    ถ้าเบต้าเป็นบวก = ทิศกลับกับ WoE เพราะซ้ำซ้อนกับตัวแปรอื่น (ควรพิจารณาตัดออก)
# ----------------------------------------------------------------------
coef = pd.DataFrame({"ตัวแปร": FEATURES, "เบต้า": logit.coef_[0]})
coef["|เบต้า|"] = coef["เบต้า"].abs()
coef["ทิศ"] = np.where(coef["เบต้า"] < 0, "ถูกต้อง", "กลับทิศ (ซ้ำซ้อน)")
print("\n=== 2) เบต้าของ Logistic Regression (เรียงตามขนาด) ===")
print(coef.sort_values("|เบต้า|", ascending=False).drop(columns="|เบต้า|").round(3).to_string(index=False))

# สมการ: z = b0 + Σ βi × WoE_i  ,  P(ผิดนัด) = 1 / (1 + e^(−z))
b0 = logit.intercept_[0]
terms = " ".join(f"{'+' if c >= 0 else '−'} {abs(c):.4f}×WoE({f})" for f, c in zip(FEATURES, logit.coef_[0]))
print("\n=== สมการ Logistic Regression ===")
print(f"z = {b0:.4f} {terms}")
print("P(ผิดนัด) = 1 / (1 + e^(−z))")

# ----------------------------------------------------------------------
# 7) ความสำคัญของตัวแปรใน Gradient Boosting (permutation importance บนชุดทดสอบ)
#    = AUC ลดลงเท่าไรเมื่อสลับค่าตัวแปรนั้นแบบสุ่ม (ลดมาก = สำคัญมาก)
# ----------------------------------------------------------------------
from sklearn.inspection import permutation_importance

imp = permutation_importance(gbm, X_test, y_test, scoring="roc_auc", n_repeats=5, random_state=SEED)
imp_df = pd.DataFrame({"ตัวแปร": FEATURES, "AUC ลดลง": imp.importances_mean}) \
    .sort_values("AUC ลดลง", ascending=False)
print("\n=== 3) ตัวแปรสำคัญของ Gradient Boosting (10 อันดับแรก) ===")
print(imp_df.head(10).round(4).to_string(index=False))

# ----------------------------------------------------------------------
# 8) สรุป
# ----------------------------------------------------------------------
lr, gb = results.iloc[0], results.iloc[1]
better = gb if gb["AUC ชุดทดสอบ"] > lr["AUC ชุดทดสอบ"] else lr
print("\n=== สรุป ===")
for _, r in results.iterrows():
    print(f"* {r['แบบจำลอง']}: AUC ทดสอบ {r['AUC ชุดทดสอบ']:.3f} (Gini {r['Gini']:.3f}, KS {r['KS']:.3f}), "
          f"จับคนผิดนัดได้ {r['Recall']:.0%} โดยแม่น {r['Precision']:.0%}")
print(f"* AUC ต่างกัน {abs(gb['AUC ชุดทดสอบ'] - lr['AUC ชุดทดสอบ']):.3f} — {better['แบบจำลอง']} ดีกว่าเล็กน้อย")
for _, r in results.iterrows():                               # ฝึกดีกว่าทดสอบเกิน 0.03 = เริ่มจำข้อมูลฝึก
    gap = r["ต่าง (overfit)"]
    print(f"* {r['แบบจำลอง']}: AUC ฝึก − ทดสอบ = {gap:.3f} -> "
          f"{'overfit เล็กน้อย' if gap > 0.03 else 'ไม่ overfit'}")

out = os.path.join(os.path.dirname(DATA_PATH), "model_results.csv")
results.to_csv(out, index=False)
print(f"\nบันทึก: {out}")
