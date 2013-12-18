
var _ = require('underscore');
var childProcess = require('child_process');
var fs = require('fs');
var temp = require('temp');
var util = require('util');

var _cattlePath = 'cattle';
var _cowboyPath = 'cowboy';

/**
 * Get or set the path to use for the cattle binary
 */
var cattlePath = module.exports.cattlePath = function(cattlePath) {
    if (cattlePath) {
        _cattlePath = cattlePath;
    }

    return _cattlePath;
};

/**
 * Get or set the path to use for the cowboy binary
 */
var cowboyPath = module.exports.cowboyPath = function(cowboyPath) {
    if (cowboyPath) {
        _cowboyPath = cowboyPath;
    }

    return _cowboyPath;
};

/**
 * Execute a cowboy command with the given config and arguments.
 *
 * E.g.,
 *
 *  cowboy('ping');
 *  cowboy(['--help'], function(code, output) { ... });
 *  cowboy(['--help'], 'install', ['cowboy-contrib-apt@2.1.0']);
 *  cowboy({'log': {'level': 'info', 'path': './cowboy.log'}}, 'ping');
 */
var cowboy = module.exports.cowboy = function(/* [config<Object>,] [argv<Array>,] [command<String>,] [commandArgv<Array>,] [callback<Function>] */) {
    var methodArguments = Array.prototype.slice.call(arguments, 0);

    var config = {};
    var argv = [];
    var command = null;
    var commandArgv = [];
    var callback = function() {};

    // Resolve config
    if (_.isObject(methodArguments[0]) && !_.isArray(methodArguments[0])) {
        config = methodArguments.shift();
    }
    
    // Resolve argv
    if (_.isArray(methodArguments[0])) {
        argv = methodArguments.shift();
    }

    // Resolve command
    if (_.isString(methodArguments[0])) {
        command = methodArguments.shift();
    }

    // Resolve commandArgv
    if (_.isArray(methodArguments[0])) {
        commandArgv = methodArguments.shift();
    }

    // Resolve callback
    if (_.isFunction(methodArguments[0])) {
        callback = methodArguments.shift();
    }

    temp.open({'prefix': util.format('cowboy-%s-config', command), 'suffix': '.json'}, function(err, tmp) {
        if (err) {
            return callback(err);
        }

        // Write the configuration file
        fs.writeFile(tmp.path, JSON.stringify(config, null, 4), function(err) {
            if (err) {
                return callback(err);
            }

            // Start with the cowboy argv
            var args = argv.slice();

            // Push the custom config
            args.push('--config', tmp.path);

            // Push the command if specified
            if (command) {
                args.push(command);
            }

            // Push the command args if specified
            if (!_.isEmpty(commandArgv)) {
                args.push('--');
                Array.prototype.push.apply(args, commandArgv);
            }

            var cowboy = childProcess.spawn(_cowboyPath, args, {'stdio': 'pipe'});
            var output = '';

            cowboy.stdout.setEncoding('utf-8');
            cowboy.stderr.setEncoding('utf-8');
            cowboy.stdout.on('data', function(data) { output += data; });
            cowboy.stderr.on('data', function(data) { output += data; });

            cowboy.on('close', function(code, signal) {
                return callback(code, output);
            });
        });
    });
};

/**
 * Launch the cattle server with the given config and arguments.
 *
 * E.g.,
 *
 *  cattle();
 *  cattle(function() { // Listening });
 *  cattle(['--log-path', './cattle.log']);
 */
var cattle = module.exports.cattle = function(/* [config<Object>,] [argv<Array>,] [callback<Function>] */) {
    var methodArguments = Array.prototype.slice.call(arguments, 0);

    var config = {};
    var argv = [];
    var callback = function() {};

    // Resolve config
    if (_.isObject(methodArguments[0]) && !_.isArray(methodArguments[0])) {
        config = methodArguments.shift();
    }
    
    // Resolve argv
    if (_.isArray(methodArguments[0])) {
        argv = methodArguments.shift();
    }

    // Resolve callback
    if (_.isFunction(methodArguments[0])) {
        callback = methodArguments.shift();
    }

    temp.open({'prefix': 'cattle-config', 'suffix': '.json'}, function(err, tmp) {
        if (err) {
            return callback(err);
        }

        // Write the configuration file
        fs.writeFile(tmp.path, JSON.stringify(config, null, 4), function(err) {
            if (err) {
                return callback(err);
            }

            // Append the config path to the argv
            var args = argv.slice();
            args.push('--config', tmp.path);

            var cattle = childProcess.spawn(_cattlePath, args, {'stdio': ['ipc']});
            cattle.on('message', function(message) {
                if (message === 'ready') {
                    callback(null, function(force, callback) {
                        var sig = (force) ? 'SIGKILL' : 'SIGTERM';
                        return _kill(cattle, sig, callback);
                    });
                }
            });

            var hasKill = false;
            var _doKill = function() {
                if (hasKill) {
                    _kill(cattle, 'SIGKILL');
                    process.exit(1);
                } else {
                    hasKill = true;
                    _kill(cattle);
                }
            };
        });
    });
};

var _kill = function(cattle, sig, callback) {
    cattle.on('disconnect', function() {
        cattle.on('exit', callback);
        cattle.kill(sig);
    });

    cattle.disconnect();
};

