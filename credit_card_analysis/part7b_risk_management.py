"""
Part 7 (ต่อ) — Scoring ตามหลัก Financial Risk Management
รันต่อจาก Part 7 ใน notebook เดียวกัน (ใช้ logit, W_test, X_test, y_test, df, FACTOR, OFFSET)

กรอบที่ใช้ (Basel / credit risk management)
    1. PD  (Probability of Default)   = ความน่าจะเป็นที่จะผิดนัด จากแบบจำลอง logistic
    2. Master scale                   = แบ่งระดับตาม "ช่วง PD" (ไม่ใช่ช่วงคะแนนที่ตั้งเอง)
                                        แล้วแปลง PD เป็นคะแนน: คะแนน = Offset + Factor × ln((1−PD)/PD)
    3. Expected Loss (EL)             = PD × LGD × EAD          -> ความเสียหายที่คาดไว้ (ต้นทุน ตั้งสำรอง)
         EAD = ยอดคงค้าง + CCF × วงเงินที่ยังไม่ใช้          (Exposure at Default)
         LGD = สัดส่วนที่เสียหายเมื่อผิดนัด                    (Loss Given Default)
    4. Unexpected Loss / Capital (K)  = สูตร Basel IRB สำหรับสินเชื่อรายย่อยหมุนเวียน (QRRE, ρ = 0.04, 99.9%)
         K = LGD × [ N( (N⁻¹(PD) + √ρ·N⁻¹(0.999)) / √(1−ρ) ) − PD ]   ,  เงินกองทุน = K × EAD
    5. RAROC = (รายได้ − ต้นทุนดำเนินงาน − EL) ÷ เงินกองทุน     -> อนุมัติระดับที่ RAROC ≥ อัตราผลตอบแทนขั้นต่ำ

ข้อจำกัดสำคัญ: DEFAULT ในข้อมูลนี้คือ "ผิดนัดเดือนถัดไป" ช่วงวิกฤตบัตรเครดิตไต้หวันปี 2005
ในที่นี้ใช้ PD จากแบบจำลองแทน PD 1 ปี (proxy) และ LGD / CCF / รายได้ / ต้นทุน เป็นค่าสมมติ (แก้ได้ด้านล่าง)
"""

import numpy as np
import pandas as pd
from scipy.stats import norm

assert "logit" in globals() and "FACTOR" in globals(), "รัน Part 5 และ Part 7 ก่อน"

# ---------- สมมติฐาน (แก้ได้) ----------
LGD = 0.75            # บัตรเครดิตไม่มีหลักประกัน มักเสียหาย 70–90% ของยอดที่ผิดนัด
CCF = 0.50            # วงเงินที่ยังไม่ใช้ ถูกเบิกเพิ่มก่อนผิดนัดเฉลี่ย 50%
RHO = 0.04            # สหสัมพันธ์ของสินเชื่อรายย่อยหมุนเวียน (Basel QRRE)
REVENUE_RATE = 0.15   # รายได้ดอกเบี้ย + ค่าธรรมเนียม ต่อปี (% ของ EAD)
COST_RATE = 0.03      # ต้นทุนดำเนินงาน + ต้นทุนเงินทุน ต่อปี (% ของ EAD)
HURDLE = 0.15         # ผลตอบแทนขั้นต่ำต่อเงินกองทุนที่ธนาคารยอมรับ (RAROC ≥ 15%)

# Master scale: ช่วง PD ของแต่ละระดับ (ขอบล่าง, ขอบบน)
MASTER = [("A", 0.00, 0.07), ("B", 0.07, 0.10), ("C", 0.10, 0.15), ("D", 0.15, 0.30), ("E", 0.30, 1.00)]


def pd_to_score(p):
    return OFFSET + FACTOR * np.log((1 - p) / p)               # สูตรเดียวกับ Part 7 แต่เขียนด้วย PD


def score_range(lo, hi):
    """PD สูง = คะแนนต่ำ -> ช่วง PD [lo, hi) ตรงกับคะแนน (score(hi), score(lo)]"""
    if lo == 0:
        return f"≥ {pd_to_score(hi):.0f}"
    if hi >= 1:
        return f"< {pd_to_score(lo):.0f}"
    return f"{pd_to_score(hi):.0f} – {pd_to_score(lo):.0f}"


def basel_k(p, lgd=LGD, rho=RHO):
    """เงินกองทุนต่อ 1 บาทของ EAD ตามสูตร Basel IRB (QRRE)"""
    p = np.clip(p, 1e-4, 0.9999)
    return lgd * (norm.cdf((norm.ppf(p) + np.sqrt(rho) * norm.ppf(0.999)) / np.sqrt(1 - rho)) - p)


# ----------------------------------------------------------------------
# 1) PD, EAD, EL, K ของลูกค้าแต่ละคน (ชุดทดสอบ)
# ----------------------------------------------------------------------
cust = df.loc[X_test.index, ["LIMIT_BAL", "BILL_AMT1"]].copy()
cust["PD"] = logit.predict_proba(W_test)[:, 1]
cust["คะแนน"] = pd_to_score(cust["PD"]).round()
balance = cust["BILL_AMT1"].clip(lower=0)                      # ยอดคงค้างล่าสุด (ติดลบ = ไม่มีหนี้)
undrawn = (cust["LIMIT_BAL"] - balance).clip(lower=0)          # วงเงินที่ยังไม่ใช้
cust["EAD"] = balance + CCF * undrawn
cust["EL"] = cust["PD"] * LGD * cust["EAD"]
cust["Capital"] = basel_k(cust["PD"]) * cust["EAD"]
cust["DEFAULT"] = y_test.values
cust["ระดับ"] = pd.cut(cust["PD"], [lo for _, lo, _ in MASTER] + [1.0], labels=[g for g, _, _ in MASTER],
                       right=False, include_lowest=True)

# ----------------------------------------------------------------------
# 2) Master scale: ระดับ / ช่วง PD / ช่วงคะแนน / PD คาดการณ์ vs อัตราผิดนัดจริง
# ----------------------------------------------------------------------
rows = []
for g, lo, hi in MASTER:
    c = cust[cust["ระดับ"] == g]
    ead = c["EAD"].sum()
    revenue, cost, el, cap = REVENUE_RATE * ead, COST_RATE * ead, c["EL"].sum(), c["Capital"].sum()
    rows.append({
        "ระดับ": g,
        "ช่วง PD": f"{lo:.0%} – {hi:.0%}",
        "ช่วงคะแนน": score_range(lo, hi),
        "จำนวน": len(c),
        "% ลูกค้า": len(c) / len(cust) * 100,
        "PD คาดการณ์ (%)": c["PD"].mean() * 100,
        "ผิดนัดจริง (%)": c["DEFAULT"].mean() * 100,
        "EAD (ล้าน)": ead / 1e6,
        "EL (ล้าน)": el / 1e6,
        "EL / EAD (%)": el / ead * 100,
        "เงินกองทุน (ล้าน)": cap / 1e6,
        "K / EAD (%)": cap / ead * 100,
        "RAROC (%)": (revenue - cost - el) / cap * 100,
    })
ms = pd.DataFrame(rows)
ms["ตัดสินใจ"] = np.where(ms["RAROC (%)"] >= HURDLE * 100, "อนุมัติ", "ปฏิเสธ / ทบทวน")

print(f"=== 1) Master scale + Expected Loss + เงินกองทุน (ชุดทดสอบ {len(cust):,} คน) ===")
print(f"สมมติฐาน: LGD {LGD:.0%}, CCF {CCF:.0%}, รายได้ {REVENUE_RATE:.0%}/ปี, ต้นทุน {COST_RATE:.0%}/ปี, "
      f"RAROC ขั้นต่ำ {HURDLE:.0%}, Basel QRRE ρ = {RHO}")
print(ms.round(2).to_string(index=False))

# ----------------------------------------------------------------------
# 3) เปรียบเทียบนโยบาย: อนุมัติทุกคน vs อนุมัติตาม RAROC
# ----------------------------------------------------------------------
def portfolio(mask):
    c = cust[mask]
    ead, el, cap = c["EAD"].sum(), c["EL"].sum(), c["Capital"].sum()
    profit = (REVENUE_RATE - COST_RATE) * ead - el
    return {"อนุมัติ (%)": mask.mean() * 100, "ผิดนัดจริง (%)": c["DEFAULT"].mean() * 100,
            "EAD (ล้าน)": ead / 1e6, "EL (ล้าน)": el / 1e6, "EL / EAD (%)": el / ead * 100,
            "กำไรหลังหัก EL (ล้าน)": profit / 1e6, "เงินกองทุน (ล้าน)": cap / 1e6,
            "RAROC (%)": profit / cap * 100}


ok_grades = ms.loc[ms["ตัดสินใจ"] == "อนุมัติ", "ระดับ"].tolist()
policy = pd.DataFrame({
    "อนุมัติทุกคน": portfolio(pd.Series(True, index=cust.index)),
    f"อนุมัติระดับ {', '.join(ok_grades)}": portfolio(cust["ระดับ"].isin(ok_grades)),
}).T
print("\n=== 2) เปรียบเทียบนโยบายการอนุมัติ ===")
print(policy.round(2).to_string())

# ----------------------------------------------------------------------
# 4) สรุปตามหลักบริหารความเสี่ยง
# ----------------------------------------------------------------------
a, b = policy.iloc[0], policy.iloc[1]
print("\n=== สรุป ===")
print(f"* Master scale แบ่งตาม PD: อัตราผิดนัดจริงเรียงจาก {ms['ผิดนัดจริง (%)'].iloc[0]:.1f}% (A) "
      f"ถึง {ms['ผิดนัดจริง (%)'].iloc[-1]:.1f}% (E) และใกล้ PD คาดการณ์ทุกระดับ")
print(f"* EL ต่อ EAD: ระดับ A {ms['EL / EAD (%)'].iloc[0]:.1f}% -> ระดับ E {ms['EL / EAD (%)'].iloc[-1]:.1f}% "
      f"(รายได้ {REVENUE_RATE:.0%} − ต้นทุน {COST_RATE:.0%} = กำไรขั้นต้น {(REVENUE_RATE - COST_RATE):.0%} ของ EAD)")
print(f"* อนุมัติเฉพาะระดับ {', '.join(ok_grades)} (RAROC ≥ {HURDLE:.0%}): อนุมัติ {b['อนุมัติ (%)']:.0f}% ของลูกค้า, "
      f"EL ลดจาก {a['EL (ล้าน)']:.1f} เป็น {b['EL (ล้าน)']:.1f} ล้าน, "
      f"RAROC พอร์ตเพิ่มจาก {a['RAROC (%)']:.1f}% เป็น {b['RAROC (%)']:.1f}%")
