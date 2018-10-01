const fs = require('fs');
var Twitter = require('twitter');
const logUpdate = require('log-update');
var mysql = require('mysql');
var jsonfile = require('jsonfile')
var argv = require('minimist')(process.argv.slice(2));
var asyncLoop = require('node-async-loop');
var emojiTree = require('emoji-tree');
var moment = require('moment');
const ipc = require('node-ipc');
const Sentiment = require('sentiment')
var sentiment = new Sentiment();
moment().format();

let dataToDisplay = {message: 'hello! Just started =)'};



const searchInterval = 8;

let frames = ["•••", "•••", "o••", "•o•", "••o", "•••", "o••", "oo•", "ooo", "ooo", "ooo", "•oo", "••o"];

const helperFunctions = require('./helperFunctions.js');

const commons = fs.readFileSync('./magellan/commons.txt', 'utf8').split(',');

let sqlConnections = [], occupiedClientNumbers = [], clients = [], fileNames = []

// consider storing filenames in json
// eventually move most short functions to helperFunctions.js

function getRateLimit(client) {
  clients[client].get('application/rate_limit_status', {}, function(error, response) {
    if(error) {
      console.log('Hit the rate limit for Rate Limit checks.')
    } else {
    console.log(' ⧖ Client #' + client + ' : ' + response.resources.search['/search/tweets'].remaining + ' / 450');
    }
  });
}


function getEmojisFromString(string) {
  return emojiTree(string).filter(obj => obj.type == 'emoji').map(obj => obj.text);
}

function initializeClients(clientsArray) {
  fs.readdir('./clients', function (err, files) {
  	if(files == undefined) { console.error('ERR: No directory for Twitter clients found. Should be named "clients".'); process.exit(); } 

    console.log(' + Entered ./clients')
    for(i=1; i<files.length-1; i++) {
      console.log(' | Reading / ' + files[i]);
      jsonfile.readFile('./clients/' + files[i], function(err, obj) {
        var client = new Twitter(obj);
        clientsArray.push(client);
      })
    }
  });

  if(argv.d) {
	  fs.readdir('./SQLinfo', function(err, files) {
	  	if(files == undefined) { console.error('ERR: No directory for SQL clients found. Should be named "SQLinfo".'); process.exit(); } 
	    console.log(' + Entered ./SQLinfo');
	    for(s=1;s<files.length;s++) {
	      console.log(' | Reading / ' + files[s]);
	      jsonfile.readFile('./SQLinfo/' + files[s], function(err, obj) {
	        var con = mysql.createConnection(obj);
	        sqlConnections.push(con);
	      })
	    }
	  })
	}

}

function deoccupyclient(client) {
  // console.log('Index of ' + client + ' is ' + occupiedClientNumbers.indexOf(client));
  occupiedClientNumbers.splice(occupiedClientNumbers.indexOf(client), 1);
  // console.log('   Deoccupied Client #' + client);
}

function occupyclient() {
  for(i=0;i<clients.length;i++) {
    if(occupiedClientNumbers.indexOf(i) == -1) {
      occupiedClientNumbers.push(i);
      // console.log('   Occupied Client #' + i)
      return i;
    }
  }

  return -1;
}

function generateFileName(title, requestParent, parentFileName) {
  var generated;
  if(requestParent == null || parentFileName == null) {
    generated = (title + (Math.floor(Math.random()*10000) + 1));
  } else {
    generated = (title + (Math.floor(Math.random()*10000) + 1) + '<' + requestParent + '<' + parentFileName);
  }
  if(fileNames.indexOf(generated) != -1) {
    generated = generateFileName(title, requestParent);
  }

  return generated;
}

function findObj(objects, key, value) {
    for(i=0;i<objects.length;i++) {
        if(objects[i][key] === value) {
            return i;
        }
    }
    return -1;
}

function request(options) {

  var filename;
  if(options.hasOwnProperty('isChild') && options.isChild == true) {
    filename = generateFileName(options.query, options.requestParent, options.parentFileName);
  } else {
    filename = generateFileName(options.query);
    options.currentDepth = 0;
    options.parentFileName = filename;
    options.requestParent = '';
  }



  var assignedClient = occupyclient();
  var startTime = undefined;
  if(assignedClient == -1) {
    console.log('\n + Request for ' + options.query + '\n | LIMBO')
  } else {
    console.log('\n + Request for ' + options.query + '\n | ' + assignedClient)
    startTime = moment();
  }

  // obj.children.push(request({query: topHashtags[x].key, count: obj.count/1.2, depth: obj.config.depth, currentDepth: obj.currentDepth+1, childQueries: obj.config.childQueries, parentFileName:obj.parentFileName, requestParent: obj.query, cutoffs: obj.cutoffs, tooLow: obj.config.tooLow, isChild: true}))

  jsonfile.writeFileSync('./magi/requests/query-' + filename + '.json',
  {



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


    // consolidate into options{}?
    // popularTweets: [],



  }, function (err) {
    if(err) {
      console.error(err);
    }
  });

  console.log(' | ' + filename);
  return filename;
}

function awake() {
  initializeClients(clients);

  fs.readdir('./magi/requests', function (err, files) {
    if(files.length <= 2) {
      console.log(' o No requests found!')
      return;
    }

    for(i=2;i<files.length;i++) {
      jsonfile.readFile('./magi/requests/' + files[i], function(err, obj) {
        if(err) throw err;
        if(obj.clientNum != -1) {
          occupiedClientNumbers.push(obj.clientNum);
        }
      });
    }
  });

  fs.readdir('./magi/products', function (err, files) {
    if(files.length <= 1) {
      return;
    }

    console.log(' o Products:')
    for(i=1;i<files.length;i++) {
      console.log(' | ' + files[i])
    }
  });
}

function wordsFor(dict, count) {
  var data = Object.keys(dict).map(key => {
    return {key:key,value:dict[key]};
  })

  data.sort(function(a, b) {
      return b.value-a.value
  })

  // console.log(data.slice(0, count));
  return data.slice(0, count);
}


function makeFrequencyDict(data, cutoff) {
    var counts = {};
    var result = {};
    var cutStorage = cutoff.value;

    logUpdate(' √ Made Dictionary from ' + data.length + ' items...')

    if(cutoff.type == 'percentage') {
      var highFreq = highestFrequencyinData(data)
      cutStorage = (cutoff.value / 100) * highFreq;
      // console.log(cutoff.value + ' percent of ' + highFreq  + ' is ' + cutStorage);
    }

    for (var i = 0; i < data.length; i++) {
        var num = data[i];
        counts[num] = counts[num] ? counts[num] + 1 : 1;
    }
    for (key in counts) {
      if (counts.hasOwnProperty(key) && counts[key] > cutStorage) {
          result[key] = counts[key];
      }
    }

    var backToArray = Object.keys(result).map(key => ({key:key,value:result[key]}) ).sort(function(a,b) {return b.value-a.value});
    var backToObject = {};
    for (var l=0; l<backToArray.length; l++) {
      backToObject[backToArray[l].key] = backToArray[l].value;
    }


    return(backToObject);
}

function highestFrequencyinData(data) {
  var tempCounts = {};
  for (var t = 0; t < data.length; t++) {
      var num = data[t];
      tempCounts[num] = tempCounts[num] ? tempCounts[num] + 1 : 1;
  }
  var p = Object.keys(tempCounts).map(i => tempCounts[i]).sort(function(a, b){
      return b-a
  })

  return p[0];
}

let frameCount = 0;

function frameUpdate(msg) {
  frameCount += 0.001;
  const frame = frames[Math.floor(frameCount) % frames.length];
  logUpdate(` ${frame} ${msg}`)
  dataToDisplay.message = `${frame} ${msg}`;
}

function removeFrom(list, items) {
  for(q=0;q<items.length;q++) {
    list.splice(list.indexOf(items[q]), 1);
  }
  items = [];
}

function makeData(words, tweetTypes, times, popular, cutoffs, sentiments) {
    const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g

    let toRemove = [];
    var startTime = moment();

    console.log('\n\n + Please wait a moment... \n | This process takes a bit of time.');
    logUpdate(' : Collecting Hashtags...')

    let hashtags = words.filter(function(obj) {
      frameUpdate('Collecting Hashtags');
      if(obj[0] == '#') {
        toRemove.push(obj);
        return true;
      }
    });

    removeFrom(words, toRemove);
    logUpdate(' √ Collecting Hashtags')
    console.log(' : Collecting Emojis...')

    let emojis = [].concat.apply([], words.filter(function(string){
      frameUpdate('Collecting Emojis');
      if(string.match(emojiRegex)) {
        toRemove.push(string);
        return true;
      }
    }).map(string => getEmojisFromString(string)));

    removeFrom(words, toRemove);


    logUpdate(' √ Collecting Emojis')

    var total = sentiments.length;

    var positiveTweets = sentiments.filter(num => Math.sign(num) == 1);
    removeFrom(sentiments, positiveTweets);

    var negativeTweets = sentiments.filter(num => Math.sign(num) == -1);
    removeFrom(sentiments, negativeTweets);

    var neutralTweets = sentiments;


    console.log(' | Done processing raw data.')
    console.log(' | Took ' + moment().from(startTime, true));
    console.log(' @ Making Dictionaries...')



    return({
      positiveTweets: Math.round((positiveTweets.length/total) * 100),
      negativeTweets: Math.round((negativeTweets.length/total) * 100),
      neutralTweets: Math.round((neutralTweets.length/total) * 100),
      popular: popular,
      hashtags:makeFrequencyDict(hashtags, cutoffs.hashtags),
      emojis:makeFrequencyDict(emojis, cutoffs.emojis),
      words:makeFrequencyDict(words, cutoffs.words),
      types:makeFrequencyDict(tweetTypes, {type:'cutoff', value: 0}),
      times:helperFunctions.decimate(times, cutoffs.decimate.step)
    })
}


function requestComplete(obj) {
  dataToDisplay.message = `Formatting. This takes a moment... ${moment().format('MMM/DD hh:mm a')}`;
  jsonfile.writeFileSync('./magi/requests/incomplete_backups/query-' + obj.filename + '.json', obj);
  deoccupyclient(obj.clientNum)

  obj.data = makeData(obj.temp.wordpool, obj.temp.tweetTypes, obj.temp.times, obj.temp.popular_tweets, obj.config.cutoffs, obj.temp.sentiments)

  console.log(obj.data);
  if(obj.data.times.length <= 1) {
    delete obj.data.times;
  }

  obj.temp.wordpool = [];
  var topHashtags = wordsFor(obj.data.hashtags, obj.config.childQueries);

  if(obj.currentDepth != obj.config.depth) {
    console.log(' X Requesting ' + topHashtags.length + ' more searches.');
    for(x=0;x<topHashtags.length;x++) {
      console.log(topHashtags[x].key.toLowerCase())
      console.log(obj.query.toLowerCase());

      if(topHashtags[x].key.toLowerCase() != obj.parentFileName.toLowerCase() && topHashtags[x].key.toLowerCase() != obj.query.toLowerCase()) {
        obj.children.push(request({query: topHashtags[x].key, count: obj.count/obj.config.divisor, currentDepth: obj.currentDepth+1, isChild:true, parentFileName:obj.parentFileName, requestParent: obj.query, config:obj.config}))
      }
    }
  } else {
    console.log(' √ Desired Depth reached.');
    delete obj.hashtagObjs;
  }


  obj.searchInfo.endTime = moment();

  if(obj.isChild) {
    let parentObj = jsonfile.readFileSync('./magi/products/product-' + obj.parentFileName + '.json');
    parentObj.hashtagObjs.push(obj);
    jsonfile.writeFileSync('./magi/products/product-' + parentObj.filename + '.json', parentObj);
  } else {
    jsonfile.writeFileSync('./magi/products/product-' + obj.filename + '.json', obj);
  }

  if(fs.existsSync('./magi/requests/query-' + obj.filename + '.json')) {
    console.log(' - Unlinking ' + obj.filename);
    fs.unlinkSync('./magi/requests/query-' + obj.filename + '.json');
  } else {
    // console.log(' - Was already unlinked. Ghost request.')
  }
  dataToDisplay.message = `Done formatting. ${moment().format('MMM/DD hh:mm a')}`;

};

// this combines all the hashtag children objs into a tree view.
// not an essential step for testing.
// collapse before uploading to view site

function collapseProduct(product) {
  jsonfile.readFile('./magi/products/'+ product, function(err, obj) {
    if (err) throw err;


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


    for(var key in obj.hashtagObjs) {
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

    trimData(obj.data);
    obj.hashtagObjs = formatHashtagObjs(obj.hashtagObjs);
    jsonfile.writeFileSync('./magi/products/product-' + product + '-formatted.json', obj);


  });
}



function trimData(data) {
  for(var key in data) {
    if(['number'].includes(typeof(data[key]))) {
      continue;
    }

    var returnObj = {};
    var slicedData = Object.keys(data[key]).map(dataKey => {return {key:dataKey,value:data[key][dataKey]}}).sort(function(a, b) {return b.value-a.value})


    for (var i=0; i<slicedData.length; i++) {
      returnObj[slicedData[i].key] = slicedData[i].value;
    }

    data[key] = returnObj;
  }

}

function formatHashtagObjs(objArray) {

  objArray.sort(function(a, b) {
    return b.currentDepth - a.currentDepth;
  });

  for(x=0;x<objArray.length;x++) {
    var hashtag = objArray[x];
    console.log(' § '+hashtag.filename + ' ' + hashtag.currentDepth + '   [' + hashtag.children + ']');
    for(j=0;j<hashtag.children.length;j++) {
      // delete has/htag._filename;
      var indexOfChild = findObj(objArray, 'filename', hashtag.children[j]);
      var childObj = objArray[indexOfChild];
      if (childObj == undefined) {
        // console.log("Couldn't find child: " + hashtag.children[j]);
      } else {
        // console.log('    √ ' +childobj.filename + ' ' + childObj.currentDepth + ' is child of ' + hashtag._filename)
        if(childObj.hasOwnProperty('data')) {
          trimData(childObj.data)
        };

        hashtag.hashtagObjs.push(childObj);
      }
    }
  }

  return objArray.filter(obj => obj.currentDepth == 1);
}



function searchLoop() {
  for(i=0;i<clients.length;i++) {
	delete dataToDisplay[i];
  }
  console.log(dataToDisplay); 
  dataToDisplay.status = 'searching';
  console.log('\n')
  console.log(' ⧗ ' + moment().format("MMM Do, h:mm:ss a"))
  console.log(occupiedClientNumbers);
  fs.readdir('./magi/requests', function (err, files) {
    console.log(' + Entered /requests')
    dataToDisplay.message = `Requests in limbo: ${files.length-2 - occupiedClientNumbers.length}  ${moment().format('MMM/DD hh:mm a')}`;

    if(files.length <= 2) {
      console.log(' o No requests found!')
      dataToDisplay.message = `No requests at the moment. ${moment().format('MMM/DD hh:mm a')}`;
      return;
    }

    for(i=2;i<files.length;i++) {
      // console.log(i + ' / ' + files.length);
      jsonfile.readFile('./magi/requests/' + files[i], function(err, obj) {
        if(obj == undefined) {
          console.log(' e Invalid file.');
          return;
        }

        if(obj.clientNum == -1) {
          obj.clientNum = occupyclient();
          if(obj.clientNum == -1) {
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

        if(obj.nextWindow == null || obj.nextWindow == 'err' || obj.nextWindow == undefined || obj.nextWindow == 0) {
          clients[obj.clientNum].get('application/rate_limit_status', {}, function(error, data, response) {
            // console.log('getting new time...')
            if(error) {
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

        // getRateLimit(obj.clientNum);
        clients[obj.clientNum].get('search/tweets', {q: obj.query, result_type: 'recent', lang: 'en', count: 100}, function(error, tweets, response) {
          if(error) {
            console.log(obj.clientNum + ' ran out of requests.');
            console.log(getRateLimit(obj.clientNum))
            return;
          }

          if(tweets.statuses.length == 0) {
              console.log('No tweets found for ' + obj.query + '. What? Unlinking.');
              deoccupyclient(obj.clientNum);
              if(fs.existsSync('./magi/requests/query-' + obj.filename + '.json')) {
                console.log(' - Unlinking ' + obj.filename);
                fs.unlinkSync('./magi/requests/query-' + obj.filename + '.json');
              }
              return;
          }

          let savedExample;
          asyncLoop(tweets.statuses, function(item, next) {

            if(obj.uniques.includes(item.user.id_str)) {
              // user is not unique
            } else {

              if(item.retweeted_status != null) {
                obj.temp.tweetTypes.push('RT');
                if(item.retweet_count > 100 && !obj.temp.popular_tweets.includes(item.retweeted_status.id_str) ) {
                  // storing popular tweet ids, so that they can be embedded dynamically
                  obj.temp.popular_tweets.push(item.retweeted_status.id_str);

                  // console.log('pushed greater retweet count to populars')
                }
              } else {
                obj.temp.tweetTypes.push('OC');
              }

              if(Math.floor(Math.random() * 4)+1 == 3) {
              	savedExample = item.text;
              }

              obj.temp.usableTweets += 1
              obj.tweets_this_window += 1;
              obj.collectedTweets += 1;
              obj.uniques.push(item.user.id_str);
              obj.temp.sentiments.push(sentiment.analyze(item.text).score)

              helperFunctions.sterilizeTweet(item.text, obj.temp.wordpool, commons);
            }

            next();
          });

          // console.log('Asyncloop done.');

          obj.searchInfo.window_average = obj.collectedTweets / obj.searchInfo.window_count;


          if(parseInt(reset.substring(0,2)) == 0 && parseInt(reset.substring(3, 5)) < searchInterval) {
            obj.searchInfo.window_count+=1;
            obj.nextWindow = null;
            obj.temp.times.push({y:obj.tweets_this_window, x: moment().format('X')});
            obj.tweets_this_window = 0;

            if(obj.searchInfo.window_average <= obj.config.tooLow) {
              console.log(' ! ' + obj.query + ' has a low window average frequency.')
              obj.low_frequency = true;
            }

          }
          if(parseInt(reset.substring(0,2)) > 15) {
            obj.nextWindow = null;
          }


          var estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.searchInfo.window_average) + obj.searchInfo.window_count) * 15);
          if(moment().isAfter(moment(estimatedCompletion))) {
            estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.searchInfo.window_average) + obj.searchInfo.window_count+2) * 15);
          }

          dataToDisplay[obj.clientNum] = {
            'query': obj.query, 
            'currentDepth': obj.currentDepth + ' / ' + obj.config.depth,
            'collectedTweets': obj.collectedTweets + ' / ' + Math.floor(obj.count),
            'frequency': Math.ceil(obj.searchInfo.window_average) + '(' + obj.searchInfo.window_count +') > ' + obj.config.tooLow,
            'windowReset': reset,
            'elapsed': moment(obj.searchInfo.startTime).toNow(true),
            'etc': moment(moment(obj.searchInfo.startTime).add(estimatedCompletion, 'minutes')).fromNow(),
            'example': savedExample
        }
          console.log('\n + ∞ ' + obj.query + ' @ ' + obj.currentDepth + ' / ' + obj.config.depth + ' / (' + obj.filename + ')');
          console.log(' |   ' + obj.collectedTweets + ' / ' + Math.floor(obj.count));
          console.log(' | Σ ' + Math.ceil(obj.searchInfo.window_average) + '(' + obj.searchInfo.window_count +') > ' + obj.config.tooLow);
          console.log(' | + ' + obj.temp.usableTweets + ' / ' + tweets.statuses.length);
          console.log(' | \n | ☇ ' + reset)
          console.log(' | ⧗ ' + moment(obj.searchInfo.startTime).toNow(true))
          console.log(' | ⧗ ' + moment(moment(obj.searchInfo.startTime).add(estimatedCompletion, 'minutes')).fromNow());

          obj.temp.usableTweets = 0;

          if(obj.collectedTweets >= obj.count || obj.low_frequency) {
            // this request is complete.
            obj.temp.times.push({y:obj.tweets_this_window, x: moment().format('X')});

            if(obj.low_frequency) {
              console.log(' ! ' + obj.query + ' has a low frequency.')
            }
            requestComplete(obj);
            return;
          }

          jsonfile.writeFileSync('./magi/requests/query-' + obj.filename + '.json', obj);

        });

      });
    }
  });
}


function sqlUpdate(connection) {
  var sql = `SELECT * FROM tweetlinks.sql_limbo_requests LIMIT 0,1`;
  connection.query(sql, function (err, row) {
    if (err) throw err;
    // console.log(row)
    if(row.length != 0) {
    	var remote = row[0];
    	console.log(' O Remote Request!');
      dataToDisplay.message = `Got a remote request! ${moment().format('MMM/DD hh:mm a')}`;
    	console.log(remote);
    	request(
    	{
		query: remote.query, 
		count: remote.count, 
		config: { 
			cutoffs: {
				words: {type: 'percentage', value: 50},
				emojis: {type: 'percentage', value: 10},
				hashtags: {type: 'percentage', value: 30},
				decimate: {step: 1}
			}, 
			childQueries: remote.childQueries,
			tooLow: 2,
			depth: remote.depth,
			divisor: 2
		}
		})
		sql = `DELETE FROM tweetlinks.sql_limbo_requests LIMIT 1`;
		 connection.query(sql, function (err, row) {
		 	if (err) throw err;
		 	console.log('RM')
		 })
   	}
  });
}

function sqlLoop() {
	if(sqlConnections[0] != undefined) {
		sqlUpdate(sqlConnections[0])
	}
}

// setTimeout(function() { getRateLimit(0) }, 1000 * 1);

// recommended pareto-form values:
// words: 2.5%
// emojis: 7%
// hashtags: 10%

// obj.children.push(request({query: topHashtags[x].key, count: obj.count/1.2, depth: obj.config.depth, currentDepth: obj.currentDepth+1, childQueries: obj.config.childQueries, parentFileName:obj.parentFileName, requestParent: obj.query, cutoffs: obj.cutoffs, tooLow: obj.config.tooLow, isChild: true}))



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
// setTimeout(function() { request(options) }, 1000 * 1);

// decimate step is in window intervals: 4 windows = 1 hour, 1 window = 15m


// setInterval(searchLoop, 1000 * searchInterval);
// collapseProduct('love1005');


exports.pass = function(electronPass) {
	// console.log(' + Passed thru ELECTRON...')
	check(electronPass);
  ipc.config.id = 'MAGI';
  ipc.config.retry = 1500;
  ipc.config.silent = true;

  ipc.serve(function() {
    console.log(' q SERVE');
    ipcserver = ipc.server;    

    ipc.server.on('message', function(data, socket){
      // console.log(' q MAGI: got a poke from window, sending data back.');
      ipc.server.emit(socket, 'message', dataToDisplay);
    })

    ipc.server.on('socket.disconnected', function(socket, destroyedSocketID){
      // console.log(' q MAGI: ' + destroyedSocketID + ' disconnected. This is a bad thing!');
    })
  })

  ipc.server.start();

}

var searchLoopRef = null;
var SQLloopRef = null;

function check(argv) {
	if(argv.a) { 
	    if(searchLoopRef != null) {
	      console.log(' X Stopping')
	      clearInterval(searchLoopRef);
	      if(SQLloopRef != null) {
	    	clearInterval(SQLloopRef);
	    };
	    process.exit()
	  }
	}

	if(argv.s) {
	  awake();
	  searchLoopRef = setInterval(searchLoop, 1000 * searchInterval);
	  if(argv.d) {
	  	SQLloopRef = setInterval(sqlLoop, 1000);
	  }
	}

	if(argv.hasOwnProperty('r')) {
	  if(argv.r == true) {
	    console.log('Asked to Request, but no path given.');
	  } else {
	    console.log(argv.r);
	    jsonfile.readFile(argv.r, function(err, obj) {
	      setTimeout(function() { request(obj) }, 1000 * 1);
	    });
	  }
	}

	if(argv.hasOwnProperty('c')) {
	  if(argv.c == true) {
	    console.log('Asked to Collapse, but no product name given.');
	  } else {
	    console.log(argv.c);
	    collapseProduct(argv.c);
	  }
	}

	if(argv.hasOwnProperty('l')) {
	  if(argv.l == true) {
	    console.log('Asked to Low Frequency, but no path given.');
	  } else {
	    console.log(argv.l);
	    jsonfile.readFile('magi/requests/'+argv.l, function(err, obj) {
	      if(err) {
	        console.log('Invalid Path');
	        return;
	      }
	      obj.low_frequency = true;
	      jsonfile.writeFile('magi/requests/'+argv.l, obj, function(err) {
	        console.log("Low Frequency'd")
	      });
	    });
	  }
	}
}

check(argv);
