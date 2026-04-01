import React from "react";
import { motion } from "framer-motion";
import Navbar from "./Navbar";

function AppLayout({ children, authenticated = true }) {
  return (
    <div className="app-layout">
      <div className="layout-bg" aria-hidden="true">
        <span className="layout-orb layout-orb--one" />
        <span className="layout-orb layout-orb--two" />
      </div>

      <Navbar authenticated={authenticated} />

      <motion.main
        className="page-shell"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {children}
      </motion.main>
    </div>
  );
}

export default AppLayout;
