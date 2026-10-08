"""
Part 1 (ต่อ) — ตารางสรุปข้อมูลหลังทำความสะอาด
รันต่อจาก part1_data_cleaning.py (ใช้ cell ถัดไปใน Colab ได้เลย)

ตารางที่ได้
    1. ภาพรวมข้อมูล        — จำนวนแถว/คอลัมน์, จำนวนและอัตราผิดนัดชำระ
    2. พจนานุกรมตัวแปร      — แต่ละคอลัมน์คืออะไร ชนิดข้อมูล ค่าต่ำสุด/สูงสุด
    3. ตัวแปรหมวดหมู่       — เพศ / การศึกษา / สถานภาพ: จำนวน, %, อัตรา default ของแต่ละกลุ่ม
    4. ตัวแปรตัวเลข          — วงเงิน, อายุ, ยอดบิล, ยอดจ่าย: mean, median, SD, min, max
    5. สถานะการชำระ (PAY)  — แต่ละเดือนมีกี่คนจ่ายตรง / ค้างกี่เดือน
"""

import os                                                   # จัดการ path / เดิน folder

import pandas as pd                                         # จัดการตารางข้อมูล

# ---------- หา file ข้อมูลที่สะอาดแล้ว ----------
CLEAN_FILE = "UCI_Credit_Card_clean.csv"                    # file ที่ part1_data_cleaning.py บันทึกไว้

if "OUTPUT_PATH" in globals() and os.path.isfile(OUTPUT_PATH):  # ถ้ารัน cell ก่อนหน้าแล้ว ใช้ path เดิมเลย
    CLEAN_PATH = OUTPUT_PATH
else:                                                       # ไม่งั้นค้นหา file เอง (เหมือน cell ก่อนหน้า)
    try:
        from google.colab import drive                      # module ของ Colab
        drive.mount("/content/drive", force_remount=False)  # เชื่อม Drive
        roots = ["/content/drive/MyDrive", "/content"]      # จุดเริ่มค้นหา
    except ImportError:                                     # ไม่ได้รันบน Colab
        roots = [os.getcwd()]                               # ค้นหาจาก folder ที่รัน
    CLEAN_PATH = None
    for root in roots:                                      # ไล่ทุกจุดเริ่มค้นหา
        for dirpath, dirnames, filenames in os.walk(root):  # เดินลงทุก folder ย่อย
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "drive"]
            if CLEAN_FILE in filenames:                     # เจอ file
                CLEAN_PATH = os.path.join(dirpath, CLEAN_FILE)
                break
        if CLEAN_PATH:
            break
    assert CLEAN_PATH, f"หา {CLEAN_FILE} ไม่เจอ — รัน part1_data_cleaning.py ก่อน"

df = pd.read_csv(CLEAN_PATH)                                # โหลดข้อมูลที่สะอาดแล้ว
print("ใช้ file:", CLEAN_PATH)

# ---------- ป้ายชื่อของรหัส (ตามเอกสาร) ----------
LABELS = {
    "SEX": {1: "ชาย", 2: "หญิง"},
    "EDUCATION": {1: "บัณฑิตวิทยาลัย", 2: "มหาวิทยาลัย", 3: "มัธยมศึกษาตอนปลาย", 4: "อื่น ๆ"},
    "MARRIAGE": {1: "สมรส", 2: "โสด", 3: "อื่น ๆ"},
}
PAY_COLS = ["PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"]  # สถานะการชำระ 6 เดือน (ชื่อตามต้นฉบับ)
BILL_COLS = [f"BILL_AMT{i}" for i in range(1, 7)]           # ยอดบิล 6 เดือน
PAY_AMT_COLS = [f"PAY_AMT{i}" for i in range(1, 7)]         # ยอดจ่าย 6 เดือน
MONTHS = ["ก.ย.", "ส.ค.", "ก.ค.", "มิ.ย.", "พ.ค.", "เม.ย."]  # เดือนที่ 1..6 (ปี 2005)


def show(title, table):                                     # แสดงตาราง: Colab = HTML, นอก notebook = ข้อความ
    print("\n" + "=" * 70 + f"\n{title}\n" + "=" * 70)
    try:
        from IPython import get_ipython
        from IPython.display import display
        if get_ipython() is None:
            raise ImportError
        display(table.style.hide(axis="index").format(precision=2, thousands=","))
    except ImportError:
        print(table.round(2).to_string(index=False))


# ----------------------------------------------------------------------
# 1) ภาพรวมข้อมูล
# ----------------------------------------------------------------------
n = len(df)                                                 # จำนวนลูกค้า
n_default = int(df["DEFAULT"].sum())                        # จำนวนคนผิดนัดชำระ
overview = pd.DataFrame([
    ("จำนวนลูกค้า (แถว)", f"{n:,}"),
    ("จำนวนตัวแปร (คอลัมน์)", f"{df.shape[1]}"),
    ("ค่าว่าง (NaN)", f"{int(df.isna().sum().sum())}"),
    ("ผิดนัดชำระ (DEFAULT = 1)", f"{n_default:,} ({n_default / n:.1%})"),
    ("ไม่ผิดนัด (DEFAULT = 0)", f"{n - n_default:,} ({1 - n_default / n:.1%})"),
    ("ช่วงเวลาข้อมูล", "เม.ย. – ก.ย. 2005 (6 เดือน)"),
], columns=["รายการ", "ค่า"])
show("1) ภาพรวมข้อมูลหลังทำความสะอาด", overview)

# ----------------------------------------------------------------------
# 2) พจนานุกรมตัวแปร
# ----------------------------------------------------------------------
MEANING = {                                                 # ความหมายของแต่ละคอลัมน์
    "ID": "รหัสลูกค้า",
    "LIMIT_BAL": "วงเงินบัตร (ดอลลาร์ไต้หวัน)",
    "SEX": "เพศ (1=ชาย, 2=หญิง)",
    "EDUCATION": "การศึกษา (1=บัณฑิตฯ, 2=มหาวิทยาลัย, 3=ม.ปลาย, 4=อื่น ๆ)",
    "MARRIAGE": "สถานภาพ (1=สมรส, 2=โสด, 3=อื่น ๆ)",
    "AGE": "อายุ (ปี)",
    "DEFAULT": "ผิดนัดชำระเดือนถัดไป (1=ใช่, 0=ไม่)",
    "DUP_PROFILE": "ธง: ข้อมูลเหมือนลูกค้าอื่นแต่ ID ต่าง",
    "HAS_CREDIT_BALANCE": "ธง: มียอดบิลติดลบ (จ่ายเกิน)",
}
for i, m in enumerate(MONTHS, start=1):
    MEANING[PAY_COLS[i - 1]] = f"สถานะชำระ {m} (-1=จ่ายตรงเวลา/ไม่ล่าช้า [รวม -2/-1/0], 1-8=ล่าช้า n เดือน)"
    MEANING[f"BILL_AMT{i}"] = f"ยอดบิล {m}"
    MEANING[f"PAY_AMT{i}"] = f"ยอดที่จ่าย {m}"

dictionary = pd.DataFrame({
    "ตัวแปร": df.columns,
    "ความหมาย": [MEANING.get(c, "") for c in df.columns],
    "ชนิด": [str(t) for t in df.dtypes],
    "จำนวนค่าไม่ซ้ำ": [df[c].nunique() for c in df.columns],
    "ต่ำสุด": [df[c].min() for c in df.columns],
    "สูงสุด": [df[c].max() for c in df.columns],
})
show("2) พจนานุกรมตัวแปร", dictionary)

# ----------------------------------------------------------------------
# 3) ตัวแปรหมวดหมู่: จำนวน, %, อัตรา default ของแต่ละกลุ่ม
# ----------------------------------------------------------------------
cat_rows = []
for col, labels in LABELS.items():                          # ไล่เพศ / การศึกษา / สถานภาพ
    g = df.groupby(col)["DEFAULT"].agg(["count", "mean"])   # จำนวน + อัตรา default ต่อกลุ่ม
    for code, row in g.iterrows():
        cat_rows.append({
            "ตัวแปร": col,
            "รหัส": code,
            "ความหมาย": labels.get(code, "?"),
            "จำนวน": int(row["count"]),
            "% ของทั้งหมด": row["count"] / n * 100,
            "อัตรา default (%)": row["mean"] * 100,
        })
show("3) ตัวแปรหมวดหมู่", pd.DataFrame(cat_rows))

# ----------------------------------------------------------------------
# 4) ตัวแปรตัวเลข: mean, median, SD, min, max
# ----------------------------------------------------------------------
num_cols = ["LIMIT_BAL", "AGE"] + BILL_COLS + PAY_AMT_COLS
desc = df[num_cols].describe().T                            # สถิติพื้นฐานของทุกคอลัมน์ตัวเลข
numeric = pd.DataFrame({
    "ตัวแปร": num_cols,
    "mean": desc["mean"].values,
    "median": desc["50%"].values,
    "SD": desc["std"].values,
    "min": desc["min"].values,
    "max": desc["max"].values,
})
show("4) ตัวแปรตัวเลข", numeric)

# ----------------------------------------------------------------------
# 5) สถานะการชำระแต่ละเดือน
# ----------------------------------------------------------------------
pay_rows = []
for i, (col, m) in enumerate(zip(PAY_COLS, MONTHS), start=1):
    s = df[col]
    pay_rows.append({
        "เดือน": m,
        "จ่ายตรงเวลา/ไม่ล่าช้า (-1)": int((s == -1).sum()),
        "ค้าง 1 เดือน": int((s == 1).sum()),
        "ค้าง 2 เดือน": int((s == 2).sum()),
        "ค้าง 3+ เดือน": int((s >= 3).sum()),
        "% ค้างชำระ": (s > 0).mean() * 100,
    })
show("5) สถานะการชำระแต่ละเดือน (จำนวนคน)", pd.DataFrame(pay_rows))
