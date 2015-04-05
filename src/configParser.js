var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var when = require( "when" );

var builtIn = getAdapters();

function defaultConstraint( config ) {
	return function levelConstraint( data ) {
		return data.level <= config.level;
	};
}

function getAdapters() {
	var adapterPath = path.resolve( __dirname, "./adapters" );
	var files = fs.readdirSync( adapterPath );
	return _.reduce( files, function( acc, file ) {
		acc[ file.split( "." )[ 0 ] ] = path.join( adapterPath, file );
		return acc;
	}, {} );
}

function timeFormatter( config, data ) {
	var time = config.timestamp;
	if ( time ) {
		if ( time.local ) {
			data.utc.local();
		}
		return data.utc.format( time.format || "YYYY-MM-DDTHH:mm:ss.SSSZ" );
	} else {
		return data.timestamp;
	}
	return config.timeformat ? data.raw.format( config.format ) : data.timestamp;
}

function wireUp( adapterFsm, config, channel, adapter ) {

	var fsm;
	var init;
	var handler = adapter.onLog;

	if ( _.isFunction( adapter.init ) ) {
		init = adapter.init();

		if ( init && init.then ) {
			adapterFsm.register( adapter, init );
			handler = adapterFsm.onLog.bind( adapterFsm, adapter );
		}
	}

	var newSub = channel
		.subscribe( adapter.topic || "#", handler )
		.constraint( adapter.constraint || defaultConstraint( config ) );
	if ( adapter.subscription ) {
		adapter.subscription.unsubscribe();
	}

	adapter.subscription = newSub;
}

module.exports = function( channel, config, fount ) {
	var adapterFsm = require( "./adapter.fsm" );

	return _.map( config.adapters, function( adapterCfg, name ) {
		var adapterPath = builtIn[ name ] || require.resolve( name );
		var adapter = require( adapterPath )( adapterCfg, timeFormatter, fount );

		wireUp( adapterFsm, adapterCfg, channel, adapter );

		return adapter;
	} );
};
