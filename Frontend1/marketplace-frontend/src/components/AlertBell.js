import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function AlertBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    try {
      const res = await axios.get("http://localhost:5000/alerts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleClick = async (alert) => {
    try {
      await axios.put(
        `http://localhost:5000/alerts/${alert.ALERT_ID}/read`,
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

  const unreadCount = alerts.filter(a => Number(a.IS_READ) === 0).length;

  return (
    <div style={{ position: "relative" }}>
      
      {/* 🔔 Bell Icon */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          width: "42px",
          height: "42px"
        }}
      >
        🔔

        {unreadCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              backgroundColor: "#ff3b3b",
              color: "white",
              borderRadius: "50%",
              minWidth: "20px",
              height: "20px",
              padding: "0 6px",
              fontSize: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px white",
              zIndex: 9999
            }}
          >
            {unreadCount}
          </div>
        )}
      </div>

      {/* 🔔 Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "45px",
            width: "320px",
            background: "white",
            color: "black",
            borderRadius: "12px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            padding: "12px",
            maxHeight: "400px",
            overflowY: "auto",
            zIndex: 1000
          }}
        >
          {alerts.length === 0 ? (
            <p>No alerts</p>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.ALERT_ID}
                onClick={() => handleClick(alert)}
                style={{
                  padding: "12px",
                  marginBottom: "10px",
                  borderRadius: "10px",
                  background:
                    Number(alert.IS_READ) === 0 ? "#f5f5f5" : "#eaeaea",
                  cursor: "pointer",
                  transition: "0.2s"
                }}
              >
                <strong>{alert.TITLE}</strong>
                <p style={{ margin: 0 }}>₹{alert.PRICE}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default AlertBell;