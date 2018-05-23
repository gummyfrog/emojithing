var emojiStrip = require('emoji-strip');
const fs = require('fs');

// sterilizeTweet will return array of words

exports.sterilizeTweet = function(tweetText, pool, excludeArray) {
  var purgeWords = [];
  var push = false;

  // emojistrip cleans emojis, first regex cleans undesirable characters
  var words = tweetText.replace(/[`“”’~!$%^&*()_|+\-=?;:…'",.<>\{\}\[\]\\\/(\r\n|\r|\n)]/gi, '').toLowerCase().split(' ');

  for(i=0;i<words.length;i++) {
    push = false;

    if(words[i].includes('@') || words[i].includes('https') || words[i].length < 3 || excludeArray.includes(words[i]) || words[i].match(/^[0-9]+$/) != null ) {
      purgeWords.push(words[i]);
    }

    if(push == true) {
      purgeWords.push(words[i]);
    }

  }

  for(i=0;i<purgeWords.length;i++) {
    words.splice(words.indexOf(purgeWords[i]), 1);
  }

  for(i=0;i<words.length;i++) {
    pool.push(words[i]);
  };

  return words.join(' ');
}


// makes frequency dictionary out of raw word pool
exports.makeFrequencyDictString = function(data) {
  var counts = {};

  for (var i = 0; i < data.length; i++) {
      var num = data[i];
      counts[num] = counts[num] ? counts[num] + 1 : 1;
  }
  // console.log(counts);

  var str = '';

  for (var p in counts) {
      if (counts.hasOwnProperty(p)) {
          str += p + '|' + counts[p] + ',';
      }
  }
  return str;

}


exports.wordsFor = function(emoji, count) {
	if(fs.existsSync('./magellan/perm/' + emoji + '.txt') ) {

		var dict = [];

		var dictionaryData = fs.readFileSync('./magellan/perm/' + emoji + '.txt', 'utf8').split(',');
		dictionaryData.splice(-1,1);

		for(i=0;i<dictionaryData.length;i++) {
			var wordData = dictionaryData[i].split('|');
			dict.push({key: wordData[0], value: wordData[1]});
		}

		//console.log('All Done! Giving you your data:')
		dict.sort(function(a, b){
    		return a.value-b.value
		})

		//console.log('Most popular words for ' + emoji + ' ::')
		var returnDict = [];

		if(count == 0) {
			count = dict.length;
			//console.log('count = 0, ' + dict.length, + count );
		}

		for(i=dict.length-count;i<dict.length;i++) {
			returnDict.push(dict[i])
		}
		return(returnDict);

	} else {
		console.log('File does not exist. Get more data!')
	}

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

exports.makeFrequencyDict = function(data, cutoff) {
  var counts = {};
  var result = {};
  var cutStorage = cutoff;

  if(cutoff == 'percentage') {
    var highFreq = highestFrequencyinData(data)
    cutStorage = (10.3 / 100) * highFreq;
    console.log('15.2 percent of ' + highFreq  + ' is ' + cutStorage);
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

  return backToObject;
}
