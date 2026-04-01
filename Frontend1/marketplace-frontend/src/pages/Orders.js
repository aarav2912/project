import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

function Orders() {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get("http://localhost:5000/orders", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : []));
  }, [token]);

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Order history</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          Your orders
        </h1>
        <p className="hero-copy">
          A cleaner history view makes it easier to scan what you bought and when it shipped.
        </p>
      </motion.section>

      <div style={{ marginTop: "1rem" }}>
        {orders.length === 0 ? (
          <div className="surface-panel empty-state">No orders yet.</div>
        ) : (
          orders.map((order) => (
            <div key={order.ORDER_ID} className="order-row surface-panel">
              <img
                src={`http://localhost:5000${order.IMAGE_URL}`}
                alt={order.TITLE}
                className="order-row__image"
              />

              <div>
                <h3 className="panel-title" style={{ marginBottom: "0.25rem" }}>
                  {order.TITLE}
                </h3>
                <p className="panel-copy" style={{ marginTop: 0 }}>
                  Rs. {order.TOTAL_AMOUNT}
                </p>
                <p className="panel-copy" style={{ marginTop: 0 }}>
                  Status: {order.STATUS}
                </p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {new Date(order.ORDER_DATE).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Orders;
