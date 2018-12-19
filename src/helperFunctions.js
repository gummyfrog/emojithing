const fs = require('fs');
const emojiTree = require('emoji-tree');

exports.sterilizeTweet = function (tweetText, pool, excludeArray) {
	// returns a sterilized version of a tweet, and pushes said words to a passed word pool (removes special characters, emojis, links, excluded words, numbers)
	// THIS FUNCTION NEEDS SERIOUS OPTIMIZATION! Very Bad Code!
	var purgeWords = [];
	var words = tweetText.replace(/[`“”’~!$%^&*()_|+\-=?;:…'",.<>\{\}\[\]\\\/(\r\n|\r|\n)]/gi, '').toLowerCase().split(' ');

	for (i = 0; i < words.length; i++) {
		if (words[i].includes('@') || words[i].includes('https') || words[i].length < 3 || excludeArray.includes(words[i]) || words[i].match(/^[0-9]+$/) != null) {
			purgeWords.push(words[i]);
		}
	}

	for (i = 0; i < purgeWords.length; i++) {
		words.splice(words.indexOf(purgeWords[i]), 1);
	}

	for (i = 0; i < words.length; i++) {
		pool.push(words[i]);
	};

	return words.join(' ');
}

exports.decimate = function (data, step) {
	// Decimates an array of chart data. Returns a lower resolution chart.

	var decimated = [];
	for (i = step; i < data.length; i += step) {
		// console.log('stepping...' + i);
		var group = [];

		for (x = 0; x < step; x++) {
			group.push(data[i - x])
		}
		if (group.includes('undefined')) {
			// console.log('Hit Undefined');
			break;
		}

		group.sort(function (a, b) {
			return b.y - a.y
		});
		
		// median
		// console.log(group[Math.floor((group.length - 1) / 2)])
		// decimated.push(group[Math.floor((group.length - 1) / 2)]);

		// average
		var average = group.reduce(function (r, a) {
			return r + a.y;
			//    ^^^ use the last result without property
		}, 0);
		decimated.push({
			y: average,
			x: group[Math.floor((group.length - 1) / 2)].x
		})

		// console.log('assembled group of ' + group.length);

	}
	// console.log('done decimating');
	// console.log(decimated);
	return decimated;
}

exports.getEmojisFromString = function (string) {
	// returns any Emojis inside of a string.
	return emojiTree(string).filter(obj => obj.type == 'emoji').map(obj => obj.text);
}


exports.topFromDict = function (dict, count) {
	// returns the top X results from a frequency dictionary.
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


exports.removeFrom = function (list, items) {
	// removes an array of items from another array of items.
	for (var q = 0; q < items.length; q++) {
		list.splice(list.indexOf(items[q]), 1);
	}
	items = [];
}

exports.trimData = function (data) {
	// It... It appears to rearrange numbers highest to lowest...
	// This function needs optimization...
	// Used by formatHashtagObjs and magi.collapseProduct
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


function findObj(objects, key, value) {
	// Finds a key in an object.
	// Used by formatHashtagObjs
	for (var i = 0; i < objects.length; i++) {
		if (objects[i][key] === value) {
			return i;
		}
	}
	return -1;
}

exports.formatHashtagObjs = function (objArray) {
	// Turns a list of parents and children objects into a tree.
	objArray.sort((a, b) => {
		return b.currentDepth - a.currentDepth;
	});

	for (var x = 0; x < objArray.length; x++) {
		var hashtag = objArray[x];
		console.log(' § ' + hashtag.filename + ' ' + hashtag.currentDepth + '   [' + hashtag.children + ']');
		for (var j = 0; j < hashtag.children.length; j++) {
			var indexOfChild = findObj(objArray, 'filename', hashtag.children[j]);
			var childObj = objArray[indexOfChild];
			if (childObj == undefined) {
				// something went very wrong...
				console.log("Couldn't find child: " + hashtag.children[j]);
			} else {
				console.log('    √ ' +childobj.filename + ' ' + childObj.currentDepth + ' is child of ' + hashtag._filename)
				if (childObj.hasOwnProperty('data')) {
					trimData(childObj.data)
				};

				hashtag.hashtagObjs.push(childObj);
			}
		}
	}

	return objArray.filter(obj => obj.currentDepth == 1);
}



function highestFrequencyinData(data) {
	// helper function for makeFrequencyDict. Used to establish a baseline for percentage-relative cutoffs.
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

exports.makeFrequencyDict = function (data, cutoff) {
	// makes a frequency dictionary.
	var counts = {};
	var result = {};
	var cutStorage = cutoff.value;

	if (cutoff.type == 'percentage') {
		var highFreq = helperFunctions.highestFrequencyinData(data)
		cutStorage = (cutoff.value / 100) * highFreq;
		// console.log(cutoff.value + ' percent of ' + highFreq  + ' is ' + cutStorage);
	}

	for (var i = 0; i < data.length; i++) {
		var num = data[i];
		counts[num] = counts[num] ? counts[num] + 1 : 1;
	}
	for (var key in counts) {
		if (counts.hasOwnProperty(key) && counts[key] > cutStorage) {
			result[key] = counts[key];
		}
	}

	var backToArray = Object.keys(result).map(key => ({
		key: key,
		value: result[key]
	})).sort((a, b) => {
		return b.value - a.value
	});
	var backToObject = {};
	for (var l = 0; l < backToArray.length; l++) {
		backToObject[backToArray[l].key] = backToArray[l].value;
	}

	logUpdate(`√ Made Dictionary from ${data.length} items...`)

	return (backToObject);
}

objhtml = function(obj) {
	var returnHtml = "";
	var keys = Object.keys(obj);
	for(var i=0; i<keys.length; i++) {
		var key = keys[i];
		returnHtml += `<span class="obj"><p class="key">${key}</p> <p class="value">${obj[key]}</p> </span>`;
	}
	return returnHtml;
}

exports.objarrayhtml = function(objarray) {
	var returnHtml = "";
	for(var x=0;x<objarray.length;x++) {
		returnHtml += objhtml(objarray[x]);
	}
	return returnHtml;
}

