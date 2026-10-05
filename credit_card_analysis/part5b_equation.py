"""
Part 5 (ต่อ) — แสดงสมการ Logistic Regression
รันต่อจาก Part 5 ใน notebook เดียวกัน (ใช้ logit, FEATURES, W_test, X_test จาก cell ก่อนหน้า)

    z = β0 + β1·WoE(x1) + β2·WoE(x2) + ... + βk·WoE(xk)
    P(ผิดนัด) = 1 / (1 + e^(−z))
"""

import numpy as np
import pandas as pd

assert "logit" in globals(), "ยังไม่มีแบบจำลอง — รัน Part 5 ก่อน"

b0 = logit.intercept_[0]                                       # ค่าคงที่ β0
betas = pd.Series(logit.coef_[0], index=FEATURES)              # เบต้าของแต่ละตัวแปร

# ----------------------------------------------------------------------
# 1) สมการแบบข้อความ (บรรทัดละ 1 ตัวแปร อ่านง่าย)
# ----------------------------------------------------------------------
print("=== สมการ Logistic Regression ===\n")
print(f"z = {b0:.4f}")
for f, b in betas.items():
    print(f"    {'+' if b >= 0 else '−'} {abs(b):.4f} × WoE({f})")
print("\nP(ผิดนัด) = 1 / (1 + e^(−z))")

# ----------------------------------------------------------------------
# 2) สมการแบบสูตรคณิตศาสตร์ (แสดงสวย ๆ ใน Colab)
# ----------------------------------------------------------------------
try:
    from IPython import get_ipython
    from IPython.display import Math, display
    if get_ipython() is None:
        raise ImportError
    terms = [f"{'+' if b >= 0 else '-'}\\,{abs(b):.4f}\\,\\text{{WoE}}_{{\\text{{{f.replace('_', ' ')}}}}}"
             for f, b in betas.items()]
    lines = [" ".join(terms[i:i + 3]) for i in range(0, len(terms), 3)]   # 3 ตัวแปรต่อบรรทัด
    display(Math(r"\begin{aligned} z = %.4f\; &%s \end{aligned}" % (b0, r" \\ &".join(lines))))
    display(Math(r"P(\text{default}) = \frac{1}{1 + e^{-z}}"))
except ImportError:
    pass                                                       # รันนอก notebook -> มีแบบข้อความแล้ว

# ----------------------------------------------------------------------
# 3) ตารางเบต้า + Odds ratio
#    e^(−β) = odds ของการผิดนัดเพิ่มกี่เท่า เมื่อ WoE ลดลง 1 หน่วย (WoE ลด = เสี่ยงขึ้น)
# ----------------------------------------------------------------------
table = pd.DataFrame({
    "ตัวแปร": ["ค่าคงที่ (β0)"] + FEATURES,
    "β": [b0] + betas.tolist(),
    "Odds เพิ่ม (เท่า) เมื่อ WoE ลด 1": [np.nan] + np.exp(-betas).tolist(),
})
order = [0] + list(betas.abs().values.argsort()[::-1] + 1)     # ค่าคงที่ก่อน แล้วเรียงตาม |β|
print("\n=== ค่าสัมประสิทธิ์ (เรียงตามขนาด) ===")
print(table.iloc[order].round(4).to_string(index=False))

# ----------------------------------------------------------------------
# 4) ตัวอย่างการแทนค่า: ลูกค้าคนแรกในชุดทดสอบ
# ----------------------------------------------------------------------
i = W_test.index[0]
contrib = W_test.loc[i] * betas                                # β × WoE ของแต่ละตัวแปร
z = b0 + contrib.sum()
p = 1 / (1 + np.exp(-z))

example = pd.DataFrame({
    "ค่าจริง": X_test.loc[i],
    "WoE": W_test.loc[i],
    "β": betas,
    "β × WoE": contrib,
}).reindex(contrib.abs().sort_values(ascending=False).index)
print(f"\n=== ตัวอย่าง: ลูกค้า index {i} (ผลจริง DEFAULT = {y_test.loc[i]}) ===")
print(example.round(4).to_string())
print(f"\nz = {b0:.4f} + ({contrib.sum():.4f}) = {z:.4f}")
print(f"P(ผิดนัด) = 1 / (1 + e^({-z:.4f})) = {p:.4f} = {p:.1%}")
print(f"ตรวจกับ logit.predict_proba = {logit.predict_proba(W_test.loc[[i]])[0, 1]:.4f}")
