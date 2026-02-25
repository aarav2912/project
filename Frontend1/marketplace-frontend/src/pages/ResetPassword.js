import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const handleReset = async () => {
    try {
      await axios.post("http://localhost:5000/reset-password", {
        token,
        newPassword,
      });

      alert("Password reset successful 🎉");
      navigate("/");
    } catch (err) {
      alert("Invalid or expired token");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Set New Password 🔑</h2>
        <input
          type="password"
          placeholder="Enter new password"
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button onClick={handleReset}>Reset Password</button>
      </div>
    </div>
  );
}

export default ResetPassword;