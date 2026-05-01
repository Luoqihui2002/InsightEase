#!/usr/bin/env python3
"""
Generate deterministic manual QA test datasets for InsightEase.

Requirements: Python 3.8+ standard library only.
Usage:
    python manual-test-data/scripts/generate_manual_test_data.py
"""

import csv
import random
import os
from datetime import datetime, timedelta

SEED = 42
random.seed(SEED)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "csv")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def write_csv(filename, headers, rows):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"  Wrote {len(rows)} rows to {filename}")


def random_date(start_str, end_str):
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.strptime(end_str, "%Y-%m-%d")
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))


def generate_01_users():
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆"]
    channels = ["organic_search", "paid_search", "social_ad", "email", "referral", "direct", "app_store"]
    age_groups = ["18-24", "25-34", "35-44", "45-54", "55+"]
    genders = ["M", "F", "U"]
    levels = ["普通会员", "银卡会员", "金卡会员", "铂金会员", "钻石会员"]
    devices = ["iOS", "Android", "Web", "MiniProgram"]

    rows = []
    for i in range(1, 501):
        signup = random_date("2023-01-01", "2025-03-31")
        rows.append([
            f"U{i:05d}",
            signup.strftime("%Y-%m-%d"),
            random.choice(regions),
            random.choice(channels),
            random.choice(age_groups),
            random.choice(genders),
            random.choice(levels),
            random.choice([0, 1]),
            random.choice(devices),
        ])
    write_csv("01_users.csv",
              ["user_id", "signup_date", "region", "channel", "age_group", "gender",
               "membership_level", "is_new_user", "device_type"],
              rows)


def generate_02_products():
    categories = ["electronics", "shoes", "apparel", "beauty", "home", "food", "sports"]
    brands = [
        ("Apple", False), ("Samsung", False), ("Nike", False), ("Adidas", False),
        ("华为", True), ("小米", True), ("李宁", True), ("安踏", True),
        ("L'Oréal", False), ("完美日记", True), ("宜家", False), ("无印良品", False),
        ("海尔", True), ("美的", True), ("Zara", False), ("优衣库", False),
        ("三只松鼠", True), ("良品铺子", True),
    ]
    rows = []
    for i in range(1, 121):
        brand, is_cn = random.choice(brands)
        cat = random.choice(categories)
        price = round(random.uniform(20, 5000), 2)
        cost = round(price * random.uniform(0.3, 0.75), 2)
        launch = random_date("2020-01-01", "2025-02-28")
        rows.append([
            f"P{i:04d}",
            cat,
            brand,
            price,
            cost,
            launch.strftime("%Y-%m-%d"),
            1 if is_cn else 0,
            round(random.uniform(3.0, 5.0), 1),
        ])
    write_csv("02_products.csv",
              ["product_id", "category", "brand", "price", "cost", "launch_date",
               "is_chinese_brand", "rating"],
              rows)


def generate_03_orders(users, products):
    statuses = ["paid", "paid", "paid", "paid", "cancelled", "refunded"]
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆"]
    user_ids = [u[0] for u in users]
    product_ids = [p[0] for p in products]

    rows = []
    for i in range(1, 1501):
        uid = random.choice(user_ids)
        pid = random.choice(product_ids)
        order_dt = random_date("2024-01-01", "2025-03-31")
        qty = random.randint(1, 5)
        # Find product price
        price = next(float(p[3]) for p in products if p[0] == pid)
        amount = round(price * qty, 2)
        discount = round(amount * random.choice([0, 0, 0.05, 0.1, 0.15, 0.2]), 2)
        gmv = round(amount - discount, 2)
        rows.append([
            f"O{i:06d}",
            uid,
            pid,
            order_dt.strftime("%Y-%m-%d"),
            random.choice(regions),
            random.choice(statuses),
            amount,
            discount,
            gmv,
            qty,
            random.choice([0, 1]),
        ])
    write_csv("03_orders.csv",
              ["order_id", "user_id", "product_id", "order_date", "region",
               "payment_status", "order_amount", "discount_amount", "gmv", "quantity",
               "is_first_order"],
              rows)


def generate_04_event_log_path(users):
    events = ["app_open", "home_view", "search", "product_view",
              "add_to_cart", "checkout", "payment_success", "payment_failed", "exit"]
    pages = ["home", "search", "product_detail", "cart", "checkout", "payment", "profile"]
    devices = ["iOS", "Android", "Web", "MiniProgram"]
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆"]
    user_ids = [u[0] for u in users]

    rows = []
    event_id = 1
    target_sessions = 800

    for _ in range(target_sessions):
        uid = random.choice(user_ids)
        session_id = f"S{random.randint(100000, 999999)}"
        base_time = random_date("2024-06-01", "2025-03-31")
        device = random.choice(devices)
        region = random.choice(regions)

        # Funnel depth: some convert, some drop off
        funnel = random.choices(
            ["convert", "drop_cart", "drop_checkout", "bounce"],
            weights=[25, 20, 20, 35]
        )[0]

        if funnel == "bounce":
            seq = ["app_open", random.choice(["home_view", "exit"])]
        elif funnel == "drop_cart":
            seq = ["app_open", "home_view", "search", "product_view", "add_to_cart", "exit"]
        elif funnel == "drop_checkout":
            seq = ["app_open", "home_view", "search", "product_view",
                   "add_to_cart", "checkout", "exit"]
        else:
            seq = ["app_open", "home_view", "search", "product_view",
                   "add_to_cart", "checkout", "payment_success"]

        for idx, ev in enumerate(seq):
            etime = base_time + timedelta(minutes=idx * random.randint(1, 8))
            page = random.choice(pages) if ev not in ["app_open", "exit"] else ""
            is_conv = 1 if ev == "payment_success" else 0
            rows.append([
                f"E{event_id:07d}",
                uid,
                session_id,
                etime.strftime("%Y-%m-%d %H:%M:%S"),
                ev,
                page,
                device,
                region,
                is_conv,
            ])
            event_id += 1

    write_csv("04_event_log_path.csv",
              ["event_id", "user_id", "session_id", "event_time", "event_name",
               "page_name", "device_type", "region", "is_conversion_event"],
              rows)


def generate_05_marketing_touchpoints_attribution(users):
    touchpoints = ["organic_search", "paid_search", "homepage_banner",
                   "push_notification", "email", "social_ad",
                   "product_detail", "coupon_popup"]
    channels = ["Search", "Display", "Email", "Push", "Social", "Onsite"]
    user_ids = [u[0] for u in users]

    rows = []
    journey_id = 1
    for _ in range(600):
        uid = random.choice(user_ids)
        num_tps = random.randint(1, 6)
        converted = random.choices([0, 1], weights=[65, 35])[0]
        conv_value = round(random.uniform(50, 800), 2) if converted else 0
        conv_time = None
        if converted:
            conv_time = random_date("2024-06-01", "2025-03-31")

        selected = random.sample(touchpoints, num_tps)
        base_time = random_date("2024-06-01", "2025-03-31")
        for idx, tp in enumerate(selected):
            tp_time = base_time + timedelta(hours=idx * random.randint(2, 48))
            ct = conv_time.strftime("%Y-%m-%d %H:%M:%S") if converted and idx == num_tps - 1 else ""
            rows.append([
                f"J{journey_id:06d}",
                uid,
                tp,
                tp_time.strftime("%Y-%m-%d %H:%M:%S"),
                random.choice(channels),
                f"CMP{random.randint(100, 999)}",
                converted,
                conv_value if converted else 0,
                ct,
            ])
        journey_id += 1

    write_csv("05_marketing_touchpoints_attribution.csv",
              ["journey_id", "user_id", "touchpoint", "touch_time", "channel",
               "campaign", "converted", "conversion_value", "conversion_time"],
              rows)


def generate_06_daily_sales_forecast():
    start = datetime.strptime("2024-01-01", "%Y-%m-%d")
    rows = []
    base_sales = 12000
    trend = 0
    for i in range(365):
        dt = start + timedelta(days=i)
        weekday = dt.weekday()
        # Weekly seasonality: weekends higher
        season = 1.3 if weekday >= 5 else 1.0
        # Promo spikes ~15% of days
        promo = 1.0
        if random.random() < 0.15:
            promo = random.uniform(1.2, 1.6)
        # Holiday flag: Jan 1, Feb 10-17 (CNY), Oct 1-7
        holiday = 0
        if (dt.month == 1 and dt.day == 1) or \
           (dt.month == 2 and 10 <= dt.day <= 17) or \
           (dt.month == 10 and 1 <= dt.day <= 7):
            holiday = 1
            season *= 1.5

        trend += random.uniform(-30, 40)
        noise = random.uniform(0.92, 1.08)
        sales = int(base_sales + trend + (base_sales * (season - 1) * 0.5) + (base_sales * (promo - 1) * 0.3) * noise)
        orders = int(sales / random.uniform(80, 130))
        traffic = int(orders * random.uniform(12, 20))
        discount = round(random.uniform(0, 0.25) if promo > 1.0 else random.uniform(0, 0.08), 2)

        rows.append([
            dt.strftime("%Y-%m-%d"),
            max(sales, 1000),
            max(orders, 10),
            max(traffic, 100),
            1 if promo > 1.0 else 0,
            holiday,
            round(discount, 2),
        ])
    write_csv("06_daily_sales_forecast.csv",
              ["date", "sales", "orders", "traffic", "promotion_flag", "holiday_flag", "avg_discount"],
              rows)


def generate_07_ab_test_experiment(users):
    groups = ["control", "treatment"]
    devices = ["iOS", "Android", "Web", "MiniProgram"]
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆"]
    user_ids = [u[0] for u in users]
    exp_users = random.sample(user_ids, min(2000, len(user_ids)))

    rows = []
    for i, uid in enumerate(exp_users):
        grp = groups[i % 2]  # deterministic alternation for balance
        conv_base = 0.08 if grp == "control" else 0.12
        converted = 1 if random.random() < conv_base else 0
        revenue = round(random.uniform(0, 300), 2) if converted == 0 else round(random.uniform(50, 900), 2)
        sessions = random.randint(1, 20)
        atc = random.randint(0, 8)
        retention = random.choices([0, 1], weights=[70 if grp == "control" else 55, 30 if grp == "control" else 45])[0]
        rows.append([
            uid,
            f"EXP2025Q1",
            grp,
            random_date("2025-01-01", "2025-02-15").strftime("%Y-%m-%d"),
            converted,
            revenue,
            sessions,
            atc,
            retention,
            random.choice(regions),
            random.choice(devices),
        ])
    write_csv("07_ab_test_experiment.csv",
              ["user_id", "experiment_id", "group", "assigned_date", "converted",
               "revenue", "sessions", "add_to_cart", "retention_d7", "region", "device_type"],
              rows)


def generate_08_customer_ltv_regression(users):
    levels = {"普通会员": 1, "银卡会员": 2, "金卡会员": 3, "铂金会员": 4, "钻石会员": 5}
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆"]
    user_ids = [u[0] for u in users]
    sample_size = min(1000, len(user_ids))
    sampled = random.sample(user_ids, sample_size)
    # Pad to 1000 rows with random picks (with replacement) if needed
    while len(sampled) < 1000:
        sampled.append(random.choice(user_ids))

    rows = []
    for uid in sampled:
        tenure = random.randint(7, 730)
        orders_30d = random.randint(0, 15)
        sessions_30d = random.randint(1, 50)
        aov = round(random.uniform(50, 600), 2)
        coupons = random.randint(0, 8)
        tickets = random.choices([0, 0, 0, 1, 2, 3], weights=[60, 20, 10, 5, 3, 2])[0]
        level = random.choice(list(levels.keys()))
        region = random.choice(regions)
        # LTV influenced by inputs + noise
        ltv = (
            tenure * 0.5
            + orders_30d * 25
            + sessions_30d * 1.2
            + aov * 0.3
            + coupons * 8
            - tickets * 30
            + levels[level] * 40
            + random.uniform(-100, 100)
        )
        ltv = max(round(ltv, 2), 10)
        rows.append([
            uid, tenure, orders_30d, sessions_30d, aov, coupons, tickets, level, region, ltv,
        ])
    write_csv("08_customer_ltv_regression.csv",
              ["user_id", "tenure_days", "orders_30d", "sessions_30d",
               "avg_order_value", "coupon_used_30d", "support_tickets_30d",
               "membership_level", "region", "ltv_90d"],
              rows)


def generate_09_product_reviews_semantic(users, products):
    reviews_en = [
        ("Great product, very satisfied!", "positive", "quality"),
        ("Fast delivery and good packaging.", "positive", "delivery"),
        ("The size is too small, disappointed.", "negative", "size"),
        ("Average quality, nothing special.", "neutral", "quality"),
        ("Customer service was helpful.", "positive", "customer_service"),
        ("Price is a bit high for what you get.", "negative", "price"),
        ("Love the color and design!", "positive", "quality"),
        ("Arrived broken, terrible packaging.", "negative", "packaging"),
        ("Exactly as described, 5 stars.", "positive", "quality"),
        ("Took too long to arrive.", "negative", "delivery"),
    ]
    reviews_zh = [
        ("质量很好，非常满意！", "positive", "quality"),
        ("物流很快，包装完好。", "positive", "delivery"),
        ("尺寸偏小，有点失望。", "negative", "size"),
        ("一般般，没什么特别的。", "neutral", "quality"),
        ("客服态度不错，解决问题很快。", "positive", "customer_service"),
        ("价格有点贵，性价比一般。", "negative", "price"),
        ("颜色和设计都很喜欢！", "positive", "quality"),
        ("收到的时候包装破损了，不好。", "negative", "packaging"),
        ("和描述一致，好评。", "positive", "quality"),
        ("发货太慢了，等了很久。", "negative", "delivery"),
    ]

    all_reviews = reviews_en + reviews_zh
    user_ids = [u[0] for u in users]
    product_ids = [p[0] for p in products]

    rows = []
    for i in range(1, 501):
        text, sentiment, topic = random.choice(all_reviews)
        lang = "zh" if any("\u4e00" <= c <= "\u9fff" for c in text) else "en"
        rows.append([
            f"R{i:05d}",
            random.choice(user_ids),
            random.choice(product_ids),
            random_date("2024-01-01", "2025-03-31").strftime("%Y-%m-%d"),
            random.randint(1, 5),
            text,
            lang,
            sentiment,
            topic,
        ])
    write_csv("09_product_reviews_semantic.csv",
              ["review_id", "user_id", "product_id", "review_date", "rating",
               "review_text", "language", "sentiment_label", "topic"],
              rows)


def generate_10_data_quality_edge_cases():
    rows = []
    categories = ["A", "B", "C", "D", "E"]
    for i in range(1, 301):
        # mostly_null_col: >60% null
        mostly_null = random.choice([random.randint(1, 100), None, None, None])
        # constant_col
        constant = "fixed_value"
        # high_cardinality_id
        high_card = f"ID{random.randint(1000000, 9999999)}"
        # mixed_number_text
        mixed = random.choice([f"{random.randint(1, 999)}", "N/A", "unknown", "null", "-", f"{random.uniform(0, 100):.2f}"])
        # outlier_metric
        outlier = random.choice([random.uniform(10, 100), random.uniform(10, 100), 9999.99])
        # date_with_missing
        date_val = random_date("2024-01-01", "2025-03-31").strftime("%Y-%m-%d") if random.random() > 0.25 else ""
        # category_with_rare_values
        cat = random.choices(categories, weights=[50, 30, 15, 4, 1])[0]
        # boolean_flag
        flag = random.choice([0, 1])
        # duplicate_group
        dup_group = f"GRP{random.randint(1, 20)}"

        rows.append([
            i,
            mostly_null if mostly_null is not None else "",
            constant,
            high_card,
            mixed,
            round(outlier, 2),
            date_val,
            cat,
            flag,
            dup_group,
        ])
    write_csv("10_data_quality_edge_cases.csv",
              ["row_id", "mostly_null_col", "constant_col", "high_cardinality_id",
               "mixed_number_text", "outlier_metric", "date_with_missing",
               "category_with_rare_values", "boolean_flag", "duplicate_group"],
              rows)


def main():
    print("Generating InsightEase manual QA test datasets...")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    generate_01_users()
    generate_02_products()

    # Load back for relational generation
    users_path = os.path.join(OUTPUT_DIR, "01_users.csv")
    products_path = os.path.join(OUTPUT_DIR, "02_products.csv")
    with open(users_path, "r", encoding="utf-8") as f:
        users = list(csv.reader(f))[1:]
    with open(products_path, "r", encoding="utf-8") as f:
        products = list(csv.reader(f))[1:]

    generate_03_orders(users, products)
    generate_04_event_log_path(users)
    generate_05_marketing_touchpoints_attribution(users)
    generate_06_daily_sales_forecast()
    generate_07_ab_test_experiment(users)
    generate_08_customer_ltv_regression(users)
    generate_09_product_reviews_semantic(users, products)
    generate_10_data_quality_edge_cases()

    print()
    print("All datasets generated successfully.")


if __name__ == "__main__":
    main()
