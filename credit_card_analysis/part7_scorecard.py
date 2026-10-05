"""
Part 7 — แปลงผลแบบจำลองเป็นคะแนน (Scorecard) และข้อเสนอแนะทางธุรกิจ
รันต่อจาก Part 5 ใน notebook เดียวกัน (ใช้ logit, FEATURES, woe_maps, edges_map, W_train, W_test, X_test, y_test)

1) แปลงเป็นคะแนนแบบมาตรฐานของธนาคาร (points to double the odds, PDO)
       คะแนน = Offset + Factor × ln(odds ของการ "ไม่ผิดนัด")
       Factor = PDO / ln(2)          -> คะแนนเพิ่ม PDO แต้ม = odds ไม่ผิดนัดเพิ่ม 2 เท่า
       Offset = BASE − Factor × ln(BASE_ODDS)
   เพราะ ln(odds ไม่ผิดนัด) = −z  ->  คะแนน = Offset − Factor × z   (คะแนนสูง = ปลอดภัย)
   แยกคะแนนรายตัวแปรรายช่วงได้: แต้ม_i = −(β_i × WoE_i + β0/k) × Factor + Offset/k   (k = จำนวนตัวแปร)

2) เลือกจุดตัด (cutoff) — อนุมัติถ้าคะแนน ≥ จุดตัด แล้วดูข้อแลกเปลี่ยน
       อนุมัติมากขึ้น -> รายได้มากขึ้น แต่หนี้เสียมากขึ้น
   ใช้สมมติฐานกำไร/ขาดทุนต่อราย (แก้ได้ด้านล่าง) เพื่อหาจุดตัดที่กำไรสูงสุด

3) ทดสอบผลของการตัดตัวแปรอ่อนไหว (อายุ, การศึกษา) ต่อความแม่น
"""

import os

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import roc_auc_score

assert "logit" in globals(), "ยังไม่มีแบบจำลอง — รัน Part 5 ก่อน"

# ---------- ตั้งค่า (แก้ได้) ----------
BASE, BASE_ODDS, PDO = 600, 50, 20     # คะแนน 600 = odds ไม่ผิดนัด 50:1, ทุก 20 แต้ม odds เพิ่ม 2 เท่า
PROFIT_GOOD = 3_000                    # สมมติ: กำไรเฉลี่ยต่อปีจากลูกค้าที่ไม่ผิดนัด (NT$)
LOSS_BAD = 15_000                      # สมมติ: ขาดทุนเฉลี่ยจากลูกค้าที่ผิดนัด (NT$) -> 1 คนเสีย = 5 คนดี

FACTOR = PDO / np.log(2)
OFFSET = BASE - FACTOR * np.log(BASE_ODDS)
b0, betas, k = logit.intercept_[0], pd.Series(logit.coef_[0], index=FEATURES), len(FEATURES)


def to_score(z):
    return OFFSET - FACTOR * z


# ----------------------------------------------------------------------
# 1) Scorecard: แต้มของแต่ละตัวแปรในแต่ละช่วง
# ----------------------------------------------------------------------
card_rows = []
for col in FEATURES:
    for b, w in woe_maps[col].items():
        pts = -(betas[col] * w + b0 / k) * FACTOR + OFFSET / k
        card_rows.append({"ตัวแปร": col, "ช่วง (Bin)": bin_label(col, b) if "bin_label" in globals() else b,
                          "WoE": w, "แต้ม": round(pts)})
scorecard = pd.DataFrame(card_rows)
print(f"=== 1) Scorecard (BASE {BASE} = odds {BASE_ODDS}:1, PDO {PDO}) ===")
print(f"Factor = {PDO}/ln2 = {FACTOR:.2f}  |  Offset = {BASE} − {FACTOR:.2f}×ln{BASE_ODDS} = {OFFSET:.2f}")
spread = scorecard.groupby("ตัวแปร")["แต้ม"].agg(lambda s: s.max() - s.min()).sort_values(ascending=False)
for col in spread.index[:5]:                                   # แสดง 5 ตัวแปรที่แต้มแกว่งมากสุด
    print(f"\n--- {col} (แต้มต่างกันได้ {spread[col]} แต้ม) ---")
    print(scorecard[scorecard["ตัวแปร"] == col].drop(columns="ตัวแปร").round(3).to_string(index=False))
print(f"\n(ตารางเต็ม {len(scorecard)} แถว บันทึกใน scorecard.csv)")

# คะแนนของลูกค้าในชุดทดสอบ (เท่ากับรวมแต้มรายตัวแปร)
z_test = logit.decision_function(W_test)
score = pd.Series(to_score(z_test), index=y_test.index).round()
print(f"\nคะแนนชุดทดสอบ: ต่ำสุด {score.min():.0f}, มัธยฐาน {score.median():.0f}, สูงสุด {score.max():.0f}")

# ----------------------------------------------------------------------
# 2) แบ่งระดับความเสี่ยง (Risk grade) ด้วยคะแนน
# ----------------------------------------------------------------------
# ขอบระดับเลือกจากการกระจายคะแนนจริง (คะแนนส่วนใหญ่อยู่ 480–560) ให้อัตราผิดนัดเพิ่มขึ้นชัดเจนทีละระดับ
GRADES = [  # (ชื่อ, คะแนนต่ำสุด, การดำเนินการที่แนะนำ)
    ("A", 560, "อนุมัติอัตโนมัติ / เสนอเพิ่มวงเงิน"),
    ("B", 550, "อนุมัติอัตโนมัติ"),
    ("C", 540, "อนุมัติ วงเงินปกติ + ติดตามการชำระ"),
    ("D", 520, "ส่งเจ้าหน้าที่พิจารณา / ลดวงเงิน"),
    ("E", -np.inf, "ปฏิเสธ หรือ ระงับวงเงิน + ติดตามหนี้เชิงรุก"),
]


def grade_of(s):
    return next(g for g, lo, _ in GRADES if s >= lo)


g = score.map(grade_of)
gt = pd.DataFrame({"g": g, "y": y_test}).groupby("g")["y"].agg(["size", "sum", "mean"])
gt = gt.reindex([x[0] for x in GRADES])
grade_table = pd.DataFrame({
    "ระดับ": gt.index,
    "ช่วงคะแนน": [f"≥ {lo:.0f}" if np.isfinite(lo) else f"< {GRADES[-2][1]}" for _, lo, _ in GRADES],
    "จำนวน": gt["size"].values,
    "% ของลูกค้า": gt["size"].values / len(score) * 100,
    "ผิดนัด": gt["sum"].values,
    "อัตราผิดนัด (%)": gt["mean"].values * 100,
    "การดำเนินการ": [a for _, _, a in GRADES],
})
print("\n=== 2) ระดับความเสี่ยงตามคะแนน (ชุดทดสอบ) ===")
print(grade_table.round(1).to_string(index=False))

# ----------------------------------------------------------------------
# 3) ข้อแลกเปลี่ยนของจุดตัด: อนุมัติถ้าคะแนน ≥ จุดตัด
# ----------------------------------------------------------------------
n_bad, n_good = int(y_test.sum()), int((1 - y_test).sum())
base_profit = n_good * PROFIT_GOOD - n_bad * LOSS_BAD          # ถ้าอนุมัติทุกคน (ไม่ใช้แบบจำลอง)
rows = []
for cut in range(int(score.quantile(0.02) // 5 * 5), int(score.quantile(0.9)) + 1, 5):
    ok = score >= cut
    good_ok, bad_ok = int(((y_test == 0) & ok).sum()), int(((y_test == 1) & ok).sum())
    profit = good_ok * PROFIT_GOOD - bad_ok * LOSS_BAD
    rows.append({"จุดตัด": cut,
                 "อนุมัติ (%)": ok.mean() * 100,
                 "อัตราผิดนัดในกลุ่มอนุมัติ (%)": bad_ok / max(ok.sum(), 1) * 100,
                 "กันคนผิดนัดได้ (%)": (n_bad - bad_ok) / n_bad * 100,
                 "ปฏิเสธคนดีไป (%)": (n_good - good_ok) / n_good * 100,
                 "กำไร (ล้าน NT$)": profit / 1e6,
                 "เทียบอนุมัติทุกคน (ล้าน NT$)": (profit - base_profit) / 1e6})
cutoffs = pd.DataFrame(rows)
best = cutoffs.loc[cutoffs["กำไร (ล้าน NT$)"].idxmax()]
print(f"\n=== 3) ข้อแลกเปลี่ยนของจุดตัด (กำไร/คนดี {PROFIT_GOOD:,}, ขาดทุน/คนเสีย {LOSS_BAD:,} NT$) ===")
print(cutoffs.round(2).to_string(index=False))
print(f"\nอนุมัติทุกคน: อัตราผิดนัด {y_test.mean():.1%}, กำไร {base_profit / 1e6:.2f} ล้าน NT$")
print(f"จุดตัดที่กำไรสูงสุด = {best['จุดตัด']:.0f}: อนุมัติ {best['อนุมัติ (%)']:.1f}%, "
      f"อัตราผิดนัดเหลือ {best['อัตราผิดนัดในกลุ่มอนุมัติ (%)']:.1f}%, "
      f"กันคนผิดนัดได้ {best['กันคนผิดนัดได้ (%)']:.1f}% แลกกับปฏิเสธคนดี {best['ปฏิเสธคนดีไป (%)']:.1f}%, "
      f"กำไรเพิ่ม {best['เทียบอนุมัติทุกคน (ล้าน NT$)']:.2f} ล้าน NT$")

# จุดตัดที่ดีที่สุดเปลี่ยนตามอัตราส่วนขาดทุน : กำไร
print("\nจุดตัดที่กำไรสูงสุด เมื่อสมมติฐานต่างไป:")
for ratio in (2, 3, 5, 8):
    prof = [(c, int(((y_test == 0) & (score >= c)).sum()) * 1 - int(((y_test == 1) & (score >= c)).sum()) * ratio)
            for c in cutoffs["จุดตัด"]]
    c_best = max(prof, key=lambda t: t[1])[0]
    print(f"  ขาดทุน/คนเสีย = {ratio} เท่าของกำไร/คนดี -> จุดตัด {c_best}, อนุมัติ {(score >= c_best).mean():.0%}")

# ----------------------------------------------------------------------
# 4) ตัวแปรอ่อนไหว: ถ้าตัดอายุ + การศึกษา ความแม่นลดลงเท่าไร
#    (การใช้อายุ/การศึกษา/เพศ/สถานภาพตัดสินสินเชื่ออาจถือว่าเลือกปฏิบัติ)
# ----------------------------------------------------------------------
SENSITIVE = [c for c in ("AGE", "EDUCATION") if c in FEATURES]
fair = clone(logit).fit(W_train.drop(columns=SENSITIVE), y_train)
auc_all = roc_auc_score(y_test, logit.predict_proba(W_test)[:, 1])
auc_fair = roc_auc_score(y_test, fair.predict_proba(W_test.drop(columns=SENSITIVE))[:, 1])
print(f"\n=== 4) ตัด {', '.join(SENSITIVE)} ออก ===")
print(f"AUC ทดสอบ: ใช้ครบ {auc_all:.4f} -> ตัดออก {auc_fair:.4f} (ลดลง {auc_all - auc_fair:.4f})")

scorecard.to_csv(os.path.join(os.path.dirname(DATA_PATH), "scorecard.csv"), index=False)
