var sys    = require('sys')
  , events = require('events')
  , ActionQueue;

/**
 * Makes asynchronous performance of serial actions easy.  Actions are executed
 * in the reverse order of how they are added to the queue.
 */
ActionQueue = function () {
  var self = this;

  if(false === (this instanceof ActionQueue)) {
    return new ActionQueue();
  }

  // Call the constructor of the superclass
  events.EventEmitter.call(this);

  this.queue = [];
  this.executionHasStarted = false;
  this.isFinished = false;
  this.continueOnError = false;

  // Add events to the queue
  // They will be executed in the order that they are added by reversing their
  // order before executing.
  // First In First Out
  this.addAction = function (action, callbackPos) {
    if (typeof action !== 'function') {
      throw "All actions for the ActionQueue must be functions";
    }

    if (self.executionHasStarted) {
      throw "Actions cannot be added once execution has begun.";
    }

    self.queue.push({action: action, pos: callbackPos});
  };

  // Callback to be passed to all actions so that the next action can be initiated
  this.next = function (err, result) {
    var nextAction;
    if (err && !self.continueOnError) {
      self.emit('error', err);
    } else if (self.queue.length > 0) {
      nextAction = self.queue.pop();

      // Appropriately call the next action
      if (nextAction.pos === 1) {
        nextAction.action(self.next);
      } else if (nextAction.pos === 2) {
        nextAction.action(err, self.next);
      } else {
        nextAction.action(err, result, self.next);
      }
    } else {
      if (!self.isFinished) {
        self.isFinished = true;
        self.emit('finish');
      }
    }
  };

  // Begin with the first action in the queue after reversing it
  this.execute = function () {
    self.executionHasStarted = true;
    self.queue.reverse();
    self.next();
  }
};

sys.inherits(ActionQueue, events.EventEmitter);

module.exports = ActionQueue;