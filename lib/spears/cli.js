var ExecutionCounter = require('./util/ExecutionCounter')
  , ActionQueue      = require('./util/ActionQueue')
  , commander        = require('commander')
  , _                = require('underscore');

/**
 * The purpose of this tool is to significantly increase the run time of your test
 * suite.  Because cucumber runs tests and test steps synchronously, it does not
 * take advantage of node.js's powerful event-loop architecture.  While not all
 * tests can be run in parallel (due to fixture data conflicts) a large number of
 * tests should be "read-only" allowing them to all share an environment and run
 * in parallel, reducing the run time of the test suite.
 */
module.exports = function Cli(args) {
  if (false === (this instanceof Cli)) {
    return new Cli(args);
  }

  var self = this
    , Spears         = require('../spears')
    , Cucumber       = Spears.Cucumber
    , Visitor        = Spears.Visitor
    , formatters     = []
    , runFeature
    , runPreParallelSuiteHook
    , ColorFormatter = Spears.Listener.ColorFormatter;

  function parseList (val) {
    return val.split(' ');
  }

  commander
    .version('0.0.1')
    .option('-c, --cucumber', 'Use cucumber and do not parallelize suite execution')
    .option('-t, --tags <list>', 'Tags to run test cases by', parseList)
    .option('-s, --serial', 'Runs the suite without parallelization')
    .parse(args);

  if (commander.cucumber) {
    for (var i in args) {
      if (args[i] === '--cucumber') {
        args.splice(i, 1);
      }
    }
    return Spears.Cucumber.Cli(args);
  }

  /**
   * An array of visitors, 1 per suite (similar with the support code libraries)
   */
  this.visitors        = [];
  this.supportCodeLibs = [];

  // Execute the serial and parallel test cases after modifying the features
  this.run = function (callback) {
    var i, suites, tags, configuration, runtime
      , queue   = new ActionQueue()
      , counter = new ExecutionCounter()
      , is_serial_only = commander.serial;

    // Parse arguments into suites and tags
    tags = null;
    if (commander.tags) {
      var tag_groups = commander.tags;
      tags = [];
      for (i in tag_groups) {
        tags.push('--tags=' + tag_groups[i]);
      }
    }

    suites = commander.args;

    // Setup the features and the code libraries before execution to get total
    // counts
    counter.on('finish', function () {
      var i
        , parallelCnt = 0
        , serialCnt = 0;

      for (i in self.visitors) {
        parallelCnt += self.visitors[i].parallelTotalCnt;
        serialCnt   += self.visitors[i].serialTotalCnt;
      }

      ColorFormatter.handleExecutionStart(parallelCnt, serialCnt);
      self.setupActionQueue(queue, queue.execute);
    });

    queue.on('finish', function () {
      ColorFormatter.handleExecutionComplete();
      var isSuccess = !ColorFormatter.hasError();
      callback(isSuccess);
    });

    for (i in suites) {
      // Cucumber only cares about the 3rd argument or greater
      if (tags) {
        var config = [0, 0, suites[i]];
        config = config.concat(tags);
        configuration = Cucumber.Cli.Configuration(config);
      } else {
        configuration = Cucumber.Cli.Configuration([0, 0, suites[i]]);
      }

      runtime       = Cucumber.Runtime(configuration);
      self.supportCodeLibs.push(configuration.getSupportCodeLibrary());

      counter.startAction();
      self.setupFeatures(runtime, is_serial_only, counter.finishAction);
    }
    counter.finalize();
  };
  // Create new ASTs by walking the complete tree and dividing it into parallel
  // and serial scenarios
  this.setupFeatures = function (runtime, is_serial_only, callback) {
    // Setup the abstract syntax tree visitor
    var visitor = new Visitor({serial: is_serial_only});
    self.visitors.push(visitor);
    var features = runtime.getFeatures();
    features.acceptVisitor(visitor, callback);
  };

  // For each test suite, run a parallel and serial test suite
  this.setupActionQueue = function (queue, callback) {
    var i;

    // Loop through suites to execute parallel and serial
    for (i in self.visitors) {
      queue.addAction(function (callback) {
        ColorFormatter.handleParallelSetBegin();
        self.executeParallel(i, function () {
          ColorFormatter.handleParallelSetComplete();
          callback();
        });
      }, 1);

      queue.addAction(function (callback) {
        ColorFormatter.handleSerialSetBegin();
        self.executeSerial(i, function () {
          ColorFormatter.handleSerialSetComplete();
          callback();
        });
      }, 1);
    }

    callback();
  };

  // Runs the cucumber feature based on the configurations and formatter
  runFeature = function (features, formatter, supportCode, callback, isSerial) {
    var astTreeWalker, collection = Cucumber.Type.Collection();

    // Attach listener
    collection.add(formatter);

    // Build test executor
    astTreeWalker = Cucumber.Runtime.AstTreeWalker(
      features,
      supportCode,
      collection
    );

    // Run the feature
    astTreeWalker.walk(function () {
      ColorFormatter.handleFeatureComplete(formatter, isSerial);
      callback();
    });
  };

  // Create and execute a feature with 1 scenario and no steps that executes
  // the TAG_FIRST_PARALLEL_SCENARIO hook
  runPreParallelSuiteHook = function (supportCode, callback) {
    var features, feature, scenario, formatter
      , Enum = Spears.Enum
      , Ast  = Spears.Cucumber.Ast;

    features = Ast.Features();
    feature  = Ast.Feature('Feature', 'Pre-Parallel Suite Hook', 'dummy', 'dummy', 1);
    features.addFeature(feature);

    scenario = Ast.Scenario('Scenario', 'Pre-Parallel Suite Hook', 'dummy', 'dummy', 1);
    scenario.addTags([Ast.Tag(Enum.TAG_FIRST_PARALLEL_SCENARIO, 'dummy', 1)]);
    feature.addScenario(scenario);

    formatter = Spears.Listener.ParallelFormatter();
    runFeature(features, formatter, supportCode, callback, true);
  };

  // Initiate one cucumber instance per scenario and call the callback when they
  // all complete
  this.executeParallel = function (idx, callback) {
    var i, j, formatter
      , supportCode      = self.supportCodeLibs[idx]
      , parallelFeatures = self.visitors[idx].parallelFeaturesToRun
      , counter          = new ExecutionCounter()
      , runParallel;

    counter.on('finish', callback);

    runParallel = function () {
      for (i in parallelFeatures) {
        // Create an array of formatters per feature
        formatters[i] = [];
        for (j in parallelFeatures[i]) {
          // Build a configuration for this scenario
          counter.startAction();
          formatter = Spears.Listener.ParallelFormatter();
          formatters[i].push(formatter);

          runFeature(
            parallelFeatures[i][j],
            formatter,
            supportCode,
            counter.finishAction
          );
        }
      }

      counter.finalize();
    };

    // Skip the pre-parallel suite hook if there are no parallel features
    if (self.visitors[idx].parallelTotalCnt) {
      runPreParallelSuiteHook(supportCode, runParallel);
    } else {
      runParallel();
    }
  };

  // Initiate once cucumber runtime per serial feature, add them to the action
  // queue and run them one at a time
  this.executeSerial = function (idx, callback) {
    var formatter
      , supportCode    = self.supportCodeLibs[idx]
      , serialFeatures = self.visitors[idx].serialFeaturesToRun;

    // Build a configuration for this scenario
    formatter = Spears.Listener.ParallelFormatter({isSerial:true}, ColorFormatter);
    runFeature(serialFeatures, formatter, supportCode, callback, true);
  };
};