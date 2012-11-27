/**
 * This class will format log output appropriately
 */
module.exports = (function () {
  var self = {};

  // Set colors
  var colors = {
    clear:  '\033[0m',
    red:    '\033[31m',
    green:  '\033[32m',
    orange: '\033[33m',
    blue:   '\033[34m',
    purple: '\033[35m',
    azure:  '\033[36m',
    pink:   '\033[37m'
  };

  var boldColors = {
    clear:  '\033[0m',
    white:  '\033[1;30m',
    red:    '\033[1;31m',
    green:  '\033[1;32m',
    orange: '\033[1;33m',
    blue:   '\033[1;34m',
    purple: '\033[1;35m',
    azure:  '\033[1;36m',
    pink:   '\033[1;37m'
  };

  var effects = {
    strikethrough: '\033[9;37m',
    faint:         '\033[2;37m'
  }

  var log = function (text) {
    process.stdout.write("  " + text + "\n");
  };

  var logRaw = function (text) {
    process.stdout.write(text);
  };

  // Stats
  var scenarioCount            = 0;
  var passedScenarioCount      = 0;
  var undefinedScenarioCount   = 0;
  var pendingScenarioCount     = 0;
  var failedScenarioCount      = 0;

  var stepCount                = 0;
  var passedStepCount          = 0;
  var failedStepCount          = 0;
  var skippedStepCount         = 0;
  var undefinedStepCount       = 0;
  var pendingStepCount         = 0;

  // Parallel vs Serial
  var parallelScenarioCount = 0;
  var serialScenarioCount   = 0;

  // Text
  var failedScenarioLogBuffer = "";
  var undefinedStepLogBuffer  = "";

  // Timing
  var start;
  var parallelEnd;
  var serialEnd;

  self.handleExecutionStart = function (numParallel, numSerial) {
    parallelScenarioCount = numParallel;
    serialScenarioCount   = numSerial;
    start = Date.now();

    log("\n");
    log(boldColors.blue + "Beginning test execution with:" + colors.clear);
    log("  - " + numParallel + " parallel scenarios");
    log("  - " + numSerial + " serial scenarios");
    log("");
  };

  self.handleParallelSetBegin = function () {
    log("");
    log(boldColors.green + "(::) Beginning Parallel Scenarios (::)" + colors.clear);
    log("");
  };

  self.handleSerialSetBegin = function () {
    log("");
    log(boldColors.green + "(::) Beginning Serial Scenarios (::)" + colors.clear);
    log("");
  };

  self.handleParallelSetComplete = function () {
    parallelEnd = Date.now();
  };

  self.handleSerialSetComplete = function () {
    serialEnd = Date.now();
  };

  // Accept a parallel formatter and output the results
  self.handleFeatureComplete = function (PF, isSerial) {
    var scenarios, j;
    
    if (!isSerial) {
      self.handleBeforeFeatureEvent(PF.feature);
      scenarios = PF.scenarios;
      for (j in scenarios) {
        self.handleScenario(scenarios[j]);
      }
    }

    // TODO: Add counts to total counts
    scenarioCount          += PF.statsJournal.getScenarioCount();
    passedScenarioCount    += PF.statsJournal.getPassedScenarioCount();
    undefinedScenarioCount += PF.statsJournal.getUndefinedScenarioCount();
    pendingScenarioCount   += PF.statsJournal.getPendingScenarioCount();
    failedScenarioCount    += PF.statsJournal.getFailedScenarioCount();

    stepCount              += PF.statsJournal.getStepCount();
    passedStepCount        += PF.statsJournal.getPassedStepCount();
    failedStepCount        += PF.statsJournal.getFailedStepCount();
    skippedStepCount       += PF.statsJournal.getSkippedStepCount();
    undefinedStepCount     += PF.statsJournal.getUndefinedStepCount();
    pendingStepCount       += PF.statsJournal.getPendingStepCount();

    failedScenarioLogBuffer += PF.summaryFormatter.getFailedScenarioLogBuffer();
    undefinedStepLogBuffer  += PF.summaryFormatter.getUndefinedStepLogBuffer();
  };

  self.handleExecutionComplete = function () {
    self.logFailedStepResults();
    self.logUndefinedStepSnippets();

    log(boldColors.green + "(::) Execution Summary (::)" + colors.clear);
    self.logTimings();
    self.logScenariosSummary();
    self.logStepsSummary();
    log("");
  };
  
  self.handleBeforeFeatureEvent = function (feature) {
    log("");
    log(boldColors.azure + feature + colors.clear);
  };
  
  self.handleBeforeScenarioEvent = function (scenario) {
    log("");
    log("  " + boldColors.blue + scenario + colors.clear);
  };
  
  self.handleStepResultEvent = function (step) {
    if (step.type === 'pending') {
      log("    " + colors.orange + step.text + colors.clear);
    } else if (step.type === 'undefined') {
      log("    " + boldColors.orange + step.text + colors.clear);
    } else if (step.type === 'skipped') {
      log("    " + effects.strikethrough + step.text + colors.clear);
    } else if (step.type === 'failed') {
      log("    " + boldColors.red + step.text + colors.clear);
      log(colors.red + step.failureText + colors.clear);
    } else {
      log("    " + colors.green + step.text + colors.clear);
    }
  };
  
  self.handleScenario = function (scenario) {
    var i, steps;    
    self.handleBeforeScenarioEvent(scenario.title);
    steps = scenario.steps;

    for (i in steps) {
      self.handleStepResultEvent(steps[i]);
    }
    log("");
  };

  self.logFailedStepResults = function logFailedStepResults() {
    var failedScenarios = "";
    var split = failedScenarioLogBuffer.split("\n");
    for (var i in split) {
      failedScenarios += "  " + split[i] + "\n";
    }

    log(boldColors.red + "(::) Failed Scenarios (::)" + colors.clear);
    logRaw(colors.red + failedScenarios + colors.clear);
  };

  self.logUndefinedStepSnippets = function logUndefinedStepSnippets() {
    var undefinedSteps = "";
    var split = undefinedStepLogBuffer.split("\n");
    for (var i in split) {
      undefinedSteps += "  " + split[i] + "\n";
    }

    if (undefinedSteps !== "") {
      log(boldColors.orange + "You can implement step definitions for undefined steps with these snippets:" + colors.clear);
      logRaw(colors.orange + undefinedSteps + colors.clear);
    }
  };

  self.logTimings = function () {
    var total = boldColors.green + 'All scenarios complete in ' + ((serialEnd - start)/1000) + ' seconds' + colors.clear;
    var details = colors.green + "  (" + ((parallelEnd - start)/1000) + " Parallel, " + ((serialEnd - parallelEnd)/1000) + " Serial)" + colors.clear;
    log(total + details);
  };

  self.logScenariosSummary = function logScenariosSummary() {
    var details    = [];
    var detailText = '';
    var spearsText = '';
    var count      = boldColors.green + scenarioCount + " scenario" + (scenarioCount != 1 ? "s" : "") + colors.clear;

    if (scenarioCount > 0 ) {
      if (failedScenarioCount > 0)
        details.push(failedScenarioCount + " failed");
      if (undefinedScenarioCount > 0)
        details.push(undefinedScenarioCount + " undefined");
      if (pendingScenarioCount > 0)
        details.push(pendingScenarioCount + " pending");
      if (passedScenarioCount > 0)
        details.push(passedScenarioCount + " passed");

      detailText = colors.green + "  (" + details.join(', ') + ")" + colors.clear;
      spearsText =
        colors.green +
          "::(" + parallelScenarioCount + " Parallel, " + serialScenarioCount + " Serial)" +
        colors.clear;

      log(count + detailText + spearsText);
    } else {
      log(count);
    }
  };

  self.logStepsSummary = function logStepsSummary() {
    var details = [];
    var count   = boldColors.green + stepCount + " step" + (stepCount != 1 ? "s" : "") + colors.clear;

    if (stepCount > 0) {
      if (failedStepCount > 0)
        details.push(failedStepCount    + " failed");
      if (undefinedStepCount > 0)
        details.push(undefinedStepCount + " undefined");
      if (pendingStepCount > 0)
        details.push(pendingStepCount   + " pending");
      if (skippedStepCount > 0)
        details.push(skippedStepCount   + " skipped");
      if (passedStepCount > 0)
        details.push(passedStepCount    + " passed");

      log(count + colors.green + "  (" + details.join(', ') + ")" + colors.clear);
    } else {
      log(count);
    }
  };

  return self;
}());