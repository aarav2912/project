import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

function Interests() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_id: "",
    min_price: "",
    max_price: "",
    keyword: "",
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []));
  }, [token]);

  const handleSubmit = async () => {
    await axios.post(`${API_BASE_URL}/interests`, form, {
      headers: { Authorization: `Bearer ${token}` },
    });
    alert("Interest saved!");
  };

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Personal feed</div>
        <h1 className="hero-title" style={{ fontSize: "2.4rem" }}>
          Set your interests
        </h1>
        <p className="hero-copy">
          Save what you care about and let the app surface better matches without cluttering the UI.
        </p>
      </motion.section>

      <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <div className="field-stack">
          <select
            className="select"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.CATEGORY_ID} value={cat.CATEGORY_ID}>
                {cat.CATEGORY_NAME}
              </option>
            ))}
          </select>

          <div className="mobile-stack">
            <input
              className="input"
              type="number"
              placeholder="Min price"
              onChange={(e) => setForm({ ...form, min_price: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Max price"
              onChange={(e) => setForm({ ...form, max_price: e.target.value })}
            />
          </div>

          <input
            className="input"
            placeholder="Keyword (optional)"
            onChange={(e) => setForm({ ...form, keyword: e.target.value })}
          />

          <button className="primary-btn" type="button" onClick={handleSubmit}>
            Save interest
          </button>
        </div>
      </div>
    </div>
  );
}

export default Interests;
