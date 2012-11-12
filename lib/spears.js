/**
 * The purpose of this tool is to significantly increase the run time of your test
 * suite.  Because cucumber runs tests and test steps synchronously, it does not
 * take advantage of node.js's powerful event-loop architecture.  While not all
 * tests can be run in parallel (due to fixture data conflicts) a large number of
 * tests should be "read-only" allowing them to all share an environment and run
 * in parallel, reducing the run time of the test suite.
 */
var Spears = function (args) {
  return Spears.Cli(args);
};

// Setup access into the dependent libraries
Spears.Cucumber = require('cucumber');
Spears.Enum     = require('./spears/enum');
Spears.Visitor  = require('./spears/visitor');
Spears.Cli      = require('./spears/cli');
Spears.Listener = {};
Spears.Listener.ParallelPrettyFormatter = require('./spears/listener/parallel_pretty_formatter');

module.exports = Spears;