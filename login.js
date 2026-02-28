require("dotenv").config();
const express = require("express");
const multer = require("multer");
const emailQueue = require("./queues/emailQueue");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const oracledb = require("oracledb");
oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER,oracledb.CLOB];

const { connectDB, getConnection } = require("./database/connection");
const authMiddleware=require("./Middleware/authMiddleware");
console.log(authMiddleware);

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName =Date.now()+ "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });


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

app.post("/items", authMiddleware, upload.array("images", 5), async (req, res) => {
  try {
    const connection = getConnection();

    const { title, description } = req.body;

    const numericPrice = parseFloat(req.body.price);
    const numericQuantity = parseInt(req.body.quantity || 1);
    const numericCategoryId = parseInt(req.body.category_id);

    if (!title || !numericPrice || !numericCategoryId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 🔹 Insert item
    const result = await connection.execute(
      `INSERT INTO items 
       (seller_user_id, category_id, title, description, price, quantity)
       VALUES (:seller_user_id, :category_id, :title, :description, :price, :quantity)
       RETURNING item_id INTO :item_id`,
      {
        seller_user_id: req.user.user_id,
        category_id: numericCategoryId,
        title,
        description,
        price: numericPrice,
        quantity: numericQuantity,
        item_id: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER }
      },
      { autoCommit: true }
    );

    const itemId = result.outBinds.item_id[0];

    // 🔹 Insert images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = `/uploads/${file.filename}`;

        await connection.execute(
          `INSERT INTO item_images (item_id, image_url)
           VALUES (:item_id, :image_url)`,
          { item_id: itemId, image_url: imageUrl },
          { autoCommit: true }
        );
      }
    }

    // 🔎 Find interested users (category + price range)
    const interestedUsers = await connection.execute(
      `
      SELECT ui.user_id, u.email, ui.keyword
      FROM user_interests ui
      JOIN users u ON ui.user_id = u.user_id
      WHERE ui.category_id = :category_id
        AND :price BETWEEN ui.min_price AND ui.max_price
      `,
      {
        category_id: numericCategoryId,
        price: numericPrice
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    for (const user of interestedUsers.rows) {

      // 🔍 Keyword filtering (if keyword exists)
      if (user.KEYWORD) {
        const lowerTitle = title.toLowerCase();
        const lowerKeyword = user.KEYWORD.toLowerCase();

        if (!lowerTitle.includes(lowerKeyword)) {
          continue;
        }
      }

      // 🔔 Insert alert
      await connection.execute(
        `
        INSERT INTO alerts (user_id, category_id, item_id, is_read)
        VALUES (:user_id, :category_id, :item_id, 0)
        `,
        {
          user_id: user.USER_ID,
          category_id: numericCategoryId,
          item_id: itemId
        },
        { autoCommit: true }
      );

      // 📧 Send email asynchronously via Redis queue
      await emailQueue.add({
        to: user.EMAIL,
        subject: "New Item Matching Your Interest 🎯",
        html: `
          <h3>New Item Found!</h3>
          <p><b>${title}</b></p>
          <p>Price: ₹${numericPrice}</p>
          <p>Login to check it out!</p>
        `
      });
    }

    res.status(201).json({
      message: "Item listed successfully",
      item_id: itemId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const connection = getConnection();

    const result = await connection.execute(
      `SELECT category_id, category_name FROM categories`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/categories/:id/items", authMiddleware,async (req, res) => {
  try {
    const connection = getConnection();
    const categoryId = parseInt(req.params.id);

    const result = await connection.execute(
      `
      SELECT i.item_id,
             i.title,
             i.price,
             i.created_at,
             (SELECT image_url
              FROM item_images
              WHERE item_id = i.item_id
              FETCH FIRST 1 ROWS ONLY) AS image_url
      FROM items i
      WHERE i.category_id = :category_id
        AND i.status = 'AVAILABLE'
      ORDER BY i.created_at DESC
      `,
      { category_id: categoryId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/items/:id", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const itemId = parseInt(req.params.id);

    // 1️⃣ Get item details
    const itemResult = await connection.execute(
      `
      SELECT i.item_id,
             i.title,
             i.price,
             i.description,
             i.quantity,
             i.avg_rating,
             i.review_count,
             u.username AS seller_name,
             TO_CHAR(i.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
      FROM items i
      JOIN users u ON i.seller_user_id = u.user_id
      WHERE i.item_id = :id
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    // 2️⃣ Get all images
    const imagesResult = await connection.execute(
      `
      SELECT image_url
      FROM item_images
      WHERE item_id = :id
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 3️⃣ Get reviews
    const reviewsResult = await connection.execute(
      `
      SELECT r.rating,
             r.review_text,
             TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
             u.username
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.item_id = :id
      ORDER BY r.created_at DESC
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
  item: { ...itemResult.rows[0] },
  images: imagesResult.rows.map(r => ({ ...r })),
  reviews: reviewsResult.rows.map(r => ({ ...r }))
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/cart", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const { item_id, quantity } = req.body;

    await connection.execute(
      `
      MERGE INTO cart c
      USING dual
      ON (c.user_id = :user_id AND c.item_id = :item_id)
      WHEN MATCHED THEN
        UPDATE SET quantity = c.quantity + :quantity
      WHEN NOT MATCHED THEN
        INSERT (user_id, item_id, quantity)
        VALUES (:user_id, :item_id, :quantity)
      `,
      {
        user_id: req.user.user_id,
        item_id,
        quantity
      },
      { autoCommit: true }
    );

    res.json({ message: "Added to cart" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/cart", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    const result = await connection.execute(
      `
      SELECT c.item_id,
             c.quantity,
             i.title,
             i.price,
             (SELECT image_url
              FROM item_images
              WHERE item_id = i.item_id
              FETCH FIRST 1 ROWS ONLY) AS image_url
      FROM cart c
      JOIN items i ON c.item_id = i.item_id
      WHERE c.user_id = :user_id
      `,
      { user_id: req.user.user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/items/:id/review", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const itemId = parseInt(req.params.id);
    const { rating, review_text } = req.body;

    // 1️⃣ Insert review
    await connection.execute(
      `
      INSERT INTO reviews (user_id, item_id, rating, review_text)
      VALUES (:user_id, :item_id, :rating, :review_text)
      `,
      {
        user_id: req.user.user_id,
        item_id: itemId,
        rating,
        review_text
      },
      { autoCommit: true }
    );

    // 2️⃣ Recalculate avg rating
    const ratingResult = await connection.execute(
      `
      SELECT ROUND(AVG(rating),1) AS avg_rating,
             COUNT(*) AS review_count
      FROM reviews
      WHERE item_id = :id
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const { AVG_RATING, REVIEW_COUNT } = ratingResult.rows[0];

    // 3️⃣ Update item table
    await connection.execute(
      `
      UPDATE items
      SET avg_rating = :avg_rating,
          review_count = :review_count
      WHERE item_id = :id
      `,
      {
        avg_rating: AVG_RATING,
        review_count: REVIEW_COUNT,
        id: itemId
      },
      { autoCommit: true }
    );

    res.json({
      message: "Review added successfully",
      avg_rating: AVG_RATING,
      review_count: REVIEW_COUNT
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/interests", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const { category_id, min_price, max_price, keyword } = req.body;

    await connection.execute(
      `
      INSERT INTO user_interests 
      (user_id, category_id, min_price, max_price, keyword)
      VALUES (:user_id, :category_id, :min_price, :max_price, :keyword)
      `,
      {
        user_id: req.user.user_id,
        category_id,
        min_price,
        max_price,
        keyword: keyword ? keyword.toLowerCase() : null
      },
      { autoCommit: true }
    );

    res.json({ message: "Interest saved successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/alerts", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    const result = await connection.execute(
      `
      SELECT a.alert_id,
             a.item_id,
             i.title,
             i.price,
             a.is_read,
             TO_CHAR(a.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
      FROM alerts a
      JOIN items i ON a.item_id = i.item_id
      WHERE a.user_id = :user_id
      ORDER BY a.created_at DESC
      `,
      { user_id: req.user.user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/alerts/:id/read", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const alertId = parseInt(req.params.id);

    await connection.execute(
      `
      UPDATE alerts
      SET is_read = 1
      WHERE alert_id = :alert_id
        AND user_id = :user_id
      `,
      {
        alert_id: alertId,
        user_id: req.user.user_id
      },
      { autoCommit: true }
    );

    res.json({ message: "Alert marked as read" });

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