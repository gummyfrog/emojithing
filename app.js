var Magi = require('./src/magi.js');
var Updater = require('./src/updater.js');
var helperFunctions = require('./src/helperFunctions.js')
var Index = require('./routes/index');

var nodeCleanup = require('node-cleanup');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

nodeCleanup(function (exitCode, signal) {
	if (signal) {
		updater.post({'status': 'offline'})
			.then(() => {
				console.log('Posted Offline Message.');
				process.kill(process.pid, signal);
			})
			.catch((err) => {
				console.log('Error connecting to DB for cleanup, killing anyway.');
				process.kill(process.pid, signal);
			})

		nodeCleanup.uninstall(); // don't call cleanup handler again
		return false;
	}
});

setInterval(function () {
	updater.post({
		"status": 'online',
		"active-clients": magi.occupiedClientNumbers.length,
		"active-requests": magi.requestCount
	}).catch((err) => {
		console.log('Error connecting to DB.')
	})
}, 1000 * 9);


var app = express();
var magi = new Magi();
var updater = new Updater();
var index = new Index();

updater.name = "frogeye";
updater.desc = "Crystal Ball for the Ultimate Socialite.";
magi.start();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', index.router);

app.get('/requests', function (req, res) {
	console.log(`RQ to /requests ... ${res}`);
	res.send({
		"requests": magi.requestCount,
		"occupied": magi.occupiedClientNumbers.length,
		"interval": magi.searchInterval,
		"totalCollected": magi.totalTweetsCollected,
		"loopCollected": magi.tweetsCollectedThisLoop,
		"displayQuery": magi.displayQuery.join('<br>'),
		"displayProducts": magi.displayProducts,
		"displayTweets": magi.displayTweets,
	});
})



app.post('/requests', function (req, res) {
	if (req.headers.password == process.env.PASSWORD) {
		if (req.body.query && req.body.count && req.body.config.cutoffs && req.body.config.childQueries) {
			res.send('Request Recieved. Passing to Magi...');
			magi.request(req.body);
		} else {
			console.log('Bad object.')
			res.send('Nope! Your formatting is wrong. Check and recheck.');
		}
	} else {
		res.send('Request Denied. Check your password!')
	}
})

app.post('/earlyComplete', function(req, res) {
	console.log(req.body);	
	if(req.headers.password == 'very_secret_password') {
		console.log(req.body);
		magi.addEarlyCompletionQuery(req.body.complete);
		res.send('Recieved!');
	}	
})

app.post('/magiMove', function(req, res) {
	console.log(req.body);	
	if(req.headers.password == 'very_secret_password') {
		updater.store(`./src/magi/products/${req.body.filename}`);
		res.send('!Recieved!');
	}	
})

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app;
