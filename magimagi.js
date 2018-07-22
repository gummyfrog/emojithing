const fs = require('fs');
var Twitter = require('twitter');
const logUpdate = require('log-update');
var jsonfile = require('jsonfile')
var asyncLoop = require('node-async-loop');
var onlyEmoji = require('emoji-aware').onlyEmoji;
var emojiTree = require('emoji-tree');
var moment = require('moment');
moment().format();
const searchInterval = 8;
let i = 0;

let frames = ["•••", "•••", "o••", "•o•", "••o", "•••", "o••", "oo•", "ooo", "ooo", "ooo", "•oo", "••o"];

const helperFunctions = require('./helperFunctions.js');

const commons = fs.readFileSync('./magellan/commons.txt', 'utf8').split(',');
let occupiedClientNumbers = [];
let clients = [];
let fileNames = []

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
    console.log(' + Entered ./clients')
    for(i=1; i<files.length-1; i++) {
      console.log(' | Reading / ' + files[i]);
      jsonfile.readFile('./clients/' + files[i], function(err, obj) {
        var client = new Twitter(obj);
        clientsArray.push(client);
      })
    }

  });
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

  jsonfile.writeFileSync('./magimagi/requests/query-' + filename + '.json',
  {
    // configured at the start
    config: {
      cutoffs: options.config.cutoffs,
      childQueries: options.config.childQueries,
      excludeRetweets: options.config.excludeRetweets,
      tooLow: options.config.tooLow,
      depth: options.config.depth
    },

    // these are outside of config because they are changed at each child.
    query: options.query,
    count: options.count,

    // only used if isChild == true
    isChild: options.isChild,

    currentDepth: options.currentDepth,
    parentFileName: options.parentFileName,
    requestParent: options.requestParent,

    filename: filename,
    clientNum: assignedClient,

    requestTime: moment(),
    startTime: startTime,
    endTime: undefined,

    // consolidate into options{}?
    collectedTweets: 0,
    data: {},

    children: [],
    // popularTweets: [],
    hashtagObjs: [],


    window_count: 0,
    tweets_per_window: 0,
    temp_popular_tweets: [],
    uniques: [],
    low_frequency: false,
    temp_tweetTypes: [],
    temp_wordpool: [],
    temp_usableTweets: 0,
    temp_times: []

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
  fs.readdir('./magimagi/requests', function (err, files) {
    if(files.length <= 2) {
      console.log(' o No requests found!')
      return;
    }

    for(i=2;i<files.length;i++) {
      jsonfile.readFile('./magimagi/requests/' + files[i], function(err, obj) {
        if(err) throw err;
        if(obj.clientNum != -1) {
          occupiedClientNumbers.push(obj.clientNum);
        }
      });
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

function makeFrequencyDicts(words, tweetTypes, times, popular, cutoffs) {

    var startTime = moment();
    console.log('\n\n + Please wait a moment... \n | This process takes a bit of time.')

    logUpdate(' : Collecting Hashtags...')

    let hashtags = words.filter(function(obj) {
      i += 0.001;
      const frame = frames[Math.floor(i) % frames.length];
      logUpdate(` ${frame} Collecting Hashtags...`)
      if(obj[0] == '#') {
        logUpdate(` ${frame} Collecting Hashtags..`)
        return true;
      }
    });
    logUpdate(' √ Collecting Hashtags')
    console.log(' : Stripping Emojis...')

    let emojis = [].concat.apply([], words.filter(function(string){
      i += 0.001;
      const frame = frames[Math.floor(i) % frames.length];
      logUpdate(` ${frame} Stripping Emojis...`)
      if(onlyEmoji(string).length >= 1) {
        logUpdate(` ${frame} Stripping Emojis..`)
        return true;
      }
    }).map(string => getEmojisFromString(string)));

    logUpdate(' √ Stripping Emojis')
    console.log(' : Stripping Words...')

    words = words.filter( function(string) {
      i += 0.001;
      const frame = frames[Math.floor(i) % frames.length];
      logUpdate(
        ` ${frame} Stripping Words...`
      );
      if(string[0] != '#' && onlyEmoji(string).length == 0) {
        logUpdate(` ${frame} Stripping Words..`)
        return true;
      }
    });

    logUpdate(' √ Collecting Words')
    console.log(' | Done processing raw data.')
    console.log(' | Took ' + moment().from(startTime, true));
    console.log(' @ Making Dictionaries...')

    return({
      popular: popular,
      hashtags:makeFrequencyDict(hashtags, cutoffs.hashtags),
      emojis:makeFrequencyDict(emojis, cutoffs.emojis),
      words:makeFrequencyDict(words, cutoffs.words),
      types:makeFrequencyDict(tweetTypes, {type:'cutoff', value: 0}),
      times:helperFunctions.decimate(times, 450)
    })
}


function requestComplete(obj) {

  jsonfile.writeFileSync('./magimagi/requests/incomplete_backups/query-' + obj.filename + '.json', obj);
  deoccupyclient(obj.clientNum)

  obj.data = makeFrequencyDicts(obj.temp_wordpool, obj.temp_tweetTypes, obj.temp_times, obj.temp_popular_tweets, obj.config.cutoffs)
  obj.temp_wordpool = [];
  var topHashtags = wordsFor(obj.data.hashtags, obj.config.childQueries);

  if(obj.currentDepth != obj.config.depth) {
    console.log(' X Requesting ' + topHashtags.length + ' more searches.');
    for(x=0;x<topHashtags.length;x++) {
      if(topHashtags[x].key.toLowerCase() != obj.parentFileName.toLowerCase() && topHashtags[x].key.toLowerCase() != obj.query.toLowerCase()) {
        obj.children.push(request({query: topHashtags[x].key, count: obj.count/1.2, currentDepth: obj.currentDepth+1, isChild:true, parentFileName:obj.parentFileName, requestParent: obj.query, config:obj.config}))
      }
    }
  } else {
    console.log(' √ Desired Depth reached.');
    delete obj.hashtagObjs;
  }

  delete obj.uniques;
  delete obj.currentDepth;
  delete obj.temp_wordpool;
  delete obj.temp_usableTweets;
  delete obj.temp_tweetTypes;
  delete obj.temp_times;
  delete obj.temp_popular_tweets;
  obj.endTime = moment();

  if(obj.isChild) {
    let parentObj = jsonfile.readFileSync('./magimagi/products/product-' + obj.parentFileName + '.json');
    parentObj.hashtagObjs.push(obj);
    jsonfile.writeFileSync('./magimagi/products/product-' + parentObj.filename + '.json', parentObj);
  } else {
    jsonfile.writeFileSync('./magimagi/products/product-' + obj.filename + '.json', obj);
  }

  if(fs.existsSync('./magimagi/requests/query-' + obj.filename + '.json')) {
    console.log(' - Unlinking ' + obj.filename);
    fs.unlinkSync('./magimagi/requests/query-' + obj.filename + '.json');
  } else {
    // console.log(' - Was already unlinked. Ghost request.')
  }

};

// this combines all the hashtag children objs into a tree view.
// not an essential step for testing.
// collapse before uploading to view site

function collapseProduct(product) {
  jsonfile.readFile('./magimagi/products/product-' + product + '.json', function(err, obj) {
    if (err) throw err;

    delete obj.parentFileName;
    delete obj.requestParent;

    delete obj.clientNum;
    delete obj.config.depth;
    // delete obj.currentDepth;
    // delete obj.filename;
    delete obj.count;
    delete obj.isChild;
    delete obj.uniques;
    // delete obj.temp_popular_tweets;
    delete obj.config.cutoffs;
    delete obj.config.childQueries;
    delete obj.config.tooLow;

    for(var key in obj.hashtagObjs) {
      delete obj.hashtagObjs[key].parentFileName;
      delete obj.hashtagObjs[key].requestParent;
      delete obj.hashtagObjs[key].clientNum;
      delete obj.hashtagObjs[key].config.depth;
      delete obj.hashtagObjs[key].uniques;
      // delete obj.hashtagObjs[key].currentDepth;
      // delete obj.hashtagObjs[key]._filename;
      delete obj.hashtagObjs[key].count;
      delete obj.hashtagObjs[key].isChild;
      // delete obj.hashtagObjs[key].temp_popular_tweets;
      delete obj.hashtagObjs[key].config.cutoffs;
      delete obj.hashtagObjs[key].config.childQueries;
      delete obj.hashtagObjs[key].config.tooLow;

    }


    trimData(obj.data);
    obj.hashtagObjs = formatHashtagObjs(obj.hashtagObjs);
    jsonfile.writeFileSync('./magimagi/products/product-' + product + '-formatted.json', obj);


  });
}



function trimData(data) {
  for(var key in data) {

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
    // console.log(' § '+hashtag._filename + ' ' + hashtag.currentDepth + '   [' + hashtag.children + ']');
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
  console.log('\n')
  console.log(' ⧗ ' + moment().format("MMM Do, h:mm:ss a"))
  console.log(occupiedClientNumbers);
  fs.readdir('./magimagi/requests', function (err, files) {
    console.log(' + Entered /requests')
    if(files.length <= 1) {
      console.log(' o No requests found!')
      return;
    }

    for(i=2;i<files.length;i++) {
      // console.log(i + ' / ' + files.length);
      jsonfile.readFile('./magimagi/requests/' + files[i], function(err, obj) {
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
            obj.startTime = moment();
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
              if(fs.existsSync('./magimagi/requests/query-' + obj.filename + '.json')) {
                console.log(' - Unlinking ' + obj.filename);
                fs.unlinkSync('./magimagi/requests/query-' + obj.filename + '.json');
              }
              return;
          }

          asyncLoop(tweets.statuses, function(item, next) {

            if(obj.uniques.includes(item.user.id_str)) {
              // user is not unique
            } else {

              if(item.retweeted_status != null) {
                obj.temp_tweetTypes.push('RT');
                if(item.retweet_count > 100 && !obj.temp_popular_tweets.includes(item.retweeted_status.id_str) ) {
                  // storing popular tweet ids, so that they can be embedded dynamically
                  obj.temp_popular_tweets.push(item.retweeted_status.id_str);

                  // console.log('pushed greater retweet count to populars')
                }
              } else {
                obj.temp_tweetTypes.push('OC');
              }

              obj.temp_usableTweets += 1
              obj.tweets_this_window += 1;
              obj.collectedTweets += 1;
              obj.uniques.push(item.user.id_str);
              helperFunctions.sterilizeTweet(item.text, obj.temp_wordpool, commons);
            }

            next();
          });

          // console.log('Asyncloop done.');
          if(obj.window_count == 0) {
            obj.window_average = obj.collectedTweets / 1;
          } else {
            obj.window_average = obj.collectedTweets / obj.window_count;
          }

          if(parseInt(reset.substring(0,2)) == 0 && parseInt(reset.substring(3, 5)) < searchInterval) {
            obj.window_count+=1;
            obj.nextWindow = null;
            obj.temp_times.push({y:obj.tweets_this_window, x: moment().format('X')});
            obj.tweets_this_window = 0;

            if(obj.window_average <= obj.config.tooLow) {
              console.log(' ! ' + obj.query + ' has a low window average frequency.')
              obj.low_frequency = true;
            }

          }
          if(parseInt(reset.substring(0,2)) > 15) {
            obj.nextWindow = null;
          }


          var estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.window_average) + obj.window_count) * 15);

          if(moment().isAfter(moment(estimatedCompletion))) {
            estimatedCompletion = ((((obj.count - obj.collectedTweets) / obj.window_average) + obj.window_count+2) * 15);
          }

          console.log('\n + ∞ ' + obj.query + ' @ ' + obj.currentDepth + ' / ' + obj.config.depth + ' / (' + obj.filename + ')');
          console.log(' |   ' + obj.collectedTweets + ' / ' + Math.floor(obj.count));
          console.log(' | Σ ' + Math.ceil(obj.window_average) + '(' + obj.window_count +') > ' + obj.config.tooLow);
          console.log(' | + ' + obj.temp_usableTweets + ' / ' + tweets.statuses.length);
          console.log(' | \n | ☇ ' + reset)
          console.log(' | ⧗ ' + moment(obj.startTime).toNow(true))
          console.log(' | ⧗ ' + moment(moment(obj.startTime).add(estimatedCompletion, 'minutes')).fromNow());

          obj.temp_usableTweets = 0;

          if(obj.collectedTweets >= obj.count || obj.low_frequency) {
            // this request is complete.
            if(obj.low_frequency) {
              console.log(' ! ' + obj.query + ' has a low frequency.')
            }
            requestComplete(obj);
            return;
          }

          jsonfile.writeFileSync('./magimagi/requests/query-' + obj.filename + '.json', obj);

        });

      });
    }
  });
}





// setTimeout(function() { getRateLimit(0) }, 1000 * 1);

// recommended pareto-form values:
// words: 2.5%
// emojis: 7%
// hashtags: 10%

awake();
// obj.children.push(request({query: topHashtags[x].key, count: obj.count/1.2, depth: obj.config.depth, currentDepth: obj.currentDepth+1, childQueries: obj.config.childQueries, parentFileName:obj.parentFileName, requestParent: obj.query, cutoffs: obj.cutoffs, tooLow: obj.config.tooLow, isChild: true}))

var options = {
  query: 'love',
  count: 35000,
  config: {
    depth: 1,
    childQueries:3,
    cutoffs:{
      words:{
        type:'percentage',
        value:2.5
      },
      emojis:{
        type:'percentage',
        value:7
      },
      hashtags:{
        type:'percentage',
        value:10
      },
      decimate:{
        step: 4,
      }
    },
    tooLow: 200
  }
};
// setTimeout(function() { request(options) }, 1000 * 1);

// decimate step is in window intervals: 4 windows = 1 hour, 1 window = 15m


setInterval(searchLoop, 1000 * searchInterval);
// collapseProduct('love9056');
