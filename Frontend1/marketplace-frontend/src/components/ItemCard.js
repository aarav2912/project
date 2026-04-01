import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

function ItemCard({ item }) {
  const navigate = useNavigate();
  const imageUrl = item.IMAGE_URL?.startsWith("http://localhost:5000")
    ? item.IMAGE_URL
    : `http://localhost:5000${item.IMAGE_URL}`;

  return (
    <motion.button
      type="button"
      className="item-card"
      onClick={() => navigate(`/product/${item.ITEM_ID}`)}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <img src={imageUrl} alt={item.TITLE} className="item-card__image" />

      <div className="item-card__body">
        <h4 className="item-card__title">{item.TITLE}</h4>
        <p className="item-card__price">Rs. {item.PRICE}</p>
      </div>
    </motion.button>
  );
}

export default ItemCard;
