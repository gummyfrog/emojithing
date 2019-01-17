var axios = require('axios');
var json = require('jsonfile');
var fs = require('fs');

class Updater {

	constructor() {
		this.name = "Unnamed Process";
		this.desc = "Description.";
		this.dateOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" }
	};

	post(obj) {
		var date = new Date();
		var postObj = {};
		obj['desc'] = this.desc;
		obj['last'] = date.toLocaleString('en-US', this.dateOptions)
		postObj[this.name] = obj;
		return axios.post('http://frogeye.duckdns.org:8282/status', postObj, { "headers": {"password": process.env.PASSWORD}})
	};

	// takes a filename and sends that over to DB for storage
	store(filename) {		
		json.readFile(filename, function (err, obj) {
			if(err) {
				console.log(`\x1b[31m`, `${err}`)
			};

			axios.post('http://localhost:8282/store', obj, { "headers": {"password": process.env.PASSWORD}})
				.then((response) => {
					console.log(response.data);
					if(response.data == `Object Retrieved. Moving to the fridge...`) {
						fs.unlinkSync(filename);
					}
				})
				.catch((err) => {
					console.log(`\x1b[31m`, `${err}`)
				});
		});
	}
};

module.exports = Updater;