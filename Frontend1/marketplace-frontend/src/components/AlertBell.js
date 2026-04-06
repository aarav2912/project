import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../config/api";

function AlertBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const fetchAlerts = useCallback(async () => {
    if (!token) {
      setAlerts([]);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
    }
  }, [token]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleClick = async (alert) => {
    try {
      await axios.put(
        `${API_BASE_URL}/alerts/${alert.ALERT_ID}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOpen(false);
      fetchAlerts();
      navigate(`/items/${alert.ITEM_ID}`);
    } catch (err) {
      console.log(err);
    }
  };

  const unreadCount = alerts.filter((a) => Number(a.IS_READ) === 0).length;

  return (
    <div className="nav-menu" style={{ position: "relative" }}>
      <button
        type="button"
        className="nav-chip"
        onClick={() => setOpen((value) => !value)}
      >
        Alerts
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {open && (
        <div
          className="notification-panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.85rem)",
            width: "min(340px, calc(100vw - 1.5rem))",
            padding: "0.9rem",
            maxHeight: "420px",
            overflowY: "auto",
          }}
        >
          {alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: "1rem" }}>
              No alerts yet.
            </div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.ALERT_ID}
                type="button"
                onClick={() => handleClick(alert)}
                className="nav-dropdown__section"
                style={{
                  width: "100%",
                  textAlign: "left",
                  marginBottom: "0.7rem",
                  cursor: "pointer",
                }}
              >
                <p className="nav-dropdown__title" style={{ marginBottom: "0.35rem" }}>
                  {alert.TITLE}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  Rs. {alert.PRICE}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default AlertBell;
