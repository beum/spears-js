var ExecutionCounter = require('./util/ExecutionCounter')
  , ActionQueue      = require('./util/ActionQueue')


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
    , configuration  = Cucumber.Cli.Configuration(args)
    , supportCode    = configuration.getSupportCodeLibrary()
    , argumentParser = Cucumber.Cli.ArgumentParser(args)
    , runtime        = Cucumber.Runtime(configuration)
    , formatters     = []
    , runFeature
    , runPreParallelSuiteHook;

  this.visitor      = null;
  this.features     = runtime.getFeatures();

  // Execute the serial and parallel test cases after modifying the features
  this.run = function (callback) {
    var i, j
      , start = Date.now()
      , parallelEnd
      , pendingText = '';

    self.setupFeatures(function () {
      process.stdout.write("\n  Beginning test execution with:\n");
      process.stdout.write("    - " + self.visitor.parallelTotalCnt + " parallel scenarios\n");
      process.stdout.write("    - " + self.visitor.serialTotalCnt + " serial scenarios\n\n  ");

      self.executeParallel(function () {
        parallelEnd = Date.now();
        process.stdout.write("\n  Completed parallel scenarios in: " + (parallelEnd - start)/1000 + " seconds\n  ");
        self.executeSerial(function () {
          process.stdout.write("\n  Completed serial scenarios in: " + (Date.now() - parallelEnd)/1000 + " seconds\n\n");

          // Loop through the formatters and flush the info
          for (i in formatters) {
            // There must be at least one scenario for the feature to have been
            // added so explicitly using 0 is a safe bet
            process.stdout.write(formatters[i][0].featureText);

            for (j in formatters[i]) {
              process.stdout.write(formatters[i][j].scenarioText);
              pendingText += (formatters[i][j].pendingText != "") ? formatters[i][j].pendingText + "\n" : "";
            }
            process.stdout.write("  Completed all scenarios in: " + (Date.now() - start)/1000 + " seconds\n\n");
            process.stdout.write(pendingText);
          }
          callback();
        });
      });
    });

  };

  // Create new ASTs by walking the complete tree and dividing it into parallel
  // and serial scenarios
  this.setupFeatures = function (callback) {
    // Setup the abstract syntax tree visitor
    self.visitor = new Visitor();
    self.features.acceptVisitor(self.visitor, callback);
  };

  // Runs the cucumber feature based on the configurations and formatter
  runFeature = function (features, formatter, callback) {
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
    astTreeWalker.walk(callback);
  };

  // Create and execute a feature with 1 scenario and no steps that executes
  // the TAG_FIRST_PARALLEL_SCENARIO hook
  runPreParallelSuiteHook = function (callback) {
    var features, feature, scenario, formatter
      , Enum = Spears.Enum
      , Ast  = Spears.Cucumber.Ast;

    features = Ast.Features();
    feature  = Ast.Feature('dummy', 'dummy', 'dummy', 'dummy', 1);
    features.addFeature(feature);

    scenario = Ast.Scenario('dummy', 'dummy', 'dummy', 'dummy', 1);
    scenario.addTags([Ast.Tag(Enum.TAG_FIRST_PARALLEL_SCENARIO, 'dummy', 1)]);
    feature.addScenario(scenario);

    formatter = Spears.Listener.ParallelPrettyFormatter();
    runFeature(features, formatter, callback);
  };

  // Initiate one cucumber instance per scenario and call the callback when they
  // all complete
  this.executeParallel = function (callback) {
    var i, j, formatter, features, feature, scenario, parallelFeatures
      , counter = new ExecutionCounter();

    parallelFeatures = self.visitor.parallelFeaturesToRun;
    counter.on('finish', callback);

    runPreParallelSuiteHook(function () {
      for (i in parallelFeatures) {
        // Create an array of formatters per feature
        formatters[i] = [];
        for (j in parallelFeatures[i]) {
          // Build a configuration for this scenario
          formatter = Spears.Listener.ParallelPrettyFormatter();
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
        formatter = Spears.Listener.ParallelPrettyFormatter();
        formatters[i].push(formatter);
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