import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";

function ProductPage() {
  const { id } = useParams();
  const token = localStorage.getItem("token");

  const [item, setItem] = useState(null);
  const [images, setImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [rating, setRating] = useState("");
  const [reviewText, setReviewText] = useState("");

  const fetchItemDetails = useCallback(async () => {
    try {
      const res = await axios.get(`http://localhost:5000/items/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setItem(res.data.item);
      setImages(Array.isArray(res.data.images) ? res.data.images : []);
      setReviews(Array.isArray(res.data.reviews) ? res.data.reviews : []);
    } catch (err) {
      console.error(err);
    }
  }, [id, token]);

  useEffect(() => {
    fetchItemDetails();
  }, [fetchItemDetails]);

  const handleReviewSubmit = async () => {
    try {
      await axios.post(
        `http://localhost:5000/items/${id}/review`,
        { rating, review_text: reviewText },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Review added!");
      setRating("");
      setReviewText("");
      fetchItemDetails();
    } catch (err) {
      alert("You already reviewed this item or an error occurred");
    }
  };

  const handleAddToCart = async () => {
    try {
      await axios.post(
        "http://localhost:5000/cart",
        {
          item_id: item.ITEM_ID,
          quantity: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Added to cart");
    } catch (err) {
      console.error(err);
      alert("Failed to add to cart");
    }
  };

  const renderStars = (score) => {
    const fullStars = Math.floor(score || 0);

    return [...Array(fullStars)].map((_, index) => (
      <span key={index} style={{ color: "var(--accent)" }}>
        ★
      </span>
    ));
  };

  if (!item) {
    return (
      <div className="content-card" style={{ padding: "1.25rem" }}>
        <div className="empty-state">Loading product...</div>
      </div>
    );
  }

  const activeImage =
    images[currentImage]
      ? images[currentImage]?.IMAGE_URL?.startsWith("http://localhost:5000")
        ? images[currentImage]?.IMAGE_URL
        : `http://localhost:5000${images[currentImage]?.IMAGE_URL || ""}`
      : null;

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Product detail</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          {item.TITLE}
        </h1>
        <p className="hero-copy">{item.DESCRIPTION}</p>
      </motion.section>

      <div className="product-hero" style={{ marginTop: "1rem" }}>
        <div className="product-gallery surface-panel">
          {activeImage ? (
            <img src={activeImage} alt="product" className="product-image" />
          ) : (
            <div className="empty-state" style={{ minHeight: "360px" }}>
              No product image available.
            </div>
          )}

          {images.length > 0 && (
            <div className="thumb-row">
              {images.map((img, index) => {
                const thumb =
                  img.IMAGE_URL?.startsWith("http://localhost:5000")
                    ? img.IMAGE_URL
                    : `http://localhost:5000${img.IMAGE_URL}`;

                return (
                  <img
                    key={index}
                    src={thumb}
                    alt={`thumb-${index}`}
                    className={`thumb ${currentImage === index ? "is-active" : ""}`}
                    onClick={() => setCurrentImage(index)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="product-summary surface-panel">
          <div className="rating-row" style={{ marginBottom: "0.75rem" }}>
            {renderStars(item.AVG_RATING)}
            <span>
              {item.AVG_RATING || 0} ({item.REVIEW_COUNT || 0} reviews)
            </span>
          </div>

          <h2 className="panel-title" style={{ fontSize: "1.75rem" }}>
            Rs. {item.PRICE}
          </h2>
          <p className="panel-copy">
            <strong>Seller:</strong> {item.SELLER_NAME}
          </p>

          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button className="primary-btn" type="button" onClick={handleAddToCart}>
              Add to cart
            </button>
          </div>
        </div>
      </div>

      <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h3 className="panel-title">Description</h3>
        <p className="panel-copy" style={{ lineHeight: 1.7 }}>
          {item.DESCRIPTION}
        </p>
      </div>

      <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h3 className="panel-title">Customer reviews</h3>

        <div className="review-grid">
          {reviews.length === 0 ? (
            <div className="empty-state">No reviews yet. Be the first to leave one.</div>
          ) : (
            reviews.map((rev, index) => (
              <div key={index} className="review-card">
                <strong>{rev.USERNAME}</strong>
                <div className="rating-row">{renderStars(rev.RATING)}</div>
                <p className="panel-copy" style={{ marginBottom: 0 }}>
                  {rev.REVIEW_TEXT}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="surface-panel" style={{ padding: "1rem", marginTop: "1rem" }}>
          <h4 className="panel-title" style={{ fontSize: "1.1rem" }}>
            Write a review
          </h4>

          <div className="field-stack" style={{ marginTop: "0.75rem" }}>
            <select className="select" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">Select rating</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>

            <textarea
              className="textarea"
              placeholder="Write your review..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />

            <button className="primary-btn" type="button" onClick={handleReviewSubmit}>
              Submit review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductPage;
