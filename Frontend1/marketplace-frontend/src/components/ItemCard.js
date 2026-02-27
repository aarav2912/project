import React from "react";

function ItemCard({ item }) {
  return (
    <div style={styles.card}>
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