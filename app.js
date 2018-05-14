/*jshint esversion: 6 */
var scraper = require("./lib/scraper.js");

// Command line argument
var args = process.argv.slice(2);
var firstPageLinks = [];
var freeDays = []; //Stores the days when everyone is free
var cinemaTimes = []; //Stores the cinema times for every day
var restaurantTimesArray = [];  //Stores the restaurant free table times
var movieList = []; //List with name and id of the current movies. Not used atm but could come handy later

// Hittas inga argument eller är för många så avsluta
if (args.length === 0) {
    console.log("Fel! Inga argument.");
    process.exit(0);
}
else if (args.length > 1) {
    console.log("Fel! För många argument.");
    process.exit(0);
}

scraper.extractLinksData(args) //Gets the links from http://vhost3.lnu.se:20080/weekend
    .then(function(weekendLinks) {
      firstPageLinks = weekendLinks;
        return Promise.resolve(weekendLinks);
    })
    .then(function(weekendLinks){
      return scraper.extractLinksData([firstPageLinks[0]]) // firstPageLinks[0] is the first link that was scraped. http://vhost3.lnu.se:20080/calendar/
        .then(function(personCalendarLinks){
          return Promise.resolve(personCalendarLinks);
        })
        .then(function(calendarLinks){
          return calendarLinks;
        });
    })
    .then(function(calendarLinks){
      return scraper.extractCalenderData(calendarLinks) //Calender data is extracted and returns an array whith which days that everyone is free or busy
        .then(function(daysOK){
          return Promise.resolve(daysOK);
        });
    })
    .then(function(daysOK){
        freeDays = daysOK;
    })
    .then(function(){
      return scraper.extractCinemaData([firstPageLinks[1]]); //scrapes the cinema data from http://vhost3.lnu.se:20080/cinema
    })
    .then(function(movies){
        movieList = movies;
        return scraper.inputToAjax(freeDays, movies, firstPageLinks[1]);
    })
    .then(function(times){
      cinemaTimes = times;
      return scraper.extractFormActions([firstPageLinks[2]])
      .then(function(formLinks){
        return scraper.getCookie(firstPageLinks[2], formLinks)
          .then(function(cookie){
            return scraper.getRestaurantData(cookie[0], firstPageLinks[2]+formLinks[0]+cookie[1])
              .then(function(resturantBody){
                  return resturantBody;
            });
          });
      });
    })
    .then(function(body){
        return scraper.extractRestaurantData(body).then(function(restaurantTimesArray){
            this.restaurantTimesArray = restaurantTimesArray;
        });
    })
    .then(function(){
        var arr = [];
        for(i=0;i<cinemaTimes.length;i++){
          for(j=0;j<this.restaurantTimesArray.length;j++){
            if(cinemaTimes[i].day === this.restaurantTimesArray[j].dayID){
              if(!arr.includes(this.restaurantTimesArray[j])){
                arr.push(this.restaurantTimesArray[j]);
              }
            }
          }
        }
        // A new array that makes it simpler when the data is printed
        var weekendTimeArray = [];
        for(k=0;k<cinemaTimes.length;k++){
          for(l=0;l<arr.length;l++){
            if(parseInt(cinemaTimes[k].endTime) <= parseInt(arr[l].startTime)){
              if(cinemaTimes[k].day === arr[l].dayID){
                var movieTime = cinemaTimes[k].startTime.substring(0,2)+":"+cinemaTimes[k].startTime.substring(2);
                weekendTimeArray.push({
                  movieDayID: cinemaTimes[k].day,
                  movieID: cinemaTimes[k].movieID,
                  movieTitle: movieList[parseInt(cinemaTimes[k].movieID)-1].title,
                  movieStartTime: movieTime,
                  movieEndTime: parseInt(cinemaTimes[k].endTime),
                  tableTime: arr[l].startTime,
                  tableDayID: arr[l].dayID,
                  tableDay: arr[l].day
                });
              }
            }
          }
        }
        //Prints the recommended days and times
        //Only recommends days where the there is a table time right after the movie so there is no need to wait a couple of hours
        //Can be changed to list those times that are not right after the movie by removing the if-statement below
        for(a=0;a<weekendTimeArray.length;a++){
          if(weekendTimeArray[a].movieEndTime === weekendTimeArray[a].tableTime){
            //Converting the time to a string in order to put a : in it
            var tTime = weekendTimeArray[a].tableTime.toString().substring(0,2)+":"+weekendTimeArray[a].tableTime.toString().substring(2);
            console.log("Recommended: The movie " + weekendTimeArray[a].movieTitle + " starts at " +
            weekendTimeArray[a].movieStartTime + " on "+ weekendTimeArray[a].tableDay+". After the movie there is a table available at Zekes at " +
            tTime);
          }
        }
    })
    .catch(function(error) {
        console.log("ERROR!!!!!!:", error);
    });
