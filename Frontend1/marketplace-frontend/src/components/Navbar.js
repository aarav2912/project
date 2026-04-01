import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AlertBell from "./AlertBell";

function Navbar({ authenticated = true }) {
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    let mounted = true;

    axios
      .get("http://localhost:5000/categories/tree")
      .then((res) => {
        if (mounted) {
          setCategories(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories([]);
        }
      });

    if (authenticated && token) {
      axios
        .get("http://localhost:5000/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          if (mounted) {
            setUser(res.data);
          }
        })
        .catch(() => {
          if (mounted) {
            setUser(null);
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [authenticated, token]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const openCategory = (categoryId) => {
    setShowMenu(false);
    navigate(`/category/${categoryId}`);
  };

  return (
    <header className="shell-nav">
      <div className="shell-nav__inner">
        <button
          className="brand"
          type="button"
          onClick={() => navigate(authenticated ? "/dashboard" : "/")}
        >
          <span className="brand__mark" aria-hidden="true" />
          <span>MyMarket</span>
        </button>

        <div className="shell-nav__actions">
          <div className="nav-menu">
            <button
              className="nav-chip"
              type="button"
              onClick={() => setShowMenu((value) => !value)}
            >
              Categories
            </button>

            {showMenu && (
              <div className="nav-dropdown">
                {categories.length === 0 ? (
                  <div className="nav-dropdown__section">
                    <p className="nav-dropdown__title">Categories</p>
                    <p className="muted" style={{ margin: 0 }}>
                      No category data is available yet.
                    </p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.CATEGORY_ID} className="nav-dropdown__section">
                      <p className="nav-dropdown__title">{cat.CATEGORY_NAME}</p>
                      {(cat.children || []).map((child) => (
                        <button
                          key={child.CATEGORY_ID}
                          className="nav-dropdown__item"
                          type="button"
                          onClick={() => openCategory(child.CATEGORY_ID)}
                        >
                          {child.CATEGORY_NAME}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {authenticated ? (
            <>
              <button className="nav-chip" type="button" onClick={() => navigate("/sell")}>
                Sell Item
              </button>

              <button className="nav-chip" type="button" onClick={() => navigate("/cart")}>
                Cart
              </button>

              <button className="nav-chip" type="button" onClick={() => navigate("/orders")}>
                Orders
              </button>

              <button className="nav-chip" type="button" onClick={() => navigate("/interests")}>
                Interests
              </button>

              <AlertBell />

              {user && (
                <div className="nav-chip" style={{ cursor: "default" }}>
                  {user.USERNAME}
                </div>
              )}

              <button className="nav-chip" type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="nav-chip" type="button" onClick={() => navigate("/")}>
                Login
              </button>

              <button className="nav-chip" type="button" onClick={() => navigate("/register")}>
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
