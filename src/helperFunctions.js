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

exports.decimate = function(data, step) {
  var decimated = [];
  for(i=step;i<data.length;i+=step) {
    // console.log('stepping...' + i);
    var group = [];

    for(x=0;x<step;x++) {
      group.push(data[i-x])
    }
    if(group.includes('undefined')) {
      // console.log('Hit Undefined');
      break;
    }

    group.sort(function(a,b) {return b.y-a.y});
    // median
    // console.log(group[Math.floor((group.length - 1) / 2)])
    // decimated.push(group[Math.floor((group.length - 1) / 2)]);

    // average
    var average = group.reduce(function (r, a) {
        return r + a.y;
        //    ^^^ use the last result without property
    }, 0);
    decimated.push({y:average, x: group[Math.floor((group.length - 1) / 2)].x })

    // console.log('assembled group of ' + group.length);

  }
  // console.log('done decimating');
  // console.log(decimated);
  return decimated;
}

exports.findObj = function(objects, key, value) {
    for (var i = 0; i < objects.length; i++) {
      if (objects[i][key] === value) {
        return i;
      }
    }
    return -1;
  }


exports.getEmojisFromString = function(string) {
  return emojiTree(string).filter(obj => obj.type == 'emoji').map(obj => obj.text);
}


exports.wordsFor = function(dict, count) {
    var data = Object.keys(dict).map(key => {
      return {
        key: key,
        value: dict[key]
      };
    })

    data.sort((a, b) => {
      return b.value - a.value
    })

    // console.log(data.slice(0, count));
    return data.slice(0, count);
  }

exports.highestFrequencyinData = function(data) {
  var tempCounts = {};
  for (var t = 0; t < data.length; t++) {
    var num = data[t];
    tempCounts[num] = tempCounts[num] ? tempCounts[num] + 1 : 1;
  }
  var p = Object.keys(tempCounts).map(i => tempCounts[i]).sort((a, b) => {
    return b - a
  })

  return p[0];
}


exports.removeFrom = function(list, items) {
    for (var q = 0; q < items.length; q++) {
      list.splice(list.indexOf(items[q]), 1);
    }
    items = [];
  }

exports.trimData = function(data) {
    for (var key in data) {
      if (['number'].includes(typeof (data[key]))) {
        continue;
      }

      var returnObj = {};
      var slicedData = Object.keys(data[key]).map(dataKey => {
        return {
          key: dataKey,
          value: data[key][dataKey]
        }
      }).sort((a, b) => {
        return b.value - a.value
      })


      for (var i = 0; i < slicedData.length; i++) {
        returnObj[slicedData[i].key] = slicedData[i].value;
      }

      data[key] = returnObj;
    }

  }

exports.formatHashtagObjs = function(objArray) {
    objArray.sort((a, b) => {
      return b.currentDepth - a.currentDepth;
    });

    for (var x = 0; x < objArray.length; x++) {
      var hashtag = objArray[x];
      console.log(' § ' + hashtag.filename + ' ' + hashtag.currentDepth + '   [' + hashtag.children + ']');
      for (var j = 0; j < hashtag.children.length; j++) {
        // delete has/htag._filename;
        var indexOfChild = findObj(objArray, 'filename', hashtag.children[j]);
        var childObj = objArray[indexOfChild];
        if (childObj == undefined) {
          // console.log("Couldn't find child: " + hashtag.children[j]);
        } else {
          // console.log('    √ ' +childobj.filename + ' ' + childObj.currentDepth + ' is child of ' + hashtag._filename)
          if (childObj.hasOwnProperty('data')) {
            trimData(childObj.data)
          };

          hashtag.hashtagObjs.push(childObj);
        }
      }
    }

    return objArray.filter(obj => obj.currentDepth == 1);
  }
