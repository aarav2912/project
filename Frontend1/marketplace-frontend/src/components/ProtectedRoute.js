import React from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const decoded = jwtDecode(token);
      const role = String(decoded.role || "").toUpperCase();

      if (!allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" />;
      }
    } catch (err) {
      localStorage.removeItem("token");
      return <Navigate to="/" />;
    }
  }

  return children;
}

export default ProtectedRoute;
