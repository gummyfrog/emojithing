

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
			tweetBox.innerHTML = "";

			document.getElementById('requests').textContent = status.requests;
			document.getElementById('occupied').textContent = status.occupied;
			document.getElementById('interval').textContent = status.interval;
			document.getElementById('queryInfo').innerHTML = status.queryInfo;
			document.getElementById('clientInfo').innerHTML = status.clientInfo;
			console.log(status.displayTweets);

			document.getElementById('queryInfo').classList.add('flash');
			document.getElementById('clientInfo').classList.add('flash');

			setTimeout(function () {
				document.getElementById('queryInfo').classList.remove('flash');
				document.getElementById('clientInfo').classList.remove('flash');
			}, 1000 * 2);

			console.log(status.loopCollected);
			console.log(status);
			addData(tweetChart, "The Now", status.loopCollected)
			console.log(status.interval);
			var timer = setInterval(function () {
				status.interval--;
				console.log(status.displayTweets.length);
				if(status.displayTweets.length !=0) {
					var tweet = status.displayTweets[0].tweet;

					tweetBox.innerHTML += `<span id=${tweet.id_str}></span>`;

				    twttr.widgets.createTweet(tweet.id_str, document.getElementById(tweet.id_str), {
				        conversation: 'none',
				        cards: 'hidden',
				        linkColor: '#cc0000',
				        theme: 'light'
				    });

					status.displayTweets.shift();
				}

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

