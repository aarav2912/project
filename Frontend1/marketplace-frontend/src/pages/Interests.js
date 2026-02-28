import React, { useEffect, useState } from "react";
import axios from "axios";

function Interests() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_id: "",
    min_price: "",
    max_price: "",
    keyword: ""
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:5000/categories", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setCategories(res.data));
  }, []);

  const handleSubmit = async () => {
    await axios.post(
      "http://localhost:5000/interests",
      form,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    alert("Interest saved!");
  };

  return (
    <div className="container">
      <div className="card" style={{ width: "400px" }}>
        <h2>🎯 Set Your Interest</h2>

        <select
          value={form.category_id}
          onChange={e => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.CATEGORY_ID} value={cat.CATEGORY_ID}>
              {cat.CATEGORY_NAME}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min Price"
          onChange={e => setForm({ ...form, min_price: e.target.value })}
        />

        <input
          type="number"
          placeholder="Max Price"
          onChange={e => setForm({ ...form, max_price: e.target.value })}
        />

        <input
          placeholder="Keyword (optional)"
          onChange={e => setForm({ ...form, keyword: e.target.value })}
        />

        <button onClick={handleSubmit}>Save Interest</button>
      </div>
    </div>
  );
}

export default Interests;