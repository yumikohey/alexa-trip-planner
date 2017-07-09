'use strict';

module.exports = function(Fulltripdetails) {
	Fulltripdetails.search = function(city, state, n_days, cb) {
	    Fulltripdetails.find({where: {city: city, state: state}}, function(err, results) {
	    	var DAILY_MINS = 600;
	    	var n_days_mins = parseInt(n_days) * DAILY_MINS;
	    	var trips = [];
	    	for(var day=0; day < parseInt(n_days); day++) {
	    		trips[day] = [];
	    	}
	    	var day_start = 0;
	    	var min_start = 0;
	    	results.forEach(function(pointOfInterest) {
	    		if (min_start < DAILY_MINS) {
	    			trips[day_start].push({
	    				name: pointOfInterest.name,
	    				address: pointOfInterest.address,
	    				img_url: pointOfInterest.img_url,
	    				duration: pointOfInterest.duration
	    			});
	    			min_start += parseInt(pointOfInterest.duration);
	    		} else {
	    			min_start = parseInt(pointOfInterest.duration);
	    			day_start += 1;
	    			trips[day_start].push({
	    				name: pointOfInterest.name,
	    				address: pointOfInterest.address,
	    				img_url: pointOfInterest.img_url,
	    				duration: pointOfInterest.duration
	    			});
	    		}
	    	});
	    	cb(null, trips);
	    });
	}

	Fulltripdetails.remoteMethod('search', {
	      accepts: [{arg: 'city', type: 'string'}, {arg: 'state', type: 'string'}, {arg: 'n_days', type: 'string'}],
	      returns: {arg: 'trips', type: 'object'},
	      http: {path: '/search', verb: 'get'}
	});
};
