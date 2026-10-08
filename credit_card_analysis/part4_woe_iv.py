"""
Part 4 — คัดเลือกตัวแปรด้วย Weight of Evidence (WoE) และ Information Value (IV)
ต้องการ file UCI_Credit_Card_features.csv จาก Part 3 (cell เดียวจบ)

ขั้นตอน
    1. แบ่งแต่ละตัวแปรเป็นช่วง (Bin)
    2. คำนวณ WoE ของแต่ละ Bin และ IV ของแต่ละตัวแปร แล้วจัดอันดับ (Rank)
    3. คัดตัวแปรออกตาม 3 กฎ
         กฎ 1: IV < 0.02                 -> ตัด (แทบไม่มีพลังทำนาย)
         กฎ 2: สหสัมพันธ์ของ WoE > 0.7    -> ตัวที่ IV ต่ำกว่าถูกตัด (ข้อมูลซ้ำซ้อน)
    4. สรุปตัวแปรที่เก็บ / ตัด พร้อมเหตุผล

สูตร (Good = ไม่ผิดนัด, Bad = ผิดนัด)
    %Good_i = จำนวน Good ใน Bin i ÷ Good ทั้งหมด
    %Bad_i  = จำนวน Bad  ใน Bin i ÷ Bad  ทั้งหมด
    WoE_i   = ln(%Good_i ÷ %Bad_i)           (+ = ปลอดภัยกว่าเฉลี่ย, − = เสี่ยงกว่าเฉลี่ย)
    IV      = Σ (%Good_i − %Bad_i) × WoE_i

เกณฑ์ IV (Siddiqi, 2006)
    < 0.02 ไม่มีประโยชน์ | 0.02–0.1 อ่อน | 0.1–0.3 ปานกลาง | 0.3–0.5 แรง | > 0.5 แรงมาก (ตรวจว่ารั่วไหมก่อนใช้)
"""

import os                                                      # จัดการ path / เดิน folder

import numpy as np                                             # คำนวณตัวเลข
import pandas as pd                                            # จัดการตาราง

# ---------- 0) หา file ข้อมูลจาก Part 3 ----------
FEATURE_FILE = "UCI_Credit_Card_features.csv"                  # file ที่ Part 3 บันทึกไว้
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
y = df["DEFAULT"]                                              # 1 = Bad (ผิดนัด), 0 = Good
print("ใช้ file:", DATA_PATH)
print(f"Good = {(y == 0).sum():,}  Bad = {(y == 1).sum():,}")

# ตัวแปรที่ไม่ใช่ตัวทำนาย: ID (รหัส), DEFAULT (คำตอบ)
CANDIDATES = [c for c in df.columns if c not in ("ID", "DEFAULT")]

PAY_STATUS = ["PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"]  # สถานะชำระ: -1 = จ่ายตรงเวลา, 1..8 = ล่าช้า n เดือน


# ----------------------------------------------------------------------
# 1) แบ่ง Bin
#    - สถานะชำระ (-1 = จ่ายตรงเวลา, 1, 2, 3+) / MAX_DELAY (0, 1, 2, 3+): ค่า ≥ 3 รวมเป็น "3+" (คนน้อย WoE แกว่ง)
#    - ตัวแปรหมวดหมู่ (ค่าไม่ซ้ำ ≤ 10): ใช้ค่าจริงเป็น Bin
#    - ตัวแปรต่อเนื่อง: แบ่ง 10 ช่วงเท่า ๆ กันตามจำนวนคน (decile)
# ----------------------------------------------------------------------
def make_bins(s, name):
    if name in PAY_STATUS or name == "MAX_DELAY":
        return s.clip(upper=3).map(lambda v: "3+" if v >= 3 else str(int(v)))
    if s.nunique() <= 10:
        return s.astype(int).astype(str)
    return pd.qcut(s, 10, duplicates="drop").astype(str)


# ----------------------------------------------------------------------
# 2) คำนวณ WoE ต่อ Bin และ IV ต่อตัวแปร
#    บวก 0.5 ให้ทุกช่อง กัน log(0) ในกรณี Bin ไม่มี Good หรือ Bad เลย
# ----------------------------------------------------------------------
def woe_table(s, name):
    b = make_bins(s, name)
    order = s.groupby(b).min().sort_values().index             # เรียง Bin ตามค่าจริง (ไม่ใช่ตามตัวอักษร)
    t = pd.crosstab(b, y).reindex(index=order, columns=[0, 1], fill_value=0)
    t.columns = ["Good", "Bad"]
    t["จำนวน"] = t["Good"] + t["Bad"]
    t["อัตราผิดนัด (%)"] = t["Bad"] / t["จำนวน"] * 100
    pct_good = (t["Good"] + 0.5) / (t["Good"].sum() + 0.5 * len(t))
    pct_bad = (t["Bad"] + 0.5) / (t["Bad"].sum() + 0.5 * len(t))
    t["WoE"] = np.log(pct_good / pct_bad)
    t["IV ของ Bin"] = (pct_good - pct_bad) * t["WoE"]
    t = t.reset_index().rename(columns={"row_0": "Bin", t.index.name or "index": "Bin"})
    t.insert(0, "ตัวแปร", name)
    return t[["ตัวแปร", "Bin", "จำนวน", "Good", "Bad", "อัตราผิดนัด (%)", "WoE", "IV ของ Bin"]], b


def strength(iv):
    if iv < 0.02:
        return "ไม่มีประโยชน์"
    if iv < 0.1:
        return "อ่อน"
    if iv < 0.3:
        return "ปานกลาง"
    if iv < 0.5:
        return "แรง"
    return "แรงมาก"


woe_tables, woe_values, iv_rows = {}, {}, []
for col in CANDIDATES:
    t, bins = woe_table(df[col], col)
    woe_tables[col] = t
    woe_values[col] = bins.map(t.set_index("Bin")["WoE"])      # ค่า WoE ของแต่ละคน (ใช้หาสหสัมพันธ์)
    iv = t["IV ของ Bin"].sum()
    iv_rows.append({"ตัวแปร": col, "จำนวน Bin": len(t), "IV": iv, "ระดับ": strength(iv)})

iv_table = pd.DataFrame(iv_rows).sort_values("IV", ascending=False).reset_index(drop=True)
iv_table.insert(0, "Rank", range(1, len(iv_table) + 1))
print("\n=== 1) Information Value ของทุกตัวแปร (เรียงตาม Rank) ===")
print(iv_table.round(4).to_string(index=False))

# ----------------------------------------------------------------------
# 3) คัดเลือกตัวแปร
# ----------------------------------------------------------------------
decision = {}                                                  # ตัวแปร -> (ผล, เหตุผล)

# กฎ 1: IV < 0.02
for _, r in iv_table.iterrows():
    if r["IV"] < 0.02:
        decision[r["ตัวแปร"]] = ("ตัด", f"IV = {r['IV']:.4f} < 0.02 แทบไม่มีพลังทำนาย")

# กฎ 2: ไล่จาก IV สูงไปต่ำ ถ้าสหสัมพันธ์ของ WoE กับตัวที่เก็บแล้ว > 0.7 -> ตัด
CORR_LIMIT = 0.7
kept = []
for col in iv_table["ตัวแปร"]:
    if col in decision:
        continue
    corr = {k: abs(np.corrcoef(woe_values[col], woe_values[k])[0, 1]) for k in kept}
    worst = max(corr, key=corr.get) if corr else None
    if worst and corr[worst] > CORR_LIMIT:
        decision[col] = ("ตัด", f"สหสัมพันธ์กับ {worst} = {corr[worst]:.2f} > {CORR_LIMIT} (ซ้ำซ้อน, IV ต่ำกว่า)")
    else:
        kept.append(col)
        decision[col] = ("เก็บ", f"IV = {iv_table.set_index('ตัวแปร').loc[col, 'IV']:.3f} "
                                 f"({strength(iv_table.set_index('ตัวแปร').loc[col, 'IV'])}) และไม่ซ้ำกับตัวอื่น")

result = iv_table.assign(
    ผล=iv_table["ตัวแปร"].map(lambda c: decision[c][0]),
    เหตุผล=iv_table["ตัวแปร"].map(lambda c: decision[c][1]),
)
print("\n=== 2) ผลการคัดเลือกตัวแปร ===")
print(result[["Rank", "ตัวแปร", "IV", "ระดับ", "ผล", "เหตุผล"]].round(4).to_string(index=False))

# ----------------------------------------------------------------------
# 4) ตาราง WoE ของตัวแปรที่เก็บไว้ (ตัวแปร / Bin / WoE)
# ----------------------------------------------------------------------
print("\n=== 3) ตาราง WoE ของตัวแปรที่เก็บไว้ ===")
for col in kept:
    t = woe_tables[col]
    print(f"\n--- {col}  (IV = {t['IV ของ Bin'].sum():.3f}) ---")
    print(t.drop(columns="ตัวแปร").round(3).to_string(index=False))

# ----------------------------------------------------------------------
# 5) สรุป + บันทึก
# ----------------------------------------------------------------------
dropped = [c for c in iv_table["ตัวแปร"] if decision[c][0] == "ตัด"]
print("\n=== สรุป ===")
print(f"* เก็บ {len(kept)} ตัวแปร: {', '.join(kept)}")
print(f"* ตัด {len(dropped)} ตัวแปร: {', '.join(dropped)}")
strong = iv_table[iv_table["IV"] > 0.5]["ตัวแปร"].tolist()
print(f"* IV > 0.5 (แรงมาก): {', '.join(strong)} — ตรวจแล้วไม่ใช่ข้อมูลรั่ว เพราะเป็นประวัติก่อนเดือนที่วัดผล")

out_dir = os.path.dirname(DATA_PATH)
pd.concat(woe_tables.values()).to_csv(os.path.join(out_dir, "woe_table.csv"), index=False)
result.to_csv(os.path.join(out_dir, "iv_selection.csv"), index=False)
print(f"\nบันทึก: woe_table.csv, iv_selection.csv ใน {out_dir}")
