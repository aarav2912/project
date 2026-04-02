from matplotlib import pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib import patheffects


TABLES = {
    "users": ["PK user_id", "username", "email", "role"],
    "categories": ["PK category_id", "category_name", "FK parent_category_id"],
    "items": ["PK item_id", "FK seller_user_id", "FK category_id", "title", "status"],
    "item_images": ["PK image_id", "FK item_id", "image_url"],
    "cart": ["PK cart_id", "FK user_id", "FK item_id", "quantity"],
    "orders": ["PK order_id", "FK user_id", "FK item_id", "status"],
    "alerts": ["PK alert_id", "FK user_id", "FK category_id", "FK item_id"],
    "reviews": ["PK review_id", "FK user_id", "FK item_id", "rating"],
    "grievances": ["PK grievance_id", "FK user_id", "FK order_id", "FK item_id", "FK replied_by", "problem_status"],
    "grievance_images": ["PK grievance_image_id", "FK grievance_id", "image_url"],
    "payments": ["PK payment_id", "FK order_id", "payment_status"],
    "user_interests": ["PK interest_id", "FK user_id", "FK category_id", "min_price", "max_price"],
    "password_resets": ["PK reset_id", "FK user_id", "expires_at"],
}


TABLE_STYLE = {
    "users": ("#2b6cb0", "#12243f", "Core"),
    "categories": ("#2f855a", "#132f22", "Core"),
    "items": ("#805ad5", "#24163f", "Core"),
    "orders": ("#d69e2e", "#3b2b12", "Commerce"),
    "item_images": ("#3182ce", "#13263d", "Commerce"),
    "cart": ("#38a169", "#13311d", "Commerce"),
    "reviews": ("#dd6b20", "#3d2212", "Commerce"),
    "alerts": ("#319795", "#113235", "Commerce"),
    "grievances": ("#b83280", "#32162a", "Support"),
    "grievance_images": ("#d53f8c", "#351623", "Support"),
    "payments": ("#718096", "#1d2430", "Support"),
    "user_interests": ("#6b46c1", "#23153c", "Support"),
    "password_resets": ("#4a5568", "#1b2230", "Support"),
}


POSITIONS = {
    "users": (0.03, 0.75),
    "categories": (0.27, 0.75),
    "items": (0.51, 0.75),
    "orders": (0.76, 0.75),
    "item_images": (0.03, 0.43),
    "cart": (0.22, 0.43),
    "reviews": (0.41, 0.43),
    "alerts": (0.60, 0.43),
    "grievances": (0.78, 0.43),
    "grievance_images": (0.03, 0.10),
    "payments": (0.22, 0.10),
    "user_interests": (0.43, 0.10),
    "password_resets": (0.66, 0.10),
}


RELATIONSHIPS = [
    ("categories", "categories", "1", "N", "parent_category_id"),
    ("users", "items", "1", "N", "seller_user_id"),
    ("categories", "items", "1", "N", "category_id"),
    ("items", "item_images", "1", "N", "item_id"),
    ("users", "cart", "1", "N", "user_id"),
    ("items", "cart", "1", "N", "item_id"),
    ("users", "orders", "1", "N", "user_id"),
    ("items", "orders", "1", "N", "item_id"),
    ("orders", "payments", "1", "N", "order_id"),
    ("users", "alerts", "1", "N", "user_id"),
    ("categories", "alerts", "1", "N", "category_id"),
    ("items", "alerts", "1", "N", "item_id"),
    ("users", "reviews", "1", "N", "user_id"),
    ("items", "reviews", "1", "N", "item_id"),
    ("users", "grievances", "1", "N", "user_id"),
    ("orders", "grievances", "1", "N", "order_id"),
    ("items", "grievances", "1", "N", "item_id"),
    ("users", "grievances", "1", "N", "replied_by"),
    ("grievances", "grievance_images", "1", "N", "grievance_id"),
    ("users", "user_interests", "1", "N", "user_id"),
    ("categories", "user_interests", "1", "N", "category_id"),
    ("users", "password_resets", "1", "N", "user_id"),
]


MANY_TO_MANY_NOTES = [
    "cart resolves Users <-> Items as a shopping bridge table.",
    "reviews resolves Users <-> Items as a feedback bridge table.",
    "user_interests resolves Users <-> Categories as a preference bridge table.",
]


def table_geometry(fields):
    width = 0.18
    height = 0.06 + 0.031 * len(fields)
    return width, height


def draw_table(ax, name, fields, xy):
    x, y = xy
    fill, header_fill, group = TABLE_STYLE[name]
    width, height = table_geometry(fields)
    header_h = 0.043

    shadow = FancyBboxPatch(
        (x + 0.005, y - 0.005),
        width,
        height,
        boxstyle="round,pad=0.012,rounding_size=0.012",
        linewidth=0,
        facecolor="#000000",
        alpha=0.18,
        zorder=1,
    )
    ax.add_patch(shadow)

    outer = FancyBboxPatch(
        (x, y),
        width,
        height,
        boxstyle="round,pad=0.012,rounding_size=0.012",
        linewidth=1.25,
        edgecolor=fill,
        facecolor="#0f1728",
        zorder=2,
    )
    ax.add_patch(outer)

    header = FancyBboxPatch(
        (x, y + height - header_h),
        width,
        header_h,
        boxstyle="round,pad=0.012,rounding_size=0.012",
        linewidth=0,
        facecolor=header_fill,
        zorder=3,
    )
    ax.add_patch(header)

    ax.text(
        x + width / 2,
        y + height - header_h / 2,
        name.upper(),
        ha="center",
        va="center",
        fontsize=10,
        fontweight="bold",
        color="#f5f7ff",
        zorder=4,
    )

    group_tag = FancyBboxPatch(
        (x + width - 0.058, y + 0.008),
        0.05,
        0.022,
        boxstyle="round,pad=0.01,rounding_size=0.008",
        linewidth=0,
        facecolor=fill,
        alpha=0.9,
        zorder=4,
    )
    ax.add_patch(group_tag)
    ax.text(
        x + width - 0.033,
        y + 0.019,
        group,
        ha="center",
        va="center",
        fontsize=5.7,
        color="#f7f9ff",
        fontweight="bold",
        zorder=5,
    )

    start_y = y + height - header_h - 0.015
    for i, field in enumerate(fields):
        color = "#f6d365" if field.startswith("PK") else "#d9e4ff" if field.startswith("FK") else "#d7dfef"
        ax.text(
            x + 0.012,
            start_y - i * 0.025,
            field,
            ha="left",
            va="top",
            fontsize=7.8,
            color=color,
            family="DejaVu Sans Mono",
            zorder=4,
        )

    center = (x + width / 2, y + height / 2)
    return {
        "top": (x + width / 2, y + height),
        "bottom": (x + width / 2, y),
        "left": (x, y + height / 2),
        "right": (x + width, y + height / 2),
        "center": center,
        "width": width,
        "height": height,
        "fill": fill,
    }


def pick_anchor(src, dst):
    sx, sy = src["center"]
    dx, dy = dst["center"]
    if abs(dx - sx) >= abs(dy - sy):
        return ("right" if dx >= sx else "left", "left" if dx >= sx else "right")
    return ("top" if dy >= sy else "bottom", "bottom" if dy >= sy else "top")


def draw_relationship(ax, src_name, dst_name, left_card, right_card, label):
    src = anchors[src_name]
    dst = anchors[dst_name]
    src_side, dst_side = pick_anchor(src, dst)
    sx, sy = src[src_side]
    dx, dy = dst[dst_side]

    # Slight curvature reduces overlap when a source fans out to several tables.
    dx_offset = 0.0
    if src_name == "users" and dst_name in {"items", "cart", "orders", "reviews", "grievances", "password_resets"}:
        dx_offset = 0.04
    elif src_name == "items" and dst_name in {"cart", "orders", "alerts", "reviews", "grievances"}:
        dx_offset = -0.02
    elif src_name == "categories" and dst_name in {"items", "alerts", "user_interests", "categories"}:
        dx_offset = 0.02

    line = FancyArrowPatch(
        (sx, sy),
        (dx, dy),
        arrowstyle="-|>",
        mutation_scale=11,
        linewidth=1.15,
        color="#9fb4d8",
        connectionstyle=f"arc3,rad={0.12 if sx < dx else -0.12}",
        zorder=1,
    )
    ax.add_patch(line)

    mx = (sx + dx) / 2 + dx_offset
    my = (sy + dy) / 2

    badge = FancyBboxPatch(
        (mx - 0.018, my - 0.011),
        0.036,
        0.022,
        boxstyle="round,pad=0.008,rounding_size=0.008",
        linewidth=0,
        facecolor="#16243f",
        alpha=0.95,
        zorder=2,
    )
    ax.add_patch(badge)
    ax.text(mx, my + 0.002, f"{left_card}:{right_card}", fontsize=7.0, color="#bfe3ff", ha="center", va="center", zorder=3)
    ax.text(mx, my - 0.014, label, fontsize=6.1, color="#dbe4f0", ha="center", va="center", zorder=3)


fig, ax = plt.subplots(figsize=(28, 18))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")
fig.patch.set_facecolor("#08111f")
ax.set_facecolor("#08111f")

bg = FancyBboxPatch(
    (0.01, 0.01),
    0.98,
    0.98,
    boxstyle="round,pad=0.015,rounding_size=0.02",
    linewidth=1.2,
    edgecolor="#1f2c46",
    facecolor="#0b1426",
    zorder=0,
)
ax.add_patch(bg)

ax.text(0.5, 0.976, "Marketplace ER Diagram", ha="center", va="top", fontsize=22, fontweight="bold", color="#f6f8ff")
ax.text(0.5, 0.949, "Primary keys, foreign keys, and 1:N / M:N relationships", ha="center", va="top", fontsize=11.5, color="#96a8ca")

anchors = {}
for table_name, fields in TABLES.items():
    anchors[table_name] = draw_table(ax, table_name, fields, POSITIONS[table_name])

for rel in RELATIONSHIPS:
    draw_relationship(ax, *rel)

legend_x = 0.03
ax.text(legend_x, 0.04, "Legend", fontsize=11, color="#f6d365", fontweight="bold", ha="left", va="bottom")
legend_items = [
    ("Core", "#2b6cb0"),
    ("Commerce", "#38a169"),
    ("Support", "#b83280"),
]
for i, (label, color) in enumerate(legend_items):
    y = 0.022 - i * 0.017
    ax.add_patch(FancyBboxPatch((legend_x, y), 0.012, 0.012, boxstyle="round,pad=0.003,rounding_size=0.003", linewidth=0, facecolor=color, zorder=4))
    ax.text(legend_x + 0.018, y + 0.006, label, fontsize=8.5, color="#dce5f8", ha="left", va="center")

for i, note in enumerate(MANY_TO_MANY_NOTES):
    ax.text(0.34, 0.04 - i * 0.017, f"- {note}", fontsize=8.2, color="#dce5f8", ha="left", va="bottom")

note_box = FancyBboxPatch(
    (0.71, 0.012),
    0.26,
    0.06,
    boxstyle="round,pad=0.012,rounding_size=0.012",
    linewidth=0.9,
    edgecolor="#24324d",
    facecolor="#101a2d",
    zorder=1,
)
ax.add_patch(note_box)
ax.text(0.84, 0.053, "Tip: associative tables are shown as bridges, not duplicated relations.", ha="center", va="center", fontsize=7.8, color="#b6c7e6")
ax.text(0.84, 0.029, "The diagram is grouped to keep the relationship lines readable.", ha="center", va="center", fontsize=7.8, color="#b6c7e6")

plt.savefig("marketplace_er_diagram.pdf", format="pdf", bbox_inches="tight", facecolor=fig.get_facecolor())
print("Saved marketplace_er_diagram.pdf")
