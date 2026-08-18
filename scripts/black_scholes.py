"""Black-Scholes pricing for European options."""

import math


def black_scholes(spot_price, strike_price, time_to_maturity, risk_free_rate, volatility, option_type="call"):
    """คำนวณราคาออปชันแบบยุโรปด้วยสูตร Black-Scholes

    Args:
        spot_price: ราคาหุ้นปัจจุบัน (S)
        strike_price: ราคาที่กำหนด (K)
        time_to_maturity: ระยะเวลาถึงวันหมดอายุ หน่วยเป็นปี (T)
        risk_free_rate: อัตราดอกเบี้ยปลอดความเสี่ยง หน่วยทศนิยม เช่น 0.05 = 5% (r)
        volatility: ความผันผวนของหุ้น หน่วยทศนิยม เช่น 0.2 = 20% (sigma)
        option_type: "call" หรือ "put"

    Returns:
        ราคาออปชัน ปัดเป็นทศนิยม 4 ตำแหน่ง
    """
    option_type = option_type.lower()
    if option_type not in ("call", "put"):
        raise ValueError("option_type ต้องเป็น 'call' หรือ 'put'")
    if time_to_maturity <= 0 or volatility <= 0:
        raise ValueError("time_to_maturity และ volatility ต้องมากกว่า 0")

    S, K, T, r, sigma = spot_price, strike_price, time_to_maturity, risk_free_rate, volatility

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    def norm_cdf(x):
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    if option_type == "call":
        price = S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)
    else:
        price = K * math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1)

    return round(price, 4)


if __name__ == "__main__":
    spot_price = 100
    strike_price = 105
    time_to_maturity = 1
    risk_free_rate = 0.05
    volatility = 0.2

    call_price = black_scholes(spot_price, strike_price, time_to_maturity, risk_free_rate, volatility, "call")
    put_price = black_scholes(spot_price, strike_price, time_to_maturity, risk_free_rate, volatility, "put")

    print(f"Call Option Price: {call_price:.4f}")
    print(f"Put Option Price: {put_price:.4f}")
