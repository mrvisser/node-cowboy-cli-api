
var _ = require('underscore');
var childProcess = require('child_process');
var fs = require('fs');
var temp = require('temp');
var util = require('util');

var _cwd = process.cwd();

/**
 * Set the current working directory underwhich to invoke cowboy commands
 */
var cwd = module.exports.cwd = function(set) {
    if (set) {
        _cwd = set;
    }

    return _cwd;
};

/**
 * Execute a cowboy command
 */
var exec = module.exports.exec = function(config, argv, commandName, commandArgv, callback) {
    temp.open({'prefix': util.format('cowboy-%s-config', commandName), 'suffix': '.json'}, function(err, tmp) {
        if (err) {
            return callback(err);
        }

        // Write the configuration file
        fs.writeFile(tmp.path, JSON.stringify(config, null, 4), function(err) {
            if (err) {
                return callback(err);
            }

            var cmd = util.format('cowboy %s', commandName);
            if (!_.isEmpty(argv)) {
                cmd += util.format(' %s', argv.join(' '));
            }

           cmd += util.format(' --config "%s" %s', tmp.path, commandName);

            if (!_.isEmpty(commandArgv)) {
                cmd += util.format(' -- %s', commandArgv.join(' '));
            }

            childProcess.exec(cmd, {'cwd': _cwd}, callback);
        });
    });
};
