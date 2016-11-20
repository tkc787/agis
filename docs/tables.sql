
-- Command for creating users table

CREATE TABLE users (
user_id SERIAL PRIMARY KEY,
name varchar(50) NOT NULL,
last_name varchar(50) NOT NULL,
username varchar(50) NOT NULL,
email varchar(50) NOT NULL,
password varchar(15) NOT NULL,
pin varchar(4) NOT NULL,
UNIQUE (username)
);

-- command for creating items table

CREATE TABLE items (
item_id SERIAL PRIMARY KEY,
item_name varchar(50) NOT NULL,
item_brand varchar(50) NOT NULL,
item_category varchar(50) NOT NULL,
item_img varchar (255) NOT NULL,
item_code varchar (50) UNIQUE
)

-- command for creating inventory_items table

CREATE TABLE inventory_items (
item_id int NOT NULL REFERENCES items(item_id),
user_id int NOT NULL REFERENCES users(user_id),
stamp timestamp,
item_qty int NOT NULL
);

-- command for creating user_inventory_items table

CREATE TABLE user_inventory_items (
user_item_id SERIAL PRIMARY KEY,
user_id int NOT NULL REFERENCES users(user_id),
user_item_name varchar(50),
user_item_brand varchar(50),
user_item_category varchar(50),
stamp timestamp,
item_qty int NOT NULL
);

-- Command for creating shopping list table

CREATE TABLE shopping_list_items (
item_id int NOT NULL REFERENCES items(item_id),
user_id int NOT NULL REFERENCES users(user_id),
stamp timestamp
);

-- Command for creating shopping list table

CREATE TABLE notifications (
notification_id SERIAL PRIMARY KEY,
user_id int NOT NULL REFERENCES users(user_id),
item_id int REFERENCES items(item_id),
stamp timestamp,
content text NOT NULL
);