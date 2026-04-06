import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import ItemCard from "../components/ItemCard";
import API_BASE_URL from "../config/api";

function CategoryPage() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/categories/${id}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.log(err));
  }, [id, token]);

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Category browse</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          Explore items in this category
        </h1>
        <p className="hero-copy">
          Consistent spacing, stronger contrast, and a cleaner layout make the browsing experience feel premium.
        </p>
      </motion.section>

      <div className="item-grid" style={{ marginTop: "1rem" }}>
        {items.map((item) => (
          <ItemCard key={item.ITEM_ID} item={item} />
        ))}
      </div>
    </div>
  );
}

export default CategoryPage;
