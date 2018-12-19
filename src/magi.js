const fs = require('fs');
const Twitter = require('twitter');
const logUpdate = require('log-update');
const jsonfile = require('jsonfile')
const argv = require('minimist')(process.argv.slice(2));
const asyncLoop = require('node-async-loop');
const emojiTree = require('emoji-tree');
const moment = require('moment');
const Sentiment = require('sentiment')
const helperFunctions = require('./helperFunctions.js');

class Magi {

	constructor() {
		moment().format();
		this.sentiment = new Sentiment();
		this.commons = fs.readFileSync('./src/commons.txt', 'utf8').split(',');
		this.frames = ["•••", "•••", "o••", "•o•", "••o", "•••", "o••", "oo•", "ooo", "ooo", "ooo", "•oo", "••o"];
		this.occupiedClientNumbers = [];
		this.clients = [];
		this.fileNames = [];
		this.queryInfo = [];
		this.clientInfo = [];
		this.searchInterval = 8;
		this.frameCount = 0;
		this.requestCount = 0;
		this.tweetsCollectedThisLoop = 0;
		this.totalTweetsCollected = 0;
	};


	// Misc


	frameUpdate(msg) {
		this.frameCount += 0.001;
		const frame = this.frames[Math.floor(this.frameCount) % this.frames.length];
		logUpdate(` ${frame} ${msg}`)
	}


	// Start


	start() {
		this.initializeClients(this.clients);

		fs.readdir('./src/magi/requests', (err, files) => {
			if (files.length <= 2) {
				console.log(' o No requests found!')
				return;
			}
			for (var i = 2; i < files.length; i++) {
				jsonfile.readFile('./src/magi/requests/' + files[i], (err, obj) => {
					if (err) throw err;
					if (obj.clientNum != -1) {
						this.occupiedClientNumbers.push(obj.clientNum);
					}
				});
			}
		});

		fs.readdir('./src/magi/products', (err, files) => {
			if (files.length <= 1) {
				return;
			}

			console.log(' o Products:')
			for (var i = 1; i < files.length; i++) {
				console.log(' | ' + files[i])
			}
		});

		this.searchLoopRef = setInterval((function (self) {
			return function () {
				self.searchLoop();
			}
		})(this), 1000 * this.searchInterval);
	}


	// Twitter Client Management


	getRateLimit(client) {
		this.clients[client].get('application/rate_limit_status', {}, (error, response) => {
			if (error) {
				console.log('Hit the rate limit for Rate Limit checks. Ironic...')
			} else {
				console.log(' ⧖ Client #' + client + ' : ' + response.resources.search['/search/tweets'].remaining + ' / 450');
			}
		});
	}

	initializeClients(clientsArray) {
		fs.readdir('./src/clients', (err, files) => {
			if (files == undefined) {
				console.error('ERR: No directory for Twitter this.clients found. Should be named "this.clients".');
				process.exit();
			}

			console.log(' + Entered ./clients')
			for (var i = 1; i < files.length - 1; i++) {
				console.log(' | Reading / ' + files[i]);
				jsonfile.readFile('./src/clients/' + files[i], (err, obj) => {
					var client = new Twitter(obj);
					clientsArray.push(client);
				})
			}
		});
	}

	deoccupyclient(client) {
		// console.log('Index of ' + client + ' is ' + this.occupiedClientNumbers.indexOf(client));
		this.occupiedClientNumbers.splice(this.occupiedClientNumbers.indexOf(client), 1);
		// console.log('   Deoccupied Client #' + client);
	}

	occupyclient() {
		for (var i = 0; i < this.clients.length; i++) {
			if (this.occupiedClientNumbers.indexOf(i) == -1) {
				this.occupiedClientNumbers.push(i);
				// console.log('   Occupied Client #' + i)
				return i;
			}
		}

		return -1;
	}


	// Requests


	generateFileName(title, requestParent, parentFileName) {
		var generated;
		if (requestParent == null || parentFileName == null) {
			generated = (title + (Math.floor(Math.random() * 10000) + 1));
		} else {
			generated = (title + (Math.floor(Math.random() * 10000) + 1) + '<' + requestParent + '<' + parentFileName);
		}
		if (this.fileNames.indexOf(generated) != -1) {
			generated = this.generateFileName(title, requestParent);
		}
		return generated;
	}

	request(options) {

		var filename;
		if (options.hasOwnProperty('isChild') && options.isChild == true) {
			filename = this.generateFileName(options.query, options.requestParent, options.parentFileName);
		} else {
			filename = this.generateFileName(options.query);
			options.currentDepth = 0;
			options.parentFileName = filename;
			options.requestParent = '';
		}


		var assignedClient = this.occupyclient();
		var startTime = undefined;
		if (assignedClient == -1) {
			console.log('\n + Request for ' + options.query + '\n | LIMBO')
		} else {
			console.log('\n + Request for ' + options.query + '\n | ' + assignedClient)
			startTime = moment();
		}

		// obj.children.push(request({query: topHashtags[x].key, count: obj.count/1.2, depth: obj.config.depth, currentDepth: obj.currentDepth+1, childQueries: obj.config.childQueries, parentFileName:obj.parentFileName, requestParent: obj.query, cutoffs: obj.cutoffs, tooLow: obj.config.tooLow, isChild: true}))

		jsonfile.writeFileSync('./src/magi/requests/query-' + filename + '.json', {

			// configured at the start

			// these are outside of config because they are changed at each child.
			query: options.query,
			filename: filename,
			low_frequency: false,
			count: options.count,
			collectedTweets: 0,

			clientNum: assignedClient,
			// only used if isChild == true
			isChild: options.isChild,
			currentDepth: options.currentDepth,
			parentFileName: options.parentFileName,
			requestParent: options.requestParent,

			uniques: [],

			temp: {
				tweetTypes: [],
				wordpool: [],
				usableTweets: 0,
				times: [],
				popular_tweets: [],
				sentiments: []
			},

			config: {
				cutoffs: options.config.cutoffs,
				childQueries: options.config.childQueries,
				excludeRetweets: options.config.excludeRetweets,
				tooLow: options.config.tooLow,
				depth: options.config.depth,
				divisor: options.config.divisor
			},
			data: {},
			children: [],
			hashtagObjs: [],
			searchInfo: {
				window_count: 1,
				window_average: 0,
				requestTime: moment(),
				startTime: startTime,
				endTime: undefined,
			},
		}, (err) => {
			if (err) {
				console.error(err);
			}
		});

		console.log(' | ' + filename);
		return filename;
	}

	makeData(words, tweetTypes, times, popular, cutoffs, sentiments) {
		const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g

		let toRemove = [];
		var startTime = moment();

		console.log('\n\n + Please wait a moment... \n | This process takes a bit of time.');
		logUpdate(' : Collecting Hashtags...')

		let hashtags = words.filter((obj) => {
			this.frameUpdate('Collecting Hashtags');
			if (obj[0] == '#') {
				toRemove.push(obj);
				return true;
			}
		});

		helperFunctions.removeFrom(words, toRemove);
		logUpdate(' √ Collecting Hashtags')
		console.log(' : Collecting Emojis...')

		let emojis = [].concat.apply([], words.filter((string) => {
			this.frameUpdate('Collecting Emojis');
			if (string.match(emojiRegex)) {
				toRemove.push(string);
				return true;
			}
		}).map(string => this.getEmojisFromString(string)));

		helperFunctions.removeFrom(words, toRemove);


		logUpdate(' √ Collecting Emojis')

		var total = sentiments.length;

		var positiveTweets = sentiments.filter(num => Math.sign(num) == 1);
		helperFunctions.removeFrom(sentiments, positiveTweets);

		var negativeTweets = sentiments.filter(num => Math.sign(num) == -1);
		helperFunctions.removeFrom(sentiments, negativeTweets);

		var neutralTweets = sentiments;


		console.log(' | Done processing raw data.')
		console.log(' | Took ' + moment().from(startTime, true));
		console.log(' @ Making Dictionaries...')


		return ({
			positiveTweets: Math.round((positiveTweets.length / total) * 100),
			negativeTweets: Math.round((negativeTweets.length / total) * 100),
			neutralTweets: Math.round((neutralTweets.length / total) * 100),
			popular: popular,
			hashtags: helperFunctions.makeFrequencyDict(hashtags, cutoffs.hashtags),
			emojis: helperFunctions.makeFrequencyDict(emojis, cutoffs.emojis),
			words: helperFunctions.makeFrequencyDict(words, cutoffs.words),
			types: helperFunctions.makeFrequencyDict(tweetTypes, {
				type: 'cutoff',
				value: 0
			}),
			times: helperFunctions.decimate(times, cutoffs.decimate.step)
		})
	}

	requestComplete(obj) {
		jsonfile.writeFileSync('./src/magi/requests/incomplete_backups/query-' + obj.filename + '.json', obj);
		this.deoccupyclient(obj.clientNum)

		obj.data = this.makeData(obj.temp.wordpool, obj.temp.tweetTypes, obj.temp.times, obj.temp.popular_tweets, obj.config.cutoffs, obj.temp.sentiments)

		console.log(obj.data);
		if (obj.data.times.length <= 1) {
			delete obj.data.times;
		}

		obj.temp.wordpool = [];
		var topHashtags = helperFunctions.topFromDict(obj.data.hashtags, obj.config.childQueries);

		if (obj.currentDepth != obj.config.depth) {
			console.log(' X Requesting ' + topHashtags.length + ' more searches.');
			for (var x = 0; x < topHashtags.length; x++) {
				console.log(topHashtags[x].key.toLowerCase())
				console.log(obj.query.toLowerCase());

				if (topHashtags[x].key.toLowerCase() != obj.parentFileName.toLowerCase() && topHashtags[x].key.toLowerCase() != obj.query.toLowerCase()) {
					obj.children.push(this.request({
						query: topHashtags[x].key,
						count: obj.count / obj.config.divisor,
						currentDepth: obj.currentDepth + 1,
						isChild: true,
						parentFileName: obj.parentFileName,
						requestParent: obj.query,
						config: obj.config
					}))
				}
			}
		} else {
			console.log(' √ Desired Depth reached.');
			delete obj.hashtagObjs;
		}


		obj.searchInfo.endTime = moment();

		if (obj.isChild) {
			let parentObj = jsonfile.readFileSync('./src/magi/products/product-' + obj.parentFileName + '.json');
			parentObj.hashtagObjs.push(obj);
			jsonfile.writeFileSync('./src/magi/products/product-' + parentObj.filename + '.json', parentObj);
		} else {
			jsonfile.writeFileSync('./src/magi/products/product-' + obj.filename + '.json', obj);
		}

		if (fs.existsSync('./src/magi/requests/query-' + obj.filename + '.json')) {
			console.log(' - Unlinking ' + obj.filename);
			fs.unlinkSync('./src/magi/requests/query-' + obj.filename + '.json');
		} else {
			// console.log(' - Was already unlinked. Ghost request.')
		}
	};

	collapseProduct(product) {
		jsonfile.readFile('./src/magi/products/' + product, (err, obj) => {
			if (err) throw err;
			// change this to loop
			delete obj.parentFileName;
			delete obj.requestParent;
			delete obj.clientNum;
			delete obj.config;
			delete obj.isChild;
			delete obj.uniques;
			delete obj.nextWindow;
			delete obj.tweets_this_window;
			delete obj.temp;
			delete obj.count;
			delete obj.low_frequency;
			delete obj.collectedTweets;

			for (var key in obj.hashtagObjs) {
				delete obj.hashtagObjs[key].parentFileName;
				delete obj.hashtagObjs[key].requestParent;
				delete obj.hashtagObjs[key].clientNum;
				delete obj.hashtagObjs[key].config;
				delete obj.hashtagObjs[key].isChild;
				delete obj.hashtagObjs[key].uniques;
				delete obj.hashtagObjs[key].nextWindow;
				delete obj.hashtagObjs[key].tweets_this_window;
				delete obj.hashtagObjs[key].temp;
				delete obj.hashtagObjs[key].count;
				delete obj.hashtagObjs[key].low_frequency;
				delete obj.hashtagObjs[key].collectedTweets;
			}

			helperFunctions.trimData(obj.data);
			obj.hashtagObjs = helperFunctions.formatHashtagObjs(obj.hashtagObjs);
			jsonfile.writeFileSync('./magi/products/product-' + product + '-formatted.json', obj);
		});
	}


	// Search


	searchLoop() {
		this.tweetsCollectedThisLoop = 0;
		console.log('\n')
		console.log(' ⧗ ' + moment().format("MMM Do, h:mm:ss a"))
		console.log(this.occupiedClientNumbers);
		fs.readdir('./src/magi/requests', (err, files) => {
			console.log(' + Entered /requests')
			this.requestCount = files.length - 2;

			if (files.length <= 2) {
				console.log(' o No requests found!')
				return;
			}

			// looping through requests...
			this.queryInfo = [];
			this.clientInfo = [];
			for (var i = 2; i < files.length; i++) {
				// console.log(i + ' / ' + files.length);
				jsonfile.readFile('./src/magi/requests/' + files[i], (err, obj) => {
					if (obj == undefined) {
						console.log(' e Invalid file.');
						return;
					}

					if (obj.clientNum == -1) {
						obj.clientNum = this.occupyclient();
						if (obj.clientNum == -1) {
							return;
						} else {
							console.log(' O Brought ' + obj.query + ' out of limbo.');
							obj.searchInfo.startTime = moment();
						}
					}

					// check if search is complete before searching
					// searching

					console.log(' | Searching Twitter for ' + obj.query + ' with Client #' + obj.clientNum);
					var reset = '???';

					if (obj.nextWindow == null || obj.nextWindow == 'err' || obj.nextWindow == undefined || obj.nextWindow == 0) {
						this.clients[obj.clientNum].get('application/rate_limit_status', {}, (error, data, response) => {
							// console.log('getting new time...')
							if (error) {
								console.error(error);
								obj.nextWindow = 'err'
							} else {
								obj.nextWindow = data.resources.search['/search/tweets'].reset;
								// console.log(moment.unix(obj.nextWindow))
								// console.log(moment(moment.unix(obj.nextWindow).diff(moment())).format('mm:ss') )
							}
						});
					} else {
						reset = moment(moment.unix(obj.nextWindow).diff(moment())).format('mm:ss')
					}

					// this.getRateLimit(obj.clientNum);
					this.clients[obj.clientNum].get('search/tweets', {
						q: obj.query,
						result_type: 'recent',
						lang: 'en',
						count: 100
					}, (error, tweets, response) => {
						if (error) {
							console.log(error);
							console.log(obj.clientNum + ' ran out of requests.');
							console.log(this.getRateLimit(obj.clientNum))
							return;
						}

						if (tweets.statuses.length == 0) {
							console.log('No tweets found for ' + obj.query + '. What? Unlinking.');
							this.deoccupyclient(obj.clientNum);
							if (fs.existsSync('./src/magi/requests/query-' + obj.filename + '.json')) {
								console.log(' - Unlinking ' + obj.filename);
								fs.unlinkSync('./src/magi/requests/query-' + obj.filename + '.json');
							}
							return;
						}

						let savedExample;
						asyncLoop(tweets.statuses, (item, next) => {

							if (obj.uniques.includes(item.user.id_str)) {
								// user is not unique
							} else {

								if (item.retweeted_status != null) {
									obj.temp.tweetTypes.push('RT');
									if (item.retweet_count > 100 && !obj.temp.popular_tweets.includes(item.retweeted_status.id_str)) {
										// storing popular tweet ids, so that they can be embedded dynamically
										obj.temp.popular_tweets.push(item.retweeted_status.id_str);

										// console.log('pushed greater retweet count to populars')
									}
								} else {
									obj.temp.tweetTypes.push('OC');
								}

								if (Math.floor(Math.random() * 4) + 1 == 3) {
									savedExample = item.text;
								}

								obj.temp.usableTweets += 1
								obj.tweets_this_window += 1;
								obj.collectedTweets += 1;
								obj.uniques.push(item.user.id_str);
								obj.temp.sentiments.push(this.sentiment.analyze(item.text).score)

								helperFunctions.sterilizeTweet(item.text, obj.temp.wordpool, this.commons);
							}

							next();
						});

						// console.log('Asyncloop done.');

						obj.searchInfo.window_average = obj.collectedTweets / obj.searchInfo.window_count;


						if (parseInt(reset.substring(0, 2)) == 0 && parseInt(reset.substring(3, 5)) < this.searchInterval) {
							obj.searchInfo.window_count += 1;
							obj.nextWindow = null;
							obj.temp.times.push({
								y: obj.tweets_this_window,
								x: moment().format('X')
							});
							obj.tweets_this_window = 0;

							if (obj.searchInfo.window_average <= obj.config.tooLow) {
								console.log(' ! ' + obj.query + ' has a low window average frequency.')
								obj.low_frequency = true;
							}

						}
						if (parseInt(reset.substring(0, 2)) > 15) {
							obj.nextWindow = null;
						}


						var estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.searchInfo.window_average) + obj.searchInfo.window_count) * 15);
						if (moment().isAfter(moment(estimatedCompletion))) {
							estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.searchInfo.window_average) + obj.searchInfo.window_count + 2) * 15);
						}
						this.tweetsCollectedThisLoop += obj.temp.usableTweets;
						this.totalTweetsCollected += obj.temp.usableTweets;

						this.queryInfo.push({
							query: obj.query, 
							rate: `${Math.ceil(obj.searchInfo.window_average)} tweets per 15m window`,
							complete: moment(moment(obj.searchInfo.startTime).add(estimatedCompletion, 'minutes')).fromNow()
						});

						this.clientInfo.push({
							client: obj.clientNum,
							window: `resetting in ${reset}`

						});

						console.log('\n + ∞ ' + obj.query + ' @ ' + obj.currentDepth + ' / ' + obj.config.depth + ' / (' + obj.filename + ')');
						console.log(' |   ' + obj.collectedTweets + ' / ' + Math.floor(obj.count));
						console.log(' | Σ ' + Math.ceil(obj.searchInfo.window_average) + '(' + obj.searchInfo.window_count + ') > ' + obj.config.tooLow);
						console.log(' | + ' + obj.temp.usableTweets + ' / ' + tweets.statuses.length);
						console.log(' | \n | ☇ ' + reset)
						console.log(' | ⧗ ' + moment(obj.searchInfo.startTime).toNow(true))
						console.log(' | ⧗ ' + moment(moment(obj.searchInfo.startTime).add(estimatedCompletion, 'minutes')).fromNow());

						obj.temp.usableTweets = 0;

						if (obj.collectedTweets >= obj.count || obj.low_frequency) {
							// this request is complete.
							obj.temp.times.push({
								y: obj.tweets_this_window,
								x: moment().format('X')
							});

							if (obj.low_frequency) {
								console.log(' ! ' + obj.query + ' has a low frequency.')
							}
							this.requestComplete(obj);
							return;
						}

						jsonfile.writeFileSync('./src/magi/requests/query-' + obj.filename + '.json', obj);

					});

				});
			}
		});
	}


}

module.exports = Magi;

// var options = {
//   query: 'love',
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

// decimate step is in window intervals: 4 windows = 1 hour, 1 window = 15m

