import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      await axios.post("http://localhost:5000/forgot-password", { email });
      alert("Reset link sent to your email");
      navigate("/");
    } catch (err) {
      alert("Email not found");
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
        <div className="hero-kicker">Account recovery</div>
        <h1 className="auth-title" style={{ marginTop: "0.85rem", fontSize: "2rem" }}>
          Reset password
        </h1>
        <p className="auth-copy">
          We&apos;ll send a reset link to your registered email.
        </p>

        <div className="field-stack">
          <input
            className="input"
            type="email"
            placeholder="Enter your registered email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary-btn" type="button" onClick={handleSubmit}>
            Send reset link
          </button>
        </div>

        <p className="auth-copy" style={{ marginBottom: 0 }}>
          <Link to="/">Back to login</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default ForgotPassword;
