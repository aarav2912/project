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
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER,oracledb.CLOB];

const { connectDB, getConnection } = require("./database/connection");
const authMiddleware=require("./Middleware/authMiddleware");
console.log(authMiddleware);

const app = express();
app.use(cors());
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.user_id;

    const connection = getConnection();

    try {
      const userResult = await connection.execute(
        `SELECT email FROM users WHERE user_id = :user_id`,
        { user_id: userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const userEmail = userResult.rows[0]?.EMAIL;
      const itemsResult = await connection.execute(
        `
        SELECT i.title, o.quantity, o.total_amount
        FROM orders o
        JOIN items i ON o.item_id = i.item_id
        WHERE o.user_id = :user_id
          AND o.status = 'PAYMENT_PENDING'
        `,
        { user_id: userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.execute(
        `
        UPDATE orders
        SET status = 'ORDERED'
        WHERE user_id = :user_id
          AND status = 'PAYMENT_PENDING'
        `,
        { user_id: userId },
        { autoCommit: true }
      );

      await connection.execute(
        `
        DELETE FROM cart
        WHERE user_id = :user_id
        `,
        { user_id: userId },
        { autoCommit: true }
      );

      await connection.execute(
        `
        INSERT INTO payments (order_id, stripe_session_id, amount, payment_status)
        VALUES (
          (SELECT MAX(order_id) FROM orders WHERE user_id = :user_id),
          :session_id,
          :amount,
          'SUCCESS'
        )
        `,
        {
          user_id: userId,
          session_id: session.id,
          amount: session.amount_total / 100
        },
        { autoCommit: true }
      );

      let itemsHtml = "";

      itemsResult.rows.forEach(item => {
        itemsHtml += `
          <tr>
            <td>${item.TITLE}</td>
            <td>${item.QUANTITY}</td>
            <td>₹${item.TOTAL_AMOUNT}</td>
          </tr>
        `;
      });
      if (userEmail) {
        await emailQueue.add({
          to: userEmail,
          subject: "🧾 Order Receipt - Payment Successful",
          html: `
            <h2>Thank you for your purchase 🎉</h2>

            <table border="1" cellpadding="10" cellspacing="0">
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
              ${itemsHtml}
            </table>

            <p><b>Total Paid:</b> ₹${session.amount_total / 100}</p>

            <p>Your order is now being processed 🚚</p>
          `
        });
      }

      console.log("Payment processed + email queued");

    } catch (err) {
      console.error("Webhook processing error:", err);
    }
  }

  res.json({ received: true });
});
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

const ADMIN_ROLE = "ADMIN";

const isAdmin = (user) => String(user?.role || "").toUpperCase() === ADMIN_ROLE;

const queueEmail = (to, subject, html) => emailQueue.add({ to, subject, html });

async function ensureGrievanceSchema() {
  const connection = getConnection();

  const columnsResult = await connection.execute(
    `
    SELECT column_name
    FROM user_tab_columns
    WHERE table_name = 'GRIEVANCES'
    `,
    {},
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const existingColumns = new Set(
    columnsResult.rows.map((row) => String(row.COLUMN_NAME || row.column_name).toUpperCase())
  );

  if (!existingColumns.has("ADMIN_REPLY")) {
    await connection.execute(
      `ALTER TABLE grievances ADD (admin_reply CLOB)`,
      {},
      { autoCommit: true }
    );
  }

  if (!existingColumns.has("REPLIED_AT")) {
    await connection.execute(
      `ALTER TABLE grievances ADD (replied_at DATE)`,
      {},
      { autoCommit: true }
    );
  }

  if (!existingColumns.has("REPLIED_BY")) {
    await connection.execute(
      `ALTER TABLE grievances ADD (replied_by NUMBER)`,
      {},
      { autoCommit: true }
    );
  }
}

const formatGrievanceRowsWithImages = async (connection, grievances) => {
  if (!grievances.length) {
    return [];
  }

  const ids = grievances.map((grievance) => grievance.GRIEVANCE_ID);
  const bindNames = ids.map((_, index) => `:id${index}`);

  const imagesResult = await connection.execute(
    `
    SELECT grievance_id, image_url
    FROM grievance_images
    WHERE grievance_id IN (${bindNames.join(", ")})
    ORDER BY uploaded_at ASC
    `,
    ids.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {}),
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const imagesByGrievance = imagesResult.rows.reduce((acc, row) => {
    if (!acc[row.GRIEVANCE_ID]) {
      acc[row.GRIEVANCE_ID] = [];
    }

    acc[row.GRIEVANCE_ID].push(row.IMAGE_URL);
    return acc;
  }, {});

  return grievances.map((grievance) => ({
    ...grievance,
    IMAGES: imagesByGrievance[grievance.GRIEVANCE_ID] || []
  }));
};


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

app.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

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

  try {
    await connection.execute(
      `
      CREATE TABLE grievance_images (
          grievance_image_id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          grievance_id       NUMBER NOT NULL,
          image_url          VARCHAR2(500) NOT NULL,
          uploaded_at        DATE DEFAULT SYSDATE,

          CONSTRAINT fk_grievance_image_grievance
              FOREIGN KEY (grievance_id)
              REFERENCES grievances(grievance_id)
              ON DELETE CASCADE
      )
      `,
      {},
      { autoCommit: true }
    );
  } catch (tableErr) {
    if (tableErr?.errorNum !== 955) {
      throw tableErr;
    }
  }
}

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

      if (user.KEYWORD) {
        const normalize = (text) =>
        text.toLowerCase().replace(/\s+/g, "");
        
        const normalizedTitle = normalize(title);
        const normalizedKeyword = normalize(user.KEYWORD);
        
        if (!normalizedTitle.includes(normalizedKeyword)) {
          continue;
        }
      }

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

    const imagesResult = await connection.execute(
      `
      SELECT image_url
      FROM item_images
      WHERE item_id = :id
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

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

app.put("/cart", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const { item_id, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    await connection.execute(
      `
      UPDATE cart
      SET quantity = :quantity
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id,
        quantity
      },
      { autoCommit: true }
    );

    res.json({ message: "Cart updated" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/cart/:item_id", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    await connection.execute(
      `
      DELETE FROM cart
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id: req.params.item_id
      },
      { autoCommit: true }
    );

    res.json({ message: "Item removed from cart" });

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

app.post("/grievances", authMiddleware, upload.array("images", 5), async (req, res) => {
  try {
    const connection = getConnection();
    const { order_id, item_id, problem_desc } = req.body;

    if (!problem_desc || !problem_desc.trim()) {
      return res.status(400).json({ message: "Problem description is required" });
    }

    const result = await connection.execute(
      `
      INSERT INTO grievances (user_id, order_id, item_id, problem_desc)
      VALUES (:user_id, :order_id, :item_id, :problem_desc)
      RETURNING grievance_id INTO :grievance_id
      `,
      {
        user_id: req.user.user_id,
        order_id: order_id ? parseInt(order_id) : null,
        item_id: item_id ? parseInt(item_id) : null,
        problem_desc: problem_desc.trim(),
        grievance_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    const grievanceId = result.outBinds.grievance_id[0];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = `/uploads/${file.filename}`;

        await connection.execute(
          `
          INSERT INTO grievance_images (grievance_id, image_url)
          VALUES (:grievance_id, :image_url)
          `,
          {
            grievance_id: grievanceId,
            image_url: imageUrl
          },
          { autoCommit: true }
        );
      }
    }

    res.status(201).json({
      message: "Grievance submitted successfully",
      grievance_id: grievanceId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/grievances/mine", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    const result = await connection.execute(
      `
      SELECT g.grievance_id,
             g.order_id,
             g.item_id,
             DBMS_LOB.SUBSTR(g.problem_desc, 4000, 1) AS problem_desc,
             g.problem_status,
             DBMS_LOB.SUBSTR(g.admin_reply, 4000, 1) AS admin_reply,
             TO_CHAR(g.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
             i.title AS item_title
      FROM grievances g
      LEFT JOIN items i ON g.item_id = i.item_id
      WHERE g.user_id = :user_id
      ORDER BY g.created_at DESC
      `,
      { user_id: req.user.user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rowsWithImages = await formatGrievanceRowsWithImages(connection, result.rows);

    res.json(rowsWithImages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/admin/grievances", authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const connection = getConnection();

    const result = await connection.execute(
      `
      SELECT g.grievance_id,
             g.user_id,
             u.username,
             u.email,
             g.order_id,
             g.item_id,
             DBMS_LOB.SUBSTR(g.problem_desc, 4000, 1) AS problem_desc,
             g.problem_status,
             DBMS_LOB.SUBSTR(g.admin_reply, 4000, 1) AS admin_reply,
             TO_CHAR(g.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
             i.title AS item_title
      FROM grievances g
      JOIN users u ON g.user_id = u.user_id
      LEFT JOIN items i ON g.item_id = i.item_id
      ORDER BY g.created_at DESC
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rowsWithImages = await formatGrievanceRowsWithImages(connection, result.rows);

    res.json(rowsWithImages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/admin/grievances/:id/reply", authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const connection = getConnection();
    const grievanceId = parseInt(req.params.id);
    const { reply_text } = req.body;

    if (!reply_text || !reply_text.trim()) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const grievanceResult = await connection.execute(
      `
      SELECT g.grievance_id,
             DBMS_LOB.SUBSTR(g.problem_desc, 4000, 1) AS problem_desc,
             u.email,
             u.username
      FROM grievances g
      JOIN users u ON g.user_id = u.user_id
      WHERE g.grievance_id = :id
      `,
      { id: grievanceId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (grievanceResult.rows.length === 0) {
      return res.status(404).json({ message: "Grievance not found" });
    }

    const grievance = grievanceResult.rows[0];

    await connection.execute(
      `
      UPDATE grievances
      SET admin_reply = :reply_text,
          problem_status = 'RESOLVED',
          replied_by = :replied_by
      WHERE grievance_id = :id
      `,
      {
        id: grievanceId,
        reply_text: reply_text.trim(),
        replied_by: req.user.user_id
      },
      { autoCommit: true }
    );

    try {
      await queueEmail(
        grievance.EMAIL,
        `Grievance reply #${grievanceId}`,
        `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Your grievance has been answered</h2>
            <p>Hi ${grievance.USERNAME || ""},</p>
            <p>We reviewed the issue you raised and replied below:</p>
            <blockquote style="padding: 12px 16px; background: #f5f7fb; border-left: 4px solid #6d28d9;">
              ${reply_text.trim().replace(/\n/g, "<br />")}
            </blockquote>
            <p><strong>Your grievance:</strong></p>
            <p>${String(grievance.PROBLEM_DESC || "").replace(/\n/g, "<br />")}</p>
            <p>You can log in to the app to see this marked as resolved.</p>
          </div>
        `
      );
    } catch (emailErr) {
      console.error("Failed to queue grievance email:", emailErr);
    }

    res.json({
      message: "Reply sent successfully",
      grievance_id: grievanceId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/orders", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    const result = await connection.execute(
      `
      SELECT o.order_id,
             o.status,
             o.total_amount,
             o.order_date,
             i.title,
             (SELECT image_url FROM item_images 
              WHERE item_id = i.item_id FETCH FIRST 1 ROWS ONLY) AS image_url
      FROM orders o
      JOIN items i ON o.item_id = i.item_id
      WHERE o.user_id = :user_id
      ORDER BY o.order_date DESC
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

app.post("/create-checkout-session", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();

    const cartItems = await connection.execute(
      `
      SELECT c.item_id, c.quantity, i.title, i.price
      FROM cart c
      JOIN items i ON c.item_id = i.item_id
      WHERE c.user_id = :user_id
      `,
      { user_id: req.user.user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (cartItems.rows.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalAmount = 0;

    for (const item of cartItems.rows) {
      const amount = item.PRICE * item.QUANTITY;
      totalAmount += amount;

      await connection.execute(
        `
        INSERT INTO orders (user_id, item_id, quantity, total_amount)
        VALUES (:user_id, :item_id, :quantity, :amount)
        `,
        {
          user_id: req.user.user_id,
          item_id: item.ITEM_ID,
          quantity: item.QUANTITY,
          amount
        },
        { autoCommit: true }
      );
    }

    const lineItems = cartItems.rows.map(item => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.TITLE
        },
        unit_amount: item.PRICE * 100 // paise
      },
      quantity: item.QUANTITY
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cart",
      metadata: {
        user_id: req.user.user_id
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Stripe error" });
  }
});





async function startServer() {
  await connectDB();
  await ensureGrievanceSchema();

  app.listen(5000, () => {
    console.log("Server running on port 5000");
  });
}

startServer();
