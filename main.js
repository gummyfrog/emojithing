const Magi = require('./magi.js');
const axios = require('axios')
var nodeCleanup = require('node-cleanup');

nodeCleanup(function (exitCode, signal) {
    if (signal) {
        post({'status':'offline'}).then(() => {
            process.kill(process.pid, signal);
        });

        nodeCleanup.uninstall(); // don't call cleanup handler again
        return false;
    }
});

var magi = new Magi();

magi.start();


function post(obj) {
return axios.post('http://gummyfrog.herokuapp.com/site', {
	frogeye: obj
  }, { "headers": {"authentication": "cicadas2565"}})
}



setInterval(function() { post({"status": 'online', "active-clients": magi.occupiedClientNumbers.length, "active-requests": magi.requestCount})}, 1000 * 10);

var options = {
  query: 'developers',
  count: 200,
  config: {
    depth: 2,
    childQueries:0,
    cutoffs:{
      words:{
        type:'percentage',
        value:50
      },
      emojis:{
        type:'percentage',
        value:10
      },
      hashtags:{
        type:'percentage',
        value:30
      },
      decimate:{
        step: 1,
      }
    },
    tooLow: 100,
    divisor: 2
  }
};

// magi.request(options)
