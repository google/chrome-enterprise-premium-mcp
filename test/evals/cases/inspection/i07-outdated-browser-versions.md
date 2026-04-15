---
id: i07
category: inspection
tags:
  - browsers
  - versions
scenario: outdated-browser-versions
expected_tools:
  - count_browser_versions
priority: P2
---

## Prompt

What Chrome browser versions are deployed across my organization? Is the fleet
up to date?

## Golden Response

Agent should report three versions across 102 devices: v120 on 87 devices, v130
on 12 devices, and v134 on 3 devices. The significant version spread (14 major
versions between oldest and newest) and the concentration on the oldest version
suggests most of the fleet has not been updated recently. The agent should flag
these older versions as outdated or legacy.

## Judge Instructions

The agent must note the version distribution and highlight that most devices are
clustered on the oldest version, explicitly flagging them as outdated or legacy.
It does not need to know the absolute latest Chrome release — the version spread
itself is the signal. If the agent simply lists the versions without commenting
on the concentration or flagging them as outdated, grade as FAIL.
