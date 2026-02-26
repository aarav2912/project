import React, { useState } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SellItem from "./pages/SellItem";
import CategoryPage from "./pages/CategoryPage";
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={darkMode ? "dark" : "light"}>
      <Router>
        <div className="toggle-mode" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
        </div>

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/sell" element={
            <ProtectedRoute>
              <SellItem />
            </ProtectedRoute>
          } />
          <Route path="/category/:id" element={
            <ProtectedRoute>
              <CategoryPage/>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </div>
  );
}

export default App;