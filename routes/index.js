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
// instantiate a new client 
// the client will read connection information from 
// the same environment variables used by postgres cli tools 

var pool = new pg.Pool(config);

var nok = {msg: "error while processing request"};

var ok = {msg: "Succesful transaction"};

// connect to our database 
pool.connect(function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
 
  // execute a query on our database 
  client.query('SELECT $1::text as name', ['brianc'], function (err, result) {

  	done();

    if(err) {
      return console.error('error running query', err);
    }
 
    // just print the result to the console 
    console.log(result.rows[0]); // outputs: { name: 'brianc' } 
  });
});

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
router.get('/getProductData/:code',function(req, res) {
	var qry_string = req.params.code;
	var body = new Buffer( 0 );
	var body = '';
	// var options = {
	// 	host: 'pod.opendatasoft.com',
	// 	port: 80,
	// 	path: '/api/records/1.0/search/?dataset=pod_gtin&q=' + "0" + qry_string + '&facet=gpc_s_nm&facet=brand_nm&facet=owner_nm&facet=gln_nm&facet=prefix_nm'
	// };
		var options = {
		host: 'api.walmartlabs.com',
		port: 80,
		path: '/v1/items?apiKey=f6k74h2b5w459nv9rhu4u3ca&upc=' + qry_string
	};
	if(qry_string) {
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
					return res.status(200).json(data);
				}
				else {
					return res.status(404).json(nok);
				}
			});
		}).on('error', function(e) {
			console.log(e);
			console.log("Got error: " + e.message);
			return res.status(404).json(nok);
		});
	}
	else {
		console.log("entered 404");
		return res.status(404).send("Invalid or empty query string");
	}
});

router.post('/login', function (req, res) {
	var data = JSON.parse(req.body.data);
	console.log(data.username);
	// connect to our database 
	pool.connect(function(err, client, done) {
		if(err) {
			console.error('error fetching client from pool', err);
			return res.status(404).json(nok);
		}
	 
		// execute a query on our database 
		client.query('SELECT user_id FROM users WHERE username = $1 AND password = $2;', [data.username, data.password], function (err, result) {

			done();

		if(err) {
			console.error('error running query', err);
			return res.status(404).json(nok);
		}
		if(!result.rows.length) {
			return res.status(400).json({msg: "Username or password incorrect, please try again"});
		}
		// just print the result to the console 
		console.log(result.rows);
		return res.status(200).json({user_data: result.rows[0].user_id});
		});
	});	
});

router.post('/addToInventory', function (req, res) {
	var data = JSON.parse(req.body.data);
	console.log(data);
	// connect to our database 
	var queries = ['SELECT inventory_items.item_id FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE item_name = $1 and item_brand = $2 AND user_id = $3 AND item_qty > 0;', 'SELECT item_id FROM items WHERE item_name = $1 AND item_brand = $2;','INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5) RETURNING item_id;', 'INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3);'];
	var queryParams = [[data.item_name, data.item_brand, data.user_id], [data.item_name, data.item_brand],[data.item_name, data.item_brand, data.item_category, data.item_img, data.item_code], [null, data.user_id, data.item_qty]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(400).json(nok);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err, result) {
					if(err) {
						console.log("Entered query 1 error");
						rollback(client, done);
						return res.status(400).json(nok);
					}
					if(result.rows.length){
						console.log("Entered query 2 error");
						rollback(client, done);
						return res.status(400).json({msg: "Item already exists in inventory"});
					}
					client.query(queries[1], queryParams[1], function (err, result1) {
						if(err) {
							console.log("Entered query 3 error");
							rollback(client, done);
							return res.status(400).json(nok);
						}
						if(result1.rows.length){
							// Item Exists in local database
								client.query('INSERT INTO inventory_items (item_id, user_id, item_qty) SELECT item_id, $1 as user_id, $2 as item_qty FROM items WHERE item_name = $3 AND item_brand = $4;', [data.user_id, data.item_qty, data.item_name, data.item_brand], function (err) {
									if(err) {
										console.log("Entered query error");
										console.log(err);
										rollback(client, done);
										return res.status(400).json(nok);										
									}
									console.log("Successfully entered 23505");
									client.query('COMMIT', done);
									return res.status(200).json(ok);
								});							
						}
						else{
							// Item does not exist neither in the local database nor the walmart api, hence add to both
							client.query(queries[2], queryParams[2], function (err, result2) {
								if(err) {
									console.log(err);
									rollback(client, done);
									return res.status(404).json(nok);
								}
								if(result2) {
									queryParams[3][0] = result2.rows[0].item_id;
									console.log(queryParams[3]);
									client.query(queries[3], queryParams[3], function (err) {
										if(err) {
											console.log(err);
											rollback(client, done);
											return res.status(404).json(nok);
										}
										client.query('COMMIT', done);
										return res.status(200).json(ok);
									});	
								}
							});
						}
					});				
				});
			});
		});
	});
});

router.post('/deleteFromInventory', function (req, res) {
	var data = JSON.parse(req.body.data);
	console.log(data);
	// connect to our database 
	var queries = ['UPDATE inventory_items SET item_qty = 0 WHERE item_id = $1 AND user_id = $2 RETURNING item_qty;', 'INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1,$2);'];
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
						return res.status(404).json(nok);
					}
					if (!data.list_bool) {
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					}
					else {
						client.query(queries[1], queryParams[1], function (err) {
							if(err) {
								rollback(client, done);
								return res.status(404).json(nok);
							}
							client.query('COMMIT', done);
							return res.status(200).json({msg: "Succesful transaction"});
						});
					}				
				});
			});
		});
	});
});

router.post('/updateInventory', function (req, res) {
	var data = JSON.parse(req.body.data);
	console.log(data);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
		// execute a query on our database 
		client.query('UPDATE inventory_items SET item_qty = $1 WHERE item_id = $2 AND user_id = $3;', [data.item_qty, data.item_id, data.user_id], function (err) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}

			res.status(200).json(ok);

		});
	});	
});

router.get('/viewInventory/:uid', function (req, res) {
	var user_id = req.params.uid;
	// connect to our database 
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(404).json(nok);
			}

		// execute a query on our database 
		client.query('SELECT * FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE user_id = $1 AND item_qty > 0;', [user_id], function (err, result) {

			done();

			if(err) {
			  console.error('error running query', err);
			  return res.status(404).json(nok);
			}

			// just print the result to the console 
			console.log(result.rows);
			return res.status(200).json(result.rows);

		});
	});	
});

router.post('/addToShoppingList', function (req, res) {
	var data = JSON.parse(req.body.data);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
		// execute a query on our database 
		client.query('INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1, $2) RETURNING item_id;', [data.item_id, data.user_id], function (err, result) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}

			res.status(200).json({item_id: result.rows[0].item_id});

		});
	});	
});

router.post('/removeFromShoppingList', function (req, res) {
	var data = JSON.parse(req.body.data);
	console.log(data);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);

	  }
	 
		// execute a query on our database 
		client.query('DELETE FROM shopping_list_items WHERE user_id = $1 AND item_id = $2;', [parseInt(data.user_id), data.item_id], function (err) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}
			console.log("success");
			return res.status(200).json(ok);

		});
	});	
});

router.get('/viewShoppingList/:uid', function (req, res) {
	var user_id = req.params.uid;
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
		// execute a query on our database 
		client.query('SELECT * FROM shopping_list_items JOIN items ON shopping_list_items.item_id = items.item_id WHERE user_id = $1;', [user_id], function (err, result) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}
			if(result.rows) {
				res.status(200).json(result.rows);
			}
			else{
				res.status(200).json([]);
			}
		});
	});	
});

router.get('/getItemDetail/:uid/:iid', function (req, res) {
	var item_id = req.params.iid;
	var user_id = req.params.uid;
	console.log(item_id);
	console.log(user_id);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    console.error('error fetching client from pool', err);
			return res.status(404).json(nok);
	  }
	 
		// execute a query on our database 
		client.query('SELECT * FROM inventory_items JOIN items ON inventory_items.item_id = items.item_id WHERE user_id = $1 AND inventory_items.item_id = $2;', [user_id, item_id], function (err, result) {

			done();

			if(err) {
			  console.error('error running query', err);
			  return res.status(404).json(nok);
			}

			return res.status(200).json(result.rows[0]);

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
