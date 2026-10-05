"""
Part 1 — ทำความสะอาดข้อมูล (Data Cleaning)
ชุดข้อมูล: UCI Default of Credit Card Clients (ไต้หวัน, เม.ย.–ก.ย. 2005, 30,000 ราย)

สิ่งที่สคริปต์นี้ทำ
    1. โหลดข้อมูลและตรวจโครงสร้าง (จำนวนแถว/คอลัมน์, ชนิดข้อมูล)
    2. หาค่าที่หายไป ทั้งแบบ "ชัดเจน" (NaN/ช่องว่าง) และแบบ "แฝง" (รหัสที่แปลว่าไม่ทราบ)
    3. หารหัสซ้ำ — ID ซ้ำ, แถวซ้ำทั้งแถว, และแถวที่ข้อมูลเหมือนกันแต่ ID ต่างกัน
    4. หารหัสที่เอกสารไม่ได้อธิบายไว้ (EDUCATION 0/5/6, MARRIAGE 0, PAY_x = -2/0)
    5. ตรวจค่าตัวเลขที่ดูแปลก (BILL_AMT ติดลบ, ช่วงอายุ, วงเงิน)
    6. จัดการแต่ละปัญหาตามที่ตัดสินใจไว้ แล้วบันทึกไฟล์ที่สะอาดแล้ว

วิธีรัน
    pip install pandas
    python part1_data_cleaning.py                       # ใช้ data/UCI_Credit_Card.csv
    python part1_data_cleaning.py path/to/file.csv      # ระบุไฟล์เอง
"""

import sys
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
INPUT_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE_DIR / "data" / "UCI_Credit_Card.csv"
OUTPUT_PATH = BASE_DIR / "data" / "UCI_Credit_Card_clean.csv"

# รหัสที่ "เอกสารต้นฉบับ" (UCI data dictionary) อธิบายไว้ — ใช้เทียบหารหัสแปลกปลอม
DOCUMENTED_CODES = {
    "SEX": {1, 2},                        # 1=ชาย, 2=หญิง
    "EDUCATION": {1, 2, 3, 4},            # 1=ป.โท+, 2=ป.ตรี, 3=ม.ปลาย, 4=อื่น ๆ
    "MARRIAGE": {1, 2, 3},                # 1=สมรส, 2=โสด, 3=อื่น ๆ
    # PAY_x: -1 = จ่ายตรงเวลา, 1..9 = ค้างชำระ 1..9 เดือน (เอกสารไม่พูดถึง -2 และ 0)
    "PAY": {-1, 1, 2, 3, 4, 5, 6, 7, 8, 9},
}

PAY_COLS = ["PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"]
BILL_COLS = [f"BILL_AMT{i}" for i in range(1, 7)]
PAY_AMT_COLS = [f"PAY_AMT{i}" for i in range(1, 7)]
TARGET = "default.payment.next.month"


def section(title: str) -> None:
    """พิมพ์หัวข้อให้อ่านผลลัพธ์ใน terminal ได้ง่าย"""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ----------------------------------------------------------------------
# 1) โหลดข้อมูล
# ----------------------------------------------------------------------
def load_data(path: Path) -> pd.DataFrame:
    # na_values: นับสตริงที่มักใช้แทน "ไม่มีข้อมูล" ให้เป็น NaN ด้วย
    df = pd.read_csv(path, na_values=["", " ", "NA", "N/A", "null", "?"])
    section("1) โครงสร้างข้อมูล")
    print(f"ไฟล์: {path}")
    print(f"จำนวนแถว x คอลัมน์: {df.shape}")
    print(df.dtypes.value_counts().to_string())
    return df


# ----------------------------------------------------------------------
# 2) ค่าที่หายไป
# ----------------------------------------------------------------------
def check_missing(df: pd.DataFrame) -> None:
    section("2) ค่าที่หายไป (Missing values)")
    na = df.isna().sum()
    print(f"NaN ทั้งหมด: {int(na.sum())}")
    if na.sum():
        print(na[na > 0].to_string())

    # ค่าหายไปแบบแฝง: รหัสที่ไม่ได้บอกว่าเป็นอะไร ก็คือ "ไม่ทราบ" นั่นเอง
    hidden = {
        "EDUCATION = 0/5/6 (ไม่ทราบ)": int(df["EDUCATION"].isin([0, 5, 6]).sum()),
        "MARRIAGE = 0 (ไม่ทราบ)": int((df["MARRIAGE"] == 0).sum()),
    }
    print("\nค่าที่หายไปแบบแฝง (ซ่อนอยู่ในรูปของรหัส):")
    for k, v in hidden.items():
        print(f"  {k:<30} {v:>6} แถว ({v / len(df):.2%})")


# ----------------------------------------------------------------------
# 3) รหัสซ้ำ / แถวซ้ำ
# ----------------------------------------------------------------------
def check_duplicates(df: pd.DataFrame) -> pd.Series:
    section("3) ข้อมูลซ้ำ (Duplicates)")
    print(f"ID ซ้ำ                         : {df['ID'].duplicated().sum()}")
    print(f"แถวซ้ำทั้งแถว (รวม ID)          : {df.duplicated().sum()}")

    features = [c for c in df.columns if c not in ("ID", TARGET)]
    dup_mask = df.duplicated(subset=features, keep=False)
    groups = df[dup_mask].groupby(features)[TARGET]
    n_conflict = int((groups.nunique() > 1).sum())
    all_zero = (df.loc[dup_mask, BILL_COLS + PAY_AMT_COLS] == 0).all(axis=1).mean()

    print(f"แถวที่ feature เหมือนกันแต่ ID ต่าง: {int(dup_mask.sum())} แถว ใน {groups.ngroups} กลุ่ม")
    print(f"  - กลุ่มที่ผลลัพธ์ (default) ต่างกัน : {n_conflict} กลุ่ม")
    print(f"  - แถวที่ยอดบิล/ยอดจ่ายเป็น 0 ทั้งหมด: {all_zero:.0%}")
    return dup_mask


# ----------------------------------------------------------------------
# 4) รหัสที่เอกสารไม่ได้อธิบาย
# ----------------------------------------------------------------------
def check_undocumented_codes(df: pd.DataFrame) -> None:
    section("4) รหัสที่เอกสารไม่ได้อธิบายไว้")
    for col in ["SEX", "EDUCATION", "MARRIAGE"]:
        counts = df[col].value_counts().sort_index()
        bad = counts[~counts.index.isin(DOCUMENTED_CODES[col])]
        print(f"{col:<10} ทั้งหมด: {counts.to_dict()}")
        print(f"{'':<10} ไม่มีในเอกสาร: {bad.to_dict() if len(bad) else '-'}")

    print("\nPAY_x — จำนวนแถวที่มีรหัส -2 และ 0 (ไม่มีในเอกสาร):")
    for col in PAY_COLS:
        print(f"  {col}: -2 = {(df[col] == -2).sum():>5}, 0 = {(df[col] == 0).sum():>5}")


# ----------------------------------------------------------------------
# 5) ค่าตัวเลขที่ดูแปลก
# ----------------------------------------------------------------------
def check_numeric_ranges(df: pd.DataFrame) -> None:
    section("5) ตรวจช่วงค่าตัวเลข")
    print(df[["LIMIT_BAL", "AGE"] + BILL_COLS + PAY_AMT_COLS].describe().T[["min", "max"]].to_string())
    neg = (df[BILL_COLS] < 0).any(axis=1).sum()
    print(f"\nแถวที่มี BILL_AMT ติดลบอย่างน้อย 1 เดือน: {neg}")
    print(f"PAY_AMT ติดลบ: {(df[PAY_AMT_COLS] < 0).any(axis=1).sum()}  |  "
          f"LIMIT_BAL <= 0: {(df['LIMIT_BAL'] <= 0).sum()}  |  "
          f"AGE นอกช่วง 18-100: {(~df['AGE'].between(18, 100)).sum()}")


# ----------------------------------------------------------------------
# 6) จัดการข้อมูลตามที่ตัดสินใจ
# ----------------------------------------------------------------------
def clean(df: pd.DataFrame, dup_mask: pd.Series) -> pd.DataFrame:
    section("6) จัดการข้อมูล")
    df = df.copy()

    # 6.1 เปลี่ยนชื่อคอลัมน์ให้สม่ำเสมอ
    #   - PAY_0 -> PAY_1 ให้เลขเดือนตรงกับ BILL_AMT1 / PAY_AMT1 (ก.ย.)
    #   - ชื่อ target มีจุด ใช้ยากใน pandas -> DEFAULT
    df = df.rename(columns={"PAY_0": "PAY_1", TARGET: "DEFAULT"})
    pay_cols = [f"PAY_{i}" for i in range(1, 7)]

    # 6.2 ธงบอกว่าเดิมเป็นรหัส "ไม่ทราบ" (ทำก่อนแก้ค่า ไม่งั้นข้อมูลนี้จะหายไป)
    df["EDUCATION_UNKNOWN"] = df["EDUCATION"].isin([0, 5, 6]).astype(int)
    df["MARRIAGE_UNKNOWN"] = (df["MARRIAGE"] == 0).astype(int)

    # 6.3 EDUCATION 0/5/6 -> 4 (อื่น ๆ) และ MARRIAGE 0 -> 3 (อื่น ๆ)
    df["EDUCATION"] = df["EDUCATION"].replace({0: 4, 5: 4, 6: 4})
    df["MARRIAGE"] = df["MARRIAGE"].replace({0: 3})
    print(f"EDUCATION หลังรวมรหัส: {df['EDUCATION'].value_counts().sort_index().to_dict()}")
    print(f"MARRIAGE  หลังรวมรหัส: {df['MARRIAGE'].value_counts().sort_index().to_dict()}")

    # 6.4 PAY_x: เก็บรหัสเดิมไว้ (มีข้อมูลพฤติกรรม) + สร้างคอลัมน์ "จำนวนเดือนที่ค้าง"
    #   -2 = ไม่มีการใช้บัตร, -1 = จ่ายเต็ม, 0 = จ่ายขั้นต่ำ (revolving) -> ทั้งหมดคือ "ไม่ค้าง" = 0
    for i, col in enumerate(pay_cols, start=1):
        df[f"DELAY_{i}"] = df[col].clip(lower=0)
    print("สร้าง DELAY_1..DELAY_6 = จำนวนเดือนที่ค้างชำระ (รหัส -2/-1/0 -> 0)")

    # 6.5 BILL_AMT ติดลบ = ลูกค้าจ่ายเกิน (มียอดเครดิตคงเหลือ) -> เก็บไว้ + ทำธง
    df["HAS_CREDIT_BALANCE"] = (df[BILL_COLS] < 0).any(axis=1).astype(int)

    # 6.6 แถวที่ feature ซ้ำกัน -> ไม่ลบ แต่ทำธงไว้ให้ตรวจสอบภายหลัง
    df["DUP_PROFILE"] = dup_mask.astype(int).values

    # 6.7 ชนิดข้อมูล: ยอดเงินเป็นจำนวนเต็มอยู่แล้ว (float เพราะรูปแบบไฟล์) -> int
    money = ["LIMIT_BAL"] + BILL_COLS + PAY_AMT_COLS
    df[money] = df[money].round().astype("int64")

    print(f"\nขนาดข้อมูลหลังทำความสะอาด: {df.shape} (ไม่มีการลบแถว)")
    return df


def main() -> None:
    df = load_data(INPUT_PATH)
    check_missing(df)
    dup_mask = check_duplicates(df)
    check_undocumented_codes(df)
    check_numeric_ranges(df)
    clean_df = clean(df, dup_mask)

    clean_df.to_csv(OUTPUT_PATH, index=False)
    print(f"บันทึกไฟล์: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
