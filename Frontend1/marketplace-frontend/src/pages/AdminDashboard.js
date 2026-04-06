import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-IN");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function buildSparkline(points, width, height, padding = 14) {
  if (!points.length) {
    return { line: "", area: "", dots: [], max: 1 };
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;

  const dots = points.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((point.value - min) / Math.max(max - min, 1)) * usableHeight;
    return {
      ...point,
      x,
      y,
    };
  });

  const line = dots
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const area = `${line} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return { line, area, dots, max };
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState("profit");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    let mounted = true;

    axios
      .get(`${API_BASE_URL}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (mounted) {
          setStats(res.data || null);
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const monthly = useMemo(() => stats?.monthly || [], [stats]);
  const popularItems = useMemo(() => stats?.popular_items || [], [stats]);
  const categorySales = useMemo(() => stats?.category_sales || [], [stats]);
  const summary = stats?.summary || {};

  const chartMaxOrders = useMemo(() => {
    if (!monthly.length) {
      return 1;
    }

    return Math.max(...monthly.map((month) => month.order_count || 0), 1);
  }, [monthly]);

  const topItemMax = useMemo(() => {
    if (!popularItems.length) {
      return 1;
    }

    return Math.max(...popularItems.map((item) => item.order_count || 0), 1);
  }, [popularItems]);

  const categoryChart = useMemo(() => {
    const categories = categorySales.slice(0, 6);
    const total = Math.max(
      categories.reduce((sum, category) => sum + Number(category.order_count || 0), 0),
      1
    );
    const gapDegrees = categories.length > 1 ? 4 : 0;
    const usableSweep = 360 - gapDegrees * categories.length;
    const palette = [
      "#8b5cf6",
      "#22d3ee",
      "#fb7185",
      "#f97316",
      "#60a5fa",
      "#34d399",
    ];

    let running = 0;

    return categories.map((category, index) => {
      const value = Number(category.order_count || 0);
      const revenue = Number(category.revenue || 0);
      const percent = Math.round((value / total) * 100);
      const startAngle = -90 + (running / total) * usableSweep + index * gapDegrees;
      const sweepAngle = (value / total) * usableSweep;
      const endAngle = startAngle + sweepAngle;
      const midAngle = startAngle + sweepAngle / 2;
      const path = describeArc(118, 118, 72, startAngle, endAngle);
      const labelPoint = polarToCartesian(118, 118, 98, midAngle);
      running += value;

      return {
        category_id: category.category_id,
        category_name: category.category_name,
        order_count: value,
        revenue,
        percent,
        total,
        startAngle,
        endAngle,
        midAngle,
        path,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        color: palette[index % palette.length],
      };
    });
  }, [categorySales]);

  const activeCategory = hoveredCategory
    ? categoryChart.find((category) => category.category_id === hoveredCategory) || categoryChart[0] || null
    : categoryChart[0] || null;

  const revenueSplit = useMemo(() => {
    const revenue = Number(summary.total_revenue || 0);
    const loss = Number(summary.estimated_loss || 0);
    const profit = Math.max(revenue - loss, 0);
    const total = Math.max(profit + loss, 1);

    const segments = [
      {
        key: "profit",
        label: "Net profit",
        value: profit,
        color: "url(#profitGrad)",
        fallback: "var(--success)",
        description: "Revenue remaining after shipping and payment fees.",
      },
      {
        key: "loss",
        label: "Estimated loss",
        value: loss,
        color: "url(#lossGrad)",
        fallback: "var(--danger)",
        description: "Shipping plus payment platform fees.",
      },
    ];

    let runningOffset = 0;

    return segments.map((segment) => {
      const startAngle = (runningOffset / total) * 360;
      const sweepAngle = (segment.value / total) * 360;
      const endAngle = startAngle + sweepAngle;
      const midAngle = startAngle + sweepAngle / 2;
      const labelPoint = polarToCartesian(110, 110, 86, midAngle);
      const percent = Math.round((segment.value / total) * 100);
      const circumference = 2 * Math.PI * 70;
      const segmentLength = (segment.value / total) * circumference;
      const dashOffset = circumference - segmentLength - (runningOffset / total) * circumference;

      runningOffset += segment.value;

      return {
        ...segment,
        total,
        percent,
        startAngle,
        endAngle,
        midAngle,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        circumference,
        segmentLength,
        dashOffset,
      };
    });
  }, [summary.total_revenue, summary.estimated_loss]);

  const monthlyRevenueSeries = useMemo(
    () => monthly.map((month) => ({ label: month.month, value: Number(month.revenue || 0) })),
    [monthly]
  );

  const sparkline = useMemo(() => buildSparkline(monthlyRevenueSeries, 420, 160), [monthlyRevenueSeries]);

  const activeSegment =
    revenueSplit.find((segment) => segment.key === hoveredSegment) || revenueSplit[0] || null;

  const statCards = [
    {
      label: "Orders placed",
      value: compact.format(summary.total_orders || 0),
      meta: "All website orders",
    },
    {
      label: "Revenue",
      value: currency.format(summary.total_revenue || 0),
      meta: "Gross order value",
    },
    {
      label: "Estimated loss",
      value: currency.format(summary.estimated_loss || 0),
      meta: "Shipping + payment fees",
    },
    {
      label: "Net profit",
      value: currency.format(summary.net_profit || 0),
      meta: "Revenue minus estimated loss",
    },
    {
      label: "Items listed",
      value: compact.format(summary.total_items || 0),
      meta: `${summary.available_items || 0} available, ${summary.sold_items || 0} sold`,
    },
  ];

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Admin intelligence</div>
        <h1 className="hero-title" style={{ fontSize: "2.35rem" }}>
          Marketplace dashboard
        </h1>
        <p className="hero-copy">
          Track orders, revenue, estimated loss, and the products driving the business. These insights are shown only to admins.
        </p>
      </motion.section>

      {loading ? (
        <div className="surface-panel empty-state" style={{ marginTop: "1rem" }}>
          Loading admin insights...
        </div>
      ) : (
        <>
          <div className="admin-analytics__grid" style={{ marginTop: "1rem" }}>
            {statCards.map((card) => (
              <div key={card.label} className="surface-panel admin-metric">
                <div className="admin-metric__label">{card.label}</div>
                <div className="admin-metric__value">{card.value}</div>
                <div className="admin-metric__meta">{card.meta}</div>
              </div>
            ))}
          </div>

          <div className="surface-panel admin-panel admin-panel--highlight" style={{ marginTop: "1rem" }}>
            <div className="toolbar-row" style={{ marginTop: 0 }}>
              <div>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Revenue pulse
                </h2>
                <p className="section-subtitle">
                  An animated view of gross revenue split into estimated profit and estimated loss.
                </p>
              </div>
              <div className="muted">Hover the ring or legend for details</div>
            </div>

            <div className="admin-revenue-grid">
              {summary.total_revenue > 0 ? (
                <div className="admin-donut-card">
                  <div className="admin-donut">
                    <svg viewBox="0 0 220 220" className="admin-donut__svg" aria-label="Revenue split chart" role="img">
                      <defs>
                        <linearGradient id="profitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--success)" />
                          <stop offset="100%" stopColor="var(--secondary)" />
                        </linearGradient>
                        <linearGradient id="lossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--danger)" />
                          <stop offset="100%" stopColor="var(--accent)" />
                        </linearGradient>
                      </defs>

                      <circle cx="110" cy="110" r="70" className="admin-donut__track" />

                      {revenueSplit.map((segment, index) => (
                        <motion.circle
                          key={segment.key}
                          cx="110"
                          cy="110"
                          r="70"
                          className={`admin-donut__segment admin-donut__segment--${segment.key}`}
                          stroke={segment.color}
                          initial={{ strokeDashoffset: segment.circumference }}
                          animate={{ strokeDashoffset: segment.dashOffset }}
                          transition={{ duration: 1.15, ease: "easeOut", delay: index * 0.14 }}
                          strokeDasharray={`${segment.segmentLength} ${segment.circumference - segment.segmentLength}`}
                          strokeLinecap="round"
                          transform="rotate(-90 110 110)"
                          onMouseEnter={() => setHoveredSegment(segment.key)}
                          onFocus={() => setHoveredSegment(segment.key)}
                          onMouseLeave={() => setHoveredSegment("profit")}
                          tabIndex={0}
                        />
                      ))}
                    </svg>

                    <div className="admin-donut__center">
                      <div className="admin-donut__label">Gross revenue</div>
                      <div className="admin-donut__value">{currency.format(summary.total_revenue || 0)}</div>
                      <div className="admin-donut__sub">{compact.format(summary.total_orders || 0)} orders</div>
                    </div>

                    {revenueSplit.map((segment) => (
                      <div
                        key={`${segment.key}-label`}
                        className={`admin-donut__ring-label admin-donut__ring-label--${segment.key} ${
                          hoveredSegment === segment.key ? "is-active" : ""
                        }`}
                        style={{
                          left: `${segment.labelX}px`,
                          top: `${segment.labelY}px`,
                        }}
                        onMouseEnter={() => setHoveredSegment(segment.key)}
                        onMouseLeave={() => setHoveredSegment("profit")}
                      >
                        {segment.percent}%
                      </div>
                    ))}

                    {activeSegment && (
                      <motion.div
                        className="admin-donut__tooltip"
                        key={activeSegment.key}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="admin-donut__tooltip-label">{activeSegment.label}</div>
                        <div className="admin-donut__tooltip-value">
                          {currency.format(activeSegment.value)} ({activeSegment.percent}%)
                        </div>
                        <div className="admin-donut__tooltip-copy">{activeSegment.description}</div>
                      </motion.div>
                    )}
                  </div>

                  <div className="admin-donut__legend">
                    {revenueSplit.map((segment) => (
                      <button
                        key={segment.key}
                        type="button"
                        className={`admin-donut__legend-row ${hoveredSegment === segment.key ? "is-active" : ""}`}
                        onMouseEnter={() => setHoveredSegment(segment.key)}
                        onFocus={() => setHoveredSegment(segment.key)}
                        onMouseLeave={() => setHoveredSegment("profit")}
                      >
                        <span className="admin-donut__dot" style={{ background: segment.fallback }} />
                        <span>{segment.label}</span>
                        <strong>{segment.percent}%</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">No revenue yet.</div>
              )}

              <div className="admin-trend-card">
                <div className="admin-trend-card__head">
                  <div>
                    <h3 className="panel-title" style={{ marginBottom: 0 }}>
                      Revenue trend
                    </h3>
                    <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                      Monthly revenue from the database, drawn as a subtle sparkline.
                    </p>
                  </div>
                  <div className="admin-trend-card__max">Max {currency.format(sparkline.max)}</div>
                </div>

                {monthlyRevenueSeries.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: "180px" }}>
                    No trend data yet.
                  </div>
                ) : (
                  <svg viewBox="0 0 420 160" className="admin-sparkline" aria-label="Revenue trend chart" role="img">
                    <defs>
                      <linearGradient id="sparkFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(34,211,238,0.32)" />
                        <stop offset="100%" stopColor="rgba(139,92,246,0.03)" />
                      </linearGradient>
                      <linearGradient id="sparkStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--secondary)" />
                        <stop offset="100%" stopColor="var(--primary)" />
                      </linearGradient>
                    </defs>

                    <path d={sparkline.area} className="admin-sparkline__area" />
                    <motion.path
                      d={sparkline.line}
                      className="admin-sparkline__line"
                      stroke="url(#sparkStroke)"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.25, ease: "easeOut" }}
                    />

                    {sparkline.dots.map((point, index) => (
                      <motion.g
                        key={point.label}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + index * 0.08 }}
                      >
                        <circle cx={point.x} cy={point.y} r="4.5" className="admin-sparkline__dot" />
                        <text x={point.x} y="146" className="admin-sparkline__label">
                          {point.label}
                        </text>
                      </motion.g>
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="surface-panel admin-panel" style={{ marginTop: "1rem" }}>
            <div className="toolbar-row" style={{ marginTop: 0 }}>
              <div>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Monthly order volume
                </h2>
                <p className="section-subtitle">
                  Bar heights are based on actual order counts from the database. Revenue and loss are shown below each month.
                </p>
              </div>
              <div className="muted">Latest 6 months</div>
            </div>

            {monthly.length === 0 ? (
              <div className="empty-state">No order data yet.</div>
            ) : (
              <div className="admin-chart">
                {monthly.map((month) => {
                  const orderRatio = (month.order_count || 0) / chartMaxOrders;
                  const barHeight = clamp(56 + orderRatio * 170, 56, 226);

                  return (
                    <div key={month.month} className="admin-chart__month">
                      <div className="admin-chart__stage">
                        <div className="admin-chart__count">{compact.format(month.order_count || 0)} orders</div>
                        <div className="admin-chart__bar-shell">
                          <motion.div
                            className="admin-chart__bar admin-chart__bar--orders"
                            initial={{ height: 0, opacity: 0.45 }}
                            animate={{ height: `${barHeight}px`, opacity: 1 }}
                            transition={{ duration: 0.95, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                      <div className="admin-chart__meta">
                        <strong>{month.month}</strong>
                        <span>{currency.format(month.revenue || 0)} revenue</span>
                        <span>{currency.format(month.loss || 0)} loss</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="surface-panel admin-panel" style={{ marginTop: "1rem" }}>
            <div className="toolbar-row" style={{ marginTop: 0 }}>
              <div>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Category-wise sales breakdown
                </h2>
                <p className="section-subtitle">
                  See which categories drive the most orders and revenue across the marketplace.
                </p>
              </div>
              <div className="muted">Top 6 categories</div>
            </div>

            {categoryChart.length === 0 ? (
              <div className="empty-state">No category sales data yet.</div>
            ) : (
              <div className="admin-category-visual">
                <div className="admin-category-visual__donut">
                  <svg viewBox="0 0 236 236" className="admin-category-visual__svg" aria-label="Category sales chart" role="img">
                    <defs>
                      <linearGradient id="categoryTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(148,163,184,0.22)" />
                        <stop offset="100%" stopColor="rgba(148,163,184,0.12)" />
                      </linearGradient>
                    </defs>

                    <circle cx="118" cy="118" r="72" className="admin-category-visual__track" />

                    {categoryChart.map((category, index) => (
                      <motion.path
                        key={category.category_id}
                        d={category.path}
                        className="admin-category-visual__segment"
                        stroke={category.color}
                        initial={{ opacity: 0, pathLength: 0 }}
                        animate={{ opacity: 1, pathLength: 1 }}
                        transition={{ duration: 1.05, ease: "easeOut", delay: index * 0.12 }}
                        strokeLinecap="round"
                        onMouseEnter={() => setHoveredCategory(category.category_id)}
                        onFocus={() => setHoveredCategory(category.category_id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        tabIndex={0}
                      />
                    ))}
                  </svg>

                  <div className="admin-category-visual__center">
                    <div className="admin-category-visual__label">Category orders</div>
                    <div className="admin-category-visual__value">
                      {compact.format(categoryChart.reduce((sum, category) => sum + (category.order_count || 0), 0))}
                    </div>
                    <div className="admin-category-visual__sub">
                      {compact.format(summary.total_orders || 0)} total marketplace orders
                    </div>
                  </div>

                  {activeCategory && (
                    <motion.div
                      className="admin-category-visual__tooltip"
                      key={activeCategory.category_id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="admin-category-visual__tooltip-label">{activeCategory.category_name}</div>
                      <div className="admin-category-visual__tooltip-value">
                        {compact.format(activeCategory.order_count || 0)} orders
                      </div>
                      <div className="admin-category-visual__tooltip-copy">
                        {currency.format(activeCategory.revenue || 0)} revenue | {activeCategory.percent}% of category orders
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="admin-category-visual__legend">
                  {categoryChart.map((category, index) => (
                    <motion.button
                      key={category.category_id}
                      type="button"
                      className={`admin-category-visual__legend-row ${
                        hoveredCategory === category.category_id ? "is-active" : ""
                      }`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.08 * index }}
                      onMouseEnter={() => setHoveredCategory(category.category_id)}
                      onFocus={() => setHoveredCategory(category.category_id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <span className="admin-category-visual__dot" style={{ background: category.color }} />
                      <span className="admin-category-visual__legend-copy">
                        <strong>{category.category_name}</strong>
                        <small>
                          {compact.format(category.order_count || 0)} orders | {currency.format(category.revenue || 0)}
                        </small>
                      </span>
                      <span className="admin-category-visual__legend-percent">{category.percent}%</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="admin-split" style={{ marginTop: "1rem" }}>
            <div className="surface-panel admin-panel">
              <div className="toolbar-row" style={{ marginTop: 0 }}>
                <div>
                  <h2 className="section-title" style={{ marginBottom: 0 }}>
                    Popular items
                  </h2>
                  <p className="section-subtitle">Items ranked by number of orders placed.</p>
                </div>
              </div>

              {popularItems.length === 0 ? (
                <div className="empty-state">No sold items yet.</div>
              ) : (
                <div className="admin-list">
                  {popularItems.map((item) => {
                    const width = ((item.order_count || 0) / topItemMax) * 100;

                    return (
                      <div key={item.item_id} className="admin-list__item">
                        <div className="admin-list__header">
                          <div>
                            <div className="admin-list__title">
                              #{item.item_id} {item.title}
                            </div>
                            <div className="admin-list__meta">
                              {compact.format(item.order_count || 0)} orders | {currency.format(item.revenue || 0)}
                            </div>
                          </div>
                        </div>
                        <div className="admin-list__track">
                          <div className="admin-list__fill" style={{ width: `${Math.max(width, 6)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="surface-panel admin-panel">
              <div className="toolbar-row" style={{ marginTop: 0 }}>
                <div>
                  <h2 className="section-title" style={{ marginBottom: 0 }}>
                    Insights
                  </h2>
                  <p className="section-subtitle">
                    The most popular item and the main financial signals at a glance.
                  </p>
                </div>
              </div>

              {summary.most_popular_item && (
                <div className="support-card__reply">
                  <strong>Most popular item</strong>
                  <p className="panel-copy" style={{ marginBottom: 0 }}>
                    #{summary.most_popular_item.item_id} {summary.most_popular_item.title}
                  </p>
                </div>
              )}

              <div className="admin-breakdown" style={{ marginTop: "1rem" }}>
                <div className="admin-breakdown__row">
                  <span>Shipping loss</span>
                  <strong>{currency.format(summary.shipping_loss || 0)}</strong>
                </div>
                <div className="admin-breakdown__row">
                  <span>Payment platform fee</span>
                  <strong>{currency.format(summary.payment_fee || 0)}</strong>
                </div>
                <div className="admin-breakdown__row is-total">
                  <span>Total estimated loss</span>
                  <strong>{currency.format(summary.estimated_loss || 0)}</strong>
                </div>
                <div className="admin-breakdown__row is-profit">
                  <span>Net profit after fees</span>
                  <strong>{currency.format(summary.net_profit || 0)}</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;

