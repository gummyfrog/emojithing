

var ctx = document.getElementById('chart').getContext('2d');
var tweetChart = new Chart(ctx, {
	type: 'line',
	data: {
		labels: [],
		datasets: [{
			label: "Tweet Aggregation",
			backgroundColor: 'rgb(255, 99, 132)',
			borderColor: 'rgb(255, 99, 132)',
			data: [],
			pointRadius: 0,
		}]
	},

	options: {
		responsive: true,
		maintainAspectRatio: true,
		legend: {
			display: false
		},
		scales: {
			xAxes: [{
				gridLines: {
					display: false,
					drawBorder: false,
					drawTicks: false,
				},
				ticks: {
					display: false,
				}
			}],
			yAxes: [{
				gridLines: {
					display: false,
					drawBorder: false,
					drawTicks: false,
				},
				ticks: {
					display: false,
				}
			}]
		}
	}
});


function scrollToElm(container, elm, duration){
  var pos = getRelativePos(elm);
  scrollTo( container, pos.top , 2);
}

function getRelativePos(elm){
  var pPos = elm.parentNode.getBoundingClientRect(),
      cPos = elm.getBoundingClientRect(),
      pos = {};

  pos.top    = cPos.top    - pPos.top + elm.parentNode.scrollTop,
  pos.right  = cPos.right  - pPos.right,
  pos.bottom = cPos.bottom - pPos.bottom,
  pos.left   = cPos.left   - pPos.left;

  return pos;
}
    
function scrollTo(element, to, duration, onDone) {
    var start = element.scrollTop,
        change = to - start,
        startTime = performance.now(),
        val, now, elapsed, t;

    function animateScroll(){
        now = performance.now();
        elapsed = (now - startTime)/1000;
        t = (elapsed/duration);

        element.scrollTop = start + change * easeInOutQuad(t);

        if( t < 1 )
            window.requestAnimationFrame(animateScroll);
        else
            onDone && onDone();
    };

    animateScroll();
}


function easeInOutQuad(t){ return t<.5 ? 2*t*t : -1+(4-2*t)*t };

function addData(chart, label, data) {
	chart.data.labels.push(label);
	chart.data.datasets.forEach((dataset) => {
		dataset.data.push(data);
	});
	chart.update();
};

	
function getCache() {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', "/requests", true);
	xhr.send();

	xhr.onreadystatechange = processRequest;

	function processRequest(e) {
		if (xhr.readyState == 4 && xhr.status == 200) {
			var status = JSON.parse(xhr.response);
			var tweetBox = document.getElementById('twitterInfo');

			document.getElementById('requests').textContent = status.requests;
			document.getElementById('occupied').textContent = status.occupied;
			document.getElementById('interval').textContent = status.interval;
			document.getElementById('queryInfo').innerHTML = status.queryInfo;
			console.log(status.displayTweets);

			document.getElementById('queryInfo').classList.add('flash');

			if(status.displayTweets.length !=0) {
				tweetBox.innerHTML = "";
				for(var x=0;x<status.displayTweets.length;x++) {
					var tweet = status.displayTweets[x].tweet;
					tweetBox.innerHTML += `<div tweetID=${tweet.id_str} class="tweet"></div>`;
				}
			}

			var elements = document.getElementsByClassName("tweet");
			for(var i=0; i<elements.length; i++) {
				var tweet = elements[i];
				var id = tweet.getAttribute("tweetID");
				if(twttr != undefined) {
				  twttr.widgets.createTweet(
				  id, tweet,
				  {
				    conversation : 'none',    // or all
				    cards        : 'hidden',  // or visible
				    linkColor    : '#cc0000', // default is blue
				    theme        : 'dark'    // or dark
				  });
				}
			}



			setTimeout(function () {
				document.getElementById('queryInfo').classList.remove('flash');
				scrollToElm(tweetBox, document.getElementById("twitterInfo").lastChild, 1700);
			}, 1000 * 2);


			console.log(status.loopCollected);
			console.log(status);
			addData(tweetChart, "The Now", status.loopCollected)
			console.log(status.interval);
			var timer = setInterval(function () {
				status.interval--;
				if(status.interval < 10) {
					document.getElementById('interval').textContent = status.interval + "0";
				}
				console.log(status.displayTweets.length);

				document.getElementById("interval").textContent = status.interval;
				if (status.interval <= 1)
					clearInterval(timer);
			}, 1000);

		};
	};
};

getCache();
setInterval(getCache, 1000 * 20)

document.addEventListener('click', function (e) {
	if (e.target && e.target.classList.contains('complete')) {
		var http = new XMLHttpRequest();
		var url = '/earlyComplete';
		var params = {complete: e.target.id};
		http.open('POST', url, true);


		//Send the proper header information along with the request
		http.setRequestHeader('Content-type', 'application/json');
		http.setRequestHeader('authentication', 'very_secret_password');

		http.onreadystatechange = function () { //Call a function when the state changes.
			if (http.readyState == 4 && http.status == 200) {
				alert(http.responseText);
			}
		}
		http.send(JSON.stringify(params));
	}
})

