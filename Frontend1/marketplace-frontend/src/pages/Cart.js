import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const token = localStorage.getItem("token");

  const fetchCart = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/cart`, {
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

      const currentItem = cartItems.find((item) => item.ITEM_ID === itemId);
      const stockQuantity = Number(currentItem?.STOCK_QUANTITY || 0);

      if (stockQuantity > 0 && newQty > stockQuantity) {
        alert(`Only ${stockQuantity} item(s) left in stock`);
        return;
      }

      await axios.put(
        `${API_BASE_URL}/cart`,
        { item_id: itemId, quantity: newQty },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchCart();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Unable to update cart");
    }
  };

  const removeItem = async (itemId) => {
    try {
      await axios.delete(`${API_BASE_URL}/cart/${itemId}`, {
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
        `${API_BASE_URL}/create-checkout-session`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      window.location.href = res.data.url;
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Unable to proceed to checkout");
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
            const imageUrl = item.IMAGE_URL?.startsWith(API_BASE_URL)
              ? item.IMAGE_URL
              : `${API_BASE_URL}${item.IMAGE_URL}`;

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
                  <p className="panel-copy" style={{ marginTop: 0 }}>
                    {Number(item.STOCK_QUANTITY || 0) > 0 && String(item.ITEM_STATUS || "AVAILABLE").toUpperCase() === "AVAILABLE"
                      ? `Only ${Number(item.STOCK_QUANTITY || 0)} left in stock`
                      : "This item is not available any more"}
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
                      disabled={
                        Number(item.STOCK_QUANTITY || 0) <= 0 ||
                        Number(item.QUANTITY) >= Number(item.STOCK_QUANTITY)
                      }
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
