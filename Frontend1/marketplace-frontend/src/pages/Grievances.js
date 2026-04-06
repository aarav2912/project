import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

function Grievances() {
  const [form, setForm] = useState({
    order_id: "",
    item_id: "",
    problem_desc: "",
  });
  const [grievances, setGrievances] = useState([]);
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);
  const token = localStorage.getItem("token");

  const fetchGrievances = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/grievances/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setGrievances(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  try {
    const decoded = jwtDecode(token);
    if (String(decoded.role || "").toUpperCase() === "ADMIN") {
      return <Navigate to="/admin/grievances" replace />;
    }
  } catch (err) {
    // if token can't decode, render the page and let auth route handle it
  }

  const handleSubmit = async () => {
    try {
      const data = new FormData();

      Object.keys(form).forEach((key) => {
        data.append(key, form[key]);
      });

      images.forEach((img) => {
        data.append("images", img);
      });

      await axios.post(
        `${API_BASE_URL}/grievances`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setForm({
        order_id: "",
        item_id: "",
        problem_desc: "",
      });
      setImages([]);
      setPreview([]);

      await fetchGrievances();
      alert("Grievance submitted successfully");
    } catch (err) {
      alert("Failed to submit grievance");
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
        <div className="hero-kicker">Support desk</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          Raise a grievance
        </h1>
        <p className="hero-copy">
          Send a complaint or issue from the website. The admin replies to your registered email and the thread stays visible here.
        </p>
      </motion.section>

      <div className="surface-panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <div className="field-stack">
          <div className="mobile-stack">
            <input
              className="input"
              type="number"
              placeholder="Order ID (optional)"
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Item ID (optional)"
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
            />
          </div>

          <textarea
            className="textarea"
            placeholder="Describe the issue, delivery problem, refund concern, seller issue, etc."
            value={form.problem_desc}
            onChange={(e) => setForm({ ...form, problem_desc: e.target.value })}
          />

          <input
            className="input"
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setImages(files);
              setPreview(files.map((file) => URL.createObjectURL(file)));
            }}
          />

          {preview.length > 0 && (
            <div className="upload-grid" style={{ marginTop: 0 }}>
              {preview.map((img, index) => (
                <div key={index} className="upload-tile">
                  <img src={img} alt={`grievance-preview-${index}`} />
                </div>
              ))}
            </div>
          )}

          <button className="primary-btn" type="button" onClick={handleSubmit}>
            Submit grievance
          </button>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <h2 className="section-title" style={{ marginBottom: "0.85rem" }}>
          My submissions
        </h2>

        <div className="support-list">
          {grievances.length === 0 ? (
            <div className="surface-panel empty-state">No grievances submitted yet.</div>
          ) : (
            grievances.map((grievance) => (
              <div key={grievance.GRIEVANCE_ID} className="surface-panel support-card">
                <h3 className="panel-title" style={{ marginBottom: "0.35rem" }}>
                  {grievance.ITEM_TITLE || `Grievance #${grievance.GRIEVANCE_ID}`}
                </h3>
                <p className="panel-copy" style={{ marginTop: 0 }}>
                  {grievance.PROBLEM_DESC}
                </p>

                <div className="support-card__meta">
                  <span
                    className={`status-pill ${String(grievance.PROBLEM_STATUS || "").toUpperCase() === "RESOLVED" ? "is-resolved" : "is-open"}`}
                  >
                    {grievance.PROBLEM_STATUS}
                  </span>
                  <span className="muted">Submitted: {grievance.CREATED_AT}</span>
                </div>

                {grievance.ADMIN_REPLY && (
                  <div className="support-card__reply">
                    <strong>Admin reply</strong>
                    <p className="panel-copy" style={{ marginBottom: 0 }}>
                      {grievance.ADMIN_REPLY}
                    </p>
                  </div>
                )}

                {Array.isArray(grievance.IMAGES) && grievance.IMAGES.length > 0 && (
                  <div className="upload-grid" style={{ marginTop: "0.9rem" }}>
                    {grievance.IMAGES.map((imageUrl, index) => (
                      <img
                        key={index}
                        src={`${API_BASE_URL}${imageUrl}`}
                        alt={`grievance-${grievance.GRIEVANCE_ID}-${index}`}
                        className="cart-row__image"
                        style={{ width: "100%", height: "160px" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Grievances;
