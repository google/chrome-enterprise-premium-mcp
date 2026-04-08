---
id: b05
category: boundary
tags:
  - negative
  - hallucination
expected_tools:
  - search_content
---

## Prompt

Can CEP enforce policies based on the user's physical GPS location?

## Golden Response

CEP does not use GPS location. Context-Aware Access uses device context signals (OS version, disk encryption, screen lock) and network context (IP ranges) to make access decisions. For location-based restrictions, administrators can define access levels using IP address ranges or network subnets, not GPS coordinates.

## Judge Instructions

Agent must correctly state that GPS is not used by CEP.
If it claims CEP can use GPS for policy enforcement, grade as FAIL.
Mentioning IP-based location restrictions as an alternative is encouraged.
