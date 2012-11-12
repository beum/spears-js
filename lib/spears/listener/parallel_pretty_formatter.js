/**
 * In order to account for the parallel nature of the execution, this formatter
 * must be a modified version of the pretty formatter that can print out full
 * scenarios as they complete in parallel.
 */

var ParallelPrettyFormatter = function(options, featureIdx) {
  var Spears           = require('../../spears')
    , PrettyFormatter  = Spears.Cucumber.Listener.PrettyFormatter(options)
    , SummaryFormatter = Spears.Cucumber.Listener.SummaryFormatter({logToConsole: false})
    , self             = PrettyFormatter;

  // Store the output as strings to be used later
  self.featureIdx   = featureIdx;
  self.featureText  = '';
  self.scenarioText = '';
  self.pendingText  = '';
  self.failedText   = '';

  // Use our own summary formatter rather than the pretty formatter's to have access
  // to summary data
  var parentHear = self.hear; // Set this to be the parent's hear func before overriding
  self.hear = function hear(event, callback) {
    SummaryFormatter.hear(event, function () {
      parentHear(event, callback);
    });
  };

  // Override the log function
  self.log = function (str) {
    self.scenarioText += str;
  }

  // Handle the feature and summary as a separate thing because multiple parallel
  // streams will be handling a single feature
  self.handleBeforeFeatureEvent = function handleBeforeFeatureEvent(event, callback) {
    var feature = event.getPayloadItem('feature');
    self.featureText = feature.getKeyword() + ": " + feature.getName() + "\n\n";
    callback();
  };

  self.handleAfterFeaturesEvent = function handleAfterFeaturesEvent(event, callback) {
    self.pendingText = SummaryFormatter.getUndefinedStepLogBuffer();
    self.failedText  = SummaryFormatter.getFailedScenarioLogBuffer();
    callback();
  };

  // Show "." in the console as scenarios complete
  self.handleAfterScenarioEvent = function handleAfterScenarioEvent(event, callback) {
    self.log("\n");
    process.stdout.write(".");
    callback();
  };

  return self;
};
module.exports = ParallelPrettyFormatter;

