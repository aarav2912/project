import React from "react";
import { useNavigate } from "react-router-dom";

function ItemCard({ item }) {
  const navigate = useNavigate();

  return (
    <div
      style={styles.card}
      onClick={() => navigate(`/product/${item.ITEM_ID}`)}
    >
      <img
        src={
          item.IMAGE_URL?.startsWith("http://localhost:5000")
            ? item.IMAGE_URL
            : `http://localhost:5000${item.IMAGE_URL}`
        }
        alt={item.TITLE}
        style={styles.image}
      />

      <div style={styles.content}>
        <h4>{item.TITLE}</h4>
        <p>₹ {item.PRICE}</p>
      </div>
    </div>
  );
}

const styles = {
  card: {
    width: "250px",
    background: "white",
    borderRadius: "15px",
    overflow: "hidden",
    boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
    cursor: "pointer",
    transition: "transform 0.2s ease",
  },
  image: {
    width: "100%",
    height: "180px",
    objectFit: "cover",
  },
  content: {
    padding: "15px",
  },
};

export default ItemCard;