import React, { useEffect, useState } from "react";
import axios from "axios";

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:5000/cart", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => setCartItems(res.data))
      .catch(err => console.error(err));
  }, [token]);

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.PRICE * item.QUANTITY,
    0
  );

  return (
    <div style={{ padding: "40px" }}>
      <h2>🛒 Your Cart</h2>

      {cartItems.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          {cartItems.map(item => (
            <div
              key={item.ITEM_ID}
              style={{
                display: "flex",
                gap: "20px",
                marginBottom: "20px",
                padding: "15px",
                borderRadius: "10px",
                background: "#f4f4f4"
              }}
            >
              <img
                src={
                    item.IMAGE_URL.startsWith("http://localhost:5000")?
                    item.IMAGE_URL
                    :`http://localhost:5000${item.IMAGE_URL}`
                }
                alt={item.TITLE}
                style={{ width: "100px", borderRadius: "10px" }}
              />

              <div>
                <h4>{item.TITLE}</h4>
                <p>₹ {item.PRICE}</p>
                <p>Quantity: {item.QUANTITY}</p>
              </div>
            </div>
          ))}

          <h3>Total: ₹ {totalPrice}</h3>

          <button style={{
            padding: "10px 20px",
            background: "#ff9900",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}>
            Proceed to Checkout
          </button>
        </>
      )}
    </div>
  );
}

export default Cart;