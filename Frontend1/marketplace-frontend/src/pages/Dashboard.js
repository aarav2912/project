import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import CategoryCard from "../components/CategoryCard";

function Dashboard() {
  const [categories, setCategories] = useState([]);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsername(decoded.username);
      } catch (err) {
        console.error("Invalid token");
      }
    }

    axios
      .get("http://localhost:5000/categories", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCategories(res.data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={{ color: "white", marginBottom: "30px" }}>
        🎉 Welcome {username.substring(0,1).toUpperCase()+username.substring(1,username.length)}
      </h1>

      <div style={{ marginBottom: "30px", display: "flex", gap: "15px" }}>
        <button
          onClick={() => navigate("/sell")}
          style={styles.sellBtn}
        >
          ➕ Sell an Item
        </button>

        <button
          onClick={handleLogout}
          style={styles.logoutBtn}
        >
          Logout
        </button>
      </div>

      <h2 style={{ color: "white", marginBottom: "20px" }}>
        Explore Categories 🚀
      </h2>

      <div style={styles.grid}>
        {categories.map((cat) => (
          <CategoryCard
            key={cat.CATEGORY_ID}
            category={cat}
            onClick={() => navigate(`/category/${cat.CATEGORY_ID}`)}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "40px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
  },
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "30px",
    justifyContent: "center",
  },
  sellBtn: {
    background: "#4CAF50",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
  logoutBtn: {
    background: "#ff4d4d",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
};

export default Dashboard;