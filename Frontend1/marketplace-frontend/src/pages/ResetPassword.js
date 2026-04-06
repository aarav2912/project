import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import API_BASE_URL from "../config/api";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const handleReset = async () => {
    try {
      await axios.post(`${API_BASE_URL}/reset-password`, {
        token,
        newPassword,
      });

      alert("Password reset successful");
      navigate("/");
    } catch (err) {
      alert("Invalid or expired token");
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="hero-kicker">Secure reset</div>
        <h1 className="auth-title" style={{ marginTop: "0.85rem", fontSize: "2rem" }}>
          Set a new password
        </h1>
        <p className="auth-copy">
          Pick a fresh password and get back into your account.
        </p>

        <div className="field-stack">
          <input
            className="input"
            type="password"
            placeholder="Enter new password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button className="primary-btn" type="button" onClick={handleReset}>
            Reset password
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default ResetPassword;
