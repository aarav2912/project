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
  SportsItems: sportsImg,
};

function CategoryCard({ category, onClick }) {
  const image = categoryImages[category.CATEGORY_NAME] || electronicsImg;

  return (
    <motion.button
      type="button"
      className="category-card"
      onClick={onClick}
      whileHover={{ y: -6, rotateX: 5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <img
        src={image}
        alt={category.CATEGORY_NAME}
        className="category-card__image"
      />

      <div className="category-card__overlay">
        <h3>{category.CATEGORY_NAME}</h3>
      </div>
    </motion.button>
  );
}

export default CategoryCard;
