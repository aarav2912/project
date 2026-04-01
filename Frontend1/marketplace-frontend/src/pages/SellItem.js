import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";

function SellItem() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    quantity: 1,
    category_id: "",
  });

  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get("http://localhost:5000/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.log(err));
  }, [token]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);

    setImages(files);

    const previewUrls = files.map((file) => URL.createObjectURL(file));
    setPreview(previewUrls);
  };

  const removeImage = (indexToRemove) => {
    const updatedImages = images.filter((_, index) => index !== indexToRemove);
    const updatedPreview = preview.filter((_, index) => index !== indexToRemove);

    setImages(updatedImages);
    setPreview(updatedPreview);
  };

  const handleSubmit = async () => {
    try {
      const data = new FormData();

      Object.keys(form).forEach((key) => {
        data.append(key, form[key]);
      });

      images.forEach((img) => {
        data.append("images", img);
      });

      await axios.post("http://localhost:5000/items", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert("Item listed successfully!");

      setForm({
        title: "",
        description: "",
        price: "",
        quantity: 1,
        category_id: "",
      });

      setImages([]);
      setPreview([]);
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  };

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="hero-kicker">Seller studio</div>
        <h1 className="hero-title" style={{ fontSize: "2.4rem" }}>
          List a product with confidence
        </h1>
        <p className="hero-copy">
          The layout keeps inputs readable in both themes and makes the upload flow feel polished.
        </p>
      </motion.section>

      <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <div className="field-stack">
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            className="textarea"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="mobile-stack">
            <input
              className="input"
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>

          <select
            className="select"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.CATEGORY_ID} value={cat.CATEGORY_ID}>
                {cat.CATEGORY_NAME}
              </option>
            ))}
          </select>

          <input className="input" type="file" multiple accept="image/*" onChange={handleImageChange} />
        </div>

        {images.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Selected files
            </p>
            <div className="muted" style={{ display: "grid", gap: "0.3rem" }}>
              {images.map((file, index) => (
                <span key={index}>{file.name}</span>
              ))}
            </div>
          </div>
        )}

        {preview.length > 0 && (
          <div className="upload-grid">
            {preview.map((img, index) => (
              <div key={index} className="upload-tile">
                <img src={img} alt={`preview-${index}`} />
                <button
                  type="button"
                  className="upload-remove"
                  onClick={() => removeImage(index)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "1.2rem" }}>
          <button className="primary-btn" onClick={handleSubmit} type="button">
            List item
          </button>
        </div>
      </div>
    </div>
  );
}

export default SellItem;
