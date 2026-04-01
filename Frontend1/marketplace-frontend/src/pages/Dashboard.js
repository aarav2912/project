import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { motion } from "framer-motion";
import CategoryCard from "../components/CategoryCard";

function Dashboard() {
  const [categories, setCategories] = useState([]);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (String(decoded.role || "").toUpperCase() === "ADMIN") {
          navigate("/admin/grievances", { replace: true });
          return;
        }
        setUsername(decoded.username || "");
      } catch (err) {
        console.error("Invalid token");
      }
    }

    axios
      .get("http://localhost:5000/categories", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.log(err));
  }, [token, navigate]);

  if (token && username === "" && window.location.pathname === "/dashboard") {
    try {
      const decoded = jwtDecode(token);
      if (String(decoded.role || "").toUpperCase() === "ADMIN") {
        return null;
      }
    } catch (err) {
      // ignore and fall through
    }
  }

  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : "there";

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Curated marketplace</div>
        <h1 className="hero-title">Welcome back, {displayName}</h1>
        <p className="hero-copy">
          Browse fast, sell faster, and keep the interface clean enough that the products stay in focus.
        </p>

        <div className="hero-stats">
          <div className="stat-pill">
            <div className="stat-pill__label">Quick action</div>
            <div className="stat-pill__value">List a new item</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill__label">Tracking</div>
            <div className="stat-pill__value">Orders and alerts</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill__label">Personalized</div>
            <div className="stat-pill__value">Interest-driven feed</div>
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: "1.1rem" }}>
          <button className="primary-btn" onClick={() => navigate("/sell")} type="button">
            Sell an item
          </button>
          <button className="secondary-btn" onClick={() => navigate("/cart")} type="button">
            Cart
          </button>
          <button className="secondary-btn" onClick={() => navigate("/orders")} type="button">
            My orders
          </button>
          <button className="secondary-btn" onClick={() => navigate("/interests")} type="button">
            Set interests
          </button>
          <button className="ghost-btn" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </motion.section>

      <div className="toolbar-row" style={{ marginBottom: "1rem" }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Explore categories
          </h2>
          <p className="section-subtitle">
            Tap a category to jump into a polished browsing flow with the same theme-safe surface.
          </p>
        </div>
      </div>

      <div className="category-grid">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.CATEGORY_ID}
            category={cat}
            onClick={() => navigate(`/category/${cat.CATEGORY_ID}`)}
          />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
