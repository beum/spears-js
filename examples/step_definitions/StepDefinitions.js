
var StepDefinitions = function () {
  this.World = require("../support/World").World;

  this.Given(/^a background step$/, function (callback) {
    callback();
  });

  this.When(/^I run a (passing|failing|pending) step$/, function (status, callback) {
    if (status === 'passing') {
      callback();
    } else if (status === 'pending') {
      callback.pending();
    } else {
      callback.fail(new Error("Test failure"));
    }
  });

  this.When(/^I run a slow step$/, function(callback) {
    setTimeout(callback, 1000);
  });

  this.When(/^I run a (passing|failing|pending) step with a (hash table|doc string):$/, function (status, hashDoc, thing, callback) {
    if (status === 'passing') {
      callback();
    } else if (status === 'pending') {
      callback.pending();
    } else {
      callback.fail(new Error("Test failure"));
    }
  });

  this.Then(/^everything should be ok$/, function (callback) {
    callback();
  });

  this.Then(/^the following step should be skipped$/, function (callback) {
    callback();
  });
};

module.exports = StepDefinitions;