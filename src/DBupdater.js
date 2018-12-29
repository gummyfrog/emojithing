var axios = require('axios')
var Updater = require ('./updater.js');

class DBupdater extends Updater {
	store(obj) {
		return axios.post('http://frogeye.duckdns.org:8282/store', obj, { "headers": {"password": process.env.PASSWORD}})
	};
};

module.exports = DBupdater;