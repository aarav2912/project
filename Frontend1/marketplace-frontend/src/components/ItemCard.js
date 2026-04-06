import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../config/api";

function ItemCard({ item }) {
  const navigate = useNavigate();
  const imageUrl = item.IMAGE_URL?.startsWith(API_BASE_URL)
    ? item.IMAGE_URL
    : `${API_BASE_URL}${item.IMAGE_URL}`;

  return (
    <motion.button
      type="button"
      className="item-card"
      onClick={() => navigate(`/product/${item.ITEM_ID}`)}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="item-card__media">
        <img src={imageUrl} alt={item.TITLE} className="item-card__image" />
        <span className="id-badge item-card__badge">Item #{item.ITEM_ID}</span>
      </div>

      <div className="item-card__body">
        <h4 className="item-card__title">{item.TITLE}</h4>
        <p className="item-card__price">Rs. {item.PRICE}</p>
      </div>
    </motion.button>
  );
}

export default ItemCard;
