Feature: Example Feature for Formatting and Colors
  In order to see demo the capabilities of spears
  As a developer
  I need to have a feature file that uses various use-cases

  Background:
    Given a background step

  Scenario: A passing scenario
    When I run a passing step
    Then everything should be ok

  Scenario: A pending scenario
    When I run a pending step
    Then the following step should be skipped

  Scenario: An undefined scenario
    When I run an undefined step
    Then the following step should be skipped

  Scenario: A failing scenario
    When I run a failing step
    Then the following step should be skipped

  Scenario: A hash table passing
    When I run a passing step with a hash table:
      | fake | header |
      | fake | value  |

  Scenario: A hash table pending
    When I run a pending step with a hash table:
      | fake | header |
      | fake | value  |

  Scenario: A hash table failing
    When I run a failing step with a hash table:
      | fake | header |
      | fake | value  |

  Scenario: A doc string passing
    When I run a passing step with a doc string:
      """
      What a cool doc
      string, on many lines
      """

  Scenario: A doc string pending
    When I run a pending step with a doc string:
      """
      What a cool doc
      string, on many lines
      """

  Scenario: A doc string failing
    When I run a failing step with a doc string:
      """
      What a cool doc
      string, on many lines
      """