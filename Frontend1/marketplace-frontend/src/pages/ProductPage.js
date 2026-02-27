import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

function ProductPage() {
  const { id } = useParams();
  const token = localStorage.getItem("token");

  const [item, setItem] = useState(null);
  const [images, setImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [currentImage, setCurrentImage] = useState(0);

  const [rating, setRating] = useState("");
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    fetchItemDetails();
  }, []);

  const fetchItemDetails = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/items/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setItem(res.data.item);
      setImages(res.data.images);
      setReviews(res.data.reviews);

    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewSubmit = async () => {
    try {
      await axios.post(
        `http://localhost:5000/items/${id}/review`,
        { rating, review_text: reviewText },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert("Review added!");
      setRating("");
      setReviewText("");
      fetchItemDetails();

    } catch (err) {
      alert("You already reviewed this item or error occurred");
    }
  };

  // const token = localStorage.getItem("token");

const handleAddToCart = async () => {
  try {
    await axios.post(
      "http://localhost:5000/cart",
      {
        item_id: item.ITEM_ID,
        quantity: 1
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    alert("🛒 Added to cart!");
  } catch (err) {
    console.error(err);
    alert("Failed to add to cart");
  }
};

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating || 0);
    return (
      <>
        {[...Array(fullStars)].map((_, i) => (
          <span key={i} style={{ color: "gold", fontSize: "20px" }}>★</span>
        ))}
      </>
    );
  };

  if (!item) return <div>Loading...</div>;

  return (
    <div style={{ padding: "40px" }}>

      {/* Top Section */}
      <div style={{ display: "flex", gap: "40px" }}>

        {/* Image Slider */}
        <div style={{ flex: 1 }}>
          <img
            src={
              images[currentImage]?.IMAGE_URL?.startsWith("http://localhost:5000")
              ? images[currentImage]?.IMAGE_URL
              : `http://localhost:5000${images[currentImage]?.IMAGE_URL}`
            }
            alt="product"
            style={{ width: "100%", borderRadius: "10px" }}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            {images.map((img, index) => (
              <img
                key={index}
                src={
                  img.IMAGE_URL?.startsWith("http://localhost:5000")
                  ? img.IMAGE_URL
                  : `http://localhost:5000${img.IMAGE_URL}`
                }
                alt="thumb"
                onClick={() => setCurrentImage(index)}
                style={{
                  width: "70px",
                  height: "70px",
                  objectFit: "cover",
                  cursor: "pointer",
                  border: currentImage === index
                    ? "2px solid orange"
                    : "1px solid #ccc"
                }}
              />
            ))}
          </div>
        </div>

        {/* Buy Box */}
        <div style={{
          flex: 1,
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px"
        }}>
          <h2>{item.TITLE}</h2>
          <h3>₹ {item.PRICE}</h3>

          <div>
            {renderStars(item.AVG_RATING)} ({item.REVIEW_COUNT})
          </div>

          <p><b>Seller:</b> {item.SELLER_NAME}</p>

          <button style={{
            marginTop: "15px",
            width: "100%",
            padding: "10px",
            background: "#ffd814",
            border: "none",
            borderRadius: "5px"
          }}>
            <button onClick={handleAddToCart}>
              Add to Cart
              </button>
          </button>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginTop: "40px" }}>
        <h3>Description</h3>
        <p>{item.DESCRIPTION}</p>
      </div>

      {/* Reviews */}
      <div style={{ marginTop: "40px" }}>
        <h3>Customer Reviews</h3>

        {reviews.map((rev, index) => (
          <div key={index} style={{
            borderBottom: "1px solid #ccc",
            padding: "10px 0"
          }}>
            <b>{rev.USERNAME}</b>
            <div>{renderStars(rev.RATING)}</div>
            <p>{rev.REVIEW_TEXT}</p>
          </div>
        ))}

        {/* Review Form */}
        <div style={{ marginTop: "30px" }}>
          <h4>Write a Review</h4>

          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">Select Rating</option>
            <option value="5">5 ⭐</option>
            <option value="4">4 ⭐</option>
            <option value="3">3 ⭐</option>
            <option value="2">2 ⭐</option>
            <option value="1">1 ⭐</option>
          </select>

          <textarea
            placeholder="Write your review..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: "10px" }}
          />

          <button
            onClick={handleReviewSubmit}
            style={{
              marginTop: "10px",
              padding: "8px 15px"
            }}
          >
            Submit Review
          </button>
        </div>
      </div>

    </div>
  );
}

export default ProductPage;