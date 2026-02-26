import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Navbar() {
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:5000/categories/tree")
      .then(res => setCategories(res.data))
      .catch(err => console.log(err));

    axios.get("http://localhost:5000/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setUser(res.data))
      .catch(err => console.log(err));

  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={styles.navbar}>
      <div style={styles.left}>
        <h2 style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
          🛒 MyMarket
        </h2>

        <div
          style={styles.hamburger}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
        >
          ☰ Categories

          {showMenu && (
            <div style={styles.dropdown}>
              {categories.map(cat => (
                <div key={cat.CATEGORY_ID} style={styles.categoryBlock}>
                  <strong>{cat.CATEGORY_NAME}</strong>
                  {cat.children.map(child => (
                    <div key={child.CATEGORY_ID} style={styles.subCategory}>
                      {child.CATEGORY_NAME}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.right}>
        <button onClick={() => navigate("/sell")}>Sell Item</button>

        {user && (
          <div style={styles.user}>
            👤 {user.USERNAME}
          </div>
        )}

        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
}

const styles = {
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    background: "linear-gradient(90deg,#667eea,#764ba2)",
    color: "white"
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "20px"
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "15px"
  },
  hamburger: {
    position: "relative",
    cursor: "pointer"
  },
  dropdown: {
    position: "absolute",
    top: "35px",
    left: "0",
    background: "white",
    color: "black",
    padding: "20px",
    borderRadius: "10px",
    display: "flex",
    gap: "30px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.2)"
  },
  categoryBlock: {
    minWidth: "150px"
  },
  subCategory: {
    fontSize: "14px",
    marginTop: "5px",
    cursor: "pointer"
  },
  user: {
    fontWeight: "bold"
  }
};

export default Navbar;