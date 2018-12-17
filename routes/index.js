var express = require('express');
var path = require('path');
var router = express.Router();


class customRouter {

  constructor() {
    this.express = express;
    this.path = path;
    this.router = router;

    this.app = this.express();
    this.app.use(this.express.static("/../public"));
    this.setup();
  }

  setup() {
    this.router.get('/', function(req, res){
      res.render('home', {
        title: 'Home'
      });
    });
  }

}


module.exports = customRouter;
