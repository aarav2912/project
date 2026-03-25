import React, { useEffect, useState } from "react";
import axios from "axios";

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const token = localStorage.getItem("token");

  // 🔄 Fetch Cart
  const fetchCart = async () => {
    try {
      const res = await axios.get("http://localhost:5000/cart", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  // 🔢 Update Quantity
  const updateQuantity = async (itemId, newQty) => {
    try {
      if (newQty < 1) {
        await removeItem(itemId);
        return;
      }

      await axios.put(
        "http://localhost:5000/cart",
        { item_id: itemId, quantity: newQty },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchCart();
    } catch (err) {
      console.error(err);
    }
  };

  // 🗑 Remove Item
  const removeItem = async (itemId) => {
    try {
      await axios.delete(
        `http://localhost:5000/cart/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchCart();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckout = async () => {
  try {
    const res = await axios.post(
      "http://localhost:5000/create-checkout-session",
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    window.location.href = res.data.url;
  } catch (err) {
    console.log(err);
  }
};

  // 💰 Total Price
  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.PRICE * Number(item.QUANTITY),
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
                padding: "20px",
                borderRadius: "12px",
                background: "#f4f4f4",
                alignItems: "center"
              }}
            >
              <img
                src={
                  item.IMAGE_URL?.startsWith("http://localhost:5000")
                    ? item.IMAGE_URL
                    : `http://localhost:5000${item.IMAGE_URL}`
                }
                alt={item.TITLE}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  borderRadius: "10px"
                }}
              />

              <div style={{ flex: 1 }}>
                <h4>{item.TITLE}</h4>
                <p>₹ {item.PRICE}</p>

                {/* 🔢 Quantity Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button onClick={() => updateQuantity(item.ITEM_ID, Number(item.QUANTITY) - 1)}>
                    ➖
                  </button>

                  <span>{Number(item.QUANTITY)}</span>

                  <button onClick={() => updateQuantity(item.ITEM_ID, Number(item.QUANTITY) + 1)}>
                    ➕
                  </button>
                </div>

                {/* 🗑 Remove */}
                <button
                  onClick={() => removeItem(item.ITEM_ID)}
                  style={{
                    marginTop: "10px",
                    background: "#ff4d4d",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  🗑 Remove
                </button>
              </div>
            </div>
          ))}

          <h3>Total: ₹ {totalPrice}</h3>

          <button
  onClick={handleCheckout}
  style={{
    padding: "12px 20px",
    background: "#ff9900",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold"
  }}
>
  Proceed to Checkout
</button>
        </>
      )}
    </div>
  );
}

export default Cart;