"""
Part 2 — อัตราการผิดนัดชำระหนี้ (Default rate)
รันต่อจาก Part 1 (ใช้ file UCI_Credit_Card_clean.csv)

สิ่งที่สคริปต์นี้ทำ
    1. อัตราผิดนัดชำระโดยรวม
    2. อัตราผิดนัดชำระแยกตามตัวแปร 6 ตัว — สถานะชำระเดือนล่าสุด (PAY_0), วงเงิน, อายุ,
       การศึกษา, เพศ, สถานภาพ — เป็นตาราง + กราฟ
    3. วัดว่าตัวแปรไหนทำนายได้ดีที่สุด ด้วย 2 ตัวชี้วัด
         - ช่วงห่าง = อัตรา default กลุ่มสูงสุด − กลุ่มต่ำสุด (นับเฉพาะกลุ่มที่มี ≥ 100 คน)
         - AUC     = ถ้าใช้ "อัตรา default ของกลุ่มที่ลูกค้าอยู่" เป็นคะแนนทำนาย จะแยกคนผิดนัด
                     ออกจากคนไม่ผิดนัดได้ดีแค่ไหน (0.5 = เดาสุ่ม, 1.0 = แยกได้สมบูรณ์)
"""

import os                                                   # จัดการ path / เดิน folder

import matplotlib.pyplot as plt                             # วาดกราฟ
import pandas as pd                                         # จัดการตารางข้อมูล
from sklearn.metrics import roc_auc_score                   # คำนวณ AUC

# ---------- หา file ข้อมูลที่สะอาดแล้ว ----------
CLEAN_FILE = "UCI_Credit_Card_clean.csv"                    # file ที่ Part 1 บันทึกไว้

if "OUTPUT_PATH" in globals() and os.path.isfile(OUTPUT_PATH):  # ถ้ารัน Part 1 ใน notebook เดียวกันแล้ว
    CLEAN_PATH = OUTPUT_PATH
else:                                                       # ไม่งั้นค้นหา file เอง
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
    assert CLEAN_PATH, f"หา {CLEAN_FILE} ไม่เจอ — รัน Part 1 ก่อน"

df = pd.read_csv(CLEAN_PATH)                                # โหลดข้อมูลที่สะอาดแล้ว
print("ใช้ file:", CLEAN_PATH)

MIN_GROUP = 100                                             # กลุ่มที่เล็กกว่านี้ไม่นับในช่วงห่าง (อัตราแกว่งง่าย)


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
# 1) อัตราผิดนัดชำระโดยรวม
# ----------------------------------------------------------------------
n = len(df)
n_default = int(df["DEFAULT"].sum())
OVERALL = df["DEFAULT"].mean()                              # อัตราโดยรวม (ใช้เป็นเส้นอ้างอิงในกราฟ)
show("1) อัตราผิดนัดชำระโดยรวม", pd.DataFrame([
    ("ลูกค้าทั้งหมด", f"{n:,}"),
    ("ผิดนัดชำระ", f"{n_default:,}"),
    ("อัตราผิดนัดชำระโดยรวม", f"{OVERALL:.1%}"),
], columns=["รายการ", "ค่า"]))

# ----------------------------------------------------------------------
# 2) จัดกลุ่มแต่ละตัวแปร
#    แต่ละตัวแปรได้คอลัมน์ "กลุ่ม" ที่เรียงลำดับแล้ว (ป้ายเป็นภาษาอังกฤษเพื่อให้กราฟแสดงได้ใน Colab
#    ซึ่งไม่มี font ไทยติดมา)
# ----------------------------------------------------------------------
def pay_group(code):                                        # สถานะชำระ ก.ย. -> กลุ่ม
    if code <= 0:
        return {-2: "No use (-2)", -1: "Paid full (-1)", 0: "Min. paid (0)"}[code]
    return "Late 1 mo" if code == 1 else "Late 2 mo" if code == 2 else "Late 3+ mo"


limit_bins = [0, 50_000, 100_000, 200_000, 300_000, 500_000, 1_000_000]
age_bins = [20, 25, 30, 35, 40, 50, 60, 80]

GROUPS = {  # ชื่อตัวแปร -> (คำอธิบายไทย, ชื่อกราฟ, Series กลุ่มแบบเรียงลำดับ)
    "PAY_0": ("สถานะชำระเดือน ก.ย. (เดือนล่าสุด)", "Repayment status, Sep",
              pd.Categorical(df["PAY_0"].map(pay_group),
                             ["No use (-2)", "Paid full (-1)", "Min. paid (0)",
                              "Late 1 mo", "Late 2 mo", "Late 3+ mo"], ordered=True)),
    "LIMIT_BAL": ("วงเงินบัตร (NT$)", "Credit limit (NT$ thousand)",
                  pd.cut(df["LIMIT_BAL"], limit_bins,
                         labels=["≤50", "50–100", "100–200", "200–300", "300–500", ">500"])),
    "AGE": ("อายุ (ปี)", "Age (years)",
            pd.cut(df["AGE"], age_bins, labels=["21–25", "26–30", "31–35", "36–40", "41–50", "51–60", "61+"])),
    "EDUCATION": ("การศึกษา", "Education",
                  pd.Categorical(df["EDUCATION"].map({1: "Grad school", 2: "University", 3: "High school", 4: "Other"}),
                                 ["Grad school", "University", "High school", "Other"], ordered=True)),
    "SEX": ("เพศ", "Sex",
            pd.Categorical(df["SEX"].map({1: "Male", 2: "Female"}), ["Male", "Female"], ordered=True)),
    "MARRIAGE": ("สถานภาพสมรส", "Marital status",
                 pd.Categorical(df["MARRIAGE"].map({1: "Married", 2: "Single", 3: "Other"}),
                                ["Married", "Single", "Other"], ordered=True)),
}

# ----------------------------------------------------------------------
# 3) อัตราผิดนัดชำระแยกตามกลุ่ม + ตัวชี้วัดความสามารถในการทำนาย
# ----------------------------------------------------------------------
rate_tables = {}                                            # เก็บตารางของแต่ละตัวแปรไว้วาดกราฟ
power_rows = []                                             # เก็บตัวชี้วัดของแต่ละตัวแปร
for var, (thai, _, groups) in GROUPS.items():
    g = df.groupby(groups, observed=True)["DEFAULT"].agg(["count", "mean"])  # จำนวน + อัตรา ต่อกลุ่ม
    t = pd.DataFrame({
        "กลุ่ม": g.index.astype(str),
        "จำนวนคน": g["count"].values,
        "อัตรา default (%)": g["mean"].values * 100,
        "เทียบค่าเฉลี่ย (จุด %)": (g["mean"].values - OVERALL) * 100,  # + = เสี่ยงกว่าค่าเฉลี่ย
    })
    rate_tables[var] = t
    show(f"2) อัตราผิดนัดชำระตาม{thai}  [{var}]", t)

    big = g[g["count"] >= MIN_GROUP]["mean"]                 # เฉพาะกลุ่มที่ใหญ่พอ
    score = pd.Series(groups, index=df.index).map(g["mean"]).astype(float)  # คะแนน = อัตรา default ของกลุ่ม
    power_rows.append({
        "ตัวแปร": var,
        "ความหมาย": thai,
        "กลุ่มเสี่ยงสุด": big.idxmax(),
        "อัตราสูงสุด (%)": big.max() * 100,
        "กลุ่มเสี่ยงต่ำสุด": big.idxmin(),
        "อัตราต่ำสุด (%)": big.min() * 100,
        "ช่วงห่าง (จุด %)": (big.max() - big.min()) * 100,
        "AUC": roc_auc_score(df["DEFAULT"], score),
    })

power = pd.DataFrame(power_rows).sort_values("AUC", ascending=False).reset_index(drop=True)
power.insert(0, "อันดับ", range(1, len(power) + 1))
show("3) ตัวแปรไหนทำนายการผิดนัดได้ดีที่สุด (เรียงตาม AUC)",
     power.assign(AUC=power["AUC"].map("{:.3f}".format)))     # AUC แสดง 3 ตำแหน่ง (ค่าใกล้กันมาก)

best = power.iloc[0]
print(f"\n→ ตัวแปรที่ทำนายได้ดีที่สุด: {best['ตัวแปร']} ({best['ความหมาย']})")
print(f"  อัตรา default ตั้งแต่ {best['อัตราต่ำสุด (%)']:.1f}% ({best['กลุ่มเสี่ยงต่ำสุด']}) "
      f"ถึง {best['อัตราสูงสุด (%)']:.1f}% ({best['กลุ่มเสี่ยงสุด']}), AUC = {best['AUC']:.3f}")
print(f"  อันดับ 2: {power.iloc[1]['ตัวแปร']} AUC = {power.iloc[1]['AUC']:.3f}")

# ----------------------------------------------------------------------
# 4) กราฟ
# ----------------------------------------------------------------------
BAR = "#2a78d6"                                             # สีแท่ง (สีเดียว เพราะทุกกราฟมีชุดข้อมูลเดียว)
INK, INK_2, GRID = "#0b0b0b", "#52514e", "#e4e3df"          # สีตัวอักษร / ตัวอักษรรอง / เส้นอ้างอิง
plt.rcParams.update({"font.size": 10, "axes.edgecolor": GRID, "axes.labelcolor": INK_2,
                     "xtick.color": INK_2, "ytick.color": INK_2, "figure.facecolor": "#fcfcfb",
                     "axes.facecolor": "#fcfcfb"})

# 4.1 อัตรา default ของแต่ละตัวแปร — small multiples 2 x 3, แกน y เดียวกันทุกช่องเพื่อเทียบกันได้
fig, axes = plt.subplots(2, 3, figsize=(15, 8.5), sharey=True)
order = list(power["ตัวแปร"])                                # เรียงช่องตามอันดับความสามารถทำนาย
for ax, var in zip(axes.flat, order):
    t = rate_tables[var]
    bars = ax.bar(t["กลุ่ม"], t["อัตรา default (%)"], color=BAR, width=0.6)
    ax.axhline(OVERALL * 100, color=INK_2, linestyle="--", linewidth=1)  # เส้นค่าเฉลี่ยรวม
    for b, v in zip(bars, t["อัตรา default (%)"]):           # ใส่ตัวเลขบนแท่ง
        ax.text(b.get_x() + b.get_width() / 2, v + 1.2, f"{v:.0f}%", ha="center", fontsize=8.5, color=INK)
    auc = power.set_index("ตัวแปร").loc[var, "AUC"]
    ax.set_title(f"{GROUPS[var][1]}   (AUC {auc:.2f})", color=INK, fontsize=11, loc="left")
    ax.tick_params(axis="x", labelrotation=30)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_ylim(0, 85)
for ax in axes[:, 0]:
    ax.set_ylabel("Default rate (%)")
axes[0, 0].text(-0.4, OVERALL * 100 + 1.5, f"overall {OVERALL:.1%}", ha="left", fontsize=8.5, color=INK_2)
fig.suptitle("Default rate by variable (dashed line = overall rate)", x=0.01, ha="left",
             fontsize=13, color=INK)
fig.tight_layout()
plt.show()

# 4.2 จัดอันดับตัวแปรตาม AUC
fig, ax = plt.subplots(figsize=(8, 3.6))
p = power.iloc[::-1]                                        # กลับลำดับให้อันดับ 1 อยู่บนสุด
ax.barh([GROUPS[v][1] for v in p["ตัวแปร"]], p["AUC"], color=BAR, height=0.55)
ax.axvline(0.5, color=INK_2, linestyle="--", linewidth=1)   # 0.5 = เดาสุ่ม
ax.text(0.503, len(p) - 0.45, "0.5 = random guess", fontsize=8.5, color=INK_2)
for y, v in enumerate(p["AUC"]):
    ax.text(v + 0.003, y, f"{v:.3f}", va="center", fontsize=9, color=INK)
ax.set_xlim(0.45, 0.75)
ax.set_ylim(-0.6, len(p) + 0.1)                              # เว้นที่ด้านบนให้ป้าย 0.5
ax.set_xlabel("AUC (higher = better at separating defaulters)")
ax.set_title("Which variable predicts default best?", loc="left", color=INK, fontsize=12)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
fig.tight_layout()
plt.show()
