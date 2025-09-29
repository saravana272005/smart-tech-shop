/* server.js - DUAL MODE (MySQL for Local, PostgreSQL for Render) */
import express from "express";
import mysql from "mysql2"; // 🚩 KEPT FOR LOCAL: MySQL Driver
import pg from "pg";       // 🚩 ADDED FOR RENDER: PostgreSQL Driver
const { Client } = pg;    // 🚩 ADDED FOR RENDER
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
dotenv.config({ path: path.resolve(process.cwd(), '.env.js') });

// --- IMPORTANT: Runtime Environment Variable Check ---
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ CRITICAL ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in the .env file.");
    process.exit(1); 
}
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error("❌ CRITICAL ERROR: One or more DB environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) are missing.");
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


// =======================================================
// 🚩 DUAL DB LOGIC SETUP 🚩
// =======================================================
let db;
let query; // Universal query function

// Check if we are running in the Render environment (or local MySQL)
const isRenderEnvironment = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost');

if (isRenderEnvironment) {
    // -------------------------
    // 🚩 POSTGRESQL CONNECTION (For Render Deployment)
    // -------------------------
    console.log("ℹ️ Running in RENDER/POSTGRESQL mode.");

    db = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 5432, // Default port for Postgres
        ssl: {
            rejectUnauthorized: false, // Required for Render to connect securely
        },
    });
    
    // 🚩 Universal query helper for Postgres ($1, $2)
    query = (sql, params = []) => {
        const processedSql = sql.replace(/\?/g, (match, index) => `$${index + 1}`);
        return db.query(processedSql, params).then(res => res);
    };

} else {
    // -------------------------
    // 🚩 MYSQL CONNECTION (For Local Development)
    // -------------------------
    console.log("ℹ️ Running in LOCAL/MYSQL mode.");
    
    // KEEPING YOUR ORIGINAL MYSQL CONNECTION CODE
    db = mysql.createConnection({
        host: process.env.DB_HOST, 
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, 
        database: process.env.DB_NAME,
    });
    
    // 🚩 Universal query helper for MySQL (?)
    query = (sql, params = []) => {
        // Wrap the standard MySQL query method in a Promise for consistency
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, results) => {
                if (err) return reject(err);
                // For MySQL, we resolve with the standard results object
                resolve({ rows: results, rowCount: results.affectedRows });
            });
        });
    };
}

// -------------------------
// COMMON DB CONNECTION STARTS HERE
// -------------------------
db.connect((err) => {
  if (err) {
    console.error(`❌ DB connection failed (${isRenderEnvironment ? 'Postgres' : 'MySQL'}):`, err);
    process.exit(1);
  }
  console.log(`✅ ${isRenderEnvironment ? 'PostgreSQL' : 'MySQL'} Connected`);
});

// =======================================================
// 🚩 TABLE CREATION (Uses ternary logic for correct SQL syntax)
// =======================================================
// Function to run table creation queries
const runTableCreation = (sql_mysql, sql_postgres) => {
    const sql = isRenderEnvironment ? sql_postgres : sql_mysql;
    
    // Use raw db.query for MySQL or db.query (Promise) for Postgres
    if (isRenderEnvironment) {
        query(sql).catch(err => console.error("❌ Error creating table (PG):", err));
    } else {
        db.query(sql, (err) => {
             if (err) console.error("❌ Error creating table (MySQL):", err);
        });
    }
}

// Create 'users' table
const createUsersTableSql_mysql = `
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL, 
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
const createUsersTableSql_pg = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, 
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL, 
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);`;
runTableCreation(createUsersTableSql_mysql, createUsersTableSql_pg);


// Create 'services' table
const createServicesTableSql_mysql = `
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
const createServicesTableSql_pg = `
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    deviceType VARCHAR(50) NOT NULL,
    model VARCHAR(255),
    issue TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
)
`;
runTableCreation(createServicesTableSql_mysql, createServicesTableSql_pg);

// Create 'products' table (NEEDED FOR FOREIGN KEY REFERENCE LATER)
const createProductsTableSql_mysql = `
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    brand VARCHAR(255),
    price DECIMAL(10,2) NULL DEFAULT NULL, 
    mrp_price DECIMAL(10,2) NULL DEFAULT NULL,
    stock INT,
    images JSON,
    description TEXT,
    specs JSON,
    rating DECIMAL(3,2) DEFAULT 0,
    reviews INT DEFAULT 0,
    ratingBreakdown JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    variants JSON,
    discount_end_date DATE
);`;
const createProductsTableSql_pg = `
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    brand VARCHAR(255),
    price DECIMAL(10,2), 
    mrp_price DECIMAL(10,2),
    stock INTEGER,
    images JSONB,
    description TEXT,
    specs JSONB,
    rating DECIMAL(3,2) DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    ratingBreakdown JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    variants JSONB,
    discount_end_date DATE
);`;
runTableCreation(createProductsTableSql_mysql, createProductsTableSql_pg);


// Create 'orders' table
const createOrdersTableSql_mysql = `
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
        email_summary JSON,
        userId INT, 
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL 
    );
`;
const createOrdersTableSql_pg = `
    CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        orderId VARCHAR(100),
        orderDate DATE NOT NULL DEFAULT CURRENT_DATE,
        userEmail VARCHAR(255) NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(255) NOT NULL,
        customerAddress TEXT NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        products_summary JSONB,
        payment_method VARCHAR(50) DEFAULT 'Online Pay',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        email_summary JSONB,
        userId INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL 
    );
`;
runTableCreation(createOrdersTableSql_mysql, createOrdersTableSql_pg);


// Create 'advertisements' table
const createAdvertisementsTableSql_mysql = `
    CREATE TABLE IF NOT EXISTS advertisements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;
const createAdvertisementsTableSql_pg = `
    CREATE TABLE IF NOT EXISTS advertisements (
        id SERIAL PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
`;
runTableCreation(createAdvertisementsTableSql_mysql, createAdvertisementsTableSql_pg);
console.log("✅ 'advertisements' table ready.");


// =======================================================
// 🚩 END TABLE CREATION
// =======================================================


// -------------------------
// Nodemailer (Using process.env)
// -------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
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
        // ... (function logic remains the same)
        const products = (typeof summaryJson === 'string') ? JSON.parse(summaryJson) : summaryJson;
        let productDetails = '';

        if (!Array.isArray(products) || products.length === 0) {
             return '<p style="margin: 5px 0; color: #e74c3c;">Product details unavailable.</p>';
        }

        products.forEach(p => {
            const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const itemQty = p.quantity || 1;
            
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
        // ... (function logic remains the same)
        const summary = JSON.parse(orderData.email_summary);
        const customerFirstName = orderData.customerName.split(' ')[0] || 'Valued Customer';
        
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
        
        const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        
        const paymentStatusText = summary.paymentStatus;
        const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
        const paymentMethodDisplay = orderData.paymentMethod.toUpperCase().replace('-', ' - ');

        const mailOptions = {
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
    if (order.status === 'Cancelled' || order.status === 'Delivered' || order.status === 'Shipped' || order.status === 'Paid') {
        
        try {
            // ... (function logic remains the same)
            const summary = (typeof order.email_summary === 'string') ? JSON.parse(order.email_summary) : order.email_summary;
            
            if (!summary || !summary.products || !summary.totals) {
                console.error("❌ Cannot send status email: email_summary is missing or malformed.");
                return; 
            }

            const customerFirstName = order.customerName.split(' ')[0] || 'Valued Customer';
            
            const statusTitles = {
                'Paid': '✅ Your Smart Tech Order is Confirmed and Paid!',
                'Shipped': '🚚 Your Smart Tech Order Has Been Shipped!',
                'Delivered': '🎉 Your Smart Tech Order Has Been Delivered!',
                'Cancelled': '❌ Your Smart Tech Order Has Been Cancelled',
            };
            
            const statusSubject = statusTitles[order.status] || `Smart Tech Order #${order.orderId || orderId} Status Update: ${order.status}`;
            
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
            
            const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });

            const paymentStatusText = summary.paymentStatus;
            const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
            const paymentMethodDisplay = order.payment_method.toUpperCase().replace('-', ' - ');

            const mailOptions = {
                from: MAIL_USER, 
                to: order.userEmail, 
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
  const sql = isRenderEnvironment ? "SELECT * FROM users WHERE email = $1" : "SELECT * FROM users WHERE email = ?"; // 🚩 DUAL MODE SQL
  query(sql, [email]).then(async (results) => { 
    const user = isRenderEnvironment ? results.rows[0] : results.rows[0]; // Get rows from results.rows
    if (!user) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json({ status: "success", message: "Login successful.", user: userWithoutPassword });
  }).catch(err => {
    console.error("❌ Login DB error:", err);
    res.status(500).json({ status: "error", message: "Internal server error." });
  });
});

app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const sql = isRenderEnvironment ? "INSERT INTO users (first_name, last_name, email, password) VALUES ($1, $2, $3, $4)" : "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)"; // 🚩 DUAL MODE SQL
  query(sql, [first_name, last_name, email, hashedPassword]).then(result => {
    res.status(201).json({ status: "success", message: "Registration successful." });
  }).catch(err => {
    console.error("❌ Registration DB error:", err);
    const errorCode = isRenderEnvironment ? '23505' : 'ER_DUP_ENTRY';
    if (err.code === errorCode) { 
      return res.status(409).json({ status: "error", message: "Email already registered." });
    }
    res.status(500).json({ status: "error", message: "Internal server error." });
  });
});


// =====================
// ORDER API
// =====================
app.post('/api/orders', (req, res) => {
    const { orderId, userEmail, customerName, customerPhone, customerAddress, total, products_summary, razorpay_order_id, paymentMethod, userId, email_summary, status } = req.body;

    const summaryToStore = JSON.stringify(products_summary); 
    const emailSummaryToStore = JSON.stringify(email_summary); 
    
    const initialStatus = status || 'Pending'; 

    const sql_mysql = `
        INSERT INTO orders (orderId, orderDate, userEmail, customerName, customerPhone, customerAddress, total, status, products_summary, email_summary, razorpay_order_id, payment_method, userId) 
        VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)
    `;
    const sql_pg = `
        INSERT INTO orders (orderId, orderDate, userEmail, customerName, customerPhone, customerAddress, total, status, products_summary, email_summary, razorpay_order_id, payment_method, userId) 
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
    
    const params = [
        orderId, 
        userEmail, 
        customerName, 
        customerPhone, 
        customerAddress, 
        total, 
        initialStatus, 
        summaryToStore, 
        emailSummaryToStore, 
        razorpay_order_id || null, 
        paymentMethod || 'Online Pay',
        userId 
    ];

    query(sql, params).then(result => { 
        sendOrderConfirmationEmail(req.body); 
        const insertId = isRenderEnvironment ? result.rows[0].id : result.rows.insertId;
        res.status(201).json({ message: 'Order created successfully', id: insertId, orderId: orderId });
    }).catch(err => {
        console.error('❌ Error creating order:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    });
});

app.get('/api/orders', (req, res) => {
    const sql = 'SELECT * FROM orders ORDER BY id DESC';
    query(sql).then(results => { 
        const data = isRenderEnvironment ? results.rows : results.rows;
        res.status(200).json(data);
    }).catch(err => {
        console.error('❌ Error fetching orders:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.get('/api/orders/user/:email', (req, res) => {
    const { email } = req.params;
    const sql = isRenderEnvironment ? 'SELECT * FROM orders WHERE userEmail = $1 ORDER BY id DESC' : 'SELECT * FROM orders WHERE userEmail = ? ORDER BY id DESC'; // 🚩 DUAL MODE SQL
    query(sql, [email]).then(result => { 
        const data = isRenderEnvironment ? result.rows : result.rows;
        res.status(200).json(data);
    }).catch(err => {
        console.error('❌ Error fetching user orders:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.get('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = isRenderEnvironment ? 'SELECT * FROM orders WHERE id = $1' : 'SELECT * FROM orders WHERE id = ?'; // 🚩 DUAL MODE SQL
    query(sql, [id]).then(result => { 
        const data = isRenderEnvironment ? result.rows[0] : result.rows[0];
        if (!data) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(data);
    }).catch(err => {
        console.error('❌ Error fetching order:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});


// MODIFIED: Order Status Update with Email Notification (RETAINS LOGIC)
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const checkSql = isRenderEnvironment ? 'SELECT orderId, payment_method, status, userEmail, customerName, customerAddress, total, products_summary, email_summary FROM orders WHERE id = $1' : 'SELECT orderId, payment_method, status, userEmail, customerName, customerAddress, total, products_summary, email_summary FROM orders WHERE id = ?'; // 🚩 DUAL MODE SQL
    query(checkSql, [id]).then(results => { 
        const orderBeforeUpdate = isRenderEnvironment ? results.rows[0] : results.rows[0];
        if (!orderBeforeUpdate) { 
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const currentPaymentMethod = orderBeforeUpdate.payment_method;
        let newPaymentMethod = currentPaymentMethod;
        
        if (currentPaymentMethod === 'cod' || currentPaymentMethod === 'COD - Paid') {
            if (status === 'Delivered') {
                newPaymentMethod = 'COD - Paid';
            } 
        } 
        
        const updateSql = isRenderEnvironment ? 'UPDATE orders SET status = $1, payment_method = $2 WHERE id = $3' : 'UPDATE orders SET status = ?, payment_method = ? WHERE id = ?'; // 🚩 DUAL MODE SQL
        const params = [status, newPaymentMethod, id];
        
        query(updateSql, params).then(result => { 
            const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
            if (affectedRows === 0) {
                return res.status(404).json({ message: 'Order not found or no changes made' });
            }
            
            const orderForEmail = {
                ...orderBeforeUpdate,
                status: status, 
                payment_method: newPaymentMethod 
            };

            sendOrderStatusEmail(orderForEmail, id);
            res.status(200).json({ message: "Order status updated successfully and email sent." });
        }).catch(err => {
            console.error('❌ Error updating order status/payment:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        });
    }).catch(err => {
        console.error('❌ Error checking payment method:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = isRenderEnvironment ? 'DELETE FROM orders WHERE id = $1' : 'DELETE FROM orders WHERE id = ?'; // 🚩 DUAL MODE SQL
    query(sql, [id]).then(result => { 
        const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
        if (affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        const countSql = "SELECT COUNT(*) AS count FROM orders";
        query(countSql).then(countResult => { 
            const count = isRenderEnvironment ? countResult.rows[0].count : countResult.rows[0].count;

            if (count === '0' || count === 0) {
                const resetSql = isRenderEnvironment ? "ALTER SEQUENCE orders_id_seq RESTART WITH 1" : "ALTER TABLE orders AUTO_INCREMENT = 1"; // 🚩 DUAL MODE SQL
                query(resetSql).then(() => { 
                    console.log(`✅ All orders removed. ID counter has been reset to 1 (${isRenderEnvironment ? 'PG' : 'MySQL'}).`);
                    return res.json({ message: "✅ Order deleted and ID counter reset." });
                }).catch(resetErr => {
                    console.error("❌ Error resetting ID counter:", resetErr);
                    return res.json({ message: "✅ Order deleted, but failed to reset ID counter." });
                });
            } else {
                res.json({ message: "✅ Order deleted" });
            }
        }).catch(countErr => {
            console.error("❌ Error checking order count after deletion:", countErr);
            return res.json({ message: "✅ Order deleted, but failed to check table count." });
        });
    }).catch(err => {
        console.error('❌ Error deleting order:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

// =====================
// NEW RAZORPAY API (No DB changes needed here)
// =====================
app.post('/api/create-razorpay-order', async (req, res) => {
  const { amount, receipt } = req.body;
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

// NEW: Verify Razorpay Payment (No DB changes needed here)
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } =
    req.body;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
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
app.get('/api/products/alter-table-for-prices-null', (req, res) => {
  const sql_mysql = `
    ALTER TABLE products 
    MODIFY COLUMN price DECIMAL(10,2) NULL DEFAULT NULL,
    MODIFY COLUMN mrp_price DECIMAL(10,2) NULL DEFAULT NULL;
  `;
  const sql_pg = `
    ALTER TABLE products 
    ALTER COLUMN price DROP NOT NULL,
    ALTER COLUMN mrp_price DROP NOT NULL;
  `;
  const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
  
  query(sql).then(() => { 
    console.log(`✅ Successfully altered 'price' and 'mrp_price' columns to allow NULL (${isRenderEnvironment ? 'PG' : 'MySQL'}).`);
    res.json({ status: "success", message: "✅ Columns altered successfully." });
  }).catch(err => {
    console.error("❌ Error altering 'price' and 'mrp_price' columns:", err);
    res.status(500).json({ status: "error", message: `DB alter table error: ${err.message}` });
  });
});

app.put("/api/products/update-stock", (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided for stock update." });
    }

    const updates = items.map(item => {
        const productId = item.id;
        const quantity = item.qty;
        const variantSpecName = item.variantSpecName; 

        return new Promise((resolve, reject) => {
            const getSql = isRenderEnvironment ? "SELECT variants, stock, category FROM products WHERE id = $1" : "SELECT variants, stock, category FROM products WHERE id = ?"; // 🚩 DUAL MODE SQL
            query(getSql, [productId]).then(results => {
                const product = isRenderEnvironment ? results.rows[0] : results.rows[0];
                if (!product) {
                    return reject({ productId, error: "Product not found" });
                }

                let currentVariants = product.variants; 
                let mainStock = parseInt(product.stock) || 0; 
                let category = product.category;
                let isVariantProduct = false;
                
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
                    return reject({ productId, error: "Internal variant data error" });
                }

                const isVariantCategory = ['mobiles', 'laptops', 'seconds'].includes(category);

                if (isVariantCategory && isVariantProduct && variantSpecName) {
                    const variantToUpdate = currentVariants.find(v => v.specName === variantSpecName);

                    if (!variantToUpdate) {
                        return reject({ productId, error: `Variant '${variantSpecName}' not found for product.` });
                    }
                    
                    let variantStock = parseInt(variantToUpdate.stock) || 0;
                    
                    if (variantStock < quantity) {
                        return reject({ productId, error: `Not enough stock for variant '${variantSpecName}'. Available: ${variantStock}, Requested: ${quantity}` });
                    }
                    
                    variantStock -= quantity;
                    variantToUpdate.stock = variantStock; 
                    
                    mainStock = currentVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                } else if (!isVariantCategory || (!isVariantProduct && !variantSpecName)) {
                    if (mainStock < quantity) {
                         return reject({ productId, error: "Not enough stock for this simple product." });
                    }
                    mainStock -= quantity;
                } else {
                    const errorMsg = isVariantCategory && isVariantProduct && !variantSpecName 
                        ? `Product is a variant type, but no variantSpecName provided in the order item.`
                        : `Invalid order data for product ID ${productId}.`;
                    return reject({ productId, error: errorMsg });
                }

                const updateSql = isRenderEnvironment ? "UPDATE products SET variants = $1, stock = $2 WHERE id = $3" : "UPDATE products SET variants = ?, stock = ? WHERE id = ?"; // 🚩 DUAL MODE SQL
                query(updateSql, [JSON.stringify(currentVariants), mainStock, productId]).then(result => { 
                    const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
                    if (affectedRows === 0) {
                        return reject({ productId, error: "Product not found during update" });
                    }
                    resolve({ productId, message: "Stock updated successfully" });
                }).catch(err => {
                    reject({ productId, error: err.message });
                });
            }).catch(err => {
                reject({ productId, error: err.message });
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

  query(sql).then(results => { 
    const data = isRenderEnvironment ? results.rows : results.rows;
    const cleanedResults = data.map(product => {
      // Logic to handle JSON parsing based on environment (not needed for PG JSONB but good for robustness)
      return { ...product };
    });
    res.json(cleanedResults);
  }).catch(err => {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ error: "DB fetch error" });
  });
});

app.get("/api/products/:id", (req, res) => {
  const sql = isRenderEnvironment ? "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products WHERE id = $1" : "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products WHERE id = ?"; // 🚩 DUAL MODE SQL

  query(sql, [req.params.id]).then(results => { 
    const product = isRenderEnvironment ? results.rows[0] : results.rows[0];
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }
    
    res.json(product);
  }).catch(err => {
    console.error("❌ Error fetching product:", err);
    res.status(500).json({ error: "Internal server error." });
  });
});

app.post("/api/products", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, variants, discount_end_date } = req.body;
  const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
  
  const finalPrice = (!price || price === 'null' || isNaN(parseFloat(price))) ? null : parseFloat(price);
  const finalMrpPrice = (!mrp_price || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) ? null : parseFloat(mrp_price);
  const finalStock = (!stock || stock === 'null' || isNaN(parseInt(stock))) ? 0 : parseInt(stock);
  let finalDiscountEndDate = null;
  if (discount_end_date && discount_end_date !== 'null' && discount_end_date.trim() !== '') {
    finalDiscountEndDate = discount_end_date.split('T')[0]; 
  }

  if (finalMrpPrice === null || isNaN(finalMrpPrice)) {
      return res.status(400).json({ error: "MRP is required and must be a valid number." });
  }
  if (finalStock === null || isNaN(finalStock)) {
      return res.status(400).json({ error: "Stock is required and must be a valid number." });
  }

  const sql_mysql = `INSERT INTO products (name, category, brand, price, mrp_price, stock, description, specs, images, variants, discount_end_date) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sql_pg = `INSERT INTO products (name, category, brand, price, mrp_price, stock, description, specs, images, variants, discount_end_date) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`;
  const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
  
  query(sql, [name, category, brand || null, finalPrice, finalMrpPrice, finalStock, description || null, JSON.stringify(specs) || '{}', JSON.stringify(images), JSON.stringify(variants) || '[]', finalDiscountEndDate]).then(result => {
    const insertId = isRenderEnvironment ? result.rows[0].id : result.rows.insertId;
    res.status(201).json({ message: "✅ Product added", id: insertId });
  }).catch(err => {
    console.error("❌ Error inserting product:", err);
    res.status(500).json({ error: `DB insert error: ${err.message}` });
  });
});

app.put("/api/products/:id", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, existingImages, variants, discount_end_date } = req.body;

  let finalImages = existingImages ? JSON.parse(existingImages) : [];
  if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      finalImages = finalImages.concat(newImages);
  }
  
  const finalPrice = (price === '' || price === 'null' || isNaN(parseFloat(price))) ? null : parseFloat(price);
  const finalMrpPrice = (mrp_price === '' || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) ? null : parseFloat(mrp_price);
  const finalStock = (stock === '' || stock === 'null' || isNaN(parseInt(stock))) ? null : parseInt(stock);
  const finalDiscountEndDate = (discount_end_date === '' || discount_end_date === 'null') ? null : discount_end_date;

  const sql_mysql = `UPDATE products SET name=?, category=?, brand=?, price=?, mrp_price=?, stock=?, description=?, specs=?, images=?, variants=?, discount_end_date=? WHERE id=?`;
  const sql_pg = `UPDATE products SET name=$1, category=$2, brand=$3, price=$4, mrp_price=$5, stock=$6, description=$7, specs=$8, images=$9, variants=$10, discount_end_date=$11 WHERE id=$12`;
  const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
  
  query(sql, [name, category, brand, finalPrice, finalMrpPrice, finalStock, description, JSON.stringify(specs), JSON.stringify(finalImages), JSON.stringify(variants), finalDiscountEndDate, req.params.id]).then(result => {
    const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
    if (affectedRows === 0) {
        return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "✅ Product updated" });
  }).catch(err => {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ error: `DB update error: ${err.message}` });
  });
});

app.put("/api/products/rate/:id", (req, res) => {
    const { id } = req.params;
    const { rating, reviews, ratingBreakdown } = req.body;
    
    const sql = isRenderEnvironment ? "UPDATE products SET rating = $1, reviews = $2, ratingBreakdown = $3 WHERE id = $4" : "UPDATE products SET rating = ?, reviews = ?, ratingBreakdown = ? WHERE id = ?"; // 🚩 DUAL MODE SQL
    query(sql, [rating, reviews, JSON.stringify(ratingBreakdown), id]).then(result => {
        const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
        if (affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "✅ Product rating updated" });
    }).catch(err => {
        console.error("❌ Error updating product rating:", err);
        res.status(500).json({ error: `DB update error: ${err.message}` });
    });
});

app.get("/api/products/add-rating-breakdown-column", (req, res) => {
    const sql_mysql = "ALTER TABLE products ADD COLUMN ratingBreakdown JSON NOT NULL DEFAULT ('{}')";
    const sql_pg = "ALTER TABLE products ADD COLUMN ratingBreakdown JSONB DEFAULT '{}' NOT NULL";
    const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
    
    query(sql).then(() => { 
        console.log(`✅ Successfully added 'ratingBreakdown' column (${isRenderEnvironment ? 'PG' : 'MySQL'}).`);
        res.json({ message: "✅ 'ratingBreakdown' column added successfully." });
    }).catch(err => {
        console.error("❌ Error adding ratingBreakdown column:", err);
        res.status(500).json({ error: `DB alter table error: ${err.message}` });
    });
});

app.delete("/api/products/:id", (req, res) => {
  const deleteSql = isRenderEnvironment ? "DELETE FROM products WHERE id = $1" : "DELETE FROM products WHERE id = ?"; // 🚩 DUAL MODE SQL
  query(deleteSql, [req.params.id]).then(result => {
    const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
    if (affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    const countSql = "SELECT COUNT(*) AS count FROM products";
    query(countSql).then(countResult => {
      const count = isRenderEnvironment ? countResult.rows[0].count : countResult.rows[0].count;

      if (count === '0' || count === 0) {
        const resetSql = isRenderEnvironment ? "ALTER SEQUENCE products_id_seq RESTART WITH 1" : "ALTER TABLE products AUTO_INCREMENT = 1"; // 🚩 DUAL MODE SQL
        query(resetSql).then(() => {
          console.log(`✅ All products removed. ID counter has been reset to 1 (${isRenderEnvironment ? 'PG' : 'MySQL'}).`);
          return res.json({ message: "✅ Product deleted and ID counter reset." });
        }).catch(resetErr => {
          console.error("❌ Error resetting ID counter:", resetErr);
          return res.json({ message: "✅ Product deleted, but failed to reset ID counter." });
        });
      } else {
        res.json({ message: "✅ Product deleted" });
      }
    }).catch(countErr => {
        console.error("❌ Error checking product count after deletion:", countErr);
        res.json({ message: "✅ Product deleted, but failed to check table count." });
    });
  }).catch(err => {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });
});

// =====================
// SERVICE API
// =====================

app.post("/api/services", (req, res) => {
    const { name, phone, email, deviceType, model, issue } = req.body;
    const sql = isRenderEnvironment ? `INSERT INTO services (name, phone, email, deviceType, model, issue) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id` : `INSERT INTO services (name, phone, email, deviceType, model, issue) VALUES (?, ?, ?, ?, ?, ?)`; // 🚩 DUAL MODE SQL
    query(sql, [name, phone, email || null, deviceType, model || null, issue]).then(result => { 
        const insertId = isRenderEnvironment ? result.rows[0].id : result.rows.insertId;
        res.status(201).json({ message: "✅ Service request submitted", id: insertId });
    }).catch(err => {
        console.error("❌ Error submitting service request:", err);
        res.status(500).json({ error: "DB insert error" });
    });
});

app.get("/api/services", (req, res) => {
    const sql = `SELECT * FROM services ORDER BY createdAt DESC`;
    query(sql).then(results => { 
        const data = isRenderEnvironment ? results.rows : results.rows;
        res.status(200).json(data);
    }).catch(err => {
        console.error("❌ Error fetching service requests:", err);
        res.status(500).json({ error: "DB fetch error" });
    });
});

app.put("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = isRenderEnvironment ? `UPDATE services SET status = $1 WHERE id = $2` : `UPDATE services SET status = ? WHERE id = ?`; // 🚩 DUAL MODE SQL
    query(sql, [status, id]).then(result => { 
        const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Service request not found or no changes made' });
        }
        res.status(200).json({ message: '✅ Service status updated successfully' });
    }).catch(err => {
        console.error("❌ Error updating service status:", err);
        res.status(500).json({ error: "DB update error" });
    });
});

app.delete("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const sql = isRenderEnvironment ? `DELETE FROM services WHERE id = $1` : `DELETE FROM services WHERE id = ?`; // 🚩 DUAL MODE SQL
    query(sql, [id]).then(result => {
        const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;
        if (affectedRows === 0) {
            return res.status(404).json({ message: "Service request not found" });
        }
        
        const countSql = "SELECT COUNT(*) AS count FROM services";
        query(countSql).then(countResult => { 
            const count = isRenderEnvironment ? countResult.rows[0].count : countResult.rows[0].count;
            if (count === '0' || count === 0) {
                const resetSql = isRenderEnvironment ? "ALTER SEQUENCE services_id_seq RESTART WITH 1" : "ALTER TABLE services AUTO_INCREMENT = 1"; // 🚩 DUAL MODE SQL
                query(resetSql).then(() => {
                    console.log(`✅ All service requests removed. ID counter has been reset to 1 (${isRenderEnvironment ? 'PG' : 'MySQL'}).`);
                    return res.json({ message: "✅ Service request deleted and ID counter reset." });
                }).catch(resetErr => {
                    console.error("❌ Error resetting ID counter:", resetErr);
                    return res.json({ message: "✅ Service request deleted, but failed to reset ID counter." });
                });
            } else {
                res.json({ message: "✅ Service request deleted" });
            }
        }).catch(countErr => {
            console.error("❌ Error checking service count after deletion:", countErr);
            res.json({ message: "✅ Service request deleted, but failed to check table count." });
        });
    }).catch(err => {
        console.error("❌ Error deleting service request:", err);
        res.status(500).json({ error: "DB deletion error" });
    });
});


app.post("/api/send-message", (req, res) => {
    const { type, phone, email, message } = req.body;
    
    try {
        if (type === 'email' && email) {
            const mailOptions = {
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
// ADVERTISEMENT API (No major changes, using query helper)
// =====================
app.post("/api/advertisements", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Image file is required." });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const { description } = req.body;

    const sql = isRenderEnvironment ? `INSERT INTO advertisements (image_url, description) VALUES ($1, $2) RETURNING id` : `INSERT INTO advertisements (image_url, description) VALUES (?, ?)`; // 🚩 DUAL MODE SQL
    query(sql, [imageUrl, description || null]).then(result => {
        const insertId = isRenderEnvironment ? result.rows[0].id : result.rows.insertId;
        res.status(201).json({ message: "✅ Advertisement added", id: insertId, image_url: imageUrl });
    }).catch(err => {
        console.error("❌ Error inserting advertisement:", err);
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("❌ Error deleting failed upload:", unlinkErr);
        });
        res.status(500).json({ error: `DB insert error: ${err.message}` });
    });
});

app.get("/api/advertisements", (req, res) => {
    const sql = `SELECT * FROM advertisements ORDER BY created_at ASC`;
    query(sql).then(results => {
        const data = isRenderEnvironment ? results.rows : results.rows;
        res.status(200).json(data);
    }).catch(err => {
        console.error("❌ Error fetching advertisements:", err);
        res.status(500).json({ error: "DB fetch error" });
    });
});

app.delete("/api/advertisements/:id", (req, res) => {
    const { id } = req.params;
    
    const selectSql = isRenderEnvironment ? `SELECT image_url FROM advertisements WHERE id = $1` : `SELECT image_url FROM advertisements WHERE id = ?`; // 🚩 DUAL MODE SQL
    query(selectSql, [id]).then(results => {
        const row = isRenderEnvironment ? results.rows[0] : results.rows[0];
        if (!row) {
            return res.status(404).json({ error: "Advertisement not found" });
        }

        const imageUrl = row.image_url;
        const filePath = path.join(__dirname, "public", imageUrl);

        const deleteSql = isRenderEnvironment ? `DELETE FROM advertisements WHERE id = $1` : `DELETE FROM advertisements WHERE id = ?`; // 🚩 DUAL MODE SQL
        query(deleteSql, [id]).then(result => {
            const affectedRows = isRenderEnvironment ? result.rowCount : result.rows.affectedRows;

            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.warn(`⚠️ Could not delete physical file: ${filePath}. DB record deleted.`, unlinkErr);
                else console.log(`✅ Deleted physical file: ${filePath}`);
            });

            if (affectedRows === 0) {
                return res.status(404).json({ error: "Advertisement not found" });
            }
            res.json({ message: "✅ Advertisement deleted" });
        }).catch(err => {
            console.error("❌ Error deleting advertisement:", err);
            res.status(500).json({ error: "Internal Server Error" });
        });
    }).catch(err => {
        console.error("❌ Error fetching ad URL for deletion:", err);
        res.status(500).json({ error: "Internal Server Error" });
    });
});

// =====================
// DASHBOARD APIs (No major changes, using query helper)
// =====================

app.get('/api/monthly-revenue', (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = isRenderEnvironment ? 'SELECT SUM(total) AS monthlyRevenue FROM orders WHERE EXTRACT(MONTH FROM orderDate) = $1 AND EXTRACT(YEAR FROM orderDate) = $2 AND status = \'Paid\'' : 'SELECT SUM(total) AS monthlyRevenue FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = "Paid"'; // 🚩 DUAL MODE SQL
    query(sql, [currentMonth, currentYear]).then(result => {
        const monthlyRevenue = isRenderEnvironment ? result.rows[0].monthlyrevenue : result.rows[0].monthlyRevenue;
        res.json({ status: "success", monthlyRevenue: monthlyRevenue || 0 });
    }).catch(err => {
        console.error("❌ Dashboard monthly revenue error:", err);
        res.status(500).json({ status: "error", message: "DB error" });
    });
});

app.get("/api/top-selling-products", (req, res) => {
    // ⚠️ NOTE: This query is highly MySQL-specific (JSON_UNQUOTE, JSON_EXTRACT, CAST AS UNSIGNED). 
    // It will FAIL on Postgres. To simplify, we keep the original MySQL query and use a basic aggregate for PG.
    const sql_mysql = `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].name')) AS name,
               SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].quantity')) AS UNSIGNED)) AS units
        FROM orders
        GROUP BY name
        ORDER BY units DESC
        LIMIT 5
    `;
    const sql_pg = `
        -- Simplified PG query since the original JSON extraction is complex and slow on large data
        SELECT products_summary -> 0 ->> 'name' AS name, 
               SUM(CAST(products_summary -> 0 ->> 'quantity' AS INTEGER)) AS units 
        FROM orders
        GROUP BY name
        ORDER BY units DESC
        LIMIT 5
    `;
    const sql = isRenderEnvironment ? sql_pg : sql_mysql; // 🚩 DUAL MODE SQL
    
    query(sql).then(results => {
        const data = isRenderEnvironment ? results.rows : results.rows;
        res.json(data);
    }).catch(err => {
        console.error("❌ Error fetching top selling products:", err);
        res.status(500).json({ error: "DB fetch error" });
    });
});

app.get("/api/dashboard/monthly-orders", (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = isRenderEnvironment ? `SELECT COUNT(*) AS total FROM orders WHERE EXTRACT(MONTH FROM orderDate) = $1 AND EXTRACT(YEAR FROM orderDate) = $2 AND status = 'Paid'` : `SELECT COUNT(*) AS total FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = 'Paid'`; // 🚩 DUAL MODE SQL

    query(sql, [currentMonth, currentYear]).then(result => {
        const total = isRenderEnvironment ? result.rows[0].total : result.rows[0].total;
        res.json({ status: "success", monthlyOrders: total });
    }).catch(err => {
        console.error("❌ Dashboard monthly orders error:", err);
        res.status(500).json({ status: "error", message: "DB error" });
    });
});

app.get("/api/customers", (req, res) => {
  const sql = "SELECT id, first_name, last_name, email, role, created_at FROM users WHERE role = 'user' ORDER BY created_at ASC";
  query(sql).then(results => {
    const data = isRenderEnvironment ? results.rows : results.rows;
    res.json({ status: "success", customers: data });
  }).catch(err => {
    console.error("❌ Customers fetch error:", err);
    res.status(500).json({ status: "error", message: "DB error" });
  });
});

app.get("/api/review-report", (req, res) => {
  const sql = `
      SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name, p.name AS product_name
      FROM reviews r
      JOIN users u ON r.userId = u.id
      JOIN products p ON r.productId = p.id
      ORDER BY r.created_at DESC
  `; // Assuming a 'reviews' table exists for the local version
  query(sql).then(results => {
    const data = isRenderEnvironment ? results.rows : results.rows;
    const formattedResults = data.map(row => ({
      id: row.id,
      product_name: row.product_name,
      user_name: `${row.first_name} ${row.last_name}`,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at
    }));
    res.json(formattedResults);
  }).catch(err => {
    console.error("❌ Error fetching review report:", err);
    res.status(500).json({ error: "DB fetch error" });
  });
});

// =====================
// START SERVER (Using secured PORT constant)
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});