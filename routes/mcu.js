var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var router = express.Router();
var pg = require('pg');
var config = {
  user: 'agis', //env var: PGUSER 
  database: 'agis', //env var: PGDATABASE 
  password: 'pgadmin', //env var: PGPASSWORD 
  port: 5432, //env var: PGPORT 
  max: 10, // max number of clients in the pool 
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed 
};

	// var options = {
	// 	host: 'pod.opendatasoft.com',
	// 	port: 80,
	// 	path: '/api/records/1.0/search/?dataset=pod_gtin&q=' + "0" + item_code + '&facet=gpc_s_nm&facet=brand_nm&facet=owner_nm&facet=gln_nm&facet=prefix_nm'
	// };

// Initiate connection pool
var pool = new pg.Pool(config);

var nok = "Request Error";

var ok = "Success";

/* GET home page. */
router.get('/test', function(req, res) {
  res.status(200).json({"msg": "succesful call"});
});
function escapeSpecialChars(jsonString) {

		return jsonString.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")
				.replace(/\t/g, "\\t")
				.replace(/\f/g, "\\f")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">");
}
function getProductData (upc, callback) {
	var item_code = upc;
	var body = new Buffer( 0 );
	var body = '';
		var options = {
		host: 'api.walmartlabs.com',
		port: 80,
		path: '/v1/items?apiKey=f6k74h2b5w459nv9rhu4u3ca&upc=' + upc
	};
	if(item_code) {
		http.get(options, function (response) {
			response.on("data", function(chunk) {
			body += chunk.toString("utf8");
			// res.status(200).send(body.brand_nm + " x1");
			// return res.status(200).json({brand_name: body.brand_nm, owner_name: body.owner_nm, img: body.brand_img});
			}).on("end", function (e) {
				try {
					body = JSON.parse(escapeSpecialChars(body));
				} catch (error) {
					console.log(body.items);
					body = JSON.parse(escapeSpecialChars(body));
				}							
				if(body.items) {
					var data = 
					{
						item_brand: body.items[0].brandName,
						item_name: body.items[0].name,
						item_code: body.items[0].upc,
						item_img: body.items[0].thumbnailImage,
						item_category: body.items[0].categoryPath
					};
					return callback(null, data);
					// return res.status(200).json(body);
				}
				else {
					return callback(null, body.errors[0]);
				}
			});
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
			return callback(e, null);
			// return res.status(400).msg(nok);
		});
	}
	else {
		console.log("entered 400");
		return callback(e, null);
		// return res.status(400).send("Invalid or empty query string");
	}
};

router.get('/login/:id/:pin', bodyParser.text(), function (req, res) {
	var user_id = req.params.id;
	var pin = req.params.pin;
	// connect to our database 
	pool.connect(function(err, client, done) {
		if(err) {
			console.error('error fetching client from pool', err);
			return res.status(404).send(nok);
		}
	 
		// execute a query on our database 
		client.query('SELECT user_id FROM users WHERE user_id = $1::NUMERIC AND pin = $2;', [user_id, pin], function (err, result) {

			done();
			if(err) {
				console.error('error running query', err);
				return res.status(404).send(nok);
			}
			console.log(result);
			if(result.rows.length) {
				// just print the result to the console 
				console.log(result.rows);
				return res.status(200).send("Yes");				
			}
			else {
				// just print the result to the console 
				console.log(result.rows);
				return res.status(200).send("No");					
			}
		});
	});	
});

router.get('/addToInventory/:id/:barcode', bodyParser.text(), function (req, res) {
	var user_id = req.params.id;
	var item_code = req.params.barcode;
	// connect to our database 
	var queries = ['SELECT inventory_items.item_id FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE items.item_code = $1 AND inventory_items.user_id = $2;', 'SELECT item_id FROM items WHERE item_code = $1;','INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5) RETURNING item_id, item_name;', 'INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3) RETURNING item_qty;'];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(400).send(nok);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], [item_code, user_id], function (err, result) {
					if(err) {
						console.log(err);
						rollback(client, done);
						return res.status(400).send(nok);
					}
					if(result.rows.length){
						// If item already exists in inventory, update qty by one
						client.query('UPDATE inventory_items SET item_qty = item_qty + 1 FROM items WHERE items.item_id = inventory_items.item_id AND items.item_code = $1 AND inventory_items.user_id = $2 RETURNING items.item_name as item_name, inventory_items.item_qty as item_qty;', [item_code, user_id], function (err, update_result) {
							if(err) {
								console.log(err);
								rollback(client, done);
								return res.status(400).send(nok);										
							}
							console.log(update_result.rows[0]);
							client.query('COMMIT', done);
							return res.status(200).send(update_result.rows[0].item_name.substring(0, 14) + " x" + update_result.rows[0].item_qty);
						});	
					}
					else {
						client.query(queries[1], [item_code], function (err, result1) {
							if(err) {
								rollback(client, done);
								return res.status(400).send(nok);
							}
							if(result1.rows.length) {
								// Item Already Exists in Local Database, So automatically add it to inventory
									client.query('INSERT INTO inventory_items (item_id, user_id, item_qty) SELECT item_id, $1 as user_id, 1 as item_qty FROM items WHERE item_code = $2 ;', [user_id, item_code], function (err) {
										if(err) {
											console.log("Entered query error");
											console.log(err);
											rollback(client, done);
											return res.status(400).send(nok);										
										}
										client.query('COMMIT', done);
										return res.status(200).send(ok);
									});							
							}
							else {
								// Item does not exist neither in local inventory nor items table. So add to both
								getProductData(item_code, function(upc_err, productData) {
									client.query(queries[2], [productData.item_name, productData.item_brand, productData.item_category, productData.item_img, productData.item_code], function newProduct (err, result2) {
										console.log("Entered Get Product Data");
										console.log(productData);
										// If there is an error, send error response to device
										if(productData.code == 4023) {
											console.log("entered error 4023");
											client.query('COMMIT', done);
											return res.status(200).send("Item unknown");
										}										
										if(err || upc_err) {
											rollback(client, done);
											if(upc_err) {
												return res.status(200).send("Item unknown");
											}
											else {
												return res.status(404).send(nok);
											}
										}
										if(result2.rows.length) {
											client.query(queries[3], [result2.rows[0].item_id, user_id, 1], function (err, insert_result) {
												if(err) {
													console.log(err);
													rollback(client, done);
													return res.status(404).send(nok);
												}
												client.query('COMMIT', done);
												return res.status(200).send(result2.rows[0].item_name.substring(0, 14) + " x" + insert_result.rows[0].item_qty);
											});	
										}
										else {
											console.log("Error while adding product to items inventory");
											rollback(client, done);
											return res.status(404).send(nok);										
										}
									});
								});
							}
						});
					}				
				});
			});
		});
	});
});

router.get('/removeFromInventory/:id/:barcode', bodyParser.text(), function (req, res) {
	var user_id = req.params.id;
	var item_id = req.params.barcode;
	console.log(item_id);
	// connect to our database 
	var queries = ['UPDATE inventory_items SET item_qty = item_qty - 1 FROM items WHERE items.item_id = inventory_items.item_id AND items.item_code = $1 AND inventory_items.user_id = $2 RETURNING items.item_name as item_name, inventory_items.item_qty as item_qty;', 'INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1,$2);'];
	var queryParams = [[item_id, user_id], [item_id, user_id]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				return console.error('error fetching client from pool', err);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err, update_result) {
					if(err) {
						console.log(err);
						rollback(client, done);
						return res.status(404).send(nok);
					}
					if (update_result.rows[0].item_qty >= 0) {
						client.query('COMMIT', done);
						return res.status(200).send(update_result.rows[0].item_name.substring(0, 14) + " x" + update_result.rows[0].item_qty);
					}
					else {
						if(update_result.rows[0].item_qty < 0) {
							rollback(client, done);
							return res.status(200).send("404");							
						}
						client.query(queries[1], queryParams[1], function (err) {
							if(err) {
								rollback(client, done);
								return res.status(404).send(nok);
							}
							client.query('COMMIT', done);
							return res.status(200).send(ok);
						});						
					}			
				});
			});
		});
	});
});

router.get('/viewUsers', bodyParser.text(), function (req, res) {
	var user_id = req.params.uid;
	// connect to our database 
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(404).send(nok);
			}

		// execute a query on our database 
		client.query('SELECT username FROM users ORDER BY user_id DESC LIMIT 5;', [user_id], function (err, result) {

			done();

			if(err) {
			  console.error('error running query', err);
			  return res.status(404).send(nok);
			}

			// user response
			console.log(result.rows);
			return res.status(200).json(result.rows);

		});
	});	
});

function rollback(client, done) {
  client.query('ROLLBACK', function(err) {
    //if there was a problem rolling back the query
    //something is seriously messed up.  Return the error
    //to the done function to close & remove this client from
    //the pool.  If you leave a client in the pool with an unaborted
    //transaction weird, hard to diagnose problems might happen.
    return done(err);
  });
};

/*  */
router.post('/post', function(req, res) {
  console.log(req.body);
  res.status(200).json({msg: "Post received"});
});

module.exports = router;
