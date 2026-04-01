import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function Success() {
  const navigate = useNavigate();

  return (
    <div className="content-card" style={{ padding: "1.25rem" }}>
      <motion.div
        className="hero-panel"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ textAlign: "center" }}
      >
        <div className="hero-kicker" style={{ margin: "0 auto" }}>
          Payment complete
        </div>
        <h1 className="hero-title" style={{ fontSize: "2.6rem" }}>
          Order successful
        </h1>
        <p className="hero-copy" style={{ marginLeft: "auto", marginRight: "auto" }}>
          Your order has been placed and the experience stays visually consistent right through the checkout finish.
        </p>

        <div className="button-row" style={{ justifyContent: "center", marginTop: "1.25rem" }}>
          <button className="primary-btn" type="button" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default Success;
