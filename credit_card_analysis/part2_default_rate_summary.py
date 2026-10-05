"""
Part 2 — อัตราการผิดนัดชำระหนี้ + สรุปผลเป็นข้อความ (cell เดียวจบ)
ต้องการแค่ file UCI_Credit_Card_clean.csv จาก Part 1
"""

import os                                                      # จัดการ path / เดิน folder

import pandas as pd                                            # จัดการตาราง
from sklearn.metrics import roc_auc_score                      # วัดความแม่นในการทำนาย

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

# ---------- 1) อัตราผิดนัดชำระโดยรวม ----------
total = len(df)                                                # จำนวนลูกค้าทั้งหมด
defaults = df["DEFAULT"].sum()                                 # จำนวนคนผิดนัด (DEFAULT = 1)
overall = defaults / total                                     # อัตรา = ผิดนัด ÷ ทั้งหมด
print(f"อัตราผิดนัดโดยรวม = {defaults:,} ÷ {total:,} = {overall:.2%}")

# ---------- 2) จัดกลุ่มตัวแปร ----------
df["สถานะชำระ_กย"] = pd.cut(df["PAY_0"], [-3, 0, 1, 2, 9],
                            labels=["ไม่ค้าง (-2,-1,0)", "ค้าง 1 เดือน", "ค้าง 2 เดือน", "ค้าง 3+ เดือน"])
df["กลุ่มวงเงิน"] = pd.cut(df["LIMIT_BAL"], [0, 50_000, 100_000, 200_000, 500_000, 1_000_000],
                          labels=["≤50k", "50k-100k", "100k-200k", "200k-500k", ">500k"])
df["กลุ่มอายุ"] = pd.cut(df["AGE"], [20, 30, 40, 50, 80], labels=["21-30", "31-40", "41-50", "51+"])
df["การศึกษา"] = df["EDUCATION"].map({1: "บัณฑิตวิทยาลัย", 2: "มหาวิทยาลัย", 3: "ม.ปลาย", 4: "อื่น ๆ"})
df["เพศ"] = df["SEX"].map({1: "ชาย", 2: "หญิง"})

VARIABLES = ["สถานะชำระ_กย", "กลุ่มวงเงิน", "กลุ่มอายุ", "การศึกษา", "เพศ"]

# ---------- 3) อัตราผิดนัดของแต่ละกลุ่ม ----------
results = []
for var in VARIABLES:
    t = df.groupby(var, observed=True)["DEFAULT"].agg(["count", "sum"])      # นับคน + นับคนผิดนัด
    t.columns = ["จำนวนคน", "ผิดนัด"]
    t["อัตราผิดนัด (%)"] = (t["ผิดนัด"] / t["จำนวนคน"] * 100).round(1)     # ผิดนัด ÷ จำนวนคน
    t["ต่างจากค่าเฉลี่ย (จุด%)"] = (t["อัตราผิดนัด (%)"] - overall * 100).round(1)
    print(f"\n=== อัตราผิดนัดตาม {var} ===")
    print(t.to_string())

    score = df[var].map(t["อัตราผิดนัด (%)"]).astype(float)                 # คะแนน = อัตราของกลุ่มที่อยู่
    results.append({"ตัวแปร": var,
                    "ต่ำสุด (%)": t["อัตราผิดนัด (%)"].min(),
                    "สูงสุด (%)": t["อัตราผิดนัด (%)"].max(),
                    "ช่วงห่าง (จุด%)": round(t["อัตราผิดนัด (%)"].max() - t["อัตราผิดนัด (%)"].min(), 1),
                    "AUC": round(roc_auc_score(df["DEFAULT"], score), 3)})

# ---------- 4) ตัวแปรไหนทำนายได้ดีที่สุด ----------
summary = pd.DataFrame(results).sort_values("AUC", ascending=False)
print("\n=== เปรียบเทียบความสามารถในการทำนาย (AUC: 0.5 = เดาสุ่ม, 1 = สมบูรณ์) ===")
print(summary.to_string(index=False))

# ---------- 5) สรุปผลเป็นข้อความ ----------
# คำอธิบายแนวโน้ม (ใช้เมื่ออัตราเพิ่ม/ลดตามลำดับกลุ่มจริง ๆ เท่านั้น)
TREND_TEXT = {
    "สถานะชำระ_กย": "ยิ่งค้างนาน ยิ่งผิดนัดมาก",
    "กลุ่มวงเงิน": "ยิ่งวงเงินสูง ยิ่งผิดนัดน้อย",
    "กลุ่มอายุ": "ยิ่งอายุมาก ยิ่งผิดนัดมาก",
}

print("\n=== สรุปผล ===")
print(f"* ค่าเฉลี่ยรวม: {overall:.1%}")
for var in VARIABLES:
    t = df.groupby(var, observed=True)["DEFAULT"].mean() * 100   # อัตราผิดนัดของแต่ละกลุ่ม (%)
    gap = t.max() - t.min()                                       # ช่วงห่าง (จุด %)
    name = var.replace("_กย", " ก.ย.")                             # ชื่อตัวแปรสำหรับแสดงผล
    lo = str(t.idxmin()).split(" (")[0]                           # กลุ่มต่ำสุด (ตัดรหัสในวงเล็บออก)
    hi = str(t.idxmax()).split(" (")[0]                           # กลุ่มสูงสุด
    monotonic = t.is_monotonic_increasing or t.is_monotonic_decreasing  # อัตราเพิ่ม/ลดตามลำดับกลุ่ม

    if var in TREND_TEXT and monotonic:                           # มีแนวโน้มชัดเจน -> บอกแนวโน้ม
        note = TREND_TEXT[var]
    elif gap < 10:                                                # ช่วงห่างน้อย -> แทบไม่ต่าง
        note = "แทบไม่ต่างจากค่าเฉลี่ย"
    else:                                                         # ต่างกันแต่ไม่เป็นแนวโน้ม
        note = "ต่างกันพอสมควร แต่ไม่เป็นแนวโน้มชัดเจน"

    if gap >= 10:
        line = f"อัตราเปลี่ยนจาก {t.min():.1f}% ({lo}) ขึ้นไปถึง {t.max():.1f}% ({hi})"
    else:
        line = f"อัตราเปลี่ยนแค่ {t.min():.1f}% ({lo}) กับ {t.max():.1f}% ({hi})"
    print(f"* เมื่อแยกตาม{name}: {line} {note}")

best = summary.iloc[0]
print(f"\n→ ตัวแปรที่ทำนายได้ดีที่สุด: {best['ตัวแปร'].replace('_กย', ' ก.ย.')} "
      f"(AUC = {best['AUC']}, ช่วงห่าง {best['ช่วงห่าง (จุด%)']} จุด)")
