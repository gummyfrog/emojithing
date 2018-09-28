const fs = require('fs');
var Twitter = require('twitter');
var jsonfile = require('jsonfile')
var asyncLoop = require('node-async-loop');
var emojiStrip = require('emoji-strip');

const helperFunctions = require('./helperFunctions.js');

var client;

jsonfile.readFile('./clients/magellan.json', function(err, obj) {
  client = new Twitter(obj);
})

const commons = fs.readFileSync('./magellan/commons.txt', 'utf8').split(',');

const desiredTweetCount = 500;

const emojiCensusList = fs.readFileSync('./magellan/emoji.txt', 'utf8').split(' ');
const params = {
    q: 'test',
    result_type: 'recent',
    include_entities: 'false',
    locale: 'en',
  }

const savedState = fs.readFileSync('./magellan/currentIndex.txt', 'utf8').split(',');

var currentEmojiIndex = parseInt(savedState[0]);
var tweetCount = parseInt(savedState[1]);

var delay = 2;

fs.writeFileSync('./magellan/uniques.txt', '');




// temporary data creates a temporary pool of words for this emoji cycle, to be processed later
function makeTemporaryData(words, emoji) {
  fs.appendFile("./magellan/temp/" + emoji + ".txt", words.join(','), function (err) {
    if(err) throw err;
    console.log('Appended word pool for  ' + emoji + '  to temporary file. ' + words.length + ' words.');
  });
}

// permanent data is called at the end of a search cycle for a certain emoji,
// which combines previous permanent data and the new temp data.
function makePermanentData(emoji, purgeLowFreqWords) {
  var rawData = [];

  if(fs.existsSync('./magellan/temp/' + emoji + '.txt')) {
    rawData = fs.readFileSync('./magellan/temp/' + emoji + '.txt', 'utf8').split(',');
  } else {
    console.log('no temp data to add to database!')
  }

  // check if permanent data already exists

  if(fs.existsSync('./magellan/perm/' + emoji + '.txt')) {
    console.log('Old Data detected...');
    var oldData = fs.readFileSync('./magellan/perm/' + emoji + '.txt', 'utf8').split(',');

    for(i=0;i<oldData.length-1;i++) {
      var wordFreq = oldData[i].split('|');
      if(purgeLowFreqWords && wordFreq[1] < 3) {
        // word occurs too infrequently and it has been deemed that on this pass, this is not acceptable.
      } else {
        for(x=0;x<wordFreq[1];x++) {
            rawData.push(wordFreq[0]);
        }
      }
    }
  }


  fs.writeFileSync('./magellan/perm/' + emoji + '.txt', '');
  fs.appendFileSync('./magellan/perm/' + emoji + '.txt', helperFunctions.makeFrequencyDictString(rawData));
  if(fs.existsSync('./magellan/temp/' + emoji + '.txt')) {
    fs.unlinkSync('./magellan/temp/' + emoji + '.txt');
  }

}

// end of factory functions

// looping search manages the search function at a higher level
function loopingSearch() {
  console.log('Count is: ' + tweetCount);
  console.log('Index is: ' + currentEmojiIndex);
  console.log('Total delay is: ' + (15 + delay) + '(' + delay + ')');


  if(tweetCount >= desiredTweetCount || delay > 20) {

    if(delay > 20) {
      // not a permanent solution.
      console.log('Terminating search for ' + emojiCensusList[currentEmojiIndex] + ' due to extremely low frequency.');
    } else {
      console.log('Moving on...');
    }

    delay = 0;
    uniques = [];
    makePermanentData(emojiCensusList[currentEmojiIndex]);
    tweetCount = 0;
    fs.writeFileSync('./magellan/uniques.txt', '');

    if(currentEmojiIndex == emojiCensusList.length-1) {
      currentEmojiIndex = 0;
    } else {
      currentEmojiIndex++;
    }

  }

  fs.writeFileSync('./magellan/currentIndex.txt', (currentEmojiIndex + ',' + tweetCount));

  search(emojiCensusList[currentEmojiIndex]);
}

function search(emoji) {
  console.log('\n')
  client.get('search/tweets', {q: emoji, result_type: 'recent', lang: 'en', count: 100}, function(error, tweets, response) {
    if(error) throw error;

    if(tweets.statuses.length <= 0) {
      console.log('Got no tweets. What? Nobody uses this emoji? Bizarre.');
      delay += 10;
      return;
    }

    console.log('Got ' + tweets.statuses.length + ' total tweets while searching for ' + emoji + '\n Running async loop...')

    var goodTweets = 0;

    // wordPool is all words from sterilized tweets collected this session
    var wordPool = [];
    var uniques = fs.readFileSync('./magellan/uniques.txt', 'utf8').split(',');

    asyncLoop(tweets.statuses, function (tweet, next) {

      if(tweet.retweeted_status != null || tweet.truncated == true) {
        // bad tweet
      } else if(uniques.includes(tweet.user.screen_name)) {
        //console.log(tweet.user.screen_name + ' is not unique, index is ' + uniques.indexOf(tweet.user.screen_name));
      } else {

        goodTweets++;
        helperFunctions.sterilizeTweet(tweet.text, wordPool, commons);
        tweetCount++;
        fs.appendFileSync('./magellan/uniques.txt', tweet.user.screen_name + ',');
      }

      next();
    });

    console.log('Asyncloop Done')

    makeTemporaryData(wordPool, emoji);
    console.log('Number of usable tweets: ' + goodTweets);

    if(goodTweets < 60) {
      delay++;
    }

    if(goodTweets > 60) {
      delay -= 0.2;
    }

  });
}


function getFilesizeInBytes(filename) {
    const stats = fs.statSync(filename)
    const fileSizeInBytes = stats.size
    return fileSizeInBytes
}

function mostPopular() {
  fs.readdir('./magellan/perm', function (err, files) {
    var counts = [];
    files.forEach(function(file) {

      if(file!='.DS_Store') {
        counts.push({emoji: file, size: getFilesizeInBytes('./magellan/perm/' + file)});
      }
    });

    // Sort the array based on the second element
    counts.sort(function(first, second) {

        return second.size - first.size;
    });

    console.log(counts.slice(0, counts.length));

    jsonfile.writeFile('./popularemojis.json', {popular: counts, json: true}, function(err) {
      if (err) throw err;
      console.log('Wrote emojis down by size.')
    });
  });
}


console.log(emojiCensusList.length);

setInterval(loopingSearch, 1000 * (3 + delay) );

mostPopular();
