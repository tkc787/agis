-- Login Query START

SELECT username, password FROM users WHERE username = $1 AND password = $2;

-- END

-- addToInventory Query START

UPDATE inventory_items SET item_qty = item_qty + $1 WHERE item_code = $2;

INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5);

INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3);

-- END

-- removeFromInventory Query START

UPDATE inventory_items SET item_qty = item_qty - $1 WHERE item_code = $2;

-- IF item_qty = 0, INSERT INTO shopping_list_items

INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1,$2);

-- END

-- viewInventory Query START

SELECT * FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE user_id = $1;

-- END

-- addToShoppingList START

INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1, $2);

-- END

-- removeFromShoppingList START

DELETE FROM  shopping_list_items WHERE user_id = $1;

-- END

-- viewShoppingList START

SELECT * FROM shopping_list_items JOIN items ON shopping_list_items.item_id = items.item_id WHERE user_id = $1;

-- END

-- addNotifications START

INSERT INTO notifications (user_id, item_id, content) WHERE user_id = $1;

-- END

-- viewNotifications START

SELECT * FROM notifications WHERE user_id = $1;

-- END

-- clearNotification START

DELETE FROM notifications WHERE user_id = $1;

-- END

-- getUserList START

SELECT username FROM users ORDER BY user_id DESC LIMIT 5;

-- END
 

