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
router.get('/getProductData/:code', bodyParser.text(),function(req, res) {
	var qry_string = req.params.code;
	var body = new Buffer( 0 );
	var item_object;
	// var options = {
	// 	host: 'pod.opendatasoft.com',
	// 	port: 80,
	// 	path: '/api/records/1.0/search/?dataset=pod_gtin&q=' + "0" + qry_string + '&facet=gpc_s_nm&facet=brand_nm&facet=owner_nm&facet=gln_nm&facet=prefix_nm'
	// };
		var options = {
		host: 'api.walmartlabs.com',
		port: 80,
		path: '/v1/items?apiKey=f6k74h2b5w459nv9rhu4u3ca&upc=035000521019'
	};
	if(qry_string) {
		http.get(options, function (response) {
			response.setEncoding('utf8');
			response.on("data", function(chunk) {
			item_object = chunk.toString("utf8");

			// res.status(200).send(item_object.brand_nm + " x1");
			// return res.status(200).json({brand_name: item_object.brand_nm, owner_name: item_object.owner_nm, img: item_object.brand_img});
			}).on("end", function (e) {
				console.log("closing POD connection");
				try {
					item_object = JSON.parse(escapeSpecialChars(item_object));
				} catch (error) {
					item_object = JSON.parse(escapeSpecialChars(item_object));
					// while(!item_object) {
					// 	try {
					// 		item_object = JSON.parse((item_object.toString().trim()));
					// 	} catch (error) {
					// 		console.log(error);
					// 	}
					// }	
				}							
				// console.log(item_object);
				return res.status(200).send(item_object);
			});
		}).on('error', function(e) {
			console.log(e);
			console.log("Got error: " + e.message);
			return res.status(404).msg(nok);
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
	var queries = ['UPDATE inventory_items SET item_qty = item_qty + $1 WHERE item_id = $2;', 'INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5) RETURNING item_id;', 'INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3);'];
	var queryParams = [[data.item_qty, data.item_code], [data.item_name, data.item_brand, data.item_category, data.item_img, data.item_code], [null, data.user_id, data.item_qty]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				console.error('error fetching client from pool', err);
				return res.status(404).json(nok);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err) {
					if(err) {
						rollback(client, done);
						return res.status(404).json(nok);
					}
					client.query(queries[1], queryParams[1], function (err, result) {
						if(err) {
							rollback(client, done);
							return res.status(404).json(nok);
						}
						queryParams[2][0] = result.rows[0].item_id;
						console.log(queryParams[2]);
						client.query(queries[2], queryParams[2], function (err) {
							if(err) {
								console.log(err);
								rollback(client, done);
								return res.status(404).json(nok);
							}
							client.query('COMMIT', done);
							return res.status(200).json(ok);
						});	
					});				
				});
			});
		});
	});
});

router.post('/removeFromInventory', function (req, res) {
	var data = JSON.parse(req.body.data);
	// connect to our database 
	var queries = ['UPDATE inventory_items SET item_qty = item_qty - $1 WHERE item_id = $2 AND user_id = $3 RETURNING item_qty;', 'INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1,$2);'];
	var queryParams = [[data.item_qty, data.item_id, data.user_id], [data.item_id, data.user_id]];
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
					if (result.rows[0].item_qty > 0) {
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					}
					client.query(queries[1], queryParams[1], function (err) {
						if(err) {
							rollback(client, done);
							return res.status(404).json(nok);
						}
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					});				
				});
			});
		});
	});
});

router.post('/deleteFromInventory', function (req, res) {
	var data = JSON.parse(req.body.data);
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
					client.query(queries[1], queryParams[1], function (err) {
						if(err) {
							rollback(client, done);
							return res.status(404).json(nok);
						}
						client.query('COMMIT', done);
						return res.status(200).json({msg: "Succesful transaction"});
					});				
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
	var user_data = JSON.parse(req.body.data);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
		// execute a query on our database 
		client.query('INSERT INTO shopping_list_items (item_id, user_id) VALUES ($1, $2);', [data.item_id, data.user_id], function (err) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}

			res.status(200).json(result.rows);

		});
	});	
});

router.post('/removeFromShoppingList', function (req, res) {
	var user_data = JSON.parse(req.body.data);
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
		// execute a query on our database 
		client.query('DELETE FROM shopping_list_items WHERE user_id = $1 AND item_id = $2;', [data.user_id, data.item_id], function (err) {

			done();

			if(err) {
			  console.error('error running query', err);
			  res.status(404).json(nok);
			}

			res.status(200).json(ok);

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

			res.status(200).json(result.rows);

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

function doQuery(query, queryParams, cb) {
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
	  // execute a query on our database 
	  client.query('UPDATE inventory_items SET item_qty = item_qty + $1 WHERE item_code = $2;', [data.item_qty, data.item_code], function (err, result) {

	  	done();

	    if(err) {
	      return console.error('error running query', err);
	    }
	 
	    // just print the result to the console 
	    console.log(result.rows[0]); // outputs: { name: 'brianc' } 
	    if(cb) {
		    cb();
	    }	 
	  });
	});		
}

/*  */
router.post('/post', function(req, res) {
  console.log(req.body);
  res.status(200).json({msg: "Post received"});
});

module.exports = router;
