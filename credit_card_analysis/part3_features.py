"""
Part 3 — สร้างคุณลักษณะ (Feature engineering) จากข้อมูลย้อนหลัง 6 เดือน (เม.ย.–ก.ย. 2005)
ต้องการแค่ file UCI_Credit_Card_clean.csv จาก Part 1 (cell เดียวจบ)

คุณลักษณะที่สร้าง (5 ตัว)
    1. AVG_UTIL       อัตราการใช้วงเงินเฉลี่ย 6 เดือน       = เฉลี่ย(ยอดบิล ÷ วงเงิน)
    2. PAY_RATIO      อัตราส่วนการชำระต่อบิล                 = ยอดจ่ายรวม ÷ ยอดบิลรวม (จับคู่เดือนให้ถูก)
    3. MAX_DELAY      การค้างชำระที่ร้ายแรงที่สุด             = จำนวนเดือนที่ค้างมากที่สุดใน 6 เดือน
    4. N_LATE_MONTHS  จำนวนเดือนที่ค้างชำระ                  = นับเดือนที่ค้าง (0–6)
    5. UTIL_TREND     แนวโน้มการใช้วงเงิน                    = ความชันของอัตราการใช้วงเงินตามเวลา (ต่อเดือน)
"""

import os                                                      # จัดการ path / เดิน folder

import numpy as np                                             # คำนวณตัวเลข
import pandas as pd                                            # จัดการตาราง
from sklearn.metrics import roc_auc_score                      # วัดความสามารถในการทำนาย

# ---------- 0) หา file ข้อมูลที่คลีนแล้ว ----------
CLEAN_FILE = "UCI_Credit_Card_clean.csv"                       # file ที่ Part 1 บันทึกไว้
if "OUTPUT_PATH" in globals() and os.path.isfile(OUTPUT_PATH): # รัน Part 1 แล้ว -> ใช้ path เดิม
    CLEAN_PATH = OUTPUT_PATH
else:                                                          # ยังไม่ได้รัน -> ค้นหา file ใน Drive
    try:
        from google.colab import drive
        drive.mount("/content/drive", force_remount=False)
        roots = ["/content/drive/MyDrive", "/content"]
    except ImportError:
        roots = [os.getcwd()]
    CLEAN_PATH = next((os.path.join(d, CLEAN_FILE)
                       for r in roots if os.path.isdir(r)
                       for d, _, files in os.walk(r) if CLEAN_FILE in files), None)
    assert CLEAN_PATH, f"หา {CLEAN_FILE} ไม่เจอ — รัน Part 1 ก่อน"

df = pd.read_csv(CLEAN_PATH)                                   # ข้อมูลที่คลีนแล้ว
print("ใช้ file:", CLEAN_PATH)

# เลข 1..6 = ก.ย. ... เม.ย. (1 = เดือนล่าสุด)
BILL = [f"BILL_AMT{i}" for i in range(1, 7)]                   # ยอดบิล 6 เดือน
PAID = [f"PAY_AMT{i}" for i in range(1, 7)]                    # ยอดจ่าย 6 เดือน
DELAY = [f"DELAY_{i}" for i in range(1, 7)]                    # จำนวนเดือนที่ค้าง (สร้างไว้ใน Part 1)

# ----------------------------------------------------------------------
# 1) AVG_UTIL — อัตราการใช้วงเงินเฉลี่ย
#    ยอดบิล ÷ วงเงิน ของแต่ละเดือน แล้วเฉลี่ย 6 เดือน
#    บิลติดลบ (จ่ายเกิน) นับเป็น 0 เพราะไม่ได้ใช้วงเงิน
# ----------------------------------------------------------------------
util = df[BILL].clip(lower=0).div(df["LIMIT_BAL"], axis=0)     # อัตราการใช้วงเงินรายเดือน
df["AVG_UTIL"] = util.mean(axis=1)

# ----------------------------------------------------------------------
# 2) PAY_RATIO — อัตราส่วนการชำระต่อบิล
#    เงินที่จ่ายในเดือนหนึ่งคือการจ่ายบิลของเดือนก่อนหน้า
#    เช่น PAY_AMT1 (จ่ายใน ก.ย.) จ่ายบิล BILL_AMT2 (ส.ค.) จึงจับคู่ PAY_AMT1..5 กับ BILL_AMT2..6
#    - ถ้าไม่มียอดบิลเลย (รวม ≤ 0) = ไม่มีหนี้ต้องจ่าย -> ให้ค่า 1 (จ่ายครบ)
#    - ตัดค่าไว้ที่ 0–1 (จ่ายเกินบิลก็นับว่าจ่ายครบ 100%)
# ----------------------------------------------------------------------
paid_total = df[PAID[:5]].sum(axis=1)                          # จ่ายรวม ก.ย.–พ.ค.
bill_total = df[BILL[1:]].clip(lower=0).sum(axis=1)            # บิลรวม ส.ค.–เม.ย.
df["PAY_RATIO"] = np.where(bill_total > 0, paid_total / bill_total.replace(0, np.nan), 1.0)
df["PAY_RATIO"] = df["PAY_RATIO"].clip(0, 1)

# ----------------------------------------------------------------------
# 3) MAX_DELAY — การค้างชำระที่ร้ายแรงที่สุดใน 6 เดือน (0 = ไม่เคยค้าง)
# 4) N_LATE_MONTHS — จำนวนเดือนที่ค้างชำระ (0–6)
# ----------------------------------------------------------------------
df["MAX_DELAY"] = df[DELAY].max(axis=1)
df["N_LATE_MONTHS"] = (df[DELAY] > 0).sum(axis=1)

# ----------------------------------------------------------------------
# 5) UTIL_TREND — แนวโน้มการใช้วงเงิน
#    ความชัน (slope) ของเส้นตรงที่ลากผ่านอัตราการใช้วงเงิน เม.ย. -> ก.ย.
#    + = ใช้วงเงินเพิ่มขึ้นเรื่อย ๆ (หนี้พอกขึ้น), − = ใช้ลดลง (กำลังผ่อนหนี้)
#    หน่วย: จุด % ของวงเงินต่อเดือน
# ----------------------------------------------------------------------
u = util[BILL[::-1]].to_numpy() * 100                          # เรียงจากเก่า (เม.ย.) ไปใหม่ (ก.ย.)
x = np.arange(6) - 2.5                                         # เดือนที่ 0..5 ลบค่าเฉลี่ย
df["UTIL_TREND"] = (u * x).sum(axis=1) / (x ** 2).sum()        # สูตรความชันของ least squares

FEATURES = {  # ชื่อ -> คำอธิบาย
    "AVG_UTIL": "อัตราการใช้วงเงินเฉลี่ย",
    "PAY_RATIO": "อัตราส่วนการชำระต่อบิล",
    "MAX_DELAY": "การค้างชำระที่ร้ายแรงที่สุด (เดือน)",
    "N_LATE_MONTHS": "จำนวนเดือนที่ค้างชำระ",
    "UTIL_TREND": "แนวโน้มการใช้วงเงิน (จุด%/เดือน)",
}

# ----------------------------------------------------------------------
# 6) สถิติพื้นฐานของแต่ละคุณลักษณะ
# ----------------------------------------------------------------------
desc = df[list(FEATURES)].describe().T
stats = pd.DataFrame({
    "คุณลักษณะ": list(FEATURES),
    "ความหมาย": list(FEATURES.values()),
    "mean": desc["mean"].values,
    "median": desc["50%"].values,
    "min": desc["min"].values,
    "max": desc["max"].values,
}).round(3)
print("\n=== 1) สถิติพื้นฐานของคุณลักษณะใหม่ ===")
print(stats.to_string(index=False))

# ----------------------------------------------------------------------
# 7) อัตราผิดนัดชำระตามกลุ่มของแต่ละคุณลักษณะ
# ----------------------------------------------------------------------
GROUPS = {
    "AVG_UTIL": pd.cut(df["AVG_UTIL"], [-0.01, 0.1, 0.3, 0.5, 0.8, np.inf],
                       labels=["<10%", "10-30%", "30-50%", "50-80%", "≥80%"]),
    "PAY_RATIO": pd.cut(df["PAY_RATIO"], [-0.01, 0.05, 0.2, 0.5, 0.99, 1.0],
                        labels=["<5%", "5-20%", "20-50%", "50-99%", "จ่ายครบ 100%"]),
    "MAX_DELAY": pd.cut(df["MAX_DELAY"], [-1, 0, 1, 2, 9],
                        labels=["ไม่เคยค้าง", "ค้างสูงสุด 1 เดือน", "ค้างสูงสุด 2 เดือน", "ค้างสูงสุด 3+ เดือน"]),
    "N_LATE_MONTHS": pd.cut(df["N_LATE_MONTHS"], [-1, 0, 1, 3, 6],
                            labels=["0 เดือน", "1 เดือน", "2-3 เดือน", "4-6 เดือน"]),
    "UTIL_TREND": pd.cut(df["UTIL_TREND"], [-np.inf, -2, -0.5, 0.5, 2, np.inf],
                         labels=["ลดลงมาก", "ลดลง", "คงที่", "เพิ่มขึ้น", "เพิ่มขึ้นมาก"]),
}

overall = df["DEFAULT"].mean() * 100                           # อัตราผิดนัดโดยรวม (%)
print(f"\nอัตราผิดนัดโดยรวม = {overall:.1f}%")
results = []
for feat, groups in GROUPS.items():
    t = df.groupby(groups, observed=True)["DEFAULT"].agg(["count", "sum"])
    t.columns = ["จำนวนคน", "ผิดนัด"]
    t["อัตราผิดนัด (%)"] = (t["ผิดนัด"] / t["จำนวนคน"] * 100).round(1)
    t["ต่างจากค่าเฉลี่ย (จุด%)"] = (t["อัตราผิดนัด (%)"] - overall).round(1)
    print(f"\n=== 2) อัตราผิดนัดตาม {feat} — {FEATURES[feat]} ===")
    print(t.to_string())

    auc = roc_auc_score(df["DEFAULT"], df[feat])               # AUC จากค่าตัวเลขตรง ๆ
    results.append({"คุณลักษณะ": feat, "ความหมาย": FEATURES[feat],
                    "ต่ำสุด (%)": t["อัตราผิดนัด (%)"].min(), "สูงสุด (%)": t["อัตราผิดนัด (%)"].max(),
                    "AUC": round(max(auc, 1 - auc), 3),        # กลับทิศถ้าค่าน้อย = เสี่ยงมาก
                    "ทิศทาง": "ค่ามาก = เสี่ยงมาก" if auc >= 0.5 else "ค่ามาก = เสี่ยงน้อย"})

# ----------------------------------------------------------------------
# 8) เทียบความสามารถในการทำนายกับ PAY_1 (ตัวที่ดีที่สุดใน Part 2)
# ----------------------------------------------------------------------
base = roc_auc_score(df["DEFAULT"], df["PAY_1"])
# (ใช้ค่าตัวเลขตรง ๆ เหมือนคุณลักษณะอื่น จึงได้ 0.690 ต่างจาก 0.700 ใน Part 2 ที่ใช้แบบจัดกลุ่ม)
results.append({"คุณลักษณะ": "PAY_1 (เทียบ)", "ความหมาย": "สถานะชำระเดือน ก.ย. อย่างเดียว",
                "ต่ำสุด (%)": np.nan, "สูงสุด (%)": np.nan, "AUC": round(base, 3), "ทิศทาง": "ค่ามาก = เสี่ยงมาก"})
summary = pd.DataFrame(results).sort_values("AUC", ascending=False)
print("\n=== 3) เปรียบเทียบความสามารถในการทำนาย (AUC: 0.5 = เดาสุ่ม, 1 = สมบูรณ์) ===")
print(summary.to_string(index=False))

# ----------------------------------------------------------------------
# 9) สรุปผลเป็นข้อความ + บันทึก file
# ----------------------------------------------------------------------
print("\n=== สรุปผล ===")
for feat, groups in GROUPS.items():
    t = df.groupby(groups, observed=True)["DEFAULT"].mean() * 100
    print(f"* {FEATURES[feat]} ({feat}): อัตราผิดนัดตั้งแต่ {t.min():.1f}% ({t.idxmin()}) "
          f"ถึง {t.max():.1f}% ({t.idxmax()})")
best = summary.iloc[0]
print(f"\n→ คุณลักษณะที่ทำนายได้ดีที่สุด: {best['คุณลักษณะ']} ({best['ความหมาย']}) AUC = {best['AUC']}")

FEATURE_PATH = os.path.join(os.path.dirname(CLEAN_PATH), "UCI_Credit_Card_features.csv")
df.to_csv(FEATURE_PATH, index=False)                           # เก็บไว้ใช้ทำโมเดลใน part ถัดไป
print(f"\nบันทึกไฟล์: {FEATURE_PATH}  ({df.shape[0]:,} แถว, {df.shape[1]} คอลัมน์)")
