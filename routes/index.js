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

router.get('/getProduct', bodyParser.text(),function(req, res) {
	var qry_string = req.query.q;
	var options = {
		host: 'pod.opendatasoft.com',
		port: 80,
		path: '/api/records/1.0/search/?dataset=pod_gtin&q=' + "0" + qry_string + '&facet=gpc_s_nm&facet=brand_nm&facet=owner_nm&facet=gln_nm&facet=prefix_nm'
	};
	if(qry_string)
	{
		http.get(options, function (response) {
			response.on("data", function(chunk) {
			var item_object = JSON.parse(chunk).records[0].fields;
			// res.set({'Content-Type': 'text/plain; charset=utf-8'});
			res.status(200).send(item_object.brand_nm + " x1");
			// return res.status(200).json({brand_name: item_object.brand_nm, owner_name: item_object.owner_nm, img: item_object.brand_img});
			});
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	}
	else
	{
		res.status(404).send("Invalid or empty query string");
	}
});

router.post('/login', function (req, res) {
	var user_data = req.body.data;
	// connect to our database 
	pool.connect(function(err, client, done) {
	  if(err) {
	    return console.error('error fetching client from pool', err);
	  }
	 
	  // execute a query on our database 
	  client.query('SELECT username, password FROM users WHERE username = $1 AND password = $2;', [user_data.username, user_data.password], function (err, result) {

	  	done();

	    if(err) {
	      return console.error('error running query', err);
	    }
	 
	    // just print the result to the console 
	    console.log(result.rows[0]); // outputs: { name: 'brianc' } 
	 
	  });
	});	
});

router.post('/addToInventory', function (req, res) {
	var data = req.body.data;
	// connect to our database 
	var queries = ['UPDATE inventory_items SET item_qty = item_qty + $1 WHERE item_code = $2;', 'INSERT INTO items (item_name, item_brand, item_category, item_img, item_code) VALUES ($1,$2,$3,$4,$5) RETURNING item_id;', 'INSERT INTO inventory_items (item_id, user_id, item_qty) VALUES ($1,$2,$3);'];
	var queryParams = [[data.item_qty, data.item_code], [data.item_name, data.item_brand, data.item_category, data.item_img, data.item_code], [null, data.user_id, data.item_qty]];
	process.nextTick(function () {
		pool.connect(function(err, client, done) {
			if(err) {
				return console.error('error fetching client from pool', err);
			}
			client.query('BEGIN', function (err) {
				// execute a query on our database 
				client.query(queries[0], queryParams[0], function (err) {
					if(err) return rollback(client, done);
					client.query(queries[1], queryParams[1], function (err, result) {
						if(err) return rollback(client, done);
						queryParams[2][0] = result.rows[0].item_id;
						client.query(queries[2], queryParams[2], function (err) {
							if(err) return rollback(client, done);
							client.query('COMMIT', done);
						});	
					});				
				});
			});
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
