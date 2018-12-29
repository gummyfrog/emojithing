var axios = require('axios')

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
};

module.exports = Updater;