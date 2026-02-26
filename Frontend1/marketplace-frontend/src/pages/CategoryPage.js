import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import ItemCard from "../components/ItemCard";

function CategoryPage() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get(`http://localhost:5000/categories/${id}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data))
      .catch((err) => console.log(err));
  }, [id]);

  return (
    <div style={styles.container}>
      <h2 style={{ color: "white", marginBottom: "20px" }}>
        Items in this Category
      </h2>

      <div style={styles.grid}>
        {items.map((item) => (
          <ItemCard key={item.ITEM_ID} item={item} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "40px",
    background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  },
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "25px",
  },
};

export default CategoryPage;