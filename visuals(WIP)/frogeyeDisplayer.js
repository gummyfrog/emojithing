function type(value) {
  return(' <val class="'+typeof(value)+'">' + value + '</val>')
}

function ID(key, depth) {
  return (key + Math.random() + depth);
}
function display(name, value) {

  if(!isNaN(name)) {
    if(typeof(value) != 'undefined') {
      return('item '+name+':' + type(value));
    }
    return('Client '+ (parseInt(name)+1) +':');
  }

  switch(name) {
    default:
      return  (key + ' : ' + type(value));
  }


}


function crawl(object, depth, originalKey) {
  if(depth > 20) {
    return "";
  }
  returnHTML ='<ol class="panel">'
  for(key in object) {
    if(typeof(object[key]) == 'object') {
      returnHTML += '<li id="object">' + display(key) + '</li>' + crawl(object[key], depth+1, key);
    } else {
      returnHTML += ('<li class="depth'+depth+'"> ' + display(key, object[key]) + '</li>')
    }
  }
  return (returnHTML + '</ol>');
}


exports.jsonDisplay = function(container, data) {
  var returnHTML = '';

  for(key in data) {
    if(typeof(data[key]) == 'object') {
      returnHTML += '<li id="object">' + display(key) + crawl(data[key], 0, key);
    } else {
      returnHTML += ('<li>' + display(key, data[key]) + '</li>')
    }
  }

  container.innerHTML = returnHTML;

}

exports.makeButtons = function(document) {
  var acc = document.getElementsByClassName("accordion");
  var i;

  for (i = 0; i < acc.length; i++) {
    var child = acc[i];
    var p = 0;
    while( (child = child.previousSibling) != null )
      p++;

    var panel = acc[i].parentNode.childNodes[p + 4];
    if(panel.innerHTML == '') {
      acc[i].innerHTML = 'empty';
      acc[i].classList.add('empty');
    }

    acc[i].addEventListener("click", function() {
        this.classList.toggle("active");

        var child = this;
        var g = 0;
        while( (child = child.previousSibling) != null )
          g++;
        var panel = this.parentNode.childNodes[g + 4];
        panel.classList.toggle("transition");

        if(panel.innerHTML == '') {
          this.classList.toggle("active");
        }

    });
  }
  
}

// var jsonData = $.ajax({
//   url: "https://rawgit.com/gummyfrog/frogJson/master/slurp.json",
//   dataType: "json",
// }).done(function (data) {

//   moment().format();
//   var container = document.getElementById("jstree");
//   jsonDisplay(container, data);

//   for(c=0;c<pieIDs.length;c++) {
//     new Chart(document.getElementById(pieIDs[c]), dataToPie(pieDatas[c], ''));
//   }

//   for(b=0;b<cartesianIDs.length;b++) {
//     new Chart(document.getElementById(cartesianIDs[b]), dataToCartesian(cartesianDatas[b], ''));
//   }

//   for(l=0;l<barIDs.length;l++) {
//     new Chart(document.getElementById(barIDs[l]), dataToBar(barDatas[l], ''));
//   }

//   // window.onload = (function(){
//   //
//   //   var tweet = document.getElementById("tweet");
//   //   var id = tweet.getAttribute("tweetID");
//   //
//   //   twttr.widgets.createTweet(
//   //     id, tweet,
//   //     {
//   //       conversation : 'none',    // or all
//   //       cards        : 'hidden',  // or visible
//   //       linkColor    : '#cc0000', // default is blue
//   //       theme        : 'light'    // or dark
//   //     })
//   //   .then (function (el) {
//   //     el.contentDocument.querySelector(".footer").style.display = "none";
//   //   });
//   //
//   // });

  // var acc = document.getElementsByClassName("accordion");
  // var i;

  // for (i = 0; i < acc.length; i++) {
  //   var child = acc[i];
  //   var p = 0;
  //   while( (child = child.previousSibling) != null )
  //     p++;

  //   var panel = acc[i].parentNode.childNodes[p + 4];
  //   if(panel.innerHTML == '') {
  //     acc[i].innerHTML = 'empty';
  //     acc[i].classList.add('empty');
  //   }

  //   acc[i].addEventListener("click", function() {
  //       this.classList.toggle("active");

  //       var child = this;
  //       var g = 0;
  //       while( (child = child.previousSibling) != null )
  //         g++;
  //       var panel = this.parentNode.childNodes[g + 4];
  //       panel.classList.toggle("transition");

  //       if(panel.innerHTML == '') {
  //         this.classList.toggle("active");
  //       }

  //   });
  // }
// });
