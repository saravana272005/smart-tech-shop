/* server.js */
import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

// ✅ 1. Load environment variables first
// 💡 FIX: Explicitly specify the file name as '.env.js' to match the user's file name.
dotenv.config({ path: path.resolve(process.cwd(), '.env.js') });

// --- IMPORTANT: Runtime Environment Variable Check ---
// We check for critical variables and exit if they are missing to prevent runtime errors.
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ CRITICAL ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in the .env file.");
    console.error("💡 Please ensure your .env file is in the root directory (E:\\SaroProject) and contains the correct keys.");
    process.exit(1); 
}
// ... (The rest of the code continues)
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error("❌ CRITICAL ERROR: One or more DB environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) are missing.");
    console.error("💡 Check your .env file for database credentials and ensure your MySQL server is running.");
    process.exit(1);
}

// Global constants derived from process.env (secured)
const PORT = process.env.PORT || 5000; 
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
// --- END ENV CHECK ---


// --- Create uploads directory if it doesn't exist ---
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created directory: ${uploadsDir}`);
}

const app = express();

// -------------------------
// Middleware
// -------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// -------------------------
// Multer Configuration
// -------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
    
  },
});
const upload = multer({ storage: storage });

// -------------------------
// MySQL Connection (Using process.env)
// -------------------------
const db = mysql.createConnection({
  // ✅ Using process.env
  host: process.env.DB_HOST, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    console.error("💡 Check if your MySQL server is running and the credentials in .env are correct.");
    process.exit(1);
  }
  console.log("✅ MySQL Connected");
});

// Create 'services' table if it doesn't exist
const createServicesTableSql = `
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    deviceType VARCHAR(50) NOT NULL,
    model VARCHAR(255),
    issue TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`;
db.query(createServicesTableSql, (err) => {
  if (err) {
    console.error("❌ Error creating services table:", err);
  } else {
    // console.log("✅ 'services' table ready."); // <-- COMMENTED OUT
  }
});

// NEW: Create 'orders' table with 'payment_method' column (Modified to include email_summary)
const createOrdersTableSql = `
    CREATE TABLE IF NOT EXISTS orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        orderId VARCHAR(100),
        orderDate DATE NOT NULL,
        userEmail VARCHAR(255) NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(255) NOT NULL,
        customerAddress TEXT NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status ENUM('Pending', 'Paid', 'Shipped', 'Cancelled', 'Delivered') DEFAULT 'Pending',
        products_summary JSON,
        payment_method VARCHAR(50) DEFAULT 'Online Pay',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        email_summary JSON, /* NEW COLUMN for simpler email content */
        userId INT, 
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL 
    );
`;
db.query(createOrdersTableSql, (err) => {
    if (err) {
        console.error("❌ Error creating orders table:", err);
    } else {
        // console.log("✅ 'orders' table ready."); // <-- COMMENTED OUT
    }
});

// NEW: Create 'advertisements' table
const createAdvertisementsTableSql = `
    CREATE TABLE IF NOT EXISTS advertisements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;
db.query(createAdvertisementsTableSql, (err) => {
    if (err) {
        console.error("❌ Error creating advertisements table:", err);
    } else {
        console.log("✅ 'advertisements' table ready.");
    }
});


// -------------------------
// Nodemailer (Using process.env)
// -------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // ✅ Using global constants (derived from process.env)
        user: MAIL_USER, 
        pass: MAIL_PASS 
    }
});

// -------------------------
// EMAIL HELPER FUNCTIONS
// -------------------------

// Helper function to format order summary for email (MODIFIED FOR SIMPLE LIST)
const formatOrderSummary = (summaryJson) => {
    try {
        const products = (typeof summaryJson === 'string') ? JSON.parse(summaryJson) : summaryJson;
        let productDetails = '';

        if (!Array.isArray(products) || products.length === 0) {
             return '<p style="margin: 5px 0; color: #e74c3c;">Product details unavailable.</p>';
        }

        products.forEach(p => {
            // Get the price to display
            const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const itemQty = p.quantity || 1;
            
            // Itemized line format: Product name, Price, Quantity
            productDetails += `
                <p style="margin: 5px 0; padding-bottom: 5px; border-bottom: 1px dashed #eee;">
                    <strong style="color: #333;">Product:</strong> ${p.name} (Qty: ${itemQty})<br>
                    <strong style="color: #555;">Price (Unit):</strong> ₹${price}
                </p>
            `;
        });
        return productDetails;
    } catch (e) {
        console.error("Error parsing products_summary for email:", e);
        return '<p style="margin: 5px 0; color: #e74c3c;">Error loading product details.</p>';
    }
};


// NEW: Function to format and send the Order Confirmation Email
const sendOrderConfirmationEmail = (orderData) => {
    try {
        const summary = JSON.parse(orderData.email_summary);
        const customerFirstName = orderData.customerName.split(' ')[0] || 'Valued Customer';
        
        // 1. Format Product Details
        const productDetailsHtml = summary.products.map(p => {
            const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const itemQty = p.quantity || 1;

            return `
                <div style="margin: 5px 0; padding: 5px 0; border-bottom: 1px dashed #eee;">
                    <p style="margin: 0; font-weight: bold; color: #333;">Product: ${p.name}</p>
                    <p style="margin: 0 0 5px 0; color: #555; font-size: 14px;">Price: ₹${price} x ${itemQty}</p>
                </div>
            `;
        }).join('');
        
        // 2. Format Totals
        const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        
        const paymentStatusText = summary.paymentStatus;
        const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
        const paymentMethodDisplay = orderData.paymentMethod.toUpperCase().replace('-', ' - ');

        const mailOptions = {
            // ✅ Using global constant
            from: MAIL_USER, 
            to: orderData.userEmail,
            subject: `🎉 Smart Tech Order #${orderData.orderId} Confirmed!`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #333; text-align: center;">Smart Tech Shop</h2>
                    <h3 style="color: #4CAF50; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 15px;">Your Order Has Been Placed!</h3>
                    <p>Hello **${customerFirstName}**, </p>
                    <p>Thank you for your order! Your order details are below:</p>
                    
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 20px; background-color: #f9f9f9;">
                        
                        <p style="margin: 5px 0; font-size: 1.1em; font-weight: bold; color: #333;">Order ID: ${orderData.orderId}</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                        
                        ${productDetailsHtml}
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">

                        <table style="width: 100%; font-size: 14px; color: #555;">
                            <tr><td style="padding: 3px 0;">Subtotal:</td><td style="text-align: right;">₹${subtotal}</td></tr>
                            <tr><td style="padding: 3px 0;">GST (5%):</td><td style="text-align: right;">+ ₹${gst}</td></tr>
                            <tr><td style="padding: 3px 0; border-bottom: 1px solid #ddd;">Delivery Charges:</td><td style="text-align: right; border-bottom: 1px solid #ddd;">+ ₹${delivery}</td></tr>
                            <tr><td style="padding: 8px 0; font-size: 1.2em; font-weight: bold; color: #333;">Total Amount:</td><td style="text-align: right; font-size: 1.2em; font-weight: bold; color: #2ecc71;">₹${totalAmount}</td></tr>
                        </table>
                        
                        <p style="margin: 15px 0 5px 0;">
                            <strong>Payment Status:</strong> <span style="font-weight: bold; color: ${paymentStatusColor};">${paymentStatusText}</span>
                        </p>
                        <p style="margin: 5px 0;">
                            <strong>Payment Method:</strong> ${paymentMethodDisplay}
                        </p>

                    </div>
                    
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">Shipping Address</h4>
                        <p style="margin: 0; font-size: 14px; color: #555;">${summary.shippingAddress || 'N/A'}</p>
                    </div>
                    
                    <p style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">Thank you for shopping with Smart Tech!</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.error("❌ Nodemailer Error (Order Confirmation):", error);
            }
            console.log("✅ Order confirmation email sent to:", orderData.userEmail, info.response);
        });

    } catch (e) {
        console.error("❌ Error sending Order Confirmation Email:", e);
    }
}


// Main function to send order status email (MODIFIED TO USE email_summary)
const sendOrderStatusEmail = (order, orderId) => {
    // Only send for these critical status changes
    if (order.status === 'Cancelled' || order.status === 'Delivered' || order.status === 'Shipped' || order.status === 'Paid') {
        
        try {
            const summary = (typeof order.email_summary === 'string') ? JSON.parse(order.email_summary) : order.email_summary;
            
            // Check if summary and its parts exist
            if (!summary || !summary.products || !summary.totals) {
                console.error("❌ Cannot send status email: email_summary is missing or malformed.");
                return; // Skip email if data is bad
            }

            const customerFirstName = order.customerName.split(' ')[0] || 'Valued Customer';
            
            const statusTitles = {
                'Paid': '✅ Your Smart Tech Order is Confirmed and Paid!',
                'Shipped': '🚚 Your Smart Tech Order Has Been Shipped!',
                'Delivered': '🎉 Your Smart Tech Order Has Been Delivered!',
                'Cancelled': '❌ Your Smart Tech Order Has Been Cancelled',
            };
            
            const statusSubject = statusTitles[order.status] || `Smart Tech Order #${order.orderId || orderId} Status Update: ${order.status}`;
            
            // 1. Format Product Details from email_summary
            const productDetailsHtml = summary.products.map(p => {
                const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                const itemQty = p.quantity || 1;

                return `
                    <div style="margin: 5px 0; padding: 5px 0; border-bottom: 1px dashed #eee;">
                        <p style="margin: 0; font-weight: bold; color: #333;">Product: ${p.name}</p>
                        <p style="margin: 0 0 5px 0; color: #555; font-size: 14px;">Price: ₹${price} x ${itemQty}</p>
                    </div>
                `;
            }).join('');
            
            // 2. Format Totals from email_summary
            const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });

            const paymentStatusText = summary.paymentStatus;
            const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
            const paymentMethodDisplay = order.payment_method.toUpperCase().replace('-', ' - ');

            const mailOptions = {
                // ✅ Using global constant
                from: MAIL_USER, 
                to: order.userEmail, // Customer's email
                subject: statusSubject,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #333; text-align: center;">Smart Tech Shop</h2>
                        <h3 style="color: ${order.status === 'Cancelled' ? '#e74c3c' : '#4CAF50'}; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 15px;">${statusSubject}</h3>
                        <p>Hello **${customerFirstName}**, </p>
                        <p>Your order **#${order.orderId || orderId}** status has been updated to **${order.status}**.</p>
                        <p>
                            ${order.status === 'Paid' ? 'Your payment has been successfully processed. We are now preparing your order for shipment!' :
                              order.status === 'Shipped' ? 'Your package is on its way and should arrive soon! Check your email for tracking details if applicable.' : 
                              order.status === 'Delivered' ? 'We hope you enjoy your new tech! Thank you for your purchase.' :
                              order.status === 'Cancelled' ? 'The order has been cancelled as requested or due to an issue. Please contact support for any refund queries.' : ''}
                        </p>
        
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 20px; background-color: #f9f9f9;">
                            
                            <p style="margin: 5px 0; font-size: 1.1em; font-weight: bold; color: #333;">Order ID: ${order.orderId || orderId}</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                            
                            ${productDetailsHtml}
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">

                            <table style="width: 100%; font-size: 14px; color: #555;">
                                <tr><td style="padding: 3px 0;">Subtotal:</td><td style="text-align: right;">₹${subtotal}</td></tr>
                                <tr><td style="padding: 3px 0;">GST (5%):</td><td style="text-align: right;">+ ₹${gst}</td></tr>
                                <tr><td style="padding: 3px 0; border-bottom: 1px solid #ddd;">Delivery Charges:</td><td style="text-align: right; border-bottom: 1px solid #ddd;">+ ₹${delivery}</td></tr>
                                <tr><td style="padding: 8px 0; font-size: 1.2em; font-weight: bold; color: #333;">Total Amount:</td><td style="text-align: right; font-size: 1.2em; font-weight: bold; color: #2ecc71;">₹${totalAmount}</td></tr>
                            </table>

                            <p style="margin: 15px 0 5px 0;">
                                <strong>Payment Status:</strong> <span style="font-weight: bold; color: ${paymentStatusColor};">${paymentStatusText}</span>
                            </p>
                            <p style="margin: 5px 0;">
                                <strong>Payment Method:</strong> ${paymentMethodDisplay}
                            </p>

                        </div>
                        
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 15px;">
                            <h4 style="margin: 0 0 10px 0; color: #333;">Shipping Address</h4>
                            <p style="margin: 0; font-size: 14px; color: #555;">${order.customerAddress || 'N/A'}</p>
                        </div>
                        
                        <p style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">Thank you for shopping with Smart Tech!</p>
                    </div>
                `
            };
        
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.error("❌ Nodemailer Error (Order Status):", error);
                }
                console.log("✅ Order status email sent to:", order.userEmail, info.response);
            });
        } catch (e) {
            console.error("❌ Error sending Order Status Email (Parsing/Data Error):", e);
        }
    } else {
        console.log(`ℹ️ Status ${order.status} update email skipped.`);
    }
};


// -------------------------
// Razorpay Instance (Using process.env)
// -------------------------
const razorpay = new Razorpay({
  // ✅ Using process.env
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// -------------------------
// ROUTES
// -------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// AUTH API
// =====================
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("❌ Login DB error:", err);
      return res.status(500).json({ status: "error", message: "Internal server error." });
    }
    if (results.length === 0) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json({ status: "success", message: "Login successful.", user: userWithoutPassword });
  });
});

app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const sql = "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)";
  db.query(sql, [first_name, last_name, email, hashedPassword], (err, result) => {
    if (err) {
      console.error("❌ Registration DB error:", err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ status: "error", message: "Email already registered." });
      }
      return res.status(500).json({ status: "error", message: "Internal server error." });
    }
    res.status(201).json({ status: "success", message: "Registration successful." });
  });
});


// =====================
// ORDER API
// =====================
app.post('/api/orders', (req, res) => {
    // NOTE: The request body now contains 'userId' from the logged-in user's session
    const { orderId, userEmail, customerName, customerPhone, customerAddress, total, products_summary, razorpay_order_id, paymentMethod, userId, email_summary, status } = req.body;

    const summaryToStore = typeof products_summary === 'string' ? products_summary : JSON.stringify(products_summary);
    const emailSummaryToStore = typeof email_summary === 'string' ? email_summary : JSON.stringify(email_summary);
    
    const initialStatus = status || 'Pending'; 

    const sql = `
        INSERT INTO orders (orderId, orderDate, userEmail, customerName, customerPhone, customerAddress, total, status, products_summary, email_summary, razorpay_order_id, payment_method, userId) 
        VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)
    `;
    const params = [
        orderId, 
        userEmail, 
        customerName, 
        customerPhone, 
        customerAddress, 
        total, 
        initialStatus, 
        summaryToStore, 
        emailSummaryToStore, // NEW PARAMETER
        razorpay_order_id || null, 
        paymentMethod || 'Online Pay',
        userId 
    ];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('❌ Error creating order:', err);
            console.error('SQL:', sql);
            console.error('Params:', params);
            return res.status(500).json({ error: 'Internal Server Error', details: err.sqlMessage });
        }
        
        // --- NEW EMAIL CONFIRMATION LOGIC ---
        // The orderData object already contains all necessary fields, including email_summary
        sendOrderConfirmationEmail(req.body); 
        // --- END NEW EMAIL CONFIRMATION LOGIC ---
        
        res.status(201).json({ message: 'Order created successfully', id: result.insertId, orderId: orderId });
    });
});

app.get('/api/orders', (req, res) => {
    const sql = 'SELECT * FROM orders ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching orders:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.status(200).json(results);
    });
});

app.get('/api/orders/user/:email', (req, res) => {
    const { email } = req.params;
    const sql = 'SELECT * FROM orders WHERE userEmail = ? ORDER BY id DESC';
    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('❌ Error fetching user orders:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.status(200).json(result);
    });
});

app.get('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM orders WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error fetching order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(result[0]);
    });
});


// MODIFIED: Order Status Update with Email Notification (RETAINS LOGIC)
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    // 1. Check current payment_method and status to determine if payment_method needs update
    const checkSql = 'SELECT orderId, payment_method, status, userEmail, customerName, customerAddress, total, products_summary, email_summary FROM orders WHERE id = ?';
    db.query(checkSql, [id], (err, results) => {
        if (err) {
            console.error('❌ Error checking payment method:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const orderBeforeUpdate = results[0];
        const currentPaymentMethod = orderBeforeUpdate.payment_method;
        let newPaymentMethod = currentPaymentMethod;
        
        // --- CORE LOGIC FOR PAYMENT METHOD UPDATE ---
        // If COD order status changes to Delivered, mark payment method as 'COD - Paid'
        if (currentPaymentMethod === 'cod' || currentPaymentMethod === 'COD - Paid') {
            if (status === 'Delivered') {
                newPaymentMethod = 'COD - Paid';
            } 
        } 
        
        // 2. Perform the update
        const updateSql = 'UPDATE orders SET status = ?, payment_method = ? WHERE id = ?';
        const params = [status, newPaymentMethod, id];
        
        db.query(updateSql, params, (err, result) => {
            if (err) {
                console.error('❌ Error updating order status/payment:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Order not found or no changes made' });
            }
            
            // --- NEW EMAIL NOTIFICATION LOGIC ---
            
            // Combine fields from orderBeforeUpdate with the newly updated status and payment method
            const orderForEmail = {
                ...orderBeforeUpdate,
                status: status, // Use the new status
                payment_method: newPaymentMethod // Use the potentially new payment method
            };

            // Call the email helper function
            sendOrderStatusEmail(orderForEmail, id);
            
            // Since the DB update succeeded, we return success immediately.
            res.status(200).json({ message: "Order status updated successfully and email sent." });
            // --- END NEW EMAIL NOTIFICATION LOGIC ---
        });
    });
});

app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM orders WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error deleting order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        const countSql = "SELECT COUNT(*) AS count FROM orders";
        db.query(countSql, (countErr, countResult) => {
            if (countErr) {
                console.error("❌ Error checking order count after deletion:", countErr);
                return res.json({ message: "✅ Order deleted, but failed to check table count." });
            }

            if (countResult[0].count === 0) {
                const resetSql = "ALTER TABLE orders AUTO_INCREMENT = 1";
                db.query(resetSql, (resetErr, resetResult) => {
                    if (resetErr) {
                        console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
                        return res.json({ message: "✅ Order deleted, but failed to reset ID counter." });
                    }
                    console.log("✅ All orders removed. AUTO_INCREMENT has been reset to 1.");
                    return res.json({ message: "✅ Order deleted and ID counter reset." });
                });
            } else {
                res.json({ message: "✅ Order deleted" });
            }
        });
    });
});

// =====================
// NEW RAZORPAY API
// =====================
app.post('/api/create-razorpay-order', async (req, res) => {
  const { amount, receipt } = req.body;
  // console.log("📩 Razorpay Order Request:", req.body);
  // console.log("🔑 Key ID:", process.env.RAZORPAY_KEY_ID); // debug

  try {
    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: receipt,
      payment_capture: 1
    });
    res.json(order);
  } catch (error) {
    console.error("❌ Razorpay error:", error);
    res.status(500).json({ error: error.message });
  }
});



// NEW: Verify Razorpay Payment
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } =
    req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  // ✅ Using environment variable
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  // ADDED: Debugging logs to help with verification issues
  // console.log("🔍 Received Signature:", razorpay_signature);
  // console.log("✨ Expected Signature:", expectedSignature);
  // console.log("Body for hash:", body);

  if (expectedSignature === razorpay_signature) {
    // Payment is verified, but we DO NOT update status to 'Paid' here as per final user request.
    // We just return success to Razorpay handler. The client handles the DB insertion.
    res.json({ status: "success", message: "Payment verified successfully" });
    
  } else {
    res
      .status(400)
      .json({ status: "failure", message: "Invalid Razorpay signature" });
  }
});


// =====================
// PRODUCT API
// =====================
// ✅ புதிய என்ட்போயிண்ட்: 'price' மற்றும் 'mrp_price' காலத்தை NULL செய்ய.
app.get('/api/products/alter-table-for-prices-null', (req, res) => {
  const sql = `
    ALTER TABLE products 
    MODIFY COLUMN price DECIMAL(10,2) NULL DEFAULT NULL,
    MODIFY COLUMN price DECIMAL(10,2) NULL DEFAULT NULL;
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error("❌ Error altering 'price' and 'mrp_price' columns:", err);
      return res.status(500).json({ status: "error", message: `DB alter table error: ${err.sqlMessage}` });
    }
    console.log("✅ Successfully altered 'price' and 'mrp_price' columns to allow NULL.");
    res.json({ status: "success", message: "✅ 'price' and 'mrp_price' columns altered successfully to allow NULL values." });
  });
});

// ✅ ஸ்டாக் குறைப்பு ஃபங்ஷன்: வேரியன்ட் ஸ்டாக் & மொத்த ஸ்டாக் இரண்டையும் அப்டேட் செய்யும்.
app.put("/api/products/update-stock", (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided for stock update." });
    }

    const updates = items.map(item => {
        const productId = item.id;
        const quantity = item.qty;
        // NOTE: variantSpecName might be null/undefined for simple products
        const variantSpecName = item.variantSpecName; 

        // 🔍 DEBUG LOG: Print the item being processed
        // console.log(`Processing Item: Product ID: ${productId}, Quantity: ${quantity}, Variant: ${variantSpecName}`); // <-- HIDDEN

        return new Promise((resolve, reject) => {
            const getSql = "SELECT variants, stock, category FROM products WHERE id = ?";
            db.query(getSql, [productId], (err, results) => {
                if (err) {
                    console.error("❌ Error fetching product variants for stock update:", err);
                    return reject({ productId, error: err.sqlMessage });
                }
                if (results.length === 0) {
                    return reject({ productId, error: "Product not found" });
                }

                let product = results[0];
                let currentVariants = product.variants; 
                let mainStock = parseInt(product.stock) || 0; // Ensure mainStock is an integer
                let category = product.category;
                let isVariantProduct = false;
                
                // --- Robust JSON Parsing for Variants ---
                try {
                    if (typeof currentVariants === 'string') {
                        currentVariants = JSON.parse(currentVariants || '[]');
                    } else if (currentVariants === null || currentVariants === undefined) {
                        currentVariants = [];
                    }
                    if (Array.isArray(currentVariants) && currentVariants.length > 0) {
                        isVariantProduct = true;
                    } else {
                        currentVariants = [];
                    }
                } catch (e) {
                    console.error(`❌ Error parsing variants for product ID ${productId}:`, e);
                    return reject({ productId, error: "Internal variant data error" });
                }
                // -------------------------------------------------------------

                // ✅ STOCK DEDUCTION LOGIC
                // Check if it should be treated as a variant product based on category OR if variant name is explicitly provided
                const isVariantCategory = ['mobiles', 'laptops', 'seconds'].includes(category);

                if (isVariantCategory && isVariantProduct && variantSpecName) {
                    // 1. Variant product, specific variant ordered (Mobile, Laptop, Seconds logic)
                    const variantToUpdate = currentVariants.find(v => v.specName === variantSpecName);

                    if (!variantToUpdate) {
                        console.error(`❌ Variant Not Found: Product ID ${productId} requested variant '${variantSpecName}' not found.`);
                        return reject({ productId, error: `Variant '${variantSpecName}' not found for product.` });
                    }
                    
                    // Parse variant stock as integer before comparison/deduction
                    let variantStock = parseInt(variantToUpdate.stock) || 0;
                    
                    if (variantStock < quantity) {
                        return reject({ productId, error: `Not enough stock for variant '${variantSpecName}'. Available: ${variantStock}, Requested: ${quantity}` });
                    }
                    
                    // --- Core Stock Deduction: Only the specific variant is changed ---
                    variantStock -= quantity;
                    variantToUpdate.stock = variantStock; // Update the stock back in the variant object
                    
                    // Recalculate main product stock from the sum of all variant stocks (Crucial Step)
                    mainStock = currentVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                    
                    // console.log(`Variant Stock Updated. New Variant Stock: ${variantStock}, New Main Stock (Sum of Variants): ${mainStock}`); // <-- HIDDEN


                } else if (!isVariantCategory || (!isVariantProduct && !variantSpecName)) {
                    // 2. Simple product (TV, Accessories, Smartwatch, etc. logic)
                    if (mainStock < quantity) {
                         return reject({ productId, error: "Not enough stock for this simple product." });
                    }
                    mainStock -= quantity;
                    // console.log(`Simple Product Stock Updated. New Main Stock: ${mainStock}`); // <-- HIDDEN
                    
                } else {
                    // 3. Error Case: Variant category, but missing variant name or variants array is malformed.
                    const errorMsg = isVariantCategory && isVariantProduct && !variantSpecName 
                        ? `Product is a variant type, but no variantSpecName provided in the order item.`
                        : `Invalid order data for product ID ${productId}.`;
                        
                    // console.error(`❌ Mismatch Error: Product ID ${productId}. ${errorMsg}`); // <-- HIDDEN
                    return reject({ productId, error: errorMsg });
                }
                // -------------------------------------------------------------

                const updateSql = "UPDATE products SET variants = ?, stock = ? WHERE id = ?";
                db.query(updateSql, [JSON.stringify(currentVariants), mainStock, productId], (err, result) => {
                    if (err) {
                        console.error("❌ Error updating product stock with variants:", err);
                        return reject({ productId, error: err.sqlMessage });
                    }
                    if (result.affectedRows === 0) {
                        return reject({ productId, error: "Product not found during update" });
                    }
                    resolve({ productId, message: "Stock updated successfully" });
                });
            });
        });
    });

    Promise.all(updates.map(p => p.catch(e => e)))
        .then(results => {
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.warn("⚠️ Some stock updates failed:", errors);
                return res.status(500).json({ message: "Some stock updates failed.", errors });
            }
            res.json({ message: "✅ All stock updated successfully" });
        })
        .catch(err => {
            console.error("❌ Overall stock update error:", err);
            res.status(500).json({ error: "Internal server error during stock update." });
        });
});

app.get("/api/products", (req, res) => {
  const sql = "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products ORDER BY id ASC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching products:", err);
      return res.status(500).json({ error: "DB fetch error" });
    }
    const cleanedResults = results.map(product => {
      let variants = product.variants;
      let specs = product.specs;
      try {
          if (typeof variants === 'string' && variants !== 'null' && !variants.startsWith('[') && !variants.startsWith('{')) {
               console.warn(`❌ Malformed variants data for product ID ${product.id}. Resetting to empty array.`);
               variants = '[]';
          }
      } catch (e) {
          console.warn(`❌ Error parsing variants for product ID ${product.id}. Resetting to empty array.`);
          variants = '[]';
      }
      try {
          if (typeof specs === 'string' && specs !== 'null' && !specs.startsWith('{')) {
               console.warn(`❌ Malformed specs data for product ID ${product.id}. Resetting to empty object.`);
               specs = '{}';
          }
      } catch (e) {
          console.warn(`❌ Error parsing specs for product ID ${product.id}. Resetting to empty object.`);
          specs = '{}';
      }
      return { ...product, variants, specs };
    });
    res.json(cleanedResults);
  });
});

app.get("/api/products/:id", (req, res) => {
  const sql = "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products WHERE id = ?";

  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error("❌ Error fetching product:", err);
      return res.status(500).json({ error: "Internal server error." });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    
    const product = results[0];
    let variants = product.variants;
    let specs = product.specs;
    
    // Parse JSON fields if they are strings
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        console.warn(`❌ Error parsing variants for product ID ${product.id}. Using default empty array.`);
        variants = [];
      }
    }
    
    if (typeof specs === 'string') {
      try {
        specs = JSON.parse(specs);
      } catch (e) {
        console.warn(`❌ Error parsing specs for product ID ${product.id}. Using default empty object.`);
        specs = {};
      }
    }
    
    // Send the product object with parsed JSON fields
    res.json({ ...product, variants, specs });
  });
});

app.post("/api/products", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, variants, discount_end_date } = req.body;
  const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
  
  // price & mrp
const finalPrice = (!price || price === 'null' || isNaN(parseFloat(price))) 
  ? null 
  : parseFloat(price);

const finalMrpPrice = (!mrp_price || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) 
  ? null 
  : parseFloat(mrp_price);

// stock
const finalStock = (!stock || stock === 'null' || isNaN(parseInt(stock))) 
  ? 0  // better to default stock to 0
  : parseInt(stock);

// discount_end_date (only keep YYYY-MM-DD part)
let finalDiscountEndDate = null;
if (discount_end_date && discount_end_date !== 'null' && discount_end_date.trim() !== '') {
  finalDiscountEndDate = discount_end_date.split('T')[0]; 
}

  // Validate required fields
  if (finalMrpPrice === null || isNaN(finalMrpPrice)) {
      return res.status(400).json({ error: "MRP is required and must be a valid number." });
  }
  if (finalStock === null || isNaN(finalStock)) {
      return res.status(400).json({ error: "Stock is required and must be a valid number." });
  }

  const sql = `INSERT INTO products (name, category, brand, price, mrp_price, stock, description, specs, images, variants, discount_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.query(sql, [name, category, brand || null, finalPrice, finalMrpPrice, finalStock, description || null, specs || '{}', JSON.stringify(images), variants || '[]', finalDiscountEndDate], (err, result) => {
    if (err) {
      console.error("❌ Error inserting product:", err);
      return res.status(500).json({ error: `DB insert error: ${err.sqlMessage}` });
    }
    res.status(201).json({ message: "✅ Product added", id: result.insertId });
  });
});

app.put("/api/products/:id", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, existingImages, variants, discount_end_date } = req.body;

  let finalImages = existingImages ? JSON.parse(existingImages) : [];
  if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      finalImages = finalImages.concat(newImages);
  }
  
  // Use a ternary operator to set values to null if they are empty strings
  const finalPrice = (price === '' || price === 'null' || isNaN(parseFloat(price))) ? null : parseFloat(price);
  const finalMrpPrice = (mrp_price === '' || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) ? null : parseFloat(mrp_price);
  const finalStock = (stock === '' || stock === 'null' || isNaN(parseInt(stock))) ? null : parseInt(stock);
  const finalDiscountEndDate = (discount_end_date === '' || discount_end_date === 'null') ? null : discount_end_date;

  const sql = `UPDATE products SET name=?, category=?, brand=?, price=?, mrp_price=?, stock=?, description=?, specs=?, images=?, variants=?, discount_end_date=? WHERE id=?`;
  db.query(sql, [name, category, brand, finalPrice, finalMrpPrice, finalStock, description, specs, JSON.stringify(finalImages), variants, finalDiscountEndDate, req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Error updating product:", err);
      // Log the specific SQL error for better debugging
      console.error("SQL Error Message:", err.sqlMessage);
      return res.status(500).json({ error: `DB update error: ${err.sqlMessage}` });
    }
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "✅ Product updated" });
  });
});

app.put("/api/products/rate/:id", (req, res) => {
    const { id } = req.params;
    const { rating, reviews, ratingBreakdown } = req.body;
    
    try {
        const sql = "UPDATE products SET rating = ?, reviews = ?, ratingBreakdown = ? WHERE id = ?";
        db.query(sql, [rating, reviews, JSON.stringify(ratingBreakdown), id], (err, result) => {
            if (err) {
                console.error("❌ Error updating product rating:", err);
                return res.status(500).json({ error: `DB update error: ${err.sqlMessage}` });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Product not found" });
            }
            res.json({ message: "✅ Product rating updated" });
        });
    } catch (error) {
        console.error("❌ Server-side error:", error);
        res.status(500).json({ error: `Server-side error: ${error.message}` });
    }
});

app.get("/api/products/add-rating-breakdown-column", (req, res) => {
    const sql = "ALTER TABLE products ADD COLUMN ratingBreakdown JSON NOT NULL DEFAULT ('{}')";
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error adding ratingBreakdown column:", err);
            return res.status(500).json({ error: `DB alter table error: ${err.sqlMessage}` });
        }
        console.log("✅ Successfully added 'ratingBreakdown' column to 'products' table.");
        res.json({ message: "✅ 'ratingBreakdown' column added successfully." });
    });
});

app.delete("/api/products/:id", (req, res) => {
  const deleteSql = "DELETE FROM products WHERE id = ?";
  db.query(deleteSql, [req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Error deleting product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    const countSql = "SELECT COUNT(*) AS count FROM products";
    db.query(countSql, (countErr, countResult) => {
      if (countErr) {
        console.error("❌ Error checking product count after deletion:", countErr);
        return res.json({ message: "✅ Product deleted, but failed to check table count." });
      }

      if (countResult[0].count === 0) {
        const resetSql = "ALTER TABLE products AUTO_INCREMENT = 1";
        db.query(resetSql, (resetErr, resetResult) => {
          if (resetErr) {
            console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
            return res.json({ message: "✅ Product deleted, but failed to reset ID counter." });
          }
          console.log("✅ All products removed. AUTO_INCREMENT has been reset to 1.");
          return res.json({ message: "✅ Product deleted and ID counter reset." });
        });
      } else {
        res.json({ message: "✅ Product deleted" });
      }
    });
  });
});

// =====================
// SERVICE API
// =====================

app.post("/api/services", (req, res) => {
    const { name, phone, email, deviceType, model, issue } = req.body;
    const sql = `INSERT INTO services (name, phone, email, deviceType, model, issue) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, phone, email || null, deviceType, model || null, issue], (err, result) => {
        if (err) {
            console.error("❌ Error submitting service request:", err);
            return res.status(500).json({ error: "DB insert error" });
        }
        res.status(201).json({ message: "✅ Service request submitted", id: result.insertId });
    });
});

app.get("/api/services", (req, res) => {
    const sql = `SELECT * FROM services ORDER BY createdAt DESC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching service requests:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.status(200).json(results);
    });
});

app.put("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = `UPDATE services SET status = ? WHERE id = ?`;
    db.query(sql, [status, id], (err, result) => {
        if (err) {
            console.error("❌ Error updating service status:", err);
            return res.status(500).json({ error: "DB update error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Service request not found or no changes made' });
        }
        res.status(200).json({ message: '✅ Service status updated successfully' });
    });
});

app.delete("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM services WHERE id = ?`;
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("❌ Error deleting service request:", err);
            return res.status(500).json({ error: "DB deletion error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Service request not found" });
        }
        
        const countSql = "SELECT COUNT(*) AS count FROM services";
        db.query(countSql, (countErr, countResult) => {
            if (countErr) {
                console.error("❌ Error checking service count after deletion:", countErr);
                return res.json({ message: "✅ Service request deleted, but failed to check table count." });
            }

            if (countResult[0].count === 0) {
                const resetSql = "ALTER TABLE services AUTO_INCREMENT = 1";
                db.query(resetSql, (resetErr) => {
                    if (resetErr) {
                        console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
                        return res.json({ message: "✅ Service request deleted, but failed to reset ID counter." });
                    }
                    console.log("✅ All service requests removed. AUTO_INCREMENT has been reset to 1.");
                    return res.json({ message: "✅ Service request deleted and ID counter reset." });
                });
            } else {
                res.json({ message: "✅ Service request deleted" });
            }
        });
    });
});


app.post("/api/send-message", (req, res) => {
    const { type, phone, email, message } = req.body;
    
    try {
        if (type === 'email' && email) {
            const mailOptions = {
                // ✅ Using global constant
                from: MAIL_USER,
                to: email,
                subject: 'Smart Tech Shop - Service Request Update',
                text: message
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("❌ Email sending failed:", error);
                    return res.status(500).json({ error: "Email sending failed." });
                }
                console.log("✅ Email sent successfully:", info.response);
                res.status(200).json({ message: "Email sent successfully!" });
            });

        } else {
            res.status(400).json({ error: "Invalid request type or missing recipient." });
        }
    } catch (err) {
        console.error("❌ Unexpected server error:", err);
        res.status(500).json({ error: `Unexpected server error: ${err.message}` });
    }
});

// =====================
// ADVERTISEMENT API (NEW)
// =====================

// POST: Add new advertisement image
app.post("/api/advertisements", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Image file is required." });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const { description } = req.body;

    const sql = `INSERT INTO advertisements (image_url, description) VALUES (?, ?)`;
    db.query(sql, [imageUrl, description || null], (err, result) => {
        if (err) {
            console.error("❌ Error inserting advertisement:", err);
            // Clean up the uploaded file if DB insertion fails
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("❌ Error deleting failed upload:", unlinkErr);
            });
            return res.status(500).json({ error: `DB insert error: ${err.sqlMessage}` });
        }
        res.status(201).json({ message: "✅ Advertisement added", id: result.insertId, image_url: imageUrl });
    });
});

// GET: Fetch all advertisements
app.get("/api/advertisements", (req, res) => {
    const sql = `SELECT * FROM advertisements ORDER BY created_at ASC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching advertisements:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.status(200).json(results);
    });
});

// DELETE: Remove an advertisement
app.delete("/api/advertisements/:id", (req, res) => {
    const { id } = req.params;

    // 1. Get the image URL to delete the physical file
    const selectSql = `SELECT image_url FROM advertisements WHERE id = ?`;
    db.query(selectSql, [id], (err, results) => {
        if (err) {
            console.error("❌ Error fetching ad URL for deletion:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Advertisement not found" });
        }

        const imageUrl = results[0].image_url;
        const filePath = path.join(__dirname, "public", imageUrl);

        // 2. Delete the record from the database
        const deleteSql = `DELETE FROM advertisements WHERE id = ?`;
        db.query(deleteSql, [id], (err, result) => {
            if (err) {
                console.error("❌ Error deleting advertisement:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            // 3. Delete the physical file (fire and forget)
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    // Log error but don't fail the API call if the file is missing/cannot be deleted
                    console.warn(`⚠️ Could not delete physical file: ${filePath}. DB record deleted.`, unlinkErr);
                } else {
                    console.log(`✅ Deleted physical file: ${filePath}`);
                }
            });

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Advertisement not found" });
            }
            res.json({ message: "✅ Advertisement deleted" });
        });
    });
});


// =====================
// DASHBOARD APIs
// =====================

// NEW: API endpoint for monthly revenue (now a separate endpoint)
app.get('/api/monthly-revenue', (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = 'SELECT SUM(total) AS monthlyRevenue FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = "Paid"';

    db.query(sql, [currentMonth, currentYear], (err, result) => {
        if (err) {
            console.error("❌ Dashboard monthly revenue error:", err);
            return res.status(500).json({ status: "error", message: "DB error" });
        }
        const monthlyRevenue = result[0].monthlyRevenue || 0;
        res.json({ status: "success", monthlyRevenue: monthlyRevenue });
    });
});

app.get("/api/top-selling-products", (req, res) => {
    const sql = `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].name')) AS name,
               SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].quantity')) AS UNSIGNED)) AS units
        FROM orders
        GROUP BY name
        ORDER BY units DESC
        LIMIT 5
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching top selling products:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.json(results);
    });
});

// Corrected API endpoint for monthly orders
app.get("/api/dashboard/monthly-orders", (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = `SELECT COUNT(*) AS total FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = 'Paid'`;

    db.query(sql, [currentMonth, currentYear], (err, result) => {
        if (err) {
            console.error("❌ Dashboard monthly orders error:", err);
            return res.status(500).json({ status: "error", message: "DB error" });
        }
        res.json({ status: "success", monthlyOrders: result[0].total });
    });
});

// Corrected API endpoint and response format for customers
app.get("/api/customers", (req, res) => {
  const sql = "SELECT id, first_name, last_name, email, role, created_at FROM users WHERE role = 'user' ORDER BY created_at ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Customers fetch error:", err);
      return res.status(500).json({ status: "error", message: "DB error" });
    }
    res.json({ status: "success", customers: results });
  });
});

// New API endpoint for reviews
app.get("/api/review-report", (req, res) => {
  const sql = `
      SELECT r.id, r.rating, r.comment, r.createdAt, u.first_name, u.last_name, p.name AS product_name
      FROM reviews r
      JOIN users u ON r.userId = u.id
      JOIN products p ON r.productId = p.id
      ORDER BY r.createdAt DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching review report:", err);
      return res.status(500).json({ error: "DB fetch error" });
    }
    const formattedResults = results.map(row => ({
      id: row.id,
      product_name: row.product_name,
      user_name: `${row.first_name} ${row.last_name}`,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt
    }));
    res.json(formattedResults);
  });
});

// =====================
// START SERVER (Using secured PORT constant)
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
