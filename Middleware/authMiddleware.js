require("dotenv").config();
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const { getConnection } = require("../database/connection");

function normalizeUser(user) {
  if (!user) return null;

  return {
    user_id: user.user_id ?? user.USER_ID ?? null,
    username: user.username ?? user.USERNAME ?? null,
    email: user.email ?? user.EMAIL ?? null,
    role: user.role ?? user.ROLE ?? null,
  };
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);

    req.user = normalizeUser(decoded);

    try {
      const connection = getConnection();
      if (connection && decoded?.user_id) {
        const result = await connection.execute(
          `
          SELECT user_id, username, email, role
          FROM users
          WHERE user_id = :user_id
          `,
          { user_id: decoded.user_id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
          req.user = normalizeUser(result.rows[0]);
        }
      }
    } catch (dbErr) {
      console.error("Auth role refresh failed:", dbErr);
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports=authMiddleware;
