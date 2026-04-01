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
      .get("http://localhost:5000/categories")
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

  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

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
          onClick={() => navigate(authenticated ? (isAdmin ? "/admin/grievances" : "/dashboard") : "/")}
        >
          <span className="brand__mark" aria-hidden="true" />
          <span>MyMarket</span>
        </button>

        <div className="shell-nav__actions">
          {authenticated ? (
            isAdmin ? (
              <>
                <button className="nav-chip is-active" type="button" onClick={() => navigate("/admin/grievances")}>
                  Admin Inbox
                </button>

                <button className="nav-chip" type="button" onClick={logout}>
                  Logout
                </button>
                {user && (
                  <div className="nav-chip" style={{ cursor: "default" }}>
                    {user.username}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="nav-menu">
                  <button
                    className="nav-chip"
                    type="button"
                    onClick={() => setShowMenu((value) => !value)}
                  >
                    Categories
                  </button>

                  {showMenu && (
                    <div className="nav-dropdown" style={{ minWidth: "260px", maxHeight: "420px", overflowY: "auto" }}>
                      {categories.length === 0 ? (
                        <div className="nav-dropdown__section">
                          <p className="nav-dropdown__title">Categories</p>
                          <p className="muted" style={{ margin: 0 }}>
                            No category data is available yet.
                          </p>
                        </div>
                      ) : (
                        categories.map((cat) => (
                          <button
                            key={cat.CATEGORY_ID}
                            className="nav-dropdown__item nav-dropdown__section"
                            type="button"
                            onClick={() => openCategory(cat.CATEGORY_ID)}
                            style={{ width: "100%", textAlign: "left", marginBottom: "0.5rem" }}
                          >
                            <p className="nav-dropdown__title" style={{ marginBottom: 0 }}>
                              {cat.CATEGORY_NAME}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

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

                <button className="nav-chip" type="button" onClick={() => navigate("/grievances")}>
                  Grievances
                </button>

                <AlertBell />

                {user && (
                  <div className="nav-chip" style={{ cursor: "default" }}>
                    {user.username}
                  </div>
                )}

                <button className="nav-chip" type="button" onClick={logout}>
                  Logout
                </button>
              </>
            )
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
