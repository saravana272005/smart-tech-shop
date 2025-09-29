-- Create database
CREATE DATABASE smartdb;

-- Use database
USE smartdb;

-- USERS TABLE
CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS TABLE
CREATE TABLE products (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    mrp_price DECIMAL(10,2),
    stock INT NOT NULL DEFAULT 0,
    description TEXT,
    specs JSON,
    images TEXT,
    rating DECIMAL(3,1) DEFAULT 0.0,
    reviews INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    variants JSON NOT NULL,
    ratingBreakdown JSON DEFAULT (
        JSON_OBJECT('5',0,'4',0,'3',0,'2',0,'1',0)
    )
);
---- Reviews

CREATE TABLE reviews (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    productId INT NOT NULL,
    userId INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (userId) REFERENCES users(id)
);


-- ORDERS TABLE
CREATE TABLE orders (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    orderId BIGINT NOT NULL,
    orderDate DATE NOT NULL,
    userEmail VARCHAR(255) NOT NULL,
    customerName VARCHAR(255) NOT NULL,
    customerPhone VARCHAR(255) NOT NULL,
    customerAddress TEXT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('Pending','Shipped','Cancelled','Delivered') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    products_summary JSON
);

-- SERVICES TABLE
CREATE TABLE services (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    deviceType VARCHAR(50) NOT NULL,
    model VARCHAR(255),
    issue TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
