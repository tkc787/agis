
-- Command for creating users table

CREATE TABLE users (
user_id SERIAL PRIMARY KEY,
name varchar(50),
last_name varchar(50),
username varchar(50),
email varchar(50),
password varchar(15),
pin varchar(4),
UNIQUE (username, email)
);

-- command for creating items table

CREATE TABLE items (
item_id SERIAL PRIMARY KEY,
item_name varchar(50),
item_brand varchar(50),
item_category varchar(50),
item_img varchar (255),
item_code varchar (50)
)

-- command for creating inventory_items table

CREATE TABLE inventory_items (
item_id int NOT NULL REFERENCES items(item_id),
user_id int NOT NULL REFERENCES users(user_id),
timestamp timestamp,
item_qty int NOT NULL
);

-- Command for creating shopping list table

CREATE TABLE shopping_list_items (
item_id int NOT NULL REFERENCES items(item_id),
user_id int NOT NULL REFERENCES users(user_id),
timestamp timestamp
);

-- Command for creating shopping list table

CREATE TABLE notifications (
notification_id SERIAL PRIMARY KEY,
user_id int NOT NULL REFERENCES users(user_id),
item_id int REFERENCES items(item_id),
timestamp timestamp,
content text
);