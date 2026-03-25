import React, { useEffect, useState } from "react";
import axios from "axios";

function Orders() {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:5000/orders", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setOrders(res.data));
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h2>📦 Your Orders</h2>

      {orders.map(order => (
        <div key={order.ORDER_ID} style={{
          display: "flex",
          gap: "20px",
          marginBottom: "20px",
          padding: "15px",
          background: "#f4f4f4",
          borderRadius: "10px"
        }}>
          <img
            src={`http://localhost:5000${order.IMAGE_URL}`}
            alt=""
            style={{ width: "100px", borderRadius: "10px" }}
          />

          <div>
            <h4>{order.TITLE}</h4>
            <p>₹ {order.TOTAL_AMOUNT}</p>
            <p>Status: {order.STATUS}</p>
            <p>{new Date(order.ORDER_DATE).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Orders;