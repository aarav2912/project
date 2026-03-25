import { useNavigate } from "react-router-dom";

function Success() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>✅ Payment Successful</h1>
      <p>Your order has been placed!</p>

      <button onClick={() => navigate("/dashboard")}>
        Go to Dashboard
      </button>
    </div>
  );
}

export default Success