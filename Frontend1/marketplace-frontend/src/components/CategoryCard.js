import React from "react";
import { motion } from "framer-motion";

import bikesImg from "../assets/categories/bycicle.png";
import carsImg from "../assets/categories/transport.png";
import mobilesImg from "../assets/categories/phone.png";
import booksImg from "../assets/categories/books.png";
import electronicsImg from "../assets/categories/electronics.png";
import furnitureImg from "../assets/categories/furniture.png";
import sportsImg from "../assets/categories/memorabilia.png";

const categoryImages = {
  Bikes: bikesImg,
  Cars: carsImg,
  Mobiles: mobilesImg,
  Book: booksImg,
  Electronics: electronicsImg,
  Furniture: furnitureImg,
  SportsItems: sportsImg
};

function CategoryCard({ category, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={styles.card}
    >
      <img
        src={categoryImages[category.CATEGORY_NAME]}
        alt={category.CATEGORY_NAME}
        style={styles.image}
      />

      <div style={styles.overlay}>
        <h3>{category.CATEGORY_NAME}</h3>
      </div>
    </motion.div>
  );
}

const styles = {
  card: {
    position: "relative",
    width: "260px",
    height: "180px",
    borderRadius: "20px",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  overlay: {
    position: "absolute",
    bottom: "0",
    width: "100%",
    background: "rgba(0,0,0,0.6)",
    color: "white",
    padding: "10px",
    textAlign: "center",
  },
};

export default CategoryCard;