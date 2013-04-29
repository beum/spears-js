var ExecutionCounter = require('./util/ExecutionCounter')
  , ActionQueue      = require('./util/ActionQueue')
  , commander        = require('commander')
  , _                = require('underscore')
  , fs               = require('fs');

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
    , ColorFormatter = Spears.Listener.ColorFormatter
    , pp_path;

  function parseList (val) {
    // Remove double quotes surrounding
    if (val.indexOf('"') !== -1) {
      val = val.substring(1, val.length);
      val = val.substring(0, val.length - 1);
    }
    return val.split(' ');
  }

  commander
    .version('0.0.1')
    .option('-c, --cucumber', 'Use cucumber and do not parallelize suite execution')
    .option('-t, --tags <list>', 'Tags to run test cases by', parseList)
    .option('-s, --serial', 'Runs the suite without parallelization')
    .option('-r, --require <list>', 'Uses the cucumber require command to include JS files', parseList)
    .option('-p, --path <value>', 'Path where pre-processed files should be placed')
    .parse(args);

  /**
   * If the cucumber option is set, skip spears and go straight to the cucumber
   * execution engine
   */
  if (commander.cucumber) {
    for (var i in args) {
      if (args[i] === '--cucumber') {
        args.splice(i, 1);
      }
    }
    return Spears.Cucumber.Cli(args);
  }
  
  // Set the temp directory if the option is specified
  pp_path = commander.path || '/tmp/spears/';

  /**
   * An array of visitors, 1 per suite (similar with the support code libraries)
   */
  this.visitors        = [];
  this.supportCodeLibs = [];


  /**
   * Execute the serial and parallel test cases after modifying the features
   * 
   * @param {type} runtime
   * @param {type} is_serial_only
   * @param {type} callback
   * @returns {undefined}
   */ 
  this.run = function (callback) {
    var i, suites, configuration, runtime
      , tags    = []
      , require = []
      , queue   = new ActionQueue()
      , counter = new ExecutionCounter()
      , is_serial_only = commander.serial;

    // Parse arguments into suites and tags
    if (commander.tags) {
      var tag_groups = commander.tags;
      for (i in tag_groups) {
        tags.push('--tags=' + tag_groups[i]);
      }
    }

    suites = commander.args;

    // Add the require argurments
    if (commander.require) {
      var require_groups = commander.require;
      for (i in require_groups) {
        require.push('--require=' + require_groups[i]);
      }
    } else {
      for (i in suites) {
        var dir = suites[i];
        
        if (/^.+\.feature$/.test(dir)) {
          dir = dir.match(/^(.+\/).+\.feature$/)[1];
        }
        
        require.push('--require=' + dir);
      }
    }

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
      counter.startAction();
    
      // Cucumber only cares about the 3rd argument or greater
      var config = [0, 0, suites[i]];
      config = config.concat(tags);
      config = config.concat(require);

      // Create the CLI Configuration, which contains an array of all of the
      // text from the 
      configuration = Cucumber.Cli.Configuration(config);

      runtime       = Cucumber.Runtime(configuration);
      self.supportCodeLibs.push(configuration.getSupportCodeLibrary());

      self.setupFeatures(runtime, is_serial_only, counter.finishAction);
    }
    
    
    /* TODO: Deprecate, this is done at the cucumber-js level now
    // Pre-process the files
    self.preprocessFeatures(suites, function (path) {
      // Cucumber only cares about the 3rd argument or greater
      var config = [0, 0, path];
      config = config.concat(tags);
      config = config.concat(require);

      // Create the CLI Configuration, which contains an array of all of the
      // text from the 
      configuration = Cucumber.Cli.Configuration(config);

      runtime       = Cucumber.Runtime(configuration);
      self.supportCodeLibs.push(configuration.getSupportCodeLibrary());

      self.setupFeatures(runtime, is_serial_only, counter.finishAction);
      
    });*/

    counter.finalize();
  };
  
  /**
   * Takes the feature files and pre-processes them before cucumber parses them
   * to support the "#include-scenarios <file path>" feature
   * 
   * 
   * @param Array suites File paths to run the tests for
   * @param Function callback
   * @returns Array New temp file paths where the pre-processed files are created
   *
  this.preprocessFeatures = function (suites, callback) {
    var expanded_paths      = Cucumber.Cli.ArgumentParser.FeaturePathExpander.expandPaths(suites)
       , feature_regex      = /^[^/]+\.feature$/
       , include_regex      = /^\s*#include-scenarios/
       , include_path_regex = /"([^"]+)"\s*$/
       , include_base_regex = /^(.+)\/.+\.feature$/
       , i, j, existing_files, file, lines, matches, fout_name
       , include_file, include_content, include_base_path;
    
    // Create the temp directory
    if (!fs.existsSync(pp_path)) {
      fs.mkdir(pp_path, callback);
      
    // Loop through the directory and unlink all of the files
    } else {
      existing_files = fs.readdirSync(pp_path);
      for (i in existing_files) {
        fs.unlinkSync(pp_path + existing_files[i]);
      }
    }
    
    // Loop through all of the feature files and create them
    for (i in expanded_paths) {
      // Get the new file name based on the original name without the file path
      matches = expanded_paths[i].split('/');
      fout_name = pp_path + matches[matches.length - 1];
      
      file = fs.readFileSync(expanded_paths[i], 'utf-8');
      lines = file.split('\n');
      include_base_path = expanded_paths[i].match(include_base_regex)[1];
      
      for (j in lines) {
        // Check for an include statement
        if (include_regex.test(lines[j])) {
          // Capture the include file name - will throw exception if not properly
          // formatted
          include_file = include_path_regex.exec(lines[j])[1];
          
          // Get the base path for the included file
          if (/^\.\/.+$/.test(include_file)) {
            include_file = include_file.substring(2); // remove the "./" from the beginning
          }
          
          include_file = include_base_path + '/' + include_file;
          
          // Read the include file and include it in the temp file
          include_content = fs.readFileSync(include_file, 'utf-8');
          
          fs.appendFileSync(fout_name, include_content + '\n');
          
          // Free up memory after using
          include_content = null;
        } else {
          // Write the line to the file
          fs.appendFileSync(fout_name, lines[j] + '\n');
        }
      }
      
      // Clear lines and file for garbage collection
      file  = null;
      lines = null;
    }
    
    // Call the callback with the new suite location for cucumber to run against
    callback(pp_path);
  };*/
  
  
  
  /**
   * Create new ASTs by walking the complete tree and dividing it into parallel
   * and serial scenarios
   * @param Cucumber_Runtime runtime
   * @param Boolean is_serial_only
   * @param Function callback
   * @returns {undefined}
   */
  this.setupFeatures = function (runtime, is_serial_only, callback) {
    // Setup the abstract syntax tree visitor
    var visitor = new Visitor({serial: is_serial_only});
    self.visitors.push(visitor);
    var features = runtime.getFeatures();
    features.acceptVisitor(visitor, callback);
  };

  /**
   * For each test suite, run a parallel and serial test suite
   * 
   * @param ActionQueue queue
   * @param Function callback
   * @returns void
   */
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

  /**
   * Runs the cucumber feature based on the configurations and formatter
   * 
   * @param {type} features
   * @param {type} formatter
   * @param {type} supportCode
   * @param Function callback
   * @param Boolean isSerial
   * @returns {undefined}
   */
  runFeature = function (features, formatter, supportCode, isSerial, callback) {
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


  /**
   * Create and execute a feature with 1 scenario and no steps that executes
   * the TAG_FIRST_PARALLEL_SCENARIO hook
   * @param {type} supportCode
   * @param {type} callback
   * @returns {undefined}
   */
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
    runFeature(features, formatter, supportCode, true, callback);
  };

  /**
   * Initiate one cucumber instance per scenario and call the callback when they
   * all complete
   * 
   * @param {type} idx
   * @param {type} callback
   * @returns {Cli.executeParallel}
   */
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
            false,
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

  /**
   * Initiate once cucumber runtime per serial feature, add them to the action 
   * queue and run them one at a time
   * 
   * @param {type} idx
   * @param {type} callback
   * @returns {undefined}
   */
  this.executeSerial = function (idx, callback) {
    var formatter
      , supportCode    = self.supportCodeLibs[idx]
      , serialFeatures = self.visitors[idx].serialFeaturesToRun;

    // Build a configuration for this scenario
    formatter = Spears.Listener.ParallelFormatter({isSerial:true}, ColorFormatter);
    runFeature(serialFeatures, formatter, supportCode, true, callback);
  };
};