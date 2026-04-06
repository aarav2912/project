import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

function AdminGrievances() {
  const [grievances, setGrievances] = useState([]);
  const [drafts, setDrafts] = useState({});
  const token = localStorage.getItem("token");

  const fetchGrievances = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/grievances`, {
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

  const sendReply = async (grievanceId) => {
    const reply_text = drafts[grievanceId] || "";

    try {
      await axios.post(
        `${API_BASE_URL}/admin/grievances/${grievanceId}/reply`,
        { reply_text },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDrafts((current) => ({ ...current, [grievanceId]: "" }));
      await fetchGrievances();
      alert("Reply sent to user email");
    } catch (err) {
      alert("Failed to send reply");
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
        <div className="hero-kicker">Admin console</div>
        <h1 className="hero-title" style={{ fontSize: "2.3rem" }}>
          Grievance inbox
        </h1>
        <p className="hero-copy">
          Review user issues, write a response, and the system will email the reply to the registered account.
        </p>
      </motion.section>

      <div style={{ marginTop: "1rem" }} className="support-list">
        {grievances.length === 0 ? (
          <div className="surface-panel empty-state">No grievances yet.</div>
        ) : (
          grievances.map((grievance) => (
            <div key={grievance.GRIEVANCE_ID} className="surface-panel support-card">
              <div className="toolbar-row" style={{ marginTop: 0 }}>
                <div>
                  <h3 className="panel-title" style={{ marginBottom: "0.25rem" }}>
                    {grievance.ITEM_TITLE || `Grievance #${grievance.GRIEVANCE_ID}`}
                  </h3>
                  <p className="muted" style={{ margin: 0 }}>
                    From {grievance.USERNAME} | {grievance.EMAIL}
                  </p>
                </div>
                <span
                  className={`status-pill ${
                    String(grievance.PROBLEM_STATUS || "").toUpperCase() === "RESOLVED"
                      ? "is-resolved"
                      : "is-open"
                  }`}
                >
                  {grievance.PROBLEM_STATUS}
                </span>
              </div>

              <p className="panel-copy">{grievance.PROBLEM_DESC}</p>

              <div className="support-card__meta">
                <span className="muted">Submitted: {grievance.CREATED_AT}</span>
                <span className="muted">Order ID: {grievance.ORDER_ID || "N/A"}</span>
                <span className="muted">Item ID: {grievance.ITEM_ID || "N/A"}</span>
              </div>

              {grievance.ADMIN_REPLY && (
                <div className="support-card__reply">
                  <strong>Previously sent reply</strong>
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
                      alt={`admin-grievance-${grievance.GRIEVANCE_ID}-${index}`}
                      className="cart-row__image"
                      style={{ width: "100%", height: "160px" }}
                    />
                  ))}
                </div>
              )}

              <div style={{ marginTop: "0.9rem" }} className="field-stack">
                <textarea
                  className="textarea"
                  placeholder="Write admin reply to email the user"
                  value={drafts[grievance.GRIEVANCE_ID] || ""}
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [grievance.GRIEVANCE_ID]: e.target.value,
                    }))
                  }
                />

                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => sendReply(grievance.GRIEVANCE_ID)}
                >
                  Send reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AdminGrievances;
