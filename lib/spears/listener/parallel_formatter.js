/**
 * In order to account for the parallel nature of the execution, this formatter
 * must be a modified version of the pretty formatter that can print out full
 * scenarios as they complete in parallel.
 */
var ParallelFormatter = function (options) {
  if (false === (this instanceof ParallelFormatter)) {
    return new ParallelFormatter(options);
  }

  var self = this;
  var Spears = require('../../spears');
  //var self = Spears.Cucumber.Listener();

  // Record passing and failing steps
  self.statsJournal     = Spears.Cucumber.Listener.StatsJournal();
  self.summaryFormatter = Spears.Cucumber.Listener.SummaryFormatter({logToConsole: false});

  var hear = function (event, callback) {
    if (self.hasHandlerForEvent(event)) {
      var handler = self.getHandlerForEvent(event);
      handler(event, callback);
    } else {
      callback();
    }
  };

  self.hasHandlerForEvent = function (event) {
    var handlerName = self.buildHandlerNameForEvent(event);
    return self[handlerName] != undefined;
  }

  self.buildHandlerNameForEvent = function (event) {
    var handlerName =
      Listener.EVENT_HANDLER_NAME_PREFIX +
      event.getName() +
      Listener.EVENT_HANDLER_NAME_SUFFIX;
    return handlerName;
  };

  self.getHandlerForEvent = function (event) {
    var eventHandlerName = self.buildHandlerNameForEvent(event);
    return self[eventHandlerName];
  };

  // Variables to hold results
  self.feature   = '';
  self.scenarios = [];
  var currScenario = {};
  var currSteps    = [];

  self.hear = function (event, callback) {
    self.summaryFormatter.hear(event, function () {
      self.statsJournal.hear(event, function () {
        hear(event, callback);
      });
    });
  };

  self.handleBeforeFeatureEvent = function handleBeforeFeatureEvent(event, callback) {
    var feature = event.getPayloadItem('feature');
    var source = feature.getKeyword() + ": " + feature.getName();
    //self.log(source);
    self.feature = source;
    callback();
  };

  self.handleBeforeScenarioEvent = function handleBeforeScenarioEvent(event, callback) {
    var scenario = event.getPayloadItem('scenario');
    var source = scenario.getKeyword() + ": " + scenario.getName();
    //self.logIndented(source, 1);
    currScenario.title = source;
    callback();
  };

  // Do nothing after scenario
  self.handleAfterScenarioEvent = function handleAfterScenarioEvent(event, callback) {
    currScenario.steps = currSteps;
    self.scenarios.push(currScenario);

    currScenario = {};
    currSteps    = [];

    callback();
  };

  self.handleStepResultEvent = function handleStepResultEvent(event, callback) {
    var stepResult = event.getPayloadItem('stepResult');
    var step       = stepResult.getStep();
    var source     = step.getKeyword() + step.getName();
    var output     = {};
    output.text = source;
    //self.logIndented(source, 2);

    if (step.hasDataTable()) {
      var dataTable = step.getDataTable();
      //self.logDataTable(dataTable);
      var outputTable = '\n';

      var rows         = dataTable.raw();
      var columnWidths = self._determineColumnWidthsFromRows(rows);
      var rowCount     = rows.length;
      var columnCount  = columnWidths.length;

      for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        var cells = rows[rowIndex];
        var line = "|";
        for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) {
          var cell        = cells[columnIndex];
          var columnWidth = columnWidths[columnIndex];
          line += " " + self._pad(cell, columnWidth) + " |"
        }

        if (rowIndex < rowCount - 1) line += "\n";
        outputTable += self.indent(line, 4);
      }

      output.text += outputTable;
    }

    if (step.hasDocString()) {
      var docString = step.getDocString();
      //self.logDocString(docString);

      var contents        = docString.getContents();
      var outputDocString = '';
      outputDocString = self.indent('\n"""\n' + contents + '\n"""' , 4);
      output.text += outputDocString;
    }

    if (stepResult.isFailed()) {
      var failure            = stepResult.getFailureException();
      var failureDescription = failure.stack || failure;
      var outputFailDesc     = '';

      outputFailDesc = self.indent(failureDescription + "\n", 4);
      output.failureText  = outputFailDesc;
    }

    if (stepResult.isPending()) {
      output.type = 'pending';
    } else if (stepResult.isUndefined()) {
      output.type = 'undefined';
    } else if (stepResult.isSkipped()) {
      output.type = 'skipped';
    } else if (stepResult.isFailed()) {
      output.type = 'failed';
    } else {
      output.type = 'pass';
    }

    currSteps.push(output);

    callback();
  };

  self.indent = function indent(text, level) {
    var indented;
    text.split("\n").forEach(function(line) {
      var prefix = new Array(level + 1).join("  ");
      line = (prefix + line).replace(/\s+$/, '');
      indented = (typeof(indented) == 'undefined' ? line : indented + "\n" + line);
    });
    return indented;
  };

  self._determineColumnWidthsFromRows = function _determineColumnWidthsFromRows(rows) {
    var columnWidths = [];
    var currentColumn;

    rows.forEach(function (cells) {
      currentColumn = 0;
      cells.forEach(function (cell) {
        var currentColumnWidth = columnWidths[currentColumn];
        var currentCellWidth   = cell.length;
        if (typeof currentColumnWidth == "undefined" || currentColumnWidth < currentCellWidth)
          columnWidths[currentColumn] = currentCellWidth;
        currentColumn += 1;
      });
    });

    return columnWidths;
  };

  self._pad = function _pad(text, width) {
    var padded = "" + text;
    while (padded.length < width) {
      padded += " ";
    }
    return padded;
  };

  return self;
};
module.exports = ParallelFormatter;

var Listener = {};
Listener.EVENT_HANDLER_NAME_PREFIX = 'handle';
Listener.EVENT_HANDLER_NAME_SUFFIX = 'Event';