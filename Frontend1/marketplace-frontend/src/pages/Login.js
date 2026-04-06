import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from "../config/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/login`, {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      try {
        const decoded = jwtDecode(res.data.token);
        const role = String(decoded.role || "").toUpperCase();
        navigate(role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
      } catch (decodeErr) {
        navigate("/dashboard");
      }
    } catch (err) {
      alert("Invalid credentials");
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
        <div className="hero-kicker">Marketplace reimagined</div>
        <h1 className="auth-title" style={{ marginTop: "0.85rem", fontSize: "2rem" }}>
          Welcome back
        </h1>
        <p className="auth-copy">
          Log in to explore categories, track orders, and sell in a UI that stays readable in every theme.
        </p>

        <div className="field-stack">
          <input
            className="input"
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <Link to="/forgot-password" className="muted" style={{ fontSize: "0.92rem" }}>
            Forgot password?
          </Link>

          <button className="primary-btn" type="button" onClick={handleLogin}>
            Login
          </button>
        </div>

        <p className="auth-copy" style={{ marginBottom: 0 }}>
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
