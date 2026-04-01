import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const token = localStorage.getItem("token");

  const fetchCart = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCartItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

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

  const removeItem = async (itemId) => {
    try {
      await axios.delete(`http://localhost:5000/cart/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      window.location.href = res.data.url;
    } catch (err) {
      console.log(err);
    }
  };

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + Number(item.PRICE) * Number(item.QUANTITY),
    0
  );

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Checkout flow</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          Your cart
        </h1>
        <p className="hero-copy">
          A cleaner cart with stronger contrast, smoother spacing, and controls that stay easy to read.
        </p>
      </motion.section>

      <div style={{ marginTop: "1rem" }}>
        {cartItems.length === 0 ? (
          <div className="surface-panel empty-state">Your cart is empty.</div>
        ) : (
          cartItems.map((item) => {
            const imageUrl = item.IMAGE_URL?.startsWith("http://localhost:5000")
              ? item.IMAGE_URL
              : `http://localhost:5000${item.IMAGE_URL}`;

            return (
              <div key={item.ITEM_ID} className="cart-row surface-panel">
                <img src={imageUrl} alt={item.TITLE} className="cart-row__image" />

                <div>
                  <h3 className="panel-title" style={{ marginBottom: "0.25rem" }}>
                    {item.TITLE}
                  </h3>
                  <p className="panel-copy" style={{ marginTop: 0 }}>
                    Rs. {item.PRICE}
                  </p>

                  <div className="button-row" style={{ alignItems: "center" }}>
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => updateQuantity(item.ITEM_ID, Number(item.QUANTITY) - 1)}
                    >
                      -
                    </button>
                    <span className="stat-pill__value" style={{ marginTop: 0 }}>
                      {Number(item.QUANTITY)}
                    </span>
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => updateQuantity(item.ITEM_ID, Number(item.QUANTITY) + 1)}
                    >
                      +
                    </button>
                    <button
                      className="danger-btn"
                      type="button"
                      onClick={() => removeItem(item.ITEM_ID)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
          <h3 className="panel-title">Total: Rs. {totalPrice}</h3>
          <button className="primary-btn" type="button" onClick={handleCheckout}>
            Proceed to checkout
          </button>
        </div>
      )}
    </div>
  );
}

export default Cart;
