import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      await axios.post("http://localhost:5000/register", form);
      alert("Registered successfully!");
      navigate("/");
    } catch (err) {
      alert("User already exists");
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
        <div className="hero-kicker">Start selling fast</div>
        <h1 className="auth-title" style={{ marginTop: "0.85rem", fontSize: "2rem" }}>
          Create your account
        </h1>
        <p className="auth-copy">
          Join the marketplace with a polished dashboard, smoother browsing, and theme-safe components.
        </p>

        <div className="field-stack">
          <input
            className="input"
            placeholder="Username"
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button className="primary-btn" type="button" onClick={handleRegister}>
            Register
          </button>
        </div>

        <p className="auth-copy" style={{ marginBottom: 0 }}>
          Already have an account? <Link to="/">Login</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;
