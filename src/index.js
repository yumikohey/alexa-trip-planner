'use strict';
var Alexa = require("alexa-sdk");
var appId = 'amzn1.ask.skill.ffb4f895-1526-4b51-b8a1-fa3d0d3bb3ba'; //'amzn1.echo-sdk-ams.app.your-skill-id';
var axios = require('axios');
var host = 'http://174.129.85.123';

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = appId;
    alexa.dynamoDBTableName = 'highLowGuessUsers';
    alexa.registerHandlers(newSessionHandlers, guessModeHandlers, travelKitHandlers);
    alexa.execute();
};

var states = {
    GUESSMODE: '_GUESSMODE', // User is trying to guess the number.
    BRINGSTUFFMODE: '_BRINGSTUFFMODE'
};

var newSessionHandlers = {
    'NewSession': function() {
        if(Object.keys(this.attributes).length === 0) {
            this.attributes['endedSessionCount'] = 0;
            this.attributes['gamesPlayed'] = 0;
        }
        this.handler.state = states.GUESSMODE;
        this.emit(':ask', 'Thanks for using Trip Planner. Please tell me where you want to go for how many days? For example, you can tell me I want to go to San Francisco for two days.');
    }
};

var guessModeHandlers = Alexa.CreateStateHandler(states.GUESSMODE, {
    'NewSession': function () {
        this.handler.state = '';
        this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
    },
    'GetCityAndDays': function() {
        var city = this.event.request.intent.slots.City.value;
        var travelDays = parseInt(this.event.request.intent.slots.TravelDays.value);
        var path = '/city_state_search/?';
        var params = 'city_state=' + encodeURIComponent(city);
        var completePath = host + path + params;
        var _this = this;
        axios.get(completePath)
            .then(function(response){
                var result = response.data.city_state[0];
                console.log('You want to go to ' + result + ' for ' + travelDays + ' days.');
                _this.attributes['city_state'] = result;
                _this.attributes['travel_days'] = travelDays;
                var maximumDayOutputSpeech = travelDays > 5 ? "We only support five days trip planning. We have adjusted your travel days for five days. " : "";
                if (travelDays > 5) {
                    travelDays = 5;
                }
                var outputSpeech = maximumDayOutputSpeech + 'You want to go to ' + result + ' for ' + travelDays + ' days? I will go ahead and plan your trip if you say Yes.';

                _this.emit(':ask', outputSpeech);
            });
    },
    'TempYesIntent': function() {
        var city = this.attributes['city_state'].split(', ')[0];
        var state = this.attributes['city_state'].split(', ')[1];
        var travelDays = parseInt(this.attributes['travel_days']);
        this.attributes['trips'] = [];
        var _this = this;
        var params = [
			`city=${encodeURIComponent(city)}`,
			`state=${encodeURIComponent(state)}`,
			`n_days=${travelDays}`
		].join('&');
        var path = '/full_trip_search/?'
        var completePath = host + path + params;
        var sentenceStart = 'Here is your first day\'s trip details.';
        var sentenceEnd = '. You can ask for the other day\'s trip detail. For example, show me day two\'s trip detail. Or you can check your Alexa app for the complete trip details.';
        var repromptSpeech = 'You can say, Please show me Day two trip detail.';
        var cardTitle = this.attributes['city_state'] + " Trip: Day 1";
        var cardContent = '';
        var imageObj = {
            smallImageUrl: '',
            largeImageUrl: ''
        };
        axios.get(completePath)
            .then(function(response) {
                var fullTrips = response.data.full_trip_details;
                var listOfPointOfInterests = "";
                fullTrips.forEach(function(item){
                    if(_this.attributes['trips'][item.day]){
                        _this.attributes['trips'][item.day].push({name: item.name, address: item.address, duration: item.adjusted_visit_length})
                    } else {
                        _this.attributes['trips'][item.day] = [{name: item.name, address: item.address, duration: item.adjusted_visit_length}]
                    }
                });
                _this.attributes['trips'][0].forEach(function(item){
                    listOfPointOfInterests += item.name + ", ";
                    cardContent += 'Place: ' + item.name + ' (' + item.duration +' mins)\n';
                    cardContent += 'Address: ' + item.address +'\n';
                });
                imageObj.smallImageUrl = fullTrips[0].img_url;
                imageObj.largeImageUrl = fullTrips[0].img_url;
                listOfPointOfInterests = listOfPointOfInterests.substr(0, listOfPointOfInterests.length - 2);

                _this.emit(':askWithCard', sentenceStart + ' You can go to: ' + listOfPointOfInterests + sentenceEnd, repromptSpeech, cardTitle, cardContent, imageObj);
            });
    },
    'AMAZON.StopIntent': function() {
        console.log("STOPINTENT");
        this.emit(':tell', "Goodbye!");
    },
    'AMAZON.CancelIntent': function() {
        console.log("CANCEL INTENT");
        this.emit(':tell', "Ok! I canceled your request");  
    },
    'GetOtherDayDetail': function() {
        var theOtherDay = parseInt(this.event.request.intent.slots.theOtherDay.value);
        var exceptionSpeech = "";
        if (theOtherDay > parseInt(this.attributes['travel_days']) || typeof(theOtherDay) !== "number") {
            console.log(" User requested for day: " + theOtherDay + " trip details.");
            console.log(" System adjusted days for program to process");
            theOtherDay = 2;
            exceptionSpeech = "You said you want to see Day " + theOtherDay + " trip details, which is invalid. We will show you Day 2 trip details by default. ";
        }
        var cardTitle = this.attributes['city_state'] + " Trip: Day " + theOtherDay;
        var listOfPointOfInterests = '';
        var sentenceStart = 'Here is your Day ' + theOtherDay +' trip details.';
        var cardContent = '';
        var repromptSpeech = 'You can ask me What do I need to bring.';
        var sentenceEnd = '. You can ask me What do I need to bring.';
        this.attributes['trips'][theOtherDay - 1].forEach(function(item){
            listOfPointOfInterests += item.name + ", ";
            cardContent += 'Place: ' + item.name + '\n';
            cardContent += 'Address: ' + item.address +'\n';
        });
        var imageObj = {
            smallImageUrl: '',
            largeImageUrl: ''
        };
        listOfPointOfInterests = listOfPointOfInterests.substr(0, listOfPointOfInterests.length - 2);
        this.emit(':askWithCard', exceptionSpeech + sentenceStart + ' You can go to: ' + listOfPointOfInterests + sentenceEnd, repromptSpeech, cardTitle, cardContent, imageObj);
    },
    'GrantListCardAccess': function() {
        var permissions = ["write::alexa:household:list"];
        var speechOutput = "Alexa List permissions are missing. You can grant permissions within the Alexa app.";
        console.log(speechOutput);
        this.emit(':tellWithPermissionCard', speechOutput, permissions);        
    },
    'ThingsToBringIntent': function() {
        var basicItems = ['Toothbrush', 'Toothpatse', 'Towel', 'Flip Flops'];
        var cardTitle = 'Travel Basic Package';
        var cardContent = 'Please remembmer to bring: \n' + basicItems[0] + ', \n' + basicItems[1]  + ', \n' + basicItems[2]  + ', \n' + basicItems[3] + '. \n';
        var sentenceEnd = 'Do you want to know what other travelers bring?';
        var outputSpeech = cardContent + sentenceEnd;
        this.handler.state = states.BRINGSTUFFMODE;
        var imageObj = {
            smallImageUrl: '',
            largeImageUrl: ''
        };
        this.emit(':askWithCard', outputSpeech, sentenceEnd, cardTitle, cardContent, imageObj);
    },
    'Unhandled': function () {
        this.handler.state = states.GUESSMODE;
        this.emit(':ask', 'Sorry, I don\'t get it! Please tell me which city you want to go.', 'Tell me the city you want to go and I plan for you');
    }
});

var travelKitHandlers = Alexa.CreateStateHandler(states.BRINGSTUFFMODE, {
    'TempYesIntent': function () {
        var smartResponses = [
            { 
                city: "San Francisco",
                response: "Although it is summer season right now, be sure to always bring a warm jacket, cooler layers, activewear, a day pack, sunscreen, and comfortable shoes."
            },
            { 
                city: "Chicago",
                response: "To beat the heat, be sure to pack plenty of lightweight T-shirts and tank tops, light pants, shorts or dresses, sunglasses, hat, and comfortable shoes."
            },
            {
                city: "Los Angeles",
                response: "Stylish sunglasses, flip flops, swimsuits, high heels/sexy dresses for the clubs, and a cozy sweatshirt for chilly temps and bus rides."
            }
        ];
        var cardTitle = "What other travelers will bring?";
        var city = this.attributes["city_state"].split(', ')[0];
        var returnResponse = smartResponses.find(function(item){
            return item.city === city;
        });
        var outputSpeech = returnResponse ? returnResponse.response : smartResponses[2].response;
        this.emit(':tellWithCard', outputSpeech, cardTitle, outputSpeech);
    },
    'AMAZON.StopIntent': function() {
        console.log("STOPINTENT");
        this.emit(':tell', "Goodbye!");
    },
    'AMAZON.CancelIntent': function() {
        console.log("CANCEL INTENT");
        this.handler.state = states.GUESSMODE;
        this.emit(':tell', "Ok! I canceled your request");  
    }
});