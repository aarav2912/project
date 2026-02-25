import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      await axios.post("http://localhost:5000/forgot-password", { email });
      alert("Reset link sent to your email 📩");
      navigate("/");
    } catch (err) {
      alert("Email not found");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Reset Password 🔐</h2>
        <input
          type="email"
          placeholder="Enter your registered email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={handleSubmit}>Send Reset Link</button>
        <p>
          <Link to="/">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;