/*jshint esversion: 6 */
var rp = require("request-promise");
var cheerio = require('cheerio');
var url = require('url');
var request = require('request');

//Extracts the links from http://vhost3.lnu.se:20080/weekend
var extractLinksData = function(urls) {
    var promises = [];
    var options = {
        transform: function(body) {
            return cheerio.load(body);
        }
    };
    urls.forEach(function(url) {
        options.uri = url;
        promises.push(rp(options));
    });

    return Promise.all(promises).then(function(value) {
        var urlArray = [];
        //Finds the value of the href attribute inside the <a> tag
        value.forEach(function($) {
            $("a")
                .filter("[href]")
                .map(function(index, link) {
                    urlArray.push(url.resolve(String(urls)+"/",$(link).attr("href")));
                });
        });
        return Promise.resolve(urlArray);
    });
};

// Extracts the calendar data from http://vhost3.lnu.se:20080/calendar/ which is located inside a table
var extractCalenderData = function(urls) {
    var promises = [];
    var options = {
        transform: function(body) {
            return cheerio.load(body);
        }
    };
    urls.forEach(function(url) {
        options.uri = url;
        promises.push(rp(options));
    });

    return Promise.all(promises).then(function(value) {
        var daysArray = [];
        //Will get the values of the table and make them a string. String will look something like this: "fridayok"
        // or friday--
        value.forEach(function($) {
          $('th').each(function(dayIndex, day) {
              $('td').each(function(statusIndex, status) {
                if(dayIndex === statusIndex){
                  daysArray.push(($(day).text()+$(status).text()).toLowerCase());
                }
              });
          });
        });
        return Promise.resolve(daysArray);
    });
};

//http://vhost3.lnu.se:20080/cinema is sent here.
var extractCinemaData = function(urls) {
    var promises = [];
    var options = {
      transform: function(body) {
        return cheerio.load(body);
      }
    };
    urls.forEach(function(url) {
      options.uri = url;
      promises.push(rp(options));
    });

    return Promise.all(promises).then(function(value) {
      var optionArray = [];
      //Fins the values of the option tag attribute value
      value.forEach(function($) {
          $("option")
              .filter("[value^='0']")
              .map(function(index, link) {
                var strObj = {id:$(link).attr("value"), title:$(link).text()};
                optionArray.push(strObj);
              });
      });
      optionArray.splice(0,3);
      return Promise.resolve(optionArray);
  });
};

//Gets the JSON objects with the cinema times
var get = function(urls) {
    //url contains the free days of everyone
    var promises = [];
    var options = {
        transform: function(body) {
          return cheerio.load(body);
        }
    };
    urls.forEach(function(url) {
      options.uri = url;
      promises.push(rp(options));
    });

    return Promise.all(promises).then(function(value) {
      var jsonArray = [];
      var nonFullyBookedMovies = [];
        value.forEach(function($) {
          jsonArray.push(JSON.parse($.text()));
        });
        //Get the non-fully booked movies adn put them in another array
        for (i = 0; i <= jsonArray.length; i++) {
          for (j = 0; j < jsonArray.length; j++) {
            try{
              if(jsonArray[j][i].status === 1){
                var strObj = {
                  day: jsonArray[j][i].day, movieID: jsonArray[j][i].movie,
                  startTime:parseInt(jsonArray[j][i].time)+"00",
                  endTime:parseInt(jsonArray[j][i].time)+2 +"00"
                };
                nonFullyBookedMovies.push(strObj);
              }
            }catch(error){
              return Promise.resolve(nonFullyBookedMovies);
            }
          }
        }
        return Promise.resolve(nonFullyBookedMovies);
    });
};

var inputToAjax = function(dayStatus, movies, link) {
  return new Promise(function(resolve,reject){
    var indexes = [], i;
    var days = ["fridayok","saturdayok","sundayok"];
    var day = 0;
    var result = [];
    var tempArray = [];

    for(i = 0; i < dayStatus.length; i++){
      day += 1;
      var test = "0"+(day+4);
      for(n = 0; n < dayStatus.length; n++){
        if (dayStatus[n] === days[day-1]){
          result.push("0"+(day+4));
        }
      }
    }
    //Checks which day everyone is free
  var count = 0;
  for(i = 0; i < 3; i++){
    count++;
    //Could add the rest of the days if needed
    if(result.toString().match(/05/g).length === 3 && count === 1){
      tempArray.push(i+5);
    }
    if(result.toString().match(/06/g).length === 3 && count === 2){
      tempArray.push(i+5);
    }
    if(result.toString().match(/07/g).length === 3 && count === 3){
      tempArray.push(i+5);
    }
  }
    var counter = 0;
    var array = [];
    for(i = 0; i < tempArray.length; i++){
      for(j = 0; j < 3; j++){
        var str = link+"/check?day="+"0"+tempArray[counter]+"&movie="+movies[j].id;
        array.push(str);
      }
      counter++;
    }
      if(array.length === 0){
        console.log("No one is free this weekend. Try again next week!");
        process.exit(0);
      }
      resolve(get(array));
  });
};

//Extracts the data from the restaurant.
var extractRestaurantData = function(data) {
  var promises = [];
  promises.push(cheerio.load(data));
    return Promise.all(promises).then(function(value) {
      var restaurantTimesArray = [];
      value.forEach(function($) {
          $("input")
              .filter("[name^='group1']")
              .map(function(index, link) {
                var day = "";
                var dayID;
                  if($(link).attr("value").substring(0,3) === "fri"){
                      day = "friday";
                      dayID = "05";
                  }
                  if($(link).attr("value").substring(0,3) === "sat"){
                    day = "saturday";
                    dayID = "06";
                  }
                  if($(link).attr("value").substring(0,3) === "sun"){
                    day = "sunday";
                    dayID = "07";
                  }
                  var obj = {day:day, dayID: dayID, startTime: parseInt($(link).attr("value").substring(3).substring(2) + "00")-200};
                  restaurantTimesArray.push(obj);
              });
      });
      return Promise.resolve(restaurantTimesArray);
    });
};

//Authenticates to the website and gets the cookie
var getCookie = function(url, formLinks) {
  return new Promise(function(resolve, reject){
    //http://stackoverflow.com/questions/6432693/post-data-with-request-module-on-node-js
    var request = require("request");
    var cookieString;
    request.post({
      headers: {'content-type' : 'application/x-www-form-urlencoded'},
      url: url+formLinks[0],
      form:{
        username: 'zeke',
        password: 'coys',
        submit: 'login'
      }
    }, function(error, response, body){
      var str = response.headers['set-cookie'].toString().split(';');
      cookieString = str[0];
      //Gets the /booking part of the link
      $ = cheerio.load(body);
      var link = body.slice(body.lastIndexOf('/'));
      resolve([cookieString, link]);
    });
  });
};

var getRestaurantData = function(cookieString, url) {
  // Code taken from here: http://stackoverflow.com/questions/8498592/extract-root-domain-name-from-string
  var domain;
  if (url.indexOf("://") > -1) {
      domain = url.split('/')[2];
  }
  else {
      domain = url.split('/')[0];
  }
  domain = domain.split(':')[0];

  //http://stackoverflow.com/questions/30942865/how-to-access-response-body-after-simulating-a-post-request-in-node-js
  return new Promise(function(resolve,reject){
    var target = url;
    var jar = request.jar();
    var cookie = request.cookie(cookieString);
    cookie.domain = domain;
    cookie.path = "/";

    jar.setCookie(cookie, target, function(error, cookie) {});
    request({
        uri: target,
        method: "GET",
        jar: jar
    }, function(error, response, body) {
        resolve(body);
    });
  });

};
//Extracts some of the link structure from the forms on http://vhost3.lnu.se:20080/dinner/. This function will find /login
var extractFormActions = function(urls) {
    var promises = [];
    var options = {
        transform: function(body) {
            return cheerio.load(body);
        }
    };
    urls.forEach(function(url) {
        options.uri = url;
        promises.push(rp(options));
    });

    return Promise.all(promises).then(function(value) {
        var formActionValues = [];
        //Finds the value of the action attribute in the form
        value.forEach(function($) {
            $("form")
                .filter("[action^='/']")
                .map(function(index, link) {
                    formActionValues.push($(link).attr("action").slice($(link).attr("action").lastIndexOf('/')));
                });
        });
        return Promise.resolve(formActionValues);
    });
};

// Exports
module.exports.extractFormActions = extractFormActions;
module.exports.getRestaurantData = getRestaurantData;
module.exports.getCookie = getCookie;
module.exports.extractRestaurantData = extractRestaurantData;
module.exports.inputToAjax = inputToAjax;
module.exports.extractLinksData = extractLinksData;
module.exports.extractCalenderData = extractCalenderData;
module.exports.extractCinemaData = extractCinemaData;
