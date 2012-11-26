var Visitor;

/**
 * Features are stored in an abstract syntax tree which must be iterated over in
 * order to extract the features in the file
 *
 * While iterating we can add tags to scenarios so that we can reference them
 * later by tag to spawn many parallel execution threads
 *
 * The environmentCount is the number of available test environments there are where
 * tests that would normally need to be run serially can be run in parallel in
 * separate environments.
 */
var Visitor = function (environmentCount) {
  if (false === (this instanceof Visitor)) {
    return new Visitor();
  }

  var self              = this
    , parallel_idx      = 0 // Sequence for scenarios to be run in parallel
    , serial_idx        = 0 // Sequence for scenarios which must be run serially
    , buildCurrFeature  = null // There is one feature per scenario for parallel
    , currSerialFeature = null
    , currBackground    = null
    , Spears            = require('../spears')
    , Tag               = Spears.Cucumber.Ast.Tag
    , Enum              = Spears.Enum;

  this.feature_idx  = 0; // Uniquely identify all features so they can be referenced later
  this.scenario_cnt_by_feature = [];

  this.parallelFeaturesToRun = [];
  this.serialFeaturesToRun   = [];

  this.parallelTotalCnt = 0;
  this.serialTotalCnt   = 0;

  // Iterate through the set of features
  // For each "real" feature, there is one serial features collection but many parallel
  // features.  This is because we will run each features collection independently
  this.visitFeature = function(feature, iterate) {
    ++self.feature_idx;
    parallel_idx = 0;  // Reset the scenario counters
    serial_idx   = 0;

    // Create a new array of Features collections to run
    self.parallelFeaturesToRun[self.feature_idx] = [];

    buildCurrFeature = function () {
      return Spears.Cucumber.Ast.Feature(
        feature.getKeyword(),
        feature.getName(),
        feature.getDescription(),
        feature.getUri(),
        feature.getLine()
      );
    };

    currSerialFeature = null;
    feature.acceptVisitor(this, function () {
      // Add the total counts of scenarios for each feature
      self.scenario_cnt_by_feature[self.feature_idx] = {
        serial: serial_idx,
        parallel: parallel_idx
      };

      iterate();
    });
  };

  // ignore the background
  this.visitBackground = function (background, iterate) {
    currBackground = background;
    iterate();
  };

  // For serial scenarios, add them to the serial feature
  // For parallel, create a new features collection and feature for each scenario
  // so they can be run in individual cuke instances
  this.visitScenario = function (scenario, iterate) {
    var i
      , feature
      , featureset
      , isParallel = false
      , tags = scenario.getTags();

    // Check if this scenario is OK to be run in parallel
    for (i in tags) {
      if (tags[i].getName() === Enum.TAG_PARALLEL_OK) {
        // Add the parallel tag to the scenario so users can filter hooks based
        // on whether or not a test case is running serially or in parallel
        scenario.addTags([Tag(Enum.TAG_PARALLEL_IN_PROGRESS, scenario.getUri(), 1)]);

        // Create a new parallel feature and add the scenario
        feature = buildCurrFeature();
        feature.addScenario(scenario);
        if (currBackground) feature.addBackground(currBackground);

        featureset = Spears.Cucumber.Ast.Features();
        featureset.addFeature(feature);

        self.parallelFeaturesToRun[self.feature_idx].push(featureset);
        ++parallel_idx;
        ++self.parallelTotalCnt;
        isParallel = true;
      }
    }

    if (!tags[i] || !isParallel && tags[i].getName() !== Enum.TAG_IGNORE_IF_PARALLEL) {
      // only add a serial feature if this feature file has at least one serial scenario
      if (!currSerialFeature) {
        currSerialFeature = buildCurrFeature();
        currSerialFeature.addBackground(currBackground);

        featureset = Spears.Cucumber.Ast.Features();
        featureset.addFeature(currSerialFeature);

        self.serialFeaturesToRun[self.feature_idx] = [];
        self.serialFeaturesToRun[self.feature_idx].push(featureset);
      }

      currSerialFeature.addScenario(scenario);
      ++serial_idx;
      ++self.serialTotalCnt;
    }
    iterate();
  };
}

module.exports = Visitor;