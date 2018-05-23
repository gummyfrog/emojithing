
const fs = require('fs');
var Twitter = require('twitter');
var jsonfile = require('jsonfile')
var asyncLoop = require('node-async-loop');
var onlyEmoji = require('emoji-aware').onlyEmoji;
var emojiTree = require('emoji-tree');
var moment = require('moment');
moment().format();

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
    console.log(' ⧖ ' + 'Client #' + client + ' : ' + response.resources.search['/search/tweets'].remaining + ' / 450');
    }
  });
}


function getEmojisFromString(string) {
  return emojiTree(string).filter(obj => obj.type == 'emoji').map(obj => obj.text);
}

function initializeClients(clientsArray) {
  fs.readdir('./clients', function (err, files) {
    console.log('Entered ./clients')
    for(i=1; i<files.length-1; i++) {
      console.log('Reading / ' + files[i]);
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
  console.log('   Deoccupied Client #' + client);
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


  // cutoff == least number of times a word must be used to be considered data
  // toolow == how many tweets per search is considered low frequency

  // query
  // origin

  // desired tweetcount
  // desired depth
  // desired sub data count modifier
  // desired sub data spawns

  // low frequency definition
  // exclude retweets
  // hashtag length cutoff
  // word length cutoff

  // parentfilename
  // requestparent

  // if (fs.existsSync('./magimagi/requests/query-' + query + '.json')) {
  //   console.log('   > A request for ' + query + ' already exists.')
  //   return;
  // }

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

  if(assignedClient == -1) {
    console.log('   > Request for ' + options.query)
  } else {
    console.log('   > Request for ' + options.query + ' | #' + assignedClient)
  }

  jsonfile.writeFileSync('./magimagi/requests/query-' + filename + '.json',
  {
    _query: options.query,
    _filename: filename,
    _clientNum: assignedClient,
    _count: options.count,
    _cutoffs: options.cutoffs,
    _childQueries: options.childQueries,
    _excludeRetweets: options._excludeRetweets,
    _tooLow: options.tooLow,
    // consolidate into options{}?
    collectedTweets: 0,
    data: {},

    _depth: options.depth,
    currentDepth: options.currentDepth,

    parentFileName: options.parentFileName,
    requestParent: options.requestParent,
    isChild: options.isChild,
    children: [],
    // popularTweets: [],
    hashtagObjs: [],

    retweeted_tweets: [],
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

  return filename;
}

function awake() {
  initializeClients(clients);
  fs.readdir('./magimagi/requests', function (err, files) {
    if(files.length <= 1) {
      console.log('No requests found!')
      return;
    }


    for(i=1;i<files.length;i++) {
      jsonfile.readFile('./magimagi/requests/' + files[i], function(err, obj) {
          if(err) throw err;

          if(obj._clientNum != -1) {
            occupiedClientNumbers.push(obj._clientNum);
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

function makeFrequencyDicts(data, tweetTypes, times, cutoffs) {

  let hashtags = data.filter(obj => obj[0] == '#');
  let emojis = [].concat.apply([], data.filter(string => onlyEmoji(string).length >= 1).map(string => getEmojisFromString(string)));

  data = data.filter( function(string) {
    if(string[0] != '#' && onlyEmoji(string).length == 0) {
      return true;
    }
  });

  console.log('making frequency dictionary with cutoffs:' + cutoffs);

  return {
    hashtags: helperFunctions.makeFrequencyDict(hashtags, cutoffs.hashtags),
    emojis: helperFunctions.makeFrequencyDict(emojis, cutoffs.emojis),
    words: helperFunctions.makeFrequencyDict(data, cutoffs.words),
    types: helperFunctions.makeFrequencyDict(tweetTypes, 0),
    times: times
  };



}


function requestComplete(obj) {
  console.log(' - ' + obj._query + ' is done.');
  deoccupyclient(obj._clientNum)
  obj.data = makeFrequencyDicts(obj.temp_wordpool, obj.temp_tweetTypes, obj.temp_times, obj._cutoffs);
  obj.temp_wordpool = [];
  var topHashtags = wordsFor(obj.data.hashtags, obj._childQueries);

  if(obj.currentDepth != obj._depth) {
    console.log(' X Requesting ' + topHashtags.length + ' more searches.');
    for(x=0;x<topHashtags.length;x++) {
      if(topHashtags[x].key.toLowerCase() != obj.parentFileName.toLowerCase() && topHashtags[x].key.toLowerCase() != obj._query.toLowerCase()) {
        obj.children.push(request({query: topHashtags[x].key, count: obj._count/1.2, depth: obj._depth, currentDepth: obj.currentDepth+1, parentFileName:obj.parentFileName, requestParent: obj._query, cutoffs: obj.cutoffs, tooLow: obj.tooLow, isChild: true}))
      }
    }
  } else {
    console.log(' √ Desired Depth reached.');
    delete obj.hashtagObjs;
  }

  delete obj.uniques;
  delete obj._currentDepth;
  delete obj.temp_wordpool;
  delete obj.temp_usableTweets;
  delete obj.temp_tweetTypes;
  delete obj.temp_times;

  if(obj.isChild) {
    let parentObj = jsonfile.readFileSync('./magimagi/products/product-' + obj.parentFileName + '.json');
    parentObj.hashtagObjs.push(obj);
    jsonfile.writeFileSync('./magimagi/products/product-' + parentObj._filename + '.json', parentObj);
  } else {
    jsonfile.writeFileSync('./magimagi/products/product-' + obj._filename + '.json', obj);
  }

  if(fs.existsSync('./magimagi/requests/query-' + obj._filename + '.json')) {
    console.log(' - Unlinking ' + obj._filename);
    fs.unlinkSync('./magimagi/requests/query-' + obj._filename + '.json');
  } else {
    console.log(' - Was already unlinked. Ghost request.')
  }

};

function formatProduct(product) {
  jsonfile.readFile('./magimagi/products/product-' + product + '.json', function(err, obj) {
    if (err) throw err;

    delete obj.parentFileName;
    delete obj.requestParent;

    delete obj._clientNum;
    delete obj._depth;
    // delete obj.currentDepth;
    // delete obj._filename;
    delete obj._count;
    delete obj.isChild;

    delete obj.retweeted_tweets;
    delete obj._cutoffs;
    delete obj._childQueries;
    delete obj._tooLow;

    for(var key in obj.hashtagObjs) {
      delete obj.hashtagObjs[key].parentFileName;
      delete obj.hashtagObjs[key].requestParent;
      delete obj.hashtagObjs[key]._clientNum;
      delete obj.hashtagObjs[key]._depth;
      // delete obj.hashtagObjs[key].currentDepth;
      // delete obj.hashtagObjs[key]._filename;
      delete obj.hashtagObjs[key]._count;
      delete obj.hashtagObjs[key].isChild;
      delete obj.hashtagObjs[key].retweeted_tweets;
      delete obj.hashtagObjs[key]._cutoffs;
      delete obj.hashtagObjs[key]._childQueries;
      delete obj.hashtagObjs[key]._tooLow;

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
      // delete hashtag._filename;
      var indexOfChild = findObj(objArray, '_filename', hashtag.children[j]);
      var childObj = objArray[indexOfChild];
      if (childObj == undefined) {
        // console.log("Couldn't find child: " + hashtag.children[j]);
      } else {
        // console.log('    √ ' +childObj._filename + ' ' + childObj.currentDepth + ' is child of ' + hashtag._filename)
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
    console.log('Entered /requests')
    if(files.length <= 1) {
      console.log('No requests found!')
      return;
    }

    for(i=1;i<files.length;i++) {
      // console.log(i + ' / ' + files.length);
      jsonfile.readFile('./magimagi/requests/' + files[i], function(err, obj) {
        if(obj == undefined) {
          console.log('Invalid file.');
          return;
        }

        if(obj._clientNum == -1) {
          obj._clientNum = occupyclient();
          if(obj._clientNum == -1) {
            return;
          } else {
            console.log(' + Brought ' + obj._query + ' out of limbo.');
          }
        }

        // check if search is complete before searching



        // searching
        console.log(' * Searching Twitter for ' + obj._query + ' with Client #' + obj._clientNum);

        // getRateLimit(obj._clientNum);
        clients[obj._clientNum].get('search/tweets', {q: obj._query, result_type: 'recent', lang: 'en', count: 100}, function(error, tweets, response) {
          if(error) {
            console.log(obj._clientNum + ' ran out of requests.');
            console.log(getRateLimit(obj._clientNum))
            return;
          }

          if(tweets.statuses.length == 0) {
              console.log('No tweets found for ' + obj._query + '. What? Unlinking.');
              deoccupyclient(obj._clientNum);
              if(fs.existsSync('./magimagi/requests/query-' + obj._filename + '.json')) {
                console.log(' - Unlinking ' + obj._filename);
                fs.unlinkSync('./magimagi/requests/query-' + obj._filename + '.json');
              }
              return;
          }

          asyncLoop(tweets.statuses, function(item, next) {

            if(obj.uniques.includes(item.user.id_str)) {
              // user is not unique
            } else {

              if(item.retweeted_status != null) {
                obj.temp_tweetTypes.push('RT');
              } else {
                obj.temp_tweetTypes.push('OC');
              }
              obj.temp_usableTweets += 1
              obj.collectedTweets += 1;
              obj.uniques.push(item.user.id_str);
              helperFunctions.sterilizeTweet(item.text, obj.temp_wordpool, commons);
            }

            next();
          });

          // console.log('Asyncloop done.');
          console.log('\n' + ' ∞ ' + obj._query + ' @ ' + obj.currentDepth + ' / ' + obj._depth);
          console.log('   ' + obj.collectedTweets + ' / ' + obj._count);
          console.log(' + ' + obj.temp_usableTweets + ' / ' + tweets.statuses.length);
          console.log('\n');
          if(obj.temp_usableTweets <= obj._tooLow) {
            obj.low_frequency = true;
          }
          obj.temp_times.push({y:obj.temp_usableTweets, x: moment().format('X')});
          obj.temp_usableTweets = 0;


          if(obj.collectedTweets >= obj._count || obj.low_frequency) {
            // this request is complete. Check what happens to the data.
            if(obj.low_frequency) {
              console.log(obj._query + ' is low freq.')
            } else {
              console.log(obj._query + ' is Complete!')
            }
            requestComplete(obj);
            return;
          }

          jsonfile.writeFileSync('./magimagi/requests/query-' + obj._filename + '.json', obj);

        });

      });
    }
  });
}




awake();
// setTimeout(function() { request("love", 200, 3) }, 1000 * 1);

// setTimeout(function() { getRateLimit(0) }, 1000 * 1);
//
var options = {query:'love', count:1000, depth:1, childQueries:0, cutoffs:{words:'percentage', emojis:'percentage', hashtags:'percentage'}, tooLow:1}
//
// setTimeout(function() { request(options) }, 1000 * 1);
// setInterval(searchLoop, 1000 * 8);
formatProduct('love8158');
