"""
Part 5 (ต่อ 2) — แปลความหมายสมการ Logistic Regression เป็นภาษาคน
รันต่อจาก Part 5 ใน notebook เดียวกัน (ใช้ logit, FEATURES, woe_maps, edges_map, W_test, X_test, y_test)

แนวคิด
    β อย่างเดียวบอกความสำคัญไม่ครบ เพราะ WoE ของแต่ละตัวแปรแกว่งกว้างไม่เท่ากัน
    จึงวัด "ผลสูงสุด" ของแต่ละตัวแปร = ถ้าลูกค้าย้ายจาก Bin ที่ปลอดภัยที่สุดไป Bin ที่เสี่ยงที่สุด
        z เปลี่ยน = |β| × (WoE สูงสุด − WoE ต่ำสุด)
        odds ผิดนัดเพิ่ม = e^(z ที่เปลี่ยน) เท่า
"""

import numpy as np
import pandas as pd

assert "logit" in globals(), "ยังไม่มีแบบจำลอง — รัน Part 5 ก่อน"

b0 = logit.intercept_[0]
betas = pd.Series(logit.coef_[0], index=FEATURES)

# ----------------------------------------------------------------------
# 1) ทำชื่อ Bin ให้อ่านออก (Part 5 เก็บ Bin เป็นเลข 0, 1, 2, ...)
# ----------------------------------------------------------------------
PAY_NAMES = {"-2": "ไม่ใช้บัตร", "-1": "จ่ายเต็ม", "0": "จ่ายขั้นต่ำ/ไม่ค้าง",
             "1": "ค้าง 1 เดือน", "2": "ค้าง 2 เดือน", "3": "ค้าง 3+ เดือน"}
EDU_NAMES = {"1": "บัณฑิตวิทยาลัย", "2": "มหาวิทยาลัย", "3": "ม.ปลาย", "4": "อื่น ๆ"}
UNIT = {"AVG_UTIL": "%", "PAY_RATIO": "%"}                    # ตัวแปรสัดส่วน -> แสดงเป็น %
# UTIL_TREND มีหน่วยเป็น "จุด% ของวงเงินต่อเดือน" (+ = ใช้เพิ่มขึ้น, − = ใช้ลดลง)


def bin_label(col, b):
    """แปลง Bin เป็นข้อความ เช่น '3' -> 'ค้าง 3+ เดือน', '9' -> '≥ 89%'"""
    if col in PAY_LIKE:
        return PAY_NAMES.get(b, b)
    if col == "EDUCATION":
        return EDU_NAMES.get(b, b)
    edges = edges_map.get(col)
    if edges is None:
        return b
    k, inner = int(b), edges[1:-1]                             # ขอบที่ใช้แบ่ง Bin ตอนฝึก
    if col in UNIT:                                            # สัดส่วน -> %
        fmt = lambda v: f"{v * 100:.0f}%"
    elif col == "UTIL_TREND":                                  # แนวโน้ม -> ทศนิยม 1 ตำแหน่ง
        fmt = lambda v: f"{v:+.1f}"
    else:                                                      # เงิน / อายุ -> จำนวนเต็มมีคั่นหลัก
        fmt = lambda v: f"{v:,.0f}"
    if k == 0:
        return f"< {fmt(inner[0])}"
    if k >= len(inner):
        return f"≥ {fmt(inner[-1])}"
    return f"{fmt(inner[k - 1])} ถึง {fmt(inner[k])}"


# ----------------------------------------------------------------------
# 2) ผลสูงสุดของแต่ละตัวแปร
# ----------------------------------------------------------------------
rows = []
for col, b in betas.items():
    w = woe_maps[col]                                          # WoE ของแต่ละ Bin (จากชุดฝึก)
    z_range = abs(b) * (w.max() - w.min())                     # z เปลี่ยนได้มากสุดเท่าไร
    safe, risky = (w.idxmax(), w.idxmin()) if b < 0 else (w.idxmin(), w.idxmax())
    rows.append({
        "ตัวแปร": col,
        "β": b,
        "กลุ่มปลอดภัยสุด": bin_label(col, safe),
        "กลุ่มเสี่ยงสุด": bin_label(col, risky),
        "z เปลี่ยน": z_range,
        "odds เพิ่ม (เท่า)": np.exp(z_range),
    })
effect = pd.DataFrame(rows).sort_values("z เปลี่ยน", ascending=False).reset_index(drop=True)
effect.insert(0, "อันดับ", range(1, len(effect) + 1))
print("=== 1) ผลของแต่ละตัวแปร: ย้ายจากกลุ่มปลอดภัยสุด -> เสี่ยงสุด ===")
print(effect.round(3).to_string(index=False))

# ----------------------------------------------------------------------
# 3) แปลความเป็นข้อความ
# ----------------------------------------------------------------------
p0 = 1 / (1 + np.exp(-b0))
print("\n=== 2) ความหมายของสมการ ===")
print(f"* ค่าคงที่ β0 = {b0:.4f}: ลูกค้าที่ทุกตัวแปรเท่าค่าเฉลี่ย (WoE = 0) "
      f"มีโอกาสผิดนัด 1/(1+e^{-b0:.4f}) = {p0:.1%} (อัตราเฉลี่ยของข้อมูล = {y_train.mean():.1%})")
print("* β ติดลบ = ถูกทิศ: อยู่กลุ่มเสี่ยง (WoE ติดลบ) -> β × WoE เป็นบวก -> z และโอกาสผิดนัดเพิ่ม")


def level(x):                                                  # จัดระดับผลจากจำนวนเท่าของ odds
    return "มาก" if x >= 2 else "ปานกลาง" if x >= 1.25 else "น้อย" if x >= 1.05 else "แทบไม่มี"


for _, r in effect.iterrows():
    if r["β"] > 0:                                             # ทิศกลับ = ข้อมูลซ้ำกับตัวอื่น
        print(f"* {r['ตัวแปร']}: β = {r['β']:+.4f} เป็นบวก/ใกล้ 0 -> แทบไม่มีผล "
              f"เพราะข้อมูลซ้ำกับตัวแปรอื่นในสมการ ตัดออกได้")
        continue
    print(f"* {r['ตัวแปร']}: ผล{level(r['odds เพิ่ม (เท่า)'])} — ลูกค้ากลุ่ม '{r['กลุ่มเสี่ยงสุด']}' "
          f"มี odds ผิดนัดสูงกว่ากลุ่ม '{r['กลุ่มปลอดภัยสุด']}' {r['odds เพิ่ม (เท่า)']:.2f} เท่า")

# ----------------------------------------------------------------------
# 4) แปลความลูกค้าตัวอย่าง: ตัวแปรไหนดันความเสี่ยงขึ้น / ลง
# ----------------------------------------------------------------------
i = W_test.index[0]
contrib = (W_test.loc[i] * betas).sort_values()                # β × WoE (ลบ = ลดความเสี่ยง)
z = b0 + contrib.sum()
p = 1 / (1 + np.exp(-z))
print(f"\n=== 3) ลูกค้าตัวอย่าง (index {i}) ===")
print(f"z = {b0:.3f} + ({contrib.sum():.3f}) = {z:.3f}  ->  P(ผิดนัด) = {p:.1%} "
      f"({'ต่ำกว่า' if p < p0 else 'สูงกว่า'}ค่าเฉลี่ย {p0:.1%})")
print("ตัวแปรที่ลดความเสี่ยงมากสุด : " +
      ", ".join(f"{c} = {X_test.loc[i, c]:,.4g} ({v:+.3f})" for c, v in contrib.head(3).items()))
up = contrib[contrib > 0].sort_values(ascending=False)
print("ตัวแปรที่เพิ่มความเสี่ยงมากสุด: " +
      (", ".join(f"{c} = {X_test.loc[i, c]:,.4g} ({v:+.3f})" for c, v in up.head(3).items()) or "ไม่มี"))
print(f"ผลจริง: DEFAULT = {y_test.loc[i]}")
