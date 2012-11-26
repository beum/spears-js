Feature: Example Feature for parallel scenarios
  In order to see demo the capabilities of spears
  As a developer
  I need to have a feature file that uses various use-cases including parallel scenarios

  Background:
    Given a background step

  @spears-ok
  Scenario: Number 1 passing parallel scenario
    When I run a slow step
    Then everything should be ok

  @spears-ok
  Scenario: Number 2 passing parallel scenario
    When I run a passing step
    Then everything should be ok

  @spears-ok
  Scenario: Number 3 passing parallel scenario
    When I run a passing step
    Then everything should be ok

  @spears-ok
  Scenario: Number 4 passing parallel scenario
    When I run a passing step
    Then everything should be ok

  @spears-ok
  Scenario: Number 5 passing parallel scenario
    When I run a passing step
    Then everything should be ok

  @spears-ok
  Scenario: Number 6 passing parallel scenario
    When I run a slow step
    Then everything should be ok

  @spears-ok
  Scenario: Number 7 passing parallel scenario
    When I run a passing step
    Then everything should be ok

  @spears-ok
  Scenario: Number 8 passing parallel scenario
    When I run a passing step
    Then everything should be ok