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
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
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
const SHIPPING_COST_PER_ORDER = 45;
const PAYMENT_PLATFORM_RATE = 0.029;
const PAYMENT_PLATFORM_FIXED_FEE = 3;

const isAdmin = (user) => String(user?.role || "").toUpperCase() === ADMIN_ROLE;
const asNumber = (value) => Number(value || 0);

const queueEmail = (to, subject, html) => emailQueue.add({ to, subject, html });

async function ensureGrievanceSchema() {
  const connection = getConnection();

  await connection.execute(`
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE grievances ADD (admin_reply CLOB)';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -1430 THEN
          RAISE;
        END IF;
    END;
  `);

  await connection.execute(`
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE grievances ADD (replied_at DATE)';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -1430 THEN
          RAISE;
        END IF;
    END;
  `);

  await connection.execute(`
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE grievances ADD (replied_by NUMBER)';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -1430 THEN
          RAISE;
        END IF;
    END;
  `);
}

async function ensureNormalizedRolesSchema() {
  const connection = getConnection();

  await connection.execute(`
    BEGIN
      EXECUTE IMMEDIATE '
        CREATE TABLE roles (
          role_name VARCHAR2(20) PRIMARY KEY
        )
      ';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -955 THEN
          RAISE;
        END IF;
    END;
  `);

  await connection.execute(`
    BEGIN
      INSERT INTO roles (role_name)
      SELECT 'USER' FROM dual
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'USER');

      INSERT INTO roles (role_name)
      SELECT 'ADMIN' FROM dual
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'ADMIN');

      UPDATE users
      SET role = UPPER(role)
      WHERE role IS NOT NULL;

      UPDATE users
      SET role = 'USER'
      WHERE role IS NULL;

      COMMIT;
    END;
  `);

  await connection.execute(`
    BEGIN
      EXECUTE IMMEDIATE '
        ALTER TABLE users
        ADD CONSTRAINT fk_users_role
        FOREIGN KEY (role)
        REFERENCES roles(role_name)
      ';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -2275 THEN
          RAISE;
        END IF;
    END;
  `);
}

async function ensureDatabaseProgramUnits() {
  const connection = getConnection();

  await connection.execute(`
    CREATE OR REPLACE FUNCTION fn_item_avg_rating(p_item_id IN NUMBER)
    RETURN NUMBER
    IS
      v_avg NUMBER(2,1);
    BEGIN
      SELECT ROUND(NVL(AVG(rating), 0), 1)
      INTO v_avg
      FROM reviews
      WHERE item_id = p_item_id;

      RETURN v_avg;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN 0;
    END;
  `);

  await connection.execute(`
    CREATE OR REPLACE TRIGGER trg_grievances_defaults
    BEFORE INSERT ON grievances
    FOR EACH ROW
    BEGIN
      IF :NEW.created_at IS NULL THEN
        :NEW.created_at := SYSDATE;
      END IF;

      IF :NEW.problem_status IS NULL THEN
        :NEW.problem_status := 'UNRESOLVED';
      END IF;
    END;
  `);

  await connection.execute(`
    CREATE OR REPLACE PROCEDURE sp_reply_grievance(
      p_grievance_id   IN NUMBER,
      p_admin_user_id  IN NUMBER,
      p_admin_reply    IN CLOB
    )
    AS
    BEGIN
      UPDATE grievances
      SET admin_reply = p_admin_reply,
          replied_at = SYSDATE,
          replied_by = p_admin_user_id,
          problem_status = 'RESOLVED'
      WHERE grievance_id = p_grievance_id;
    END;
  `);
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
             i.quantity,
             i.created_at,
             (SELECT image_url
              FROM item_images
              WHERE item_id = i.item_id
              FETCH FIRST 1 ROWS ONLY) AS image_url
      FROM items i
      WHERE i.category_id = :category_id
        AND i.status = 'AVAILABLE'
        AND i.quantity > 0
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
             i.status AS item_status,
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
    const itemId = parseInt(req.body.item_id);
    const requestedQuantity = parseInt(req.body.quantity || 1);

    if (!Number.isInteger(itemId) || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      return res.status(400).json({ message: "Invalid cart quantity" });
    }

    const stockResult = await connection.execute(
      `
      SELECT i.quantity AS stock_quantity,
             i.status AS item_status
      FROM items i
      WHERE i.item_id = :item_id
      `,
      {
        item_id: itemId
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    const stockRow = stockResult.rows[0];
    const stockQuantity = asNumber(stockRow.STOCK_QUANTITY);
    const itemStatus = String(stockRow.ITEM_STATUS || "").toUpperCase();

    if (itemStatus !== "AVAILABLE" || stockQuantity <= 0) {
      return res.status(409).json({ message: "This item is not available any more" });
    }

    if (requestedQuantity > stockQuantity) {
      return res.status(409).json({
        message: `Only ${stockQuantity} item(s) left in stock`
      });
    }

    const stockUpdate = await connection.execute(
      `
      UPDATE items
      SET quantity = quantity - :quantity,
          status = CASE
            WHEN quantity - :quantity <= 0 THEN 'SOLD'
            ELSE 'AVAILABLE'
          END
      WHERE item_id = :item_id
        AND status = 'AVAILABLE'
        AND quantity >= :quantity
      `,
      {
        item_id: itemId,
        quantity: requestedQuantity
      },
      { autoCommit: false }
    );

    if (stockUpdate.rowsAffected === 0) {
      return res.status(409).json({ message: "This item is not available any more" });
    }

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
        item_id: itemId,
        quantity: requestedQuantity
      },
      { autoCommit: false }
    );

    await connection.commit();

    res.json({ message: "Added to cart" });

  } catch (err) {
    try {
      const connection = getConnection();
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    console.error(err);
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
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
             i.quantity AS stock_quantity,
             i.status AS item_status,
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
    const itemId = parseInt(req.body.item_id);
    const requestedQuantity = parseInt(req.body.quantity);

    if (!Number.isInteger(itemId) || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const stockResult = await connection.execute(
      `
      SELECT i.quantity AS stock_quantity,
             i.status AS item_status
      FROM items i
      WHERE i.item_id = :item_id
      `,
      { item_id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    const stockRow = stockResult.rows[0];
    const stockQuantity = asNumber(stockRow.STOCK_QUANTITY);
    const itemStatus = String(stockRow.ITEM_STATUS || "").toUpperCase();

    const existingCartResult = await connection.execute(
      `
      SELECT quantity
      FROM cart
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id: itemId
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingCartResult.rows.length === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const currentCartQuantity = asNumber(existingCartResult.rows[0].QUANTITY);
    const delta = requestedQuantity - currentCartQuantity;

    if (delta === 0) {
      return res.json({ message: "Cart updated" });
    }

    if (delta > 0 && (itemStatus !== "AVAILABLE" || stockQuantity < delta)) {
      return res.status(409).json({ message: "This item is not available any more" });
    }

    if (delta > 0) {
      const stockUpdate = await connection.execute(
        `
        UPDATE items
        SET quantity = quantity - :delta,
            status = CASE
              WHEN quantity - :delta <= 0 THEN 'SOLD'
              ELSE 'AVAILABLE'
            END
        WHERE item_id = :item_id
          AND status = 'AVAILABLE'
          AND quantity >= :delta
        `,
        {
          item_id: itemId,
          delta
        },
        { autoCommit: false }
      );

      if (stockUpdate.rowsAffected === 0) {
        return res.status(409).json({ message: "This item is not available any more" });
      }
    } else {
      const restoreAmount = Math.abs(delta);
      await connection.execute(
        `
        UPDATE items
        SET quantity = quantity + :restore_amount,
            status = 'AVAILABLE'
        WHERE item_id = :item_id
        `,
        {
          item_id: itemId,
          restore_amount: restoreAmount
        },
        { autoCommit: false }
      );
    }

    await connection.execute(
      `
      UPDATE cart
      SET quantity = :quantity
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id: itemId,
        quantity: requestedQuantity
      },
      { autoCommit: false }
    );

    await connection.commit();

    res.json({ message: "Cart updated" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/cart/:item_id", authMiddleware, async (req, res) => {
  try {
    const connection = getConnection();
    const itemId = parseInt(req.params.item_id);

    if (!Number.isInteger(itemId)) {
      return res.status(400).json({ message: "Invalid item" });
    }

    const cartResult = await connection.execute(
      `
      SELECT quantity
      FROM cart
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id: itemId
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (cartResult.rows.length === 0) {
      return res.json({ message: "Item removed from cart" });
    }

    const cartQuantity = asNumber(cartResult.rows[0].QUANTITY);

    await connection.execute(
      `
      UPDATE items
      SET quantity = quantity + :restore_amount,
          status = 'AVAILABLE'
      WHERE item_id = :item_id
      `,
      {
        item_id: itemId,
        restore_amount: cartQuantity
      },
      { autoCommit: false }
    );

    await connection.execute(
      `
      DELETE FROM cart
      WHERE user_id = :user_id AND item_id = :item_id
      `,
      {
        user_id: req.user.user_id,
        item_id: itemId
      },
      { autoCommit: false }
    );

    await connection.commit();

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

    const avgRatingResult = await connection.execute(
      `
      SELECT fn_item_avg_rating(:id) AS avg_rating
      FROM dual
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const reviewCountResult = await connection.execute(
      `
      SELECT COUNT(*) AS review_count
      FROM reviews
      WHERE item_id = :id
      `,
      { id: itemId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const { AVG_RATING } = avgRatingResult.rows[0];
    const { REVIEW_COUNT } = reviewCountResult.rows[0];

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
      BEGIN
        sp_reply_grievance(
          p_grievance_id => :id,
          p_admin_user_id => :replied_by,
          p_admin_reply => :reply_text
        );
      END;
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

app.get("/admin/analytics", authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const connection = getConnection();

    const summaryResult = await connection.execute(
      `
      SELECT
        (SELECT COUNT(*) FROM orders) AS total_orders,
        NVL((SELECT SUM(total_amount) FROM orders), 0) AS total_revenue,
        (SELECT COUNT(*) FROM items) AS total_items,
        NVL((SELECT SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) FROM items), 0) AS available_items,
        NVL((SELECT SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) FROM items), 0) AS sold_items
      FROM dual
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const popularItemsResult = await connection.execute(
      `
      SELECT
        i.item_id,
        i.title,
        COUNT(*) AS order_count,
        NVL(SUM(o.total_amount), 0) AS revenue
      FROM orders o
      JOIN items i ON o.item_id = i.item_id
      GROUP BY i.item_id, i.title
      ORDER BY COUNT(*) DESC, NVL(SUM(o.total_amount), 0) DESC
      FETCH FIRST 5 ROWS ONLY
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const categorySalesResult = await connection.execute(
      `
      SELECT
        c.category_id,
        c.category_name,
        COUNT(*) AS order_count,
        NVL(SUM(o.total_amount), 0) AS revenue
      FROM orders o
      JOIN items i ON o.item_id = i.item_id
      JOIN categories c ON i.category_id = c.category_id
      GROUP BY c.category_id, c.category_name
      ORDER BY COUNT(*) DESC, NVL(SUM(o.total_amount), 0) DESC
      FETCH FIRST 6 ROWS ONLY
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const monthlyResult = await connection.execute(
      `
      SELECT
        TO_CHAR(TRUNC(order_date, 'MM'), 'YYYY-MM') AS month_label,
        COUNT(*) AS order_count,
        NVL(SUM(total_amount), 0) AS revenue
      FROM orders
      GROUP BY TRUNC(order_date, 'MM')
      ORDER BY TRUNC(order_date, 'MM') DESC
      FETCH FIRST 6 ROWS ONLY
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const summaryRow = summaryResult.rows[0] || {};
    const totalOrders = asNumber(summaryRow.TOTAL_ORDERS);
    const totalRevenue = asNumber(summaryRow.TOTAL_REVENUE);
    const shippingLoss = totalOrders * SHIPPING_COST_PER_ORDER;
    const paymentFee = (totalRevenue * PAYMENT_PLATFORM_RATE) + (totalOrders * PAYMENT_PLATFORM_FIXED_FEE);
    const estimatedLoss = shippingLoss + paymentFee;
    const netProfit = totalRevenue - estimatedLoss;

    const popularItems = popularItemsResult.rows.map((row) => ({
      item_id: row.ITEM_ID,
      title: row.TITLE,
      order_count: asNumber(row.ORDER_COUNT),
      revenue: asNumber(row.REVENUE)
    }));

    const categorySales = categorySalesResult.rows.map((row) => ({
      category_id: row.CATEGORY_ID,
      category_name: row.CATEGORY_NAME,
      order_count: asNumber(row.ORDER_COUNT),
      revenue: asNumber(row.REVENUE)
    }));

    const monthly = monthlyResult.rows
      .map((row) => {
        const monthOrders = asNumber(row.ORDER_COUNT);
        const monthRevenue = asNumber(row.REVENUE);
        const monthShipping = monthOrders * SHIPPING_COST_PER_ORDER;
        const monthPaymentFee = (monthRevenue * PAYMENT_PLATFORM_RATE) + (monthOrders * PAYMENT_PLATFORM_FIXED_FEE);
        const monthLoss = monthShipping + monthPaymentFee;
        const monthNet = monthRevenue - monthLoss;

        return {
          month: row.MONTH_LABEL || "",
          order_count: monthOrders,
          revenue: monthRevenue,
          shipping_loss: monthShipping,
          payment_fee: monthPaymentFee,
          loss: monthLoss,
          net_profit: monthNet
        };
      })
      .reverse();

    res.json({
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_items: asNumber(summaryRow.TOTAL_ITEMS),
        available_items: asNumber(summaryRow.AVAILABLE_ITEMS),
        sold_items: asNumber(summaryRow.SOLD_ITEMS),
        shipping_loss: shippingLoss,
        payment_fee: paymentFee,
        estimated_loss: estimatedLoss,
        net_profit: netProfit,
        most_popular_item: popularItems[0] || null
      },
      popular_items: popularItems,
      category_sales: categorySales,
      monthly
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
             o.item_id,
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
      SELECT c.item_id, c.quantity, i.title, i.price, i.quantity AS stock_quantity, i.status AS item_status
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
        { autoCommit: false }
      );
    }

    await connection.commit();

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
      success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/success`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/cart`,
      metadata: {
        user_id: req.user.user_id
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    try {
      const connection = getConnection();
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

    console.error(err);
    res.status(err.statusCode || 500).json({
      message: err.statusCode === 409 ? err.message : "Stripe error"
    });
  }
});





async function startServer() {
  await connectDB();
  await ensureNormalizedRolesSchema();
  await ensureGrievanceSchema();
  await ensureDatabaseProgramUnits();

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
