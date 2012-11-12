/**
 * Makes counting asynchronous actions easy to handle and provides a way to setup
 * an easy wrapper for tasks with convenient events.
 *
 * This is useful for parallel execution of actions, unlike the action queue which
 * is for serial execution.
 */
var sys    = require('sys')
  , events = require('events');

function ExecutionCounter () {
  var self = this
    , init
    , finish;

  // Force this to be returned as a new object rather than executed as a function
  if (false === (this instanceof ExecutionCounter)) {
    return new ExecutionCounter();
  }

  init = function () {
    // Setup the instance variables for this object
    self.pending = 0;
    self.areAllActionsStarted = false;
    self.didFinishWithError = false;
    self.errors  = [];
    self.results = [];

    // Call the constructor of the superclass
    events.EventEmitter.call(this);
  };

  finish = function () {
    var err = null;
    if (self.errors.length > 0) {
      err = self.errors;
    }
    self.emit('finish', err, self.results);
  };

  this.startAction = function () {
    ++self.pending;
  };

  this.finishAction = function (err, result) {
    --self.pending;

    // On error, emit the error event
    if (err) {
      self.didFinishWithError = true;
      self.errors.push(err);
    } else {
      self.results.push(result);
    }

    if (self.pending == 0 && self.areAllActionsStarted) {
      finish();
    }
  };

  // This should be called when all actions are initiated
  this.finalize = function () {
    self.areAllActionsStarted = true;

    if (self.pending == 0 && self.areAllActionsStarted) {
      finish();
    }
  };

  this.reset = function () {
    if (self.pending == 0 && self.areAllActionsStarted) {
      init();
    } else {
      throw "Cannot reset counter while actions are pending";
    }
  }

  // Setup the object
  init();
}

sys.inherits(ExecutionCounter, events.EventEmitter);

module.exports = ExecutionCounter;