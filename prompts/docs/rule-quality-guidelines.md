Analyze the provided Chrome Enterprise Premium (CEP) Data Loss Prevention (DLP) API configurations (raw JSON arrays). Apply the following MECE framework—grounded in factual CEP API heuristics—to identify logic flaws, eliminate noise, and generate optimized, ready-to-deploy JSON/CEL payloads.

<agent_steering_protocol>
1. Prioritize Logic Over Intent: Ignore the `displayName`. You MUST evaluate the explicit CEL operators (`AND`, `OR`, `NOT`), the `triggers` array, and the `action` fields.
2. Limit Assumptions: Only flag issues supported by the raw JSON payload provided.
3. Generate Corrected Payloads: Do not just offer advice. For every rule that violates the heuristics below, you must generate a corrected, valid JSON or CEL snippet that implements the tuning action.
</agent_steering_protocol>

<mece_api_heuristics_framework>
  <dimension_1_coverage_and_scope>
    <heuristic_context_blindness>
      Fact: If `trigger` is `WEB_CONTENT_UPLOAD` or `URL_NAVIGATION` but the CEL `condition` lacks a destination vector (e.g., no `url_navigation.destination.domain` or `google.workspace.chrome.url.category` restrictions), it represents a noisy "Catch-All" pattern.
      Tuning Action: Inject CEL constraints restricting matching solely to high-risk egress channels like unmanaged cloud uploads or personal webmail.
    </heuristic_context_blindness>
    
    <heuristic_false_negatives_over_scoping>
      Fact: If the CEL condition contains broad file-type exclusions (e.g., `!file.name.endsWith('.docx')` or `!file.type.contains('excel')`), it creates massive security blind spots (false negatives).
      Tuning Action: Remove the broad format exclusion and replace it with a higher match threshold or targeted recipient boundaries in the CEL snippet.
    </heuristic_false_negatives_over_scoping>

    <heuristic_root_ou_targeting>
      Fact: Policies applied to the Root OU without Context-Aware Access (CAA) device signals (e.g., ignoring `device.managed == true`) over-scope the deployment.
      Tuning Action: Require explicit inclusion groups or CAA binding.
    </heuristic_root_ou_targeting>
  </dimension_1_coverage_and_scope>

  <dimension_2_efficacy_and_accuracy>
    <heuristic_threshold_sensitivities>
      Fact: If the payload contains an infoType or detector for broad numerical patterns (like SSN or Credit Card) with a `minimum_match_count` or threshold of 1, it produces massive false-positive noise.
      Tuning Action: Increase the instance threshold to target bulk exfiltration.
    </heuristic_threshold_sensitivities>
    
    <heuristic_compound_conditions>
      Fact: If an identifier rule lacks proximity or compound logic, it triggers on random numbers. High-fidelity rules require a multi-part compound condition.
      Tuning Action: Output a corrected boolean `AND` block in CEL that chains the primary pattern with a secondary dictionary match (e.g., requiring keywords like "Visa" or "Invoice" within 10 to 50 terms).
    </heuristic_compound_conditions>

    <heuristic_shotgun_triggers>
      Fact: If the `triggers` array combines unrelated actions (e.g., `[FILE_UPLOAD, FILE_DOWNLOAD, PRINT, CLIPBOARD_COPY]`) in a single rule, precision tuning is impossible.
      Tuning Action: Split the rule. Output distinct JSON payloads mapping one specific action to one specific data type.
    </heuristic_shotgun_triggers>
  </dimension_2_efficacy_and_accuracy>

  <dimension_3_business_friction>
    <heuristic_action_proportionality>
      Fact: If `action == 'BLOCK'` on a rule containing broad scopes (Dimension 1) or low thresholds (Dimension 2), it causes immediate, unwarranted helpdesk traffic.
      Tuning Action: Downgrade the `action` to `WARN` and inject user override/justification parameters into the JSON payload. This turns friction into an educational event.
    </heuristic_action_proportionality>
  </dimension_3_business_friction>
  
  <dimension_4_lifecycle_and_hygiene>
    <heuristic_audit_first>
      Fact: Bypassing `AUDIT` mode during initial deployment prevents the establishment of a baseline profile.
      Tuning Action: Ensure newly defined or untested rules default to `AUDIT` mode.
    </heuristic_audit_first>

    <heuristic_orphaned_state>
      Fact: `state == 'INACTIVE'` rules or rules missing `target_resources` bindings create technical debt.
      Tuning Action: Flag inactive rules for deletion or missing targets for explicit scoping.
    </heuristic_orphaned_state>
  </dimension_4_lifecycle_and_hygiene>
</mece_api_heuristics_framework>

<output_format>
For every rule evaluated:
1. Rule Name / ID
2. Diagnosed Flaw: State the diagnosed flaw directly mapped to the specific API heuristic above.
3. Remediation: Output a remediated JSON or CEL block establishing the proper compound conditions, thresholds, destination vectors, or override actions.
</output_format>

<reporting_constraints>
- DO NOT use internal tool names in your output. Translate findings into user-facing administrative language.
- Use standard straight quotes inside JSON/CEL code blocks.
</reporting_constraints>
