require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const { connectDB, getConnection } = require("./database/connection");
const authMiddleware=require("./Middleware/authMiddleware");
console.log(authMiddleware);

const app = express();
app.use(cors());
app.use(express.json());


app.post("/register", async (req, res) => {
  try {
    const connection = getConnection();
    const { username, email, password } = req.body;

    const checkUser = await connection.execute(
      `SELECT * FROM users WHERE email = :email OR username = :username`,
      { email, username }
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      `INSERT INTO users (username, email, password)
       VALUES (:username, :email, :password)`,
      { username, email, password: hashedPassword },
      { autoCommit: true }
    );

    res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const connection = getConnection();
    const { email, password } = req.body;

    const result = await connection.execute(
      `SELECT user_id, username, password, role
       FROM users WHERE email = :email`,
      { email }
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User is not registered.Please register" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.PASSWORD);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        user_id: user.USER_ID,
        username: user.USERNAME,
        role: user.ROLE,
      },
      process.env.JWT_SECRETKEY,
      { expiresIn: "1d" }
    );

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: `Welcome ${req.user.username}`,
    user: req.user
  });
});

app.get("/logout",authMiddleware,(req,res)=>{
  res.json({
    message:`Logging out ${req.user.username}`,
    user:req.user
  });
})

app.post("/forgot-password", async (req, res) => {
  try {
    const connection = getConnection();
    const { email } = req.body;

    const userResult = await connection.execute(
      `SELECT user_id FROM users WHERE email = :email`,
      { email }
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: "Email not found" });
    }

    const user = userResult.rows[0];

const rawToken = crypto.randomBytes(32).toString("hex");

// Step 2: hash it for DB storage
const resetToken = crypto.createHash("sha256")
  .update(rawToken)
  .digest("hex");

    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1); // 1 hour expiry

    await connection.execute(
      `INSERT INTO password_resets (user_id, reset_token, expires_at)
       VALUES (:user_id, :reset_token, :expires_at)`,
      {
        user_id: user.USER_ID,
        reset_token: resetToken,
        expires_at: expiry
      },
      { autoCommit: true }
    );

    // Configure mail (Gmail example)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.APP_EMAIL,
        pass: process.env.APP_PASSWORD
      }
    });

    const resetLink = `http://localhost:3000/reset-password?token=${rawToken}`;

    await transporter.sendMail({
      from: process.env.APP_EMAIL,
      to: email,
      subject: "Password Reset",
      html: `<p>Click below to reset password:</p>
             <a href="${resetLink}">${resetLink}</a>`
    });

    res.json({ message: "Reset link sent to email" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const connection = getConnection();
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash("sha256")
  .update(token)
  .digest("hex");

    const result = await connection.execute(
      `SELECT user_id, expires_at 
       FROM password_resets 
       WHERE reset_token = :token`,
      { token:hashedToken }
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const record = result.rows[0];

    if (new Date(record.EXPIRES_AT) < new Date()) {
      return res.status(400).json({ message: "Token expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = :password WHERE user_id = :user_id`,
      {
        password: hashedPassword,
        user_id: record.USER_ID
      },
      { autoCommit: true }
    );

    // Delete token after use
    await connection.execute(
      `DELETE FROM password_resets WHERE reset_token = :token`,
      { token : hashedToken},
      { autoCommit: true }
    );

    res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

async function startServer() {
  await connectDB();

  app.listen(5000, () => {
    console.log("Server running on port 5000");
  });
}

startServer();