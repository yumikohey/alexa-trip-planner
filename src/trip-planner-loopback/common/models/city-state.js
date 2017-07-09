'use strict';

module.exports = function(Citystate) {
	Citystate.search = function(city_state, cb) {
	    Citystate.findOne({where: {city: city_state}}, function(err, result) {
	    	cb(null, result.city + ', ' + result.state);
	    });
	}

	Citystate.remoteMethod('search', {
	      accepts: {arg: 'city_state', type: 'string'},
	      returns: {arg: 'city_state', type: 'string'},
	      http: {path: '/search', verb: 'get'}
	});
};
