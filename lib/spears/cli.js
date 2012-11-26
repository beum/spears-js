var ExecutionCounter = require('./util/ExecutionCounter')
  , ActionQueue      = require('./util/ActionQueue')
  , commander        = require('commander')


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
    , Spears          = require('../spears')
    , Cucumber        = Spears.Cucumber
    , Visitor         = Spears.Visitor
    //, configuration  = Cucumber.Cli.Configuration(args)
    . configurations  = []
    //, supportCode    = configuration.getSupportCodeLibrary()
    , supportCodeLibs = []
    //, runtime        = Cucumber.Runtime(configuration)
    , runtimeEnvs     = []
    , formatters      = []
    , runFeature
    , runPreParallelSuiteHook
    , ColorFormatter = Spears.Listener.ColorFormatter;

  // Check if the user requested "no-parallel" in which case, just use cucumber
  // to run the test suite
  commander
    .version('0.0.1')
    .option('-c, --cucumber', 'Use cucumber and do not parallelize suite execution')
    .parse(args);

  if (commander.cucumber) {
    for (var i in args) {
      if (args[i] === '--cucumber') {
        args.splice(i, 1);
      }
    }
    return Spears.Cucumber.Cli(args);
  } else if (commander.suites) {

  }

  this.visitor      = null;
  this.features     = runtime.getFeatures();

  // Execute the serial and parallel test cases after modifying the features
  this.run = function (callback) {
    var queue = new ActionQueue();

    queue.addAction(function (callback) {
      self.setupFeatures(function () {
        ColorFormatter.handleExecutionStart(
          self.visitor.parallelTotalCnt,
          self.visitor.serialTotalCnt
        );
        callback();
      })
    }, 1);

    queue.addAction(function (callback) {
      ColorFormatter.handleParallelSetBegin();
      self.executeParallel(function () {
        ColorFormatter.handleParallelSetComplete();
        callback();
      });
    }, 1);

    queue.addAction(function (callback) {
      ColorFormatter.handleSerialSetBegin();
      self.executeSerial(function () {
        ColorFormatter.handleSerialSetComplete();
        callback();
      });
    }, 1);

    queue.on('finish', function () {
      ColorFormatter.handleExecutionComplete();
    });

    queue.execute();
  };

  // Create new ASTs by walking the complete tree and dividing it into parallel
  // and serial scenarios
  this.setupFeatures = function (callback) {
    // Setup the abstract syntax tree visitor
    self.visitor = new Visitor();
    self.features.acceptVisitor(self.visitor, callback);
  };

  // Runs the cucumber feature based on the configurations and formatter
  runFeature = function (features, formatter, callback, supressOutput) {
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
      if (!supressOutput) ColorFormatter.handleFeatureComplete(formatter);
      callback();
    });
  };

  // Create and execute a feature with 1 scenario and no steps that executes
  // the TAG_FIRST_PARALLEL_SCENARIO hook
  runPreParallelSuiteHook = function (callback) {
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
    runFeature(features, formatter, callback, true);
  };

  // Initiate one cucumber instance per scenario and call the callback when they
  // all complete
  this.executeParallel = function (callback) {
    var i, j, formatter, parallelFeatures
      , counter = new ExecutionCounter();

    parallelFeatures = self.visitor.parallelFeaturesToRun;
    counter.on('finish', callback);

    runPreParallelSuiteHook(function () {
      for (i in parallelFeatures) {
        // Create an array of formatters per feature
        formatters[i] = [];
        for (j in parallelFeatures[i]) {
          // Build a configuration for this scenario
          formatter = Spears.Listener.ParallelFormatter();
          formatters[i].push(formatter);
          runFeature(parallelFeatures[i][j], formatter, counter.finishAction);
          counter.startAction();
        }
      }

      counter.finalize();
    });
  };

  // Initiate once cucumber runtime per serial feature, add them to the action
  // queue and run them one at a time
  this.executeSerial = function (callback) {
    var i, j, formatter, serialFeatures
      , queue = new ActionQueue();

    queue.continueOnError = true; // ignore true in arg 0 of callback
    formatter = configuration.getFormatter();
    serialFeatures = self.visitor.serialFeaturesToRun;

    for (i in serialFeatures) {
      for (j in serialFeatures[i]) {
        // Build a configuration for this scenario
        formatter = Spears.Listener.ParallelFormatter();
        queue.addAction(function (callback) {
          runFeature(serialFeatures[i][j], formatter, callback);
        }, 1);
      }
    }

    // Will run each feature serially
    queue.on('finish', callback);
    queue.execute();
  };
};