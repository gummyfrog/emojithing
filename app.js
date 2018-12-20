var Magi = require('./src/magi.js');
var Updater = require('./src/updater.js');
var helperFunctions = require('./src/helperFunctions.js')
var Index = require('./routes/index');
var axios = require('axios');
var nodeCleanup = require('node-cleanup');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var stylus = require('stylus');

var app = express();
var magi = new Magi();
var updater = new Updater();

updater.name = "frogeye";
updater.desc = "Crystal Ball for the Ultimate Socialite.";

const index = new Index();

nodeCleanup(function (exitCode, signal) {
	if (signal) {
		updater.post({
			'status': 'offline'
		}).then(() => {
			process.kill(process.pid, signal);
		});
		nodeCleanup.uninstall(); // don't call cleanup handler again
		return false;
	}
});

magi.start();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(stylus.middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_jszip', express.static(__dirname + '/node_modules/jszip/'));
app.use('/node_sylb-haiku', express.static(__dirname + '/node_modules/sylb-haiku/'));
app.use('/', index.router);

app.get('/requests', function (req, res) {
	res.send({
		"requests": magi.requestCount,
		"occupied": magi.occupiedClientNumbers.length,
		"interval": magi.searchInterval,
		"totalCollected": magi.totalTweetsCollected,
		"loopCollected": magi.tweetsCollectedThisLoop,
		"queryInfo": helperFunctions.objarrayhtml(magi.queryInfo),
		"clientInfo": helperFunctions.objarrayhtml(magi.clientInfo),
	});
})

app.post('/requests', function (req, res) {
	if (req.headers.authentication == process.env.PASSWORD) {
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
	if(req.headers.authentication == 'very_secret_password') {
		console.log(req.body);
		magi.addEarlyCompletionQuery(req.body.complete);
		res.send('Recieved...');
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

function post(obj) {
	return axios.post('http://gummyfrog.herokuapp.com/site', {
		frogeye: obj
	}, {
		"headers": {
			"authentication": process.env.AUTHENTICATION
		}
	})
}

nodeCleanup(function (exitCode, signal) {
	if (signal) {
		post({
			'status': 'offline'
		}).then(() => {
			process.kill(process.pid, signal);
		});
		nodeCleanup.uninstall(); // don't call cleanup handler again
		return false;
	}
});

setInterval(function () {
	updater.post({
		"status": 'online',
		"active-clients": magi.occupiedClientNumbers.length,
		"active-requests": magi.requestCount
	})
}, 1000 * 9);
module.exports = app;

// var options = {
//   query: 'developers',
//   count: 200,
//   config: {
//     depth: 2,
//     childQueries:0,
//     cutoffs:{
//       words:{
//         type:'percentage',
//         value:50
//       },
//       emojis:{
//         type:'percentage',
//         value:10
//       },
//       hashtags:{
//         type:'percentage',
//         value:30
//       },
//       decimate:{
//         step: 1,
//       }
//     },
//     tooLow: 100,
//     divisor: 2
//   }
// };
// curl -d '{"bolopo":{}}' -H "Content-Type: application/json, authentication: cicadas2565" -X POST http://localhost:3000/site

