-- ============================================================
-- SQL script to create the database
-- ============================================================

-- Personalized types
CREATE TYPE user_role    AS ENUM ('admin', 'econome', 'cook');
CREATE TYPE movement_type AS ENUM ('entry', 'kitchen_exit', 'liquid_sale_exit', 'loss');
CREATE TYPE alert_type   AS ENUM ('threshold', 'expiration');

-- Users
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       user_role NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Suppliers
CREATE TABLE suppliers (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    phone VARCHAR(20)
);

-- Articles (définition générique d'un produit)
CREATE TABLE articles (
    id                SERIAL PRIMARY KEY,
    category_id       INT NOT NULL,
    name              VARCHAR(100) NOT NULL,
    unit              VARCHAR(20) NOT NULL,
    liquid_sale_price NUMERIC(10,2),
    stock_quantity    INT NOT NULL DEFAULT 0,
    min_threshold     INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Lots (chaque livraison physique d'un article)
CREATE TABLE lots (
    id             SERIAL PRIMARY KEY,
    article_id     INT NOT NULL,
    supplier_id    INT,
    quantity       INT NOT NULL,
    purchase_price NUMERIC(10,2) NOT NULL,
    expiry_date    DATE,
    qr_code_path   VARCHAR(255),
    received_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id)  REFERENCES articles(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Movements
CREATE TABLE movements (
    id         SERIAL PRIMARY KEY,
    article_id INT NOT NULL,
    lot_id     INT,
    user_id    INT NOT NULL,
    type       movement_type NOT NULL,
    quantity   INT NOT NULL,
    motive     VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (lot_id)     REFERENCES lots(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
);

-- Alerts
CREATE TABLE alerts (
    id         SERIAL PRIMARY KEY,
    article_id INT,
    type       alert_type NOT NULL,
    message    VARCHAR(255),
    read       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);
