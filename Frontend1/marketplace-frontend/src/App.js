import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SellItem from "./pages/SellItem";
import CategoryPage from "./pages/CategoryPage";
import ProductPage from "./pages/ProductPage";
import Cart from "./pages/Cart";
import Interests from "./pages/Interests";
import Orders from "./pages/Orders";
import Success from "./pages/Success";
import "./App.css";

const THEME_KEY = "marketplace-theme";

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const appShellClass = useMemo(() => `app-shell theme-${theme}`, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const withProtectedLayout = (page) => (
    <ProtectedRoute>
      <AppLayout authenticated>{page}</AppLayout>
    </ProtectedRoute>
  );

  const withPublicLayout = (page) => <AppLayout authenticated={false}>{page}</AppLayout>;

  return (
    <div className={appShellClass}>
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        <span className="theme-toggle__dot" aria-hidden="true" />
        <span className="theme-toggle__label">
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </span>
      </button>

      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={withProtectedLayout(<Dashboard />)} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/sell" element={withProtectedLayout(<SellItem />)} />
          <Route path="/category/:id" element={withProtectedLayout(<CategoryPage />)} />
          <Route path="/product/:id" element={withPublicLayout(<ProductPage />)} />
          <Route path="/cart" element={withProtectedLayout(<Cart />)} />
          <Route path="/interests" element={withProtectedLayout(<Interests />)} />
          <Route path="/items/:id" element={withProtectedLayout(<ProductPage />)} />
          <Route path="/orders" element={withProtectedLayout(<Orders />)} />
          <Route path="/success" element={withPublicLayout(<Success />)} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
