import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = async () => {
    try {
      await axios.get("http://localhost:5000/logout", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.log("Logout route error (safe to ignore)");
    }

    // Remove token locally
    localStorage.removeItem("token");

    // Redirect to login
    navigate("/");
  };

  return (
    <div className="container">
      <div className="card">
        <h2>🎉 Dashboard</h2>
        <p>You are successfully logged in.</p>

        <button
          onClick={handleLogout}
          style={{ marginTop: "20px", background: "#ff4d4d" }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Dashboard;