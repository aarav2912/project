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
    category_id: ""
  });
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:5000/categories")
      .then(res => setCategories(res.data))
      .catch(err => console.log(err));
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);

    const previewUrls = files.map(file => URL.createObjectURL(file));
    setPreview(previewUrls);
  };

  const handleSubmit = async () => {
    try {
      const data = new FormData();
      Object.keys(form).forEach(key => {
        data.append(key, form[key]);
      });

      images.forEach(img => {
        data.append("images", img);
      });

      await axios.post("http://localhost:5000/items", data, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      alert("🎉 Item Listed Successfully!");
      setForm({
        title: "",
        description: "",
        price: "",
        quantity: 1,
        category_id: ""
      });
      setImages([]);
      setPreview([]);

    } catch (err) {
      alert("Something went wrong");
    }
  };

  return (
    <div className="container">
      <motion.div 
        className="card"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: "450px" }}
      >
        <h2>🚀 Sell Your Item</h2>

        <input
          placeholder="Title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          placeholder="Description"
          style={{ width: "100%", padding: "12px", borderRadius: "10px", marginTop: "10px" }}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />

        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
        />

        <input
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={e => setForm({ ...form, quantity: e.target.value })}
        />

        <select
          value={form.category_id}
          onChange={e => setForm({ ...form, category_id: e.target.value })}
          style={{ width: "100%", padding: "12px", borderRadius: "10px", marginTop: "10px" }}
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.CATEGORY_ID} value={cat.CATEGORY_ID}>
              {cat.CATEGORY_NAME}
            </option>
          ))}
        </select>

        <input
          type="file"
          multiple
          onChange={handleImageChange}
          style={{ marginTop: "15px" }}
        />

        <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
          {preview.map((img, index) => (
            <img 
              key={index}
              src={img}
              alt="preview"
              style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "10px" }}
            />
          ))}
        </div>

        <button 
          onClick={handleSubmit}
          style={{ marginTop: "20px" }}
        >
          List Item
        </button>
      </motion.div>
    </div>
  );
}

export default SellItem;