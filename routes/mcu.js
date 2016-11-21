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

var nok = "error while processing request";

var ok = "Succesful transaction";

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
function getProductData (upc, cb) {
	var item_code = upc;
	var body = new Buffer( 0 );
	var body = '';
		var options = {
		host: 'api.walmartlabs.com',
		port: 80,
		path: '/v1/items?apiKey=f6k74h2b5w459nv9rhu4u3ca&upc=035000521019'
	};
	if(item_code) {
		http.get(options, function (response) {
			response.on("data", function(chunk) {
			body += chunk.toString("utf8");
			// res.status(200).send(body.brand_nm + " x1");
			// return res.status(200).json({brand_name: body.brand_nm, owner_name: body.owner_nm, img: body.brand_img});
			}).on("end", function (e) {
				console.log("closing POD connection");
				try {
					body = JSON.parse(escapeSpecialChars(body));
				} catch (error) {
					console.log(body.items);
					body = JSON.parse(escapeSpecialChars(body));
				}							
				console.log(body.items[0].itemId);
				var data = 
				{
					item_brand: body.items[0].brandName,
					item_name: body.items[0].name,
					item_code: body.items[0].upc,
					item_img: body.items[0].thumbnailImage,
					item_category: body.items[0].categoryPath
				};
				return res.status(200).json(body);
			});
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
			return res.status(400).msg(nok);
		});
	}
	else {
		console.log("entered 400");
		return res.status(400).send("Invalid or empty query string");
	}
};

router.post('/login', bodyParser.text(), function (req, res) {
	var data = JSON.parse(req.body.data);
	// connect to our database 
	pool.connect(function(err, client, done) {
		if(err) {
			console.error('error fetching client from pool', err);
			return res.status(404).send(nok);
		}
	 
		// execute a query on our database 
		client.query('SELECT user_id FROM users WHERE username = $1 AND pin = $2;', [data.username, data.pin], function (err, result) {

			done();

		if(err) {
			console.error('error running query', err);
			return res.status(404).send(nok);
		}

		// just print the result to the console 
		console.log(result.rows);
		return res.status(200).send(result.rows[0].user_id);
		});
	});	
});

router.get('/addToInventory/:id/:barcode', bodyParser.text(), function (req, res) {
	var user_id = req.params.id;
	var item_code = req.params.barcode;
	console.log(data);
	// connect to our database 
	var queries = ['SELECT inventory_items.item_id FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE items.item_code = $1 AND inventory_items.user_id = $2;', 'SELECT item_id FROM items WHERE item_code = $1;','INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5) RETURNING item_id;', 'INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3);'];
	var queryParams = [[item_code, user_id], [item_code], [data.item_name, data.item_brand, data.item_category, data.item_img, data.item_code], [null, data.user_id, data.item_qty]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(400).send(nok);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err, result) {
					if(err) {
						rollback(client, done);
						return res.status(400).send(nok);
					}
					if(result.rows.length){
						// If item already exists in inventory, update qty by one
						client.query('UPDATE inventory_items SET item_qty = item_qty + 1 FROM items WHERE items.item_item_id = inventory_items.item_item_id AND items.item_code = $1 AND inventory_items.user_id = $2 RETURNING items.item_name as item_name, inventory_items.item_qty as item_qty;', [item_code, user_id], function (err, update_result) {
							if(err) {
								console.log(err);
								rollback(client, done);
								return res.status(400).send(nok);										
							}
							console.log(update_result.rows[0]);
							client.query('COMMIT', done);
							return res.status(200).send(update_result.rows[0].item_name.substring(0, 13) + "x" + update_result.rows[0].item_qty);
						});	
					}
					client.query(queries[1], queryParams[1], function (err, result1) {
						if(err) {
							rollback(client, done);
							return res.status(400).send(nok);
						}
						if(result1.rows.length) {
							// Item Already Exists in Local Database, So automatically add it to inventory
								client.query('INSERT INTO inventory_items (item_id, user_id, item_qty) SELECT item_id, $1 as user_id, $2 as item_qty FROM items WHERE item_code = $3 ;', [user_id, 1, item_code], function (err) {
									if(err) {
										console.log("Entered query error");
										console.log(err);
										rollback(client, done);
										return res.status(400).send(nok);										
									}
									console.log("Successfully entered 23505");
									client.query('COMMIT', done);
									return res.status(200).send(ok);
								});							
						}
						else {
							// Item does not exist neither in local inventory nor items table. So add to both
							/*take all of this*/client.query(queries[2], queryParams[2], function (err, result2) {
								if(err) {
									console.log(err);
									rollback(client, done);
									return res.status(404).send(nok);
								}
								if(result2) {
									queryParams[3][0] = result2.rows[0].item_id;
									console.log(queryParams[3]);
									client.query(queries[3], queryParams[3], function (err) {
										if(err) {
											console.log(err);
											rollback(client, done);
											return res.status(404).send(nok);
										}
										client.query('COMMIT', done);
										return res.status(200).send(ok);
									});	
								}
							}); /* take this too*/
						}
					});				
				});
			});
		});
	});
});

router.post('/removeFromInventory', bodyParser.text(), function (req, res) {
	var data = JSON.parse(req.body.data);
	// connect to our database 
	var queries = ['UPDATE inventory_items SET item_qty = item_qty - 1 WHERE item_code = $1 AND user_id = $2;', 'INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1,$2);'];
	var queryParams = [[data.item_id, data.user_id], [data.item_id, data.user_id]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				return console.error('error fetching client from pool', err);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err, result) {
					if(err) {
						console.log(err);
						rollback(client, done);
						return res.status(404).send(nok);
					}
					if (result.rows[0].item_qty > 0) {
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					}
					client.query(queries[1], queryParams[1], function (err) {
						if(err) {
							rollback(client, done);
							return res.status(404).send(nok);
						}
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					});				
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
