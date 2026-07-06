# Changelog

## [1.10.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.9.0...chrome-enterprise-premium-mcp-v1.10.0) (2026-07-06)


### Features

* **acm:** implement AccessContextManagerClient with accessPolicy and accessLevel Methods ([#351](https://github.com/google/chrome-enterprise-premium-mcp/issues/351)) ([9ce3e3e](https://github.com/google/chrome-enterprise-premium-mcp/commit/9ce3e3e45d0e1b15839a984bddf7eadd63ede7b0))
* add basic secure gateway tools ([#350](https://github.com/google/chrome-enterprise-premium-mcp/issues/350)) ([6381d9a](https://github.com/google/chrome-enterprise-premium-mcp/commit/6381d9acc9150ec5d791411b94dd8569f4ffc473))
* add Security Insights query methods to ChromeManagementClient ([#329](https://github.com/google/chrome-enterprise-premium-mcp/issues/329)) ([a248b04](https://github.com/google/chrome-enterprise-premium-mcp/commit/a248b04f6cad99a16179598445b9e74f702bf028))
* **auth:** gate CLOUD_PLATFORM scope behind feature flag ([#345](https://github.com/google/chrome-enterprise-premium-mcp/issues/345)) ([c6f424f](https://github.com/google/chrome-enterprise-premium-mcp/commit/c6f424fd4f7f1e04d9a77a8d8cf59ad4b6d6ce18))
* **crm:** add Cloud Resource Manager client and integration ([#340](https://github.com/google/chrome-enterprise-premium-mcp/issues/340)) ([fb9e7d4](https://github.com/google/chrome-enterprise-premium-mcp/commit/fb9e7d43e28a0328b5ec4c61425cc1bd988edcf3))
* **Crm:** Add search_organizations tool to MCP server ([#346](https://github.com/google/chrome-enterprise-premium-mcp/issues/346)) ([3be6196](https://github.com/google/chrome-enterprise-premium-mcp/commit/3be61967b8cba06d372194361d66329767f0d82e))
* **crm:** gate search_organizations tool behind EXPERIMENT_SEARCH_ORGANIZATIONS_TOOL_ENABLED ([#356](https://github.com/google/chrome-enterprise-premium-mcp/issues/356)) ([ed035df](https://github.com/google/chrome-enterprise-premium-mcp/commit/ed035df2ceff38d932232c888e9fe9cd917653c7))
* **diagnose:** add structured remediation and connector deep links ([#336](https://github.com/google/chrome-enterprise-premium-mcp/issues/336)) ([d8eae32](https://github.com/google/chrome-enterprise-premium-mcp/commit/d8eae3204201ecb4c9ae1ef55f1a43c667897f87))
* **diagnose:** escalate Security Insights disabled findings to critical severity ([#335](https://github.com/google/chrome-enterprise-premium-mcp/issues/335)) ([e3b7a44](https://github.com/google/chrome-enterprise-premium-mcp/commit/e3b7a4416bed5f1800c54249879e70d5fbfdd925))
* **diagnose:** integrate Security Insights Data tool into diagnose_environment ([#337](https://github.com/google/chrome-enterprise-premium-mcp/issues/337)) ([1497320](https://github.com/google/chrome-enterprise-premium-mcp/commit/14973209dbb7dce93700cd09ec6cc525cf64e366))
* **diagnose:** proactively include Admin Console deep-links in environment health check findings ([#333](https://github.com/google/chrome-enterprise-premium-mcp/issues/333)) ([0c00848](https://github.com/google/chrome-enterprise-premium-mcp/commit/0c008484a7538682263b3194fdba96c4373fb8e4))
* ensure DLP rule deletion link is provided and add evals ([#349](https://github.com/google/chrome-enterprise-premium-mcp/issues/349)) ([3867e22](https://github.com/google/chrome-enterprise-premium-mcp/commit/3867e22b13848db3462c2e06b838d535ebf259e7))
* **eval:** implement daily evaluation trend reporter and scheduler ([#332](https://github.com/google/chrome-enterprise-premium-mcp/issues/332)) ([7f0f8be](https://github.com/google/chrome-enterprise-premium-mcp/commit/7f0f8beaf60f34c741148911949d45f770e12727))
* **eval:** track and report newly added evals separately in daily trend reporter (b/527926026) ([#360](https://github.com/google/chrome-enterprise-premium-mcp/issues/360)) ([a259230](https://github.com/google/chrome-enterprise-premium-mcp/commit/a259230be5358a2f9893daccd2b21832bd79c0fc))
* **health:** proactively offer to enable Security Insights during health check ([#334](https://github.com/google/chrome-enterprise-premium-mcp/issues/334)) ([e4111fb](https://github.com/google/chrome-enterprise-premium-mcp/commit/e4111fbd82c9044d868bdc3476df8ff45b5f1de8))
* implement security_insights_data tool and tests ([#331](https://github.com/google/chrome-enterprise-premium-mcp/issues/331)) ([8b3e098](https://github.com/google/chrome-enterprise-premium-mcp/commit/8b3e09804af6d47c441ce11a33cfcd0df3c99bff))
* suggest proactive follow-ups and clarify plain English descriptions ([#342](https://github.com/google/chrome-enterprise-premium-mcp/issues/342)) ([1e44407](https://github.com/google/chrome-enterprise-premium-mcp/commit/1e44407326b69080d16d6997b1e7584c24c980c8))
* support test file argument forwarding in integration runner ([#348](https://github.com/google/chrome-enterprise-premium-mcp/issues/348)) ([f85393e](https://github.com/google/chrome-enterprise-premium-mcp/commit/f85393e65451cf0b92c1f2c4e4fdac1ebdb83ef6))


### Bug Fixes

* **eval:** add explicit permission to m04 prompt to trigger connector enablement tool (b/527582280) ([#357](https://github.com/google/chrome-enterprise-premium-mcp/issues/357)) ([6bda33d](https://github.com/google/chrome-enterprise-premium-mcp/commit/6bda33db7f4fc6ac2fd5f1948493f930e0b11368))
* **eval:** allow alternative tool calls in expectedTools for d05 and i04 ([#323](https://github.com/google/chrome-enterprise-premium-mcp/issues/323)) ([10a9627](https://github.com/google/chrome-enterprise-premium-mcp/commit/10a962756242f15f1c4656a31d4cab1f47b24be0))
* **eval:** clarify m06 judge instructions for idempotent security insights check (b/527597352) ([#358](https://github.com/google/chrome-enterprise-premium-mcp/issues/358)) ([a16ba10](https://github.com/google/chrome-enterprise-premium-mcp/commit/a16ba1037d57393afea57df697272340bfd5efe5))
* **eval:** clear activities in no-dlp-rules scenario ([#325](https://github.com/google/chrome-enterprise-premium-mcp/issues/325)) ([674bfe2](https://github.com/google/chrome-enterprise-premium-mcp/commit/674bfe25903e787d738311decfc1d13051d41749))
* **eval:** derive golden run comparison baseline from latest run version ([#353](https://github.com/google/chrome-enterprise-premium-mcp/issues/353)) ([#354](https://github.com/google/chrome-enterprise-premium-mcp/issues/354)) ([2532f26](https://github.com/google/chrome-enterprise-premium-mcp/commit/2532f26a5b308d52cbc59e654b8996fafdfcf37e))
* **eval:** enable security insights by default in healthy and no-detectors scenarios (b/527496693) ([#355](https://github.com/google/chrome-enterprise-premium-mcp/issues/355)) ([fcd3447](https://github.com/google/chrome-enterprise-premium-mcp/commit/fcd34471c164044c3664ec287396298fcbb69ceb))
* **eval:** set m07 scenario to security-insights-enabled ([#322](https://github.com/google/chrome-enterprise-premium-mcp/issues/322)) ([11a1f14](https://github.com/google/chrome-enterprise-premium-mcp/commit/11a1f146d2f055adf605635a32fe17ec8aafcc2d))
* **eval:** simplify judge instructions in i12 ([#318](https://github.com/google/chrome-enterprise-premium-mcp/issues/318)) ([876ec69](https://github.com/google/chrome-enterprise-premium-mcp/commit/876ec69eb54e3419c869b6b6bcd9bdc54645efc3))
* **evals:** load secure gateway fixtures in fake server ([#361](https://github.com/google/chrome-enterprise-premium-mcp/issues/361)) ([a29b2fd](https://github.com/google/chrome-enterprise-premium-mcp/commit/a29b2fdcdffead48f28d89c3ded7df0f15fb64fd))
* **eval:** support /chrome prefix routing for mocked help articles ([#324](https://github.com/google/chrome-enterprise-premium-mcp/issues/324)) ([b5ab7ad](https://github.com/google/chrome-enterprise-premium-mcp/commit/b5ab7ada8c6a46bf8426cbe29fdfef01f1ecea3f))


### Miscellaneous Chores

* configure release-please and workflows for beta release channel ([a3a954b](https://github.com/google/chrome-enterprise-premium-mcp/commit/a3a954b3979acca6640ab3690c01c12db4882d9e))
* ignore temporary scratch directories in prettier and git ([cae8dde](https://github.com/google/chrome-enterprise-premium-mcp/commit/cae8dde738bb9e36790d1a82c0ef8dd213c9304a))


### Continuous Integration

* set target-branch dynamically in release-please-action ([fcdbe76](https://github.com/google/chrome-enterprise-premium-mcp/commit/fcdbe7639cd963553b8f6b439995eafea29f6d45))
* upgrade github actions to node 24 ([#339](https://github.com/google/chrome-enterprise-premium-mcp/issues/339)) ([5e3cee4](https://github.com/google/chrome-enterprise-premium-mcp/commit/5e3cee4140cdfe09ca8af877a6db2be96869e084))


### Documentation

* add prerequisites to README ([#313](https://github.com/google/chrome-enterprise-premium-mcp/issues/313)) ([1693fbc](https://github.com/google/chrome-enterprise-premium-mcp/commit/1693fbc123c7b239c7a4152790c040d073128b5a))
* add secure gateway knowledge and evals ([#362](https://github.com/google/chrome-enterprise-premium-mcp/issues/362)) ([f3e041f](https://github.com/google/chrome-enterprise-premium-mcp/commit/f3e041f8b674b5075cc3057726ce4480b15e8360))
* document headless auth backup in README quickstart ([#311](https://github.com/google/chrome-enterprise-premium-mcp/issues/311)) ([9c59f5b](https://github.com/google/chrome-enterprise-premium-mcp/commit/9c59f5b1f4fe2b293fb623a7889df7535bdc1ad7))


### Tests

* **evals:** add security insights data telemetry evals i15 and i16 ([#341](https://github.com/google/chrome-enterprise-premium-mcp/issues/341)) ([aaa1e8d](https://github.com/google/chrome-enterprise-premium-mcp/commit/aaa1e8db3a5be28626e28dcbd8ed2077c084a066))
* **evals:** fix i15/i16 experiments, expectations, and prompts ([#359](https://github.com/google/chrome-enterprise-premium-mcp/issues/359)) ([2dc73d0](https://github.com/google/chrome-enterprise-premium-mcp/commit/2dc73d0ed87f3b6150fbf30e335a29c170c8c3de))
* hermetically sanitize custom OAuth client env vars in runners ([#347](https://github.com/google/chrome-enterprise-premium-mcp/issues/347)) ([3e5ae80](https://github.com/google/chrome-enterprise-premium-mcp/commit/3e5ae80d35746df7cec2328dce435e67340ef129))

## [1.9.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.8.0...chrome-enterprise-premium-mcp-v1.9.0) (2026-06-04)


### Features

* add Chrome Security Insights configuration integration and unified tool ([#295](https://github.com/google/chrome-enterprise-premium-mcp/issues/295)) ([0b26618](https://github.com/google/chrome-enterprise-premium-mcp/commit/0b266185b2d0a69b5a7d6f88020e3a630b5f6be4))
* **auth:** fail early on missing credentials instead of opening browser ([#301](https://github.com/google/chrome-enterprise-premium-mcp/issues/301)) ([97bd1c9](https://github.com/google/chrome-enterprise-premium-mcp/commit/97bd1c923efcb90a111b9223056b57e67a6cd320))
* **auth:** implement robust instant asynchronous auth flow for cep_auth ([#303](https://github.com/google/chrome-enterprise-premium-mcp/issues/303)) ([545b81b](https://github.com/google/chrome-enterprise-premium-mcp/commit/545b81b5e6cf77ef868d49de9dbeac97bae3b672))
* integrate Security Insights into diagnose_environment tool ([#306](https://github.com/google/chrome-enterprise-premium-mcp/issues/306)) ([07c2cbf](https://github.com/google/chrome-enterprise-premium-mcp/commit/07c2cbf81dc002337ca4bdd1670b3e17c14f28e6))
* replace incorrect dashboard roles with correct privileges ([#307](https://github.com/google/chrome-enterprise-premium-mcp/issues/307)) ([78a250a](https://github.com/google/chrome-enterprise-premium-mcp/commit/78a250a5ead3364bb82e24c49beec09842ef05e7))


### Bug Fixes

* **adk:** resolve agent dependency bug and improve auth documentation ([#293](https://github.com/google/chrome-enterprise-premium-mcp/issues/293)) ([8642490](https://github.com/google/chrome-enterprise-premium-mcp/commit/86424903e529cc02bbf1959a50cf9f6bbd1de05c))
* ignore python virtual environments in eslint config ([#296](https://github.com/google/chrome-enterprise-premium-mcp/issues/296)) ([614c25d](https://github.com/google/chrome-enterprise-premium-mcp/commit/614c25d2dea959cf136eb057f6ef7463add83985))
* prevent local loopback server shutdown hangs by forcing Connection: close ([#297](https://github.com/google/chrome-enterprise-premium-mcp/issues/297)) ([51bd90e](https://github.com/google/chrome-enterprise-premium-mcp/commit/51bd90eaae67708bc2a2ca11c7b5d1eeb48bd023))
* **test:** allow 'latest' version in gemini-extension.json ([#310](https://github.com/google/chrome-enterprise-premium-mcp/issues/310)) ([f40ce8e](https://github.com/google/chrome-enterprise-premium-mcp/commit/f40ce8eef3752ada8d93d2bef1f7fa19c58bfee3))


### Documentation

* remove references to gated tools from README ([#287](https://github.com/google/chrome-enterprise-premium-mcp/issues/287)) ([e6edec3](https://github.com/google/chrome-enterprise-premium-mcp/commit/e6edec341cb0f520734c9cc9d32e30e9e2f07a28))
* streamline README onboarding and consolidate contributor setup ([#294](https://github.com/google/chrome-enterprise-premium-mcp/issues/294)) ([1980c80](https://github.com/google/chrome-enterprise-premium-mcp/commit/1980c80c91abe8e0d97064a1ea81d97bfaaa7019))


### Code Refactoring

* **auth:** make non-headless authentication non-blocking ([#299](https://github.com/google/chrome-enterprise-premium-mcp/issues/299)) ([d7c285d](https://github.com/google/chrome-enterprise-premium-mcp/commit/d7c285d8c48d6a55558f869fca0ae3c634f23e2f))
* **auth:** remove workstation ADC support from local python agent ([#292](https://github.com/google/chrome-enterprise-premium-mcp/issues/292)) ([78bb325](https://github.com/google/chrome-enterprise-premium-mcp/commit/78bb325a6d1080627c78bd684a6dc5b7da727014))

## [1.8.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.7.0...chrome-enterprise-premium-mcp-v1.8.0) (2026-05-29)


### Features

* **auth:** dynamic environment-aware agent hints and user instructions ([#257](https://github.com/google/chrome-enterprise-premium-mcp/issues/257)) ([2f1b554](https://github.com/google/chrome-enterprise-premium-mcp/commit/2f1b554a4c0e41471506df0c6e948151c71f4135))


### Bug Fixes

* **adk:** update model name and docs ([#214](https://github.com/google/chrome-enterprise-premium-mcp/issues/214)) ([a6d5d7c](https://github.com/google/chrome-enterprise-premium-mcp/commit/a6d5d7c20315b1d96a80ec09ef18b3349223bda4))
* **auth:** route sign-in fallback through cli_invocation helper ([#273](https://github.com/google/chrome-enterprise-premium-mcp/issues/273)) ([e41dcf7](https://github.com/google/chrome-enterprise-premium-mcp/commit/e41dcf73c15e0be7ca3c86a8696f608d3fe2eb5c))
* **eval:** add test proxy support rewriter and fake endpoint for k07 ([#276](https://github.com/google/chrome-enterprise-premium-mcp/issues/276)) ([064c144](https://github.com/google/chrome-enterprise-premium-mcp/commit/064c1445c754a9404144859586de7f4b7f9d6150))
* **eval:** remove robot emoji prefix from mock rule for m03 refuse check ([#275](https://github.com/google/chrome-enterprise-premium-mcp/issues/275)) ([198ea2d](https://github.com/google/chrome-enterprise-premium-mcp/commit/198ea2d3d3e94599d6b2c76d1acfd201da86acd5))
* **eval:** simplify m01 judge instructions as per team consensus ([#285](https://github.com/google/chrome-enterprise-premium-mcp/issues/285)) ([4e0df7a](https://github.com/google/chrome-enterprise-premium-mcp/commit/4e0df7a6bb86d009b45762ad1e5b9fd0236837b9))
* **eval:** support optional expectedTools and update i03 to permit diagnose_environment ([#289](https://github.com/google/chrome-enterprise-premium-mcp/issues/289)) ([e10f54d](https://github.com/google/chrome-enterprise-premium-mcp/commit/e10f54da321a20cddde90a2e29dd73fb0f14d927))
* **eval:** update d01 to expect and permit actual OU IDs ([#284](https://github.com/google/chrome-enterprise-premium-mcp/issues/284)) ([8d24e05](https://github.com/google/chrome-enterprise-premium-mcp/commit/8d24e05d6dd46aa94fe1acc166a01b182627da51))
* **eval:** update s03 to expect correct built-in auth login commands ([#283](https://github.com/google/chrome-enterprise-premium-mcp/issues/283)) ([c926f18](https://github.com/google/chrome-enterprise-premium-mcp/commit/c926f18a57918007db22abcdaffc975d927a689f))
* self-reference in devDependencies to resolve local npx failure ([#290](https://github.com/google/chrome-enterprise-premium-mcp/issues/290)) ([4fabd9a](https://github.com/google/chrome-enterprise-premium-mcp/commit/4fabd9a5b84e71cddbe3ff394461d996def4f6c9))
* support /apps prefix for fake licensing user endpoint ([#274](https://github.com/google/chrome-enterprise-premium-mcp/issues/274)) ([f20c3e5](https://github.com/google/chrome-enterprise-premium-mcp/commit/f20c3e5fad5ac784b6e666955bc4dc9ab075afe8))


### Documentation

* align knowledge summaries with actual document content ([#278](https://github.com/google/chrome-enterprise-premium-mcp/issues/278)) ([d32ebbc](https://github.com/google/chrome-enterprise-premium-mcp/commit/d32ebbcc90dbad4f7448e609269ba762e3a497f5))


### Tests

* **evals:** update deprecated model reference to gemini-3.1-flash-lite ([#281](https://github.com/google/chrome-enterprise-premium-mcp/issues/281)) ([a2e7139](https://github.com/google/chrome-enterprise-premium-mcp/commit/a2e713961f922e61309926996528785062ce4630))

## [1.7.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.6.0...chrome-enterprise-premium-mcp-v1.7.0) (2026-05-22)


### Features

* **auth:** boxed consent URL and Chrome activation on macOS ([#241](https://github.com/google/chrome-enterprise-premium-mcp/issues/241)) ([2af309e](https://github.com/google/chrome-enterprise-premium-mcp/commit/2af309e8489e5c5341ee846875b13bc14686d41f))
* **cep_auth:** name CEP MCP explicitly and disambiguate from Workspace MCP ([#231](https://github.com/google/chrome-enterprise-premium-mcp/issues/231)) ([b0436c7](https://github.com/google/chrome-enterprise-premium-mcp/commit/b0436c7c317e07328e3c1fdd24334f07a037b6c9))
* **constants:** add AUTH_STATUS and AUTH_NEXT_ACTION ([#230](https://github.com/google/chrome-enterprise-premium-mcp/issues/230)) ([52e7986](https://github.com/google/chrome-enterprise-premium-mcp/commit/52e798604cc64ec5ef104a67e2e34f35d1e9ae5f))


### Bug Fixes

* **auth:** cep_ prefix on auth_status/auth_clear; styled loopback pages ([#232](https://github.com/google/chrome-enterprise-premium-mcp/issues/232)) ([a1226ed](https://github.com/google/chrome-enterprise-premium-mcp/commit/a1226ed307c9f363da505df1420ddb5c674f4747))
* **auth:** OSC 8 hyperlink + own-line consent URL ([#244](https://github.com/google/chrome-enterprise-premium-mcp/issues/244)) ([a41b5cb](https://github.com/google/chrome-enterprise-premium-mcp/commit/a41b5cbb7dda8608cb597a6acfeaac8569b71e6b))
* **auth:** prevent mangled consent URLs by conditionally wrapping in OSC 8 ([#258](https://github.com/google/chrome-enterprise-premium-mcp/issues/258)) ([f7359a7](https://github.com/google/chrome-enterprise-premium-mcp/commit/f7359a7b1486cca8cf160998a4d8493ef12f7027))
* **auth:** route remediation through cli_invocation helper ([#242](https://github.com/google/chrome-enterprise-premium-mcp/issues/242)) ([7405975](https://github.com/google/chrome-enterprise-premium-mcp/commit/74059753607a689593d452f7e97794449a44121c))
* distinguish 1P auth project and target project for API enablement ([#267](https://github.com/google/chrome-enterprise-premium-mcp/issues/267)) ([64738f2](https://github.com/google/chrome-enterprise-premium-mcp/commit/64738f27d5c0b44c24b8aabe71b1efdaf3bfd87d))
* **evals:** seed synthetic valid token in evals runner for fake backend ([#254](https://github.com/google/chrome-enterprise-premium-mcp/issues/254)) ([72b40fd](https://github.com/google/chrome-enterprise-premium-mcp/commit/72b40fd0283396c26690b8fda62fcde54392abe3))


### Miscellaneous Chores

* **auth:** say "return to the agent" on loopback success page ([#260](https://github.com/google/chrome-enterprise-premium-mcp/issues/260)) ([17815c2](https://github.com/google/chrome-enterprise-premium-mcp/commit/17815c276d33bc19d23d8620a867fdfee36f2e5d))
* format gemini-extension.json ([#247](https://github.com/google/chrome-enterprise-premium-mcp/issues/247)) ([5bb9637](https://github.com/google/chrome-enterprise-premium-mcp/commit/5bb9637200fe42bd50982a25912f1d2d6b9aff60))
* remove unused Dockerfile ([#176](https://github.com/google/chrome-enterprise-premium-mcp/issues/176)) ([6c6c060](https://github.com/google/chrome-enterprise-premium-mcp/commit/6c6c060f65f33165653254ecb70401cef098b8a8))
* **test:** remove unused fetched URL tracker ([#249](https://github.com/google/chrome-enterprise-premium-mcp/issues/249)) ([e7bf61c](https://github.com/google/chrome-enterprise-premium-mcp/commit/e7bf61cd1f1de862573b2b4f82834c9e75b13722))
* **test:** use lastIndexOf for version range extraction ([#251](https://github.com/google/chrome-enterprise-premium-mcp/issues/251)) ([dd1e947](https://github.com/google/chrome-enterprise-premium-mcp/commit/dd1e947b6a9fc6453f6bcc4b615260fbd71be6cb))


### Code Refactoring

* **test:** extract synthetic-cache setup into a shared helper ([#229](https://github.com/google/chrome-enterprise-premium-mcp/issues/229)) ([a2ee827](https://github.com/google/chrome-enterprise-premium-mcp/commit/a2ee8275cd966cc07398988b2ee491b091cad87e))
* **test:** use synthetic token cache helper in evals runner ([#255](https://github.com/google/chrome-enterprise-premium-mcp/issues/255)) ([98d391d](https://github.com/google/chrome-enterprise-premium-mcp/commit/98d391d224fd4f5cefcb5cb1e45e2e0507450bc7))


### Tests

* cover createSseHandler null-principal path ([#250](https://github.com/google/chrome-enterprise-premium-mcp/issues/250)) ([800e49d](https://github.com/google/chrome-enterprise-premium-mcp/commit/800e49dbf413d5893f4ffc514b9ea45999fcbce1))

## [1.6.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.5.0...chrome-enterprise-premium-mcp-v1.6.0) (2026-05-18)


### Features

* **auth:** wrapper pre-flight + cep_auth tool for agent-led sign-in ([#211](https://github.com/google/chrome-enterprise-premium-mcp/issues/211)) ([9b75909](https://github.com/google/chrome-enterprise-premium-mcp/commit/9b75909a463185c6744594bd1ddd96c41533358c))
* proactive inline OAuth login and explicit auth tools ([#228](https://github.com/google/chrome-enterprise-premium-mcp/issues/228)) ([de946b1](https://github.com/google/chrome-enterprise-premium-mcp/commit/de946b18d42e197e13c99d0fcc543f51edcda171))


### Bug Fixes

* **ci:** format gemini-extension.json; widen lint-staged to JSON+YAML ([#225](https://github.com/google/chrome-enterprise-premium-mcp/issues/225)) ([e18b04b](https://github.com/google/chrome-enterprise-premium-mcp/commit/e18b04bd4c4e959dc2effb66f1a30b6e9bc55408))
* **ci:** install from public npm registry; only use Wombat for publish ([#221](https://github.com/google/chrome-enterprise-premium-mcp/issues/221)) ([e08f9fa](https://github.com/google/chrome-enterprise-premium-mcp/commit/e08f9fa6fc83925919494ef9b831fa6ccd86ffb0))
* **ci:** resolve zod v4 cache mismatch in daily evaluations ([#234](https://github.com/google/chrome-enterprise-premium-mcp/issues/234)) ([db8c5bc](https://github.com/google/chrome-enterprise-premium-mcp/commit/db8c5bce545ebe8f0c57b2a3bc098343a514d02d))
* reduce excessive output in get_customer_id tool ([#195](https://github.com/google/chrome-enterprise-premium-mcp/issues/195)) ([33b4d58](https://github.com/google/chrome-enterprise-premium-mcp/commit/33b4d58c5db9366e09a9e8a30844115cb79be643))


### Miscellaneous Chores

* **deps:** bump non-major deps; eslint 9 -&gt; 10; replace eslint-plugin-notice ([#217](https://github.com/google/chrome-enterprise-premium-mcp/issues/217)) ([c98509e](https://github.com/google/chrome-enterprise-premium-mcp/commit/c98509e9f38fb966b1dc0277b2ff9675206f238a))
* **deps:** upgrade zod 3 -&gt; 4; migrate to non-deprecated APIs ([#223](https://github.com/google/chrome-enterprise-premium-mcp/issues/223)) ([d69aeaa](https://github.com/google/chrome-enterprise-premium-mcp/commit/d69aeaa317c876e6b471c3597b38d1598f2abe42))
* **release-please:** include chore/ci/docs/refactor/test in changelog ([#227](https://github.com/google/chrome-enterprise-premium-mcp/issues/227)) ([1b3bdaf](https://github.com/google/chrome-enterprise-premium-mcp/commit/1b3bdafb9f3e9c5ab08898d4718d1dc808aca74f))


### Continuous Integration

* opt into Node 24 runner for JavaScript actions to resolve deprecation warning ([#220](https://github.com/google/chrome-enterprise-premium-mcp/issues/220)) ([6baf129](https://github.com/google/chrome-enterprise-premium-mcp/commit/6baf1299c57b4a4c2be5e8ff694ac1f7adf66e91))


### Tests

* add exact version matching check for gemini-extension.json ([#212](https://github.com/google/chrome-enterprise-premium-mcp/issues/212)) ([0c20660](https://github.com/google/chrome-enterprise-premium-mcp/commit/0c2066073d4de750d74726cdeba7731ffa4c5509))
* **knowledge:** stub axios in unit-suite knowledge_search tests ([#224](https://github.com/google/chrome-enterprise-premium-mcp/issues/224)) ([6cc2398](https://github.com/google/chrome-enterprise-premium-mcp/commit/6cc2398156516e6bb00f040813bbe7c11c3939c4))
* **sse:** stub req.on in createSseHandler principal-forwarding test ([#226](https://github.com/google/chrome-enterprise-premium-mcp/issues/226)) ([8c89c9f](https://github.com/google/chrome-enterprise-premium-mcp/commit/8c89c9f61eddd63161dd7f939ac99df5bdaf5101))

## [1.5.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.4.0...chrome-enterprise-premium-mcp-v1.5.0) (2026-05-15)


### Features

* **ci:** configure Kokoro CI testing and enable central release-please bot ([a56d114](https://github.com/google/chrome-enterprise-premium-mcp/commit/a56d1144c9f6ef495c93a752bcabada8d90f1397))
* **ci:** configure Kokoro CI testing and enable central release-please bot ([bf8baef](https://github.com/google/chrome-enterprise-premium-mcp/commit/bf8baef1b21ba100074e99991ada90218dc70b6a))
* **http:** plumb verified principal through getServer; add CEP_BEARER_PRINCIPAL_SUB lock ([1ea5904](https://github.com/google/chrome-enterprise-premium-mcp/commit/1ea5904f698045980f4f6e2e0d9bf46c11944fdd))
* **scripts:** add npm run auth:login and auth:status ([31dcd71](https://github.com/google/chrome-enterprise-premium-mcp/commit/31dcd7152fc0704d9743527800af7b1cd7199eff))
* **scripts:** add npm run auth:login and auth:status ([ab33a0c](https://github.com/google/chrome-enterprise-premium-mcp/commit/ab33a0c770ad293f78ba1853626de4139f4dba73))
* **server:** conditional enable_api tool registration by OAuth client source ([7027710](https://github.com/google/chrome-enterprise-premium-mcp/commit/702771018b067ec14912c6526a037c57119efdde))
* **server:** conditional enable_api tool registration by OAuth client source ([a8afeb2](https://github.com/google/chrome-enterprise-premium-mcp/commit/a8afeb218c36f16a2568bfc3d75e434776edc19b))


### Bug Fixes

* add configurable timeouts deep scanning guidance ([cc1e74f](https://github.com/google/chrome-enterprise-premium-mcp/commit/cc1e74f9787b71f90deebabd7ee6a16a32cc667f))
* add configurable timeouts deep scanning guidance ([c7cdfee](https://github.com/google/chrome-enterprise-premium-mcp/commit/c7cdfee940bf84cd3d1aece47274beeb5a0410e7))
* **api:** resolve Licensing API auth remediation bypass ([81ec908](https://github.com/google/chrome-enterprise-premium-mcp/commit/81ec908dd5c835414c063f2b001381244517e37c))
* **api:** resolve Licensing API auth remediation bypass ([9f29e46](https://github.com/google/chrome-enterprise-premium-mcp/commit/9f29e46a43109b97259265404976753f1d529a92))
* **auth:** trim CEP_IMPERSONATE_SUBJECT; document jwtCache mutation assumption ([59ac1f3](https://github.com/google/chrome-enterprise-premium-mcp/commit/59ac1f3aa7906fa4ddb46c30780337c8566a14db))
* **commitlint:** disable body-max-line-length ([1283a79](https://github.com/google/chrome-enterprise-premium-mcp/commit/1283a79dd423a1acfc1ebdde9cf2cae0ea264375))
* **commitlint:** disable body-max-line-length ([be2b980](https://github.com/google/chrome-enterprise-premium-mcp/commit/be2b9802fafca02e344b91b7bfc22063cdbf8f7b))
* **evals:** update agent model and add catastrophic-failure alarm ([b2e6f63](https://github.com/google/chrome-enterprise-premium-mcp/commit/b2e6f63e17b9f0d38520209f2fa946725672c55e))
* **evals:** update agent model and add catastrophic-failure alarm ([a85fe47](https://github.com/google/chrome-enterprise-premium-mcp/commit/a85fe4790f8e06f54e75bff8c37d574c8ace7a70))
* **tools:** drop regex check for service-management host (CodeQL js/incomplete-hostname-regexp) ([9db53fd](https://github.com/google/chrome-enterprise-premium-mcp/commit/9db53fd7f93be3eb3bf88b8baade92b1b6ed0d1a))

## [1.4.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.3.0...chrome-enterprise-premium-mcp-v1.4.0) (2026-05-08)


### Features

* **auth:** add mcp auth login plus OAuth token-cache fallback for ADC ([90a6fc3](https://github.com/google/chrome-enterprise-premium-mcp/commit/90a6fc33d8e3972c7ae0e785650b946469e363b0))
* **auth:** fall back to OAuth token cache when ADC is unavailable ([0585062](https://github.com/google/chrome-enterprise-premium-mcp/commit/05850620ea1af4864cb14152f74fb95aafd815d2))
* **auth:** verify inbound bearer ID tokens via CEP_BEARER_AUDIENCE ([83e6d80](https://github.com/google/chrome-enterprise-premium-mcp/commit/83e6d80c47a209a0f05f7af3a78bfab44cbefc11))
* **auth:** verify inbound bearer ID tokens via CEP_BEARER_AUDIENCE ([cb90fea](https://github.com/google/chrome-enterprise-premium-mcp/commit/cb90feaf023985cdaf70c555b5acacca8f7dfc65))
* **constants:** add MANAGED_OAUTH_CLIENT_* placeholder constants ([0905755](https://github.com/google/chrome-enterprise-premium-mcp/commit/0905755b49382a5aead89d704daeb6d2f21b9c3e))
* **credential:** add OAuth login flow, token cache, CLI dispatcher ([49b5c3e](https://github.com/google/chrome-enterprise-premium-mcp/commit/49b5c3eef4ba41a25cdc45527c0c5b0df583a28a))
* deduplicate diagnostic issues and improve remediation ([253190d](https://github.com/google/chrome-enterprise-premium-mcp/commit/253190d235240e41bad78d8ae31ebc854e8f4f69))
* enforce log-driven diagnostics for security assessments ([4ecc508](https://github.com/google/chrome-enterprise-premium-mcp/commit/4ecc50892328607be30c248c523c6ab48f4a7dd5))
* **evals:** add eval-as-code loader alongside markdown ([c50379e](https://github.com/google/chrome-enterprise-premium-mcp/commit/c50379e1ab0bb6462eab4f01475a92cf804feb7a))
* **evals:** auto-open or update a tracking issue on drift ([ef651f3](https://github.com/google/chrome-enterprise-premium-mcp/commit/ef651f3746790234cc679ae4045f72239d348f95))
* **evals:** loosen global forbidden patterns for API field names ([33a5867](https://github.com/google/chrome-enterprise-premium-mcp/commit/33a5867e6b80db6be686c85d076ee7a80098682b))
* **evals:** scheduled workflow with transient-error classification ([3902560](https://github.com/google/chrome-enterprise-premium-mcp/commit/3902560266652e43d39c487cda56ccbebb4b9ef1))
* **evals:** scheduled workflow with transient-error classification ([64d7942](https://github.com/google/chrome-enterprise-premium-mcp/commit/64d79427edf7e3c2342001ebc962bae09adb82ca))
* **evals:** support environment feature flags in eval runner [3/4] ([d4e8d54](https://github.com/google/chrome-enterprise-premium-mcp/commit/d4e8d548a218b7a15e6a8f9145c3a29b4bc86954))
* **evals:** support per-eval experiment overrides ([b6d60c0](https://github.com/google/chrome-enterprise-premium-mcp/commit/b6d60c0dbf7aa02f917a4b697427df0d5de9f705))
* **evals:** support per-eval experiment overrides ([4c72b9b](https://github.com/google/chrome-enterprise-premium-mcp/commit/4c72b9bd9d7aef4559daa0a3ce400323a1fe9af5))
* implement Security Posture Guide and proactive log-based recommendations ([b6fb2b7](https://github.com/google/chrome-enterprise-premium-mcp/commit/b6fb2b76893a5e33bf6bef9e8fe23db0030697e0))
* **infra:** add centralized feature flag logging [2/4] ([9ee0037](https://github.com/google/chrome-enterprise-premium-mcp/commit/9ee0037771439c8f301ebc30d1c432997d03dbc7))
* **infra:** startup banner + details ([437d190](https://github.com/google/chrome-enterprise-premium-mcp/commit/437d190c3302786aab1950d8c17d6b065c0b150c))
* **knowledge:** enrich document summaries [4/4] ([454e8bb](https://github.com/google/chrome-enterprise-premium-mcp/commit/454e8bb542d0519a5ae65a44e7498ce938c14ad9))
* **knowledge:** gate search and list tools behind flag [1/4] ([08cc1fe](https://github.com/google/chrome-enterprise-premium-mcp/commit/08cc1fe549105c2a1f839055d5dc94087215a975))
* **local:** put diagnose_environment behind feature flag (default enabled) ([116bbaa](https://github.com/google/chrome-enterprise-premium-mcp/commit/116bbaa4c10a4fa12e74cb2ff8046ab975947c70))
* **local:** put diagnose_environment behind feature flag (default ENABLED) ([a3ee05d](https://github.com/google/chrome-enterprise-premium-mcp/commit/a3ee05de12421fc6525afcd25dcc2284de7ba9e0))
* **login:** highlight the headless 404 path in red ([6fcaaa0](https://github.com/google/chrome-enterprise-premium-mcp/commit/6fcaaa0c9362e0b4f4815abc175438430395937b))
* **mcp:** improve server startup output and handle ports dynamically ([85a216f](https://github.com/google/chrome-enterprise-premium-mcp/commit/85a216f9f46d20fb374a0052dc598959212a2cc9))
* polish user-facing security warnings ([6236a87](https://github.com/google/chrome-enterprise-premium-mcp/commit/6236a875cda810d41e44c1b89bdf1e650bc4e792))
* **release:** bump gemini-extension.json version in lockstep via release-please extra-files ([3172b2c](https://github.com/google/chrome-enterprise-premium-mcp/commit/3172b2c64f7df7afd4d69bf81879966da57f010f))
* remove cep_feedback tool and cep:feedback prompt ([b49370b](https://github.com/google/chrome-enterprise-premium-mcp/commit/b49370b42e8d3ec3ed2314be0a18f6d5e0131d06))
* **scopes:** split OAUTH_SCOPES from the ADC default; drop cloud-platform ([bee8394](https://github.com/google/chrome-enterprise-premium-mcp/commit/bee83941c14535a78357b53151cd2efbbece3f48))
* **scopes:** split OAUTH_SCOPES; drop cloud-platform from OAuth-flow consent ([50765b0](https://github.com/google/chrome-enterprise-premium-mcp/commit/50765b01509106e7e509e3b717ad20e781c8746a))
* use shared connector analysis in diagnose_environment ([73abbd7](https://github.com/google/chrome-enterprise-premium-mcp/commit/73abbd7f73ce7d2d8558c9dccc3eb35f2347aa7f))


### Bug Fixes

* **api:** drop dead initial detectorType assignment ([552074d](https://github.com/google/chrome-enterprise-premium-mcp/commit/552074d4046a6ac4df9fdab058d70936609f9f25))
* **api:** drop dead initial detectorType assignment ([69de778](https://github.com/google/chrome-enterprise-premium-mcp/commit/69de77807bf404e1429820511dada3e6cf33ef6c))
* **auth:** await getAuthErrorMessage at the two call sites ([37768bc](https://github.com/google/chrome-enterprise-premium-mcp/commit/37768bc92577b12efbbabe092aaf8b572b46ab4a))
* **auth:** await getAuthErrorMessage in the OAuth-cache fallback ([e3d23f7](https://github.com/google/chrome-enterprise-premium-mcp/commit/e3d23f7e92b1f05eb2c54a33886a7139cb48e8b9))
* **auth:** clarify the CEP_BEARER_AUDIENCE-unset startup warning ([a1614eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/a1614eb582e31c3007067683995962808118598f))
* **auth:** refuse to load OAuth token cache when its mode is loose ([a15d1fd](https://github.com/google/chrome-enterprise-premium-mcp/commit/a15d1fd93de1a4a3845bda6e711286633eb75736))
* block-scoping bug for authToken variable ([edf7299](https://github.com/google/chrome-enterprise-premium-mcp/commit/edf7299eb3b7b1b4baa936dc5b820176863ca551))
* **check_and_enable_cep_api:** branch on LRO error, done, and unknown shape ([93e3ce6](https://github.com/google/chrome-enterprise-premium-mcp/commit/93e3ce62ebc4a7e58eba94480a363d02db724cb2))
* **check_and_enable_cep_api:** make ENABLING summary actionable and drop "unknown" operation literal ([47a790d](https://github.com/google/chrome-enterprise-premium-mcp/commit/47a790dc0086462f76ce7cef159664407ee40048))
* **check_and_enable_cep_api:** match Service Usage host with anchored regex ([60c65d0](https://github.com/google/chrome-enterprise-premium-mcp/commit/60c65d05a7e47fea8b8c2a3ab3c0ce55ce1d89bc))
* **chrome-management:** add authToken to base interface signatures ([5d21871](https://github.com/google/chrome-enterprise-premium-mcp/commit/5d218719d18fe43d89504d6e55987796a8d75423))
* **chrome-management:** thread authToken through countBrowserVersions and listCustomerProfiles ([498ba3f](https://github.com/google/chrome-enterprise-premium-mcp/commit/498ba3f6da5b1b824c68b65dc9652b8707fad670))
* **chrome-management:** thread authToken through countBrowserVersions and listCustomerProfiles ([1a3f420](https://github.com/google/chrome-enterprise-premium-mcp/commit/1a3f42002035a3ee4f4552f866bb91255a287522)), closes [#126](https://github.com/google/chrome-enterprise-premium-mcp/issues/126)
* **ci:** tolerate grep no-match exit in test-budget tripwire ([a22af6b](https://github.com/google/chrome-enterprise-premium-mcp/commit/a22af6b70e7e7a8e7bf851251e8018233208b5a0))
* **delete_agent_dlp_rule:** drop redundant policies.get before delete ([5ccfa94](https://github.com/google/chrome-enterprise-premium-mcp/commit/5ccfa94eb7116f7b6cb3872ca504362ce23dc037))
* **delete_agent_dlp_rule:** drop redundant policies.get before delete ([3a643ce](https://github.com/google/chrome-enterprise-premium-mcp/commit/3a643ce6d6983255833a7272f98b9d9a2bfaf161)), closes [#132](https://github.com/google/chrome-enterprise-premium-mcp/issues/132)
* **eval:** align K06 privilege names with source ([19a1248](https://github.com/google/chrome-enterprise-premium-mcp/commit/19a1248d1b48fc97b6ae9ef63a00c79e04031f84))
* **eval:** align K07 role names with source ([489d582](https://github.com/google/chrome-enterprise-premium-mcp/commit/489d5826d0c203dbf7d428ffea6f5a82f6988715))
* **eval:** relax k07 role name requirements ([a654283](https://github.com/google/chrome-enterprise-premium-mcp/commit/a6542834ee788a5bda307becb94d9acd0a576e83))
* **evals/run:** align concurrency default with help text; restore priority-filter check ([f611ee3](https://github.com/google/chrome-enterprise-premium-mcp/commit/f611ee3aecc6e63527b2fe943e456dcc29fcf4ad))
* **evals/run:** align concurrency default with help text; restore priority-filter check ([402bfaa](https://github.com/google/chrome-enterprise-premium-mcp/commit/402bfaa8f1a136be97981359b96562cdc42df0fe))
* **evals:** anchor judge PASS detection so negations don't slip through ([cc2b6d7](https://github.com/google/chrome-enterprise-premium-mcp/commit/cc2b6d7f47d6f40a2cbc9834970fb6cff36e4aac))
* **evals:** anchor judge PASS detection so negations don't slip through ([ca344b2](https://github.com/google/chrome-enterprise-premium-mcp/commit/ca344b23f4b78f13c6329fea85ca2baed84c5eed))
* **evals:** default EXPERIMENT_DELETE_TOOL_ENABLED=true so m03 tests real agent behavior ([27f6fe7](https://github.com/google/chrome-enterprise-premium-mcp/commit/27f6fe7e0b99fe0e48fab40488d194bd68758bd4))
* **evals:** default EXPERIMENT_DELETE_TOOL_ENABLED=true so m03 tests real agent behavior ([0aa6203](https://github.com/google/chrome-enterprise-premium-mcp/commit/0aa62030e92284471e82545afe249a3cdd7653bd))
* **evals:** ensure agent sees all tool content parts ([63e2391](https://github.com/google/chrome-enterprise-premium-mcp/commit/63e23914d8f848ef1bde51b1a2d168dc7cb45669))
* **evals:** include experiments field in eval-as-code loader ([deb9a39](https://github.com/google/chrome-enterprise-premium-mcp/commit/deb9a396adedb8acec8dea45d8332284794d4ea6))
* **evals:** move m02 to create_chrome_dlp_rule, add real connector-enablement case ([c09199f](https://github.com/google/chrome-enterprise-premium-mcp/commit/c09199f539f7730903f9c7dd8d4f214f6f3f1441))
* **evals:** move m02 to create_chrome_dlp_rule, add real connector-enablement case ([0d520eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/0d520ebc509f45fbfad2b43edd6e62e5c171dded))
* **evals:** reject cases that set both fixtures and scenario ([dc9d7f9](https://github.com/google/chrome-enterprise-premium-mcp/commit/dc9d7f9dd40a767a431ccd45a384d53115d52a9f))
* **evals:** reject cases that set both fixtures and scenario ([b943bac](https://github.com/google/chrome-enterprise-premium-mcp/commit/b943bac1bdcd223cc36889ee8f1b5ac62eaff1b8))
* **evals:** rewrite "soft FAIL" rubrics as binary pass/fail ([35e1733](https://github.com/google/chrome-enterprise-premium-mcp/commit/35e1733d7a3bf87abb9fa1f18a980b40a24d643b))
* **evals:** skip tool check in --dry-run instead of asserting expected==expected ([0b15b65](https://github.com/google/chrome-enterprise-premium-mcp/commit/0b15b65ca8e7a67f7352d9672b10287adf0769bc))
* **evals:** skip tool check in --dry-run instead of asserting expected==expected ([9fb9dea](https://github.com/google/chrome-enterprise-premium-mcp/commit/9fb9dea30089a4c78fb87e653d8aebfe54b23af0))
* **evals:** tighten P0-priority detection and Gemini options arg ([770602d](https://github.com/google/chrome-enterprise-premium-mcp/commit/770602d135b910dc2b46d508e60f6c933989c0b3))
* **evals:** tighten P0-priority detection and Gemini options arg ([7e6eb83](https://github.com/google/chrome-enterprise-premium-mcp/commit/7e6eb83fd1ab50a5a103fe1fd00a1e734ce8a2aa))
* **eval:** update evaluator knowledge accuracy and remove non-CEP eval ([a129d05](https://github.com/google/chrome-enterprise-premium-mcp/commit/a129d05f542b010a3cacfcee5f6bb82912468d47))
* **get_connector_policy:** align tool response with declared outputSchema ([235f5f5](https://github.com/google/chrome-enterprise-premium-mcp/commit/235f5f5ef53fd6cca7fb83bf161abac5a47e897c))
* **get_connector_policy:** align tool response with declared outputSchema ([473f5b8](https://github.com/google/chrome-enterprise-premium-mcp/commit/473f5b8e4ff14bed0a25206932eb9d749411ba19)), closes [#20](https://github.com/google/chrome-enterprise-premium-mcp/issues/20)
* **get_connector_policy:** replace stale item schema; declare configured ([68d8d39](https://github.com/google/chrome-enterprise-premium-mcp/commit/68d8d39a6f57d700e8babb48b3fa28c17c587274))
* **knowledge:** replace regex HTML stripper with cheerio parser ([590d752](https://github.com/google/chrome-enterprise-premium-mcp/commit/590d752ed2896f9ebb3c7fb36af7fd0a330c4c76))
* **knowledge:** tolerate junk inside closing tags so CodeQL bad-tag-filter passes ([ccdea0c](https://github.com/google/chrome-enterprise-premium-mcp/commit/ccdea0c67670906a616548da4a9582afbc01793b))
* **mcp-server:** defer startup banner until the assigned port is known ([43376da](https://github.com/google/chrome-enterprise-premium-mcp/commit/43376da308891ef44e4085e0502f9a8dab42436e))
* **mcp-server:** defer startup banner until the assigned port is known ([50282dc](https://github.com/google/chrome-enterprise-premium-mcp/commit/50282dc458c9bb83f12d6ca295721eb277ad0109))
* **mcp-server:** return well-formed JSON-RPC errors on transport endpoints ([0746eae](https://github.com/google/chrome-enterprise-premium-mcp/commit/0746eae6c25c687f05b4346467a103d17ac25de0))
* **mcp-server:** SSE server-instance leak, var-name clarity, missing sessionId in 400 ([3f61e77](https://github.com/google/chrome-enterprise-premium-mcp/commit/3f61e770dfc9a35d82047f020e98946f8ee1a274))
* **mcp-server:** SSE server-instance leak, var-name clarity, missing sessionId in 400 ([7ceead1](https://github.com/google/chrome-enterprise-premium-mcp/commit/7ceead1f5ca21541857894a489bbd233ad1f5e8a))
* proactively report and remediate auth errors ([072f26e](https://github.com/google/chrome-enterprise-premium-mcp/commit/072f26e5e4ab5767568e4da4d22eb06bd66b6f35))
* **prompts:** cep:health leads with the top finding ([ff4f728](https://github.com/google/chrome-enterprise-premium-mcp/commit/ff4f728aaa7f473efe47a8cd6ab4e9a762df6097))
* **prompts:** cep:health leads with the top finding ([#14](https://github.com/google/chrome-enterprise-premium-mcp/issues/14)) ([a0645c1](https://github.com/google/chrome-enterprise-premium-mcp/commit/a0645c1e837aafd4a93cbdf142ce8403ce39e448))
* **prompts:** cep:optimize leads with what the logs show ([1710da2](https://github.com/google/chrome-enterprise-premium-mcp/commit/1710da29c294c7a8a91caef1b4e74080876ef5ab))
* **prompts:** cep:optimize leads with what the logs show ([#15](https://github.com/google/chrome-enterprise-premium-mcp/issues/15)) ([c7b7df4](https://github.com/google/chrome-enterprise-premium-mcp/commit/c7b7df4108e21daaed394ea7057c0b84da525ccc))
* **prompts:** drop orphan '3.' from SHARED_DIAGNOSTIC_RULES ([35e310c](https://github.com/google/chrome-enterprise-premium-mcp/commit/35e310c9f768fc9e3d8dac1579c03f17ebc881e1))
* **prompts:** drop orphan '3.' from SHARED_DIAGNOSTIC_RULES ([20f7e66](https://github.com/google/chrome-enterprise-premium-mcp/commit/20f7e66d13a96b1216081d326ce22ed7099f6f10))
* **release:** include README files in snapshot, force LC_ALL=C sort for cross-machine determinism ([a1494db](https://github.com/google/chrome-enterprise-premium-mcp/commit/a1494db15d3ed614b044a09b49d151a68c21e6f6))
* resolve path typos and mock dependencies to fix presubmits ([907cdc7](https://github.com/google/chrome-enterprise-premium-mcp/commit/907cdc7c7e14dfc848003dac9545902034a380d5))
* Resolve syntax error and missing import in knowledge tools ([d203eb8](https://github.com/google/chrome-enterprise-premium-mcp/commit/d203eb83d8081677ab807ded3ad2836d687a4ec1))
* **scripts:** cover prompt/boundary/licensing eval categories and run integration in npm test ([b57497c](https://github.com/google/chrome-enterprise-premium-mcp/commit/b57497cfae9bf2aafa0a57cb33f2aafb8a8bbd1d))
* **scripts:** cover prompt/boundary/licensing eval categories and run integration in npm test ([bc8caee](https://github.com/google/chrome-enterprise-premium-mcp/commit/bc8caee82e45ee81dcdeabf3dc4bde7b68d3a5c9))
* **security:** address CodeQL alerts across regex/URL/proto handling ([cd50c2f](https://github.com/google/chrome-enterprise-premium-mcp/commit/cd50c2f9d2da80fd9952eaf753e4ed73dc0eccb8))
* **security:** address CodeQL alerts across regex/URL/proto handling ([8625ef2](https://github.com/google/chrome-enterprise-premium-mcp/commit/8625ef242700dfdc0dfdbacc138e711e6c563b20))
* **security:** close CodeQL alert [#33](https://github.com/google/chrome-enterprise-premium-mcp/issues/33) by null-proto'ing top-level state maps ([d55c336](https://github.com/google/chrome-enterprise-premium-mcp/commit/d55c3365dbf8d5269751d66bd31b8f5ae3611ed6))
* **security:** resolve remaining CodeQL alerts in test fixtures ([3288945](https://github.com/google/chrome-enterprise-premium-mcp/commit/32889454377157c6ce820418a6ca1222367bd0de))
* **security:** resolve remaining CodeQL alerts in test fixtures ([68173a8](https://github.com/google/chrome-enterprise-premium-mcp/commit/68173a8525330b94f11bb5eaf316b6b3a9f589dc))
* **server:** handle SIGTERM for graceful Cloud Run shutdown ([d23a082](https://github.com/google/chrome-enterprise-premium-mcp/commit/d23a08229d96f8a3a2b87e5d73379acacea01075))
* **server:** handle SIGTERM for graceful Cloud Run shutdown ([5beb89f](https://github.com/google/chrome-enterprise-premium-mcp/commit/5beb89fbef0c6f912f9b1dec3324d690cf947fdd))
* **server:** scope session state per HTTP request ([49218fe](https://github.com/google/chrome-enterprise-premium-mcp/commit/49218fedf8ad17efa452b8b4e14a4016ba32b097))
* **server:** scope session state per HTTP request to prevent cross-customer leak ([bb71813](https://github.com/google/chrome-enterprise-premium-mcp/commit/bb71813a17f91548474ad02a21bfce782338e3bc))
* **server:** wrap /sse handler in try/catch ([25ec2a7](https://github.com/google/chrome-enterprise-premium-mcp/commit/25ec2a782a9a0e5173c76b75d8e6110f30d1c071))
* **server:** wrap /sse handler in try/catch so failures terminate the response ([b15f318](https://github.com/google/chrome-enterprise-premium-mcp/commit/b15f3189b1bcfc0b79514796aec4dbf19d41266b))
* **test/fake-api-server:** guard customerId in licenses fixture merge ([ece3b95](https://github.com/google/chrome-enterprise-premium-mcp/commit/ece3b95072eb28fa9f2c1ff9bb06c258644acd25))
* **test/scenarios:** derive serviceUsage seed from SERVICE_NAMES ([348a762](https://github.com/google/chrome-enterprise-premium-mcp/commit/348a7622b6c75c28bc1ccd6ea06bc7fe9ddbe2cc))
* **test/scenarios:** seed connectorPolicies and serviceUsage in eval base state ([23b83c4](https://github.com/google/chrome-enterprise-premium-mcp/commit/23b83c43a3c7953afd586278db5f74f8ed1a05bc))
* **test/scenarios:** seed connectorPolicies and serviceUsage in eval base state ([aa9484d](https://github.com/google/chrome-enterprise-premium-mcp/commit/aa9484d8f294c6b33c8e118d9c4e5e50ebc836de))
* **test:** skip ADC probe in startup-log tests to eliminate 8s race with 12s spawnSync timeout ([9781db5](https://github.com/google/chrome-enterprise-premium-mcp/commit/9781db54a2124f9632c42877b3deed6f4f497da8))
* **test:** skip ADC probe in startup-log tests to eliminate flaky timing race ([aff1070](https://github.com/google/chrome-enterprise-premium-mcp/commit/aff107070c4becc68c05ec121b96d06815a31c07))
* **test:** use 'value' key in fake RealtimeUrlCheck to match other connectors and the real API ([d91b047](https://github.com/google/chrome-enterprise-premium-mcp/commit/d91b04711f2c3a45f9763f72a460b2f95e101865))
* **test:** use 'value' key in fake RealtimeUrlCheck to match other connectors and the real API ([ea0af4c](https://github.com/google/chrome-enterprise-premium-mcp/commit/ea0af4c722cb8454622aa2c1a89f2b0b897c3c4d))
* **tools:** distinguish 404 from transient errors in delete_agent_dlp_rule ([254c7eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/254c7eb818ecc3fe379166decc8af934783a0f16))
* **tools:** distinguish 404 from transient errors in delete_agent_dlp_rule pre-fetch ([e975021](https://github.com/google/chrome-enterprise-premium-mcp/commit/e9750215a4092180abc834a7fcecb89804813017))
* **tools:** don't claim API ENABLED before the long-running enable completes ([8c0f80f](https://github.com/google/chrome-enterprise-premium-mcp/commit/8c0f80f02bade05624da093f2654e207b17a77c3))
* **tools:** don't claim ENABLED before the long-running enable completes ([6967397](https://github.com/google/chrome-enterprise-premium-mcp/commit/6967397c6ee8d237f0173b61c5e896585278e4ff))
* **tools:** drop chained .describe() on orgUnitId in SEB tools ([4a8eaec](https://github.com/google/chrome-enterprise-premium-mcp/commit/4a8eaec2b4fea60081187a5ee16bf47425a83440))
* **tools:** drop chained .describe() on orgUnitId in SEB tools ([68b7c73](https://github.com/google/chrome-enterprise-premium-mcp/commit/68b7c73f24e94039b544319ba4a45794921230da))
* **tools:** let list_customer_profiles surface auth errors ([9a76b65](https://github.com/google/chrome-enterprise-premium-mcp/commit/9a76b6586b700337439f3bbb1e0f639d49aa427f))
* **tools:** let list_customer_profiles surface auth errors ([ed8a4ea](https://github.com/google/chrome-enterprise-premium-mcp/commit/ed8a4ea451a34d8aaebdfe218b6c40365f954b07))
* **tools:** propagate auth errors in all relevant tools ([863335b](https://github.com/google/chrome-enterprise-premium-mcp/commit/863335b9caffb3fa626ee6a773414978bab48297))
* **tools:** sanitize raw API trigger strings in list_dlp_rules summary ([ad7d796](https://github.com/google/chrome-enterprise-premium-mcp/commit/ad7d7968b122062b6467fe725c8338f3afed1897))
* **tools:** set skipAutoResolve on tools that don't take customerId ([1ad843f](https://github.com/google/chrome-enterprise-premium-mcp/commit/1ad843fcaeb0a3285fbfa22aca2a7eefd408a305))
* **tools:** set skipAutoResolve on tools that don't take customerId ([256b73b](https://github.com/google/chrome-enterprise-premium-mcp/commit/256b73bb41127cc8f29f73204cb041bbb9a2e700))
* **util:** add 3s timeout to checkGCP metadata probe ([51c5d4d](https://github.com/google/chrome-enterprise-premium-mcp/commit/51c5d4de7ea8214990f8d047bc14c57497d0f959))
* **util:** add 3s timeout to checkGCP metadata probe ([4026e5a](https://github.com/google/chrome-enterprise-premium-mcp/commit/4026e5a73e3e6d5ff4a82c946a739eaf866c4f58))
* **util:** derive ADC scope lists from SCOPES constant in both remediation paths ([89f7a98](https://github.com/google/chrome-enterprise-premium-mcp/commit/89f7a98b7caa56dd9bc4803eb17c7e79dffa5946))
* **util:** derive ADC scope lists from SCOPES constant in both remediation paths ([b50547b](https://github.com/google/chrome-enterprise-premium-mcp/commit/b50547b13a35dca9019b09aa7034a6c7f6f1173b))
* **util:** make gcloud quota-project probe async with per-call timeout ([660fe64](https://github.com/google/chrome-enterprise-premium-mcp/commit/660fe64a21e7db3a16a0aaf63837ff0d240c5745))
* **util:** make gcloud quota-project probe async with per-call timeout ([08631b7](https://github.com/google/chrome-enterprise-premium-mcp/commit/08631b79be72e69ecc1a9670adbe80177cdec065))
* **util:** surface PERMISSION_DENIED immediately ([99174b8](https://github.com/google/chrome-enterprise-premium-mcp/commit/99174b8f0b45af4b9eb7c587ca0aeb7ae0b61c9e))
* **util:** surface PERMISSION_DENIED immediately instead of retrying for 78s ([493495f](https://github.com/google/chrome-enterprise-premium-mcp/commit/493495f4c303ebaecb5f1634ef5af7e992b80e80))
* **wrapper:** propagate customerId auto-resolve errors ([76a9de9](https://github.com/google/chrome-enterprise-premium-mcp/commit/76a9de9c6e0e4c729bd81f178b3e2a816a7a029e))
* **wrapper:** propagate customerId auto-resolve errors so auth remediation fires ([6425c51](https://github.com/google/chrome-enterprise-premium-mcp/commit/6425c51f9da5de8e151cd994b7dbcf770d9f148d))

## [1.3.0](https://github.com/google/chrome-enterprise-premium-mcp/compare/chrome-enterprise-premium-mcp-v1.2.0...chrome-enterprise-premium-mcp-v1.3.0) (2026-05-05)

### Features

- add cep:diagnose prompt evals ([2013f80](https://github.com/google/chrome-enterprise-premium-mcp/commit/2013f80b0384a1710113ba653720e939f17f7aef))
- add cep:feedback prompt eval ([b05a6e4](https://github.com/google/chrome-enterprise-premium-mcp/commit/b05a6e4a2d9a7b555cd8404d9767360668246ab7))
- add diagnose_environment tool ([1c4dbcb](https://github.com/google/chrome-enterprise-premium-mcp/commit/1c4dbcbd617319fba327b6e10e6967e785d84d07))
- add eval scenario infrastructure for per-eval fake server state ([0bbaff0](https://github.com/google/chrome-enterprise-premium-mcp/commit/0bbaff0b871ca0e8bf709d88320d6a7367e6aab7))
- **auth:** add mcp auth login plus OAuth token-cache fallback for ADC ([90a6fc3](https://github.com/google/chrome-enterprise-premium-mcp/commit/90a6fc33d8e3972c7ae0e785650b946469e363b0))
- **auth:** fall back to OAuth token cache when ADC is unavailable ([0585062](https://github.com/google/chrome-enterprise-premium-mcp/commit/05850620ea1af4864cb14152f74fb95aafd815d2))
- **auth:** verify inbound bearer ID tokens via CEP_BEARER_AUDIENCE ([83e6d80](https://github.com/google/chrome-enterprise-premium-mcp/commit/83e6d80c47a209a0f05f7af3a78bfab44cbefc11))
- **auth:** verify inbound bearer ID tokens via CEP_BEARER_AUDIENCE ([cb90fea](https://github.com/google/chrome-enterprise-premium-mcp/commit/cb90feaf023985cdaf70c555b5acacca8f7dfc65))
- **constants:** add MANAGED*OAUTH_CLIENT*\* placeholder constants ([0905755](https://github.com/google/chrome-enterprise-premium-mcp/commit/0905755b49382a5aead89d704daeb6d2f21b9c3e))
- **credential:** add OAuth login flow, token cache, CLI dispatcher ([49b5c3e](https://github.com/google/chrome-enterprise-premium-mcp/commit/49b5c3eef4ba41a25cdc45527c0c5b0df583a28a))
- deduplicate diagnostic issues and improve remediation ([253190d](https://github.com/google/chrome-enterprise-premium-mcp/commit/253190d235240e41bad78d8ae31ebc854e8f4f69))
- **eval:** add all-connectors-disabled scenario and eval ([e6d2b04](https://github.com/google/chrome-enterprise-premium-mcp/commit/e6d2b0483495f91868ec24b81d7ef737e752f597))
- **eval:** add multi-event DLP activity fixture and eval ([6e731a0](https://github.com/google/chrome-enterprise-premium-mcp/commit/6e731a0ffa21b65afc712c0f2d47b3cab031fb46))
- **eval:** add no-detectors scenario and eval ([f337dfc](https://github.com/google/chrome-enterprise-premium-mcp/commit/f337dfc442613e458030e49516d431283a5a594f))
- **eval:** add outdated browser versions scenario and eval ([7c059e7](https://github.com/google/chrome-enterprise-premium-mcp/commit/7c059e77278493b3de6d306dcb3a86f9ad7bc6f8))
- **evals:** loosen global forbidden patterns for API field names ([33a5867](https://github.com/google/chrome-enterprise-premium-mcp/commit/33a5867e6b80db6be686c85d076ee7a80098682b))
- **evals:** support environment feature flags in eval runner [3/4] ([d4e8d54](https://github.com/google/chrome-enterprise-premium-mcp/commit/d4e8d548a218b7a15e6a8f9145c3a29b4bc86954))
- implement Security Posture Guide and proactive log-based recommendations ([b6fb2b7](https://github.com/google/chrome-enterprise-premium-mcp/commit/b6fb2b76893a5e33bf6bef9e8fe23db0030697e0))
- **infra:** add centralized feature flag logging [2/4] ([9ee0037](https://github.com/google/chrome-enterprise-premium-mcp/commit/9ee0037771439c8f301ebc30d1c432997d03dbc7))
- **infra:** startup banner + details ([437d190](https://github.com/google/chrome-enterprise-premium-mcp/commit/437d190c3302786aab1950d8c17d6b065c0b150c))
- **knowledge:** enrich document summaries [4/4] ([454e8bb](https://github.com/google/chrome-enterprise-premium-mcp/commit/454e8bb542d0519a5ae65a44e7498ce938c14ad9))
- **knowledge:** gate search and list tools behind flag [1/4] ([08cc1fe](https://github.com/google/chrome-enterprise-premium-mcp/commit/08cc1fe549105c2a1f839055d5dc94087215a975))
- **login:** highlight the headless 404 path in red ([6fcaaa0](https://github.com/google/chrome-enterprise-premium-mcp/commit/6fcaaa0c9362e0b4f4815abc175438430395937b))
- **mcp:** improve server startup output and handle ports dynamically ([85a216f](https://github.com/google/chrome-enterprise-premium-mcp/commit/85a216f9f46d20fb374a0052dc598959212a2cc9))
- polish user-facing security warnings ([6236a87](https://github.com/google/chrome-enterprise-premium-mcp/commit/6236a875cda810d41e44c1b89bdf1e650bc4e792))
- **release:** bump gemini-extension.json version in lockstep via release-please extra-files ([3172b2c](https://github.com/google/chrome-enterprise-premium-mcp/commit/3172b2c64f7df7afd4d69bf81879966da57f010f))
- remove cep_feedback tool and cep:feedback prompt ([b49370b](https://github.com/google/chrome-enterprise-premium-mcp/commit/b49370b42e8d3ec3ed2314be0a18f6d5e0131d06))
- **scopes:** split OAUTH_SCOPES from the ADC default; drop cloud-platform ([bee8394](https://github.com/google/chrome-enterprise-premium-mcp/commit/bee83941c14535a78357b53151cd2efbbece3f48))
- **scopes:** split OAUTH_SCOPES; drop cloud-platform from OAuth-flow consent ([50765b0](https://github.com/google/chrome-enterprise-premium-mcp/commit/50765b01509106e7e509e3b717ad20e781c8746a))
- **test:** add pagination to fake Cloud Identity list response ([2e67318](https://github.com/google/chrome-enterprise-premium-mcp/commit/2e67318f651171f4b6b217a0e8efbf7d5e833736))
- **test:** implement Service Usage API in fake server ([1f29fef](https://github.com/google/chrome-enterprise-premium-mcp/commit/1f29fef1814faa047020e9f1ba746c0bbdf9c5f2))
- use shared connector analysis in diagnose_environment ([73abbd7](https://github.com/google/chrome-enterprise-premium-mcp/commit/73abbd7f73ce7d2d8558c9dccc3eb35f2347aa7f))

### Bug Fixes

- **api:** drop dead initial detectorType assignment ([552074d](https://github.com/google/chrome-enterprise-premium-mcp/commit/552074d4046a6ac4df9fdab058d70936609f9f25))
- **api:** drop dead initial detectorType assignment ([69de778](https://github.com/google/chrome-enterprise-premium-mcp/commit/69de77807bf404e1429820511dada3e6cf33ef6c))
- **auth:** await getAuthErrorMessage at the two call sites ([37768bc](https://github.com/google/chrome-enterprise-premium-mcp/commit/37768bc92577b12efbbabe092aaf8b572b46ab4a))
- **auth:** await getAuthErrorMessage in the OAuth-cache fallback ([e3d23f7](https://github.com/google/chrome-enterprise-premium-mcp/commit/e3d23f7e92b1f05eb2c54a33886a7139cb48e8b9))
- **auth:** clarify the CEP_BEARER_AUDIENCE-unset startup warning ([a1614eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/a1614eb582e31c3007067683995962808118598f))
- **auth:** refuse to load OAuth token cache when its mode is loose ([a15d1fd](https://github.com/google/chrome-enterprise-premium-mcp/commit/a15d1fd93de1a4a3845bda6e711286633eb75736))
- block-scoping bug for authToken variable ([edf7299](https://github.com/google/chrome-enterprise-premium-mcp/commit/edf7299eb3b7b1b4baa936dc5b820176863ca551))
- **check_and_enable_cep_api:** branch on LRO error, done, and unknown shape ([93e3ce6](https://github.com/google/chrome-enterprise-premium-mcp/commit/93e3ce62ebc4a7e58eba94480a363d02db724cb2))
- **check_and_enable_cep_api:** make ENABLING summary actionable and drop "unknown" operation literal ([47a790d](https://github.com/google/chrome-enterprise-premium-mcp/commit/47a790dc0086462f76ce7cef159664407ee40048))
- **check_and_enable_cep_api:** match Service Usage host with anchored regex ([60c65d0](https://github.com/google/chrome-enterprise-premium-mcp/commit/60c65d05a7e47fea8b8c2a3ab3c0ce55ce1d89bc))
- **chrome-management:** add authToken to base interface signatures ([5d21871](https://github.com/google/chrome-enterprise-premium-mcp/commit/5d218719d18fe43d89504d6e55987796a8d75423))
- **chrome-management:** thread authToken through countBrowserVersions and listCustomerProfiles ([498ba3f](https://github.com/google/chrome-enterprise-premium-mcp/commit/498ba3f6da5b1b824c68b65dc9652b8707fad670))
- **chrome-management:** thread authToken through countBrowserVersions and listCustomerProfiles ([1a3f420](https://github.com/google/chrome-enterprise-premium-mcp/commit/1a3f42002035a3ee4f4552f866bb91255a287522)), closes [#126](https://github.com/google/chrome-enterprise-premium-mcp/issues/126)
- **ci:** tolerate grep no-match exit in test-budget tripwire ([a22af6b](https://github.com/google/chrome-enterprise-premium-mcp/commit/a22af6b70e7e7a8e7bf851251e8018233208b5a0))
- correct etag field name in fake license API response ([02bcdf5](https://github.com/google/chrome-enterprise-premium-mcp/commit/02bcdf518547256b01b33b8efa066f8ec6acca5c))
- **eval:** align K06 privilege names with source ([19a1248](https://github.com/google/chrome-enterprise-premium-mcp/commit/19a1248d1b48fc97b6ae9ef63a00c79e04031f84))
- **eval:** align K07 role names with source ([489d582](https://github.com/google/chrome-enterprise-premium-mcp/commit/489d5826d0c203dbf7d428ffea6f5a82f6988715))
- **eval:** correct K05 IAM role name to match source ([4566e7f](https://github.com/google/chrome-enterprise-premium-mcp/commit/4566e7f292b9fd8e52565d1b99615f49c8d8e0e7))
- **eval:** fix i06 fixture and relax golden response ([e1ef917](https://github.com/google/chrome-enterprise-premium-mcp/commit/e1ef9171f730ccadc4173c4ee9ef99cb89702c49))
- **eval:** load dotenvx configuration programmatically ([0d2f42e](https://github.com/google/chrome-enterprise-premium-mcp/commit/0d2f42eb9c254a0a21d3c5ed3d16dc3dcbad46ae))
- **eval:** narrow K18 cache encryption scope to match source ([58c0ac4](https://github.com/google/chrome-enterprise-premium-mcp/commit/58c0ac4836d6de3011595673a2ae91ceb9d388d1))
- **eval:** relax k07 role name requirements ([a654283](https://github.com/google/chrome-enterprise-premium-mcp/commit/a6542834ee788a5bda307becb94d9acd0a576e83))
- **eval:** relax K28 judge instructions ([695342c](https://github.com/google/chrome-enterprise-premium-mcp/commit/695342c319e356d5fe77dc7f0c0a62d4e534ebe4))
- **evals/run:** align concurrency default with help text; restore priority-filter check ([f611ee3](https://github.com/google/chrome-enterprise-premium-mcp/commit/f611ee3aecc6e63527b2fe943e456dcc29fcf4ad))
- **evals/run:** align concurrency default with help text; restore priority-filter check ([402bfaa](https://github.com/google/chrome-enterprise-premium-mcp/commit/402bfaa8f1a136be97981359b96562cdc42df0fe))
- **evals:** anchor judge PASS detection so negations don't slip through ([cc2b6d7](https://github.com/google/chrome-enterprise-premium-mcp/commit/cc2b6d7f47d6f40a2cbc9834970fb6cff36e4aac))
- **evals:** anchor judge PASS detection so negations don't slip through ([ca344b2](https://github.com/google/chrome-enterprise-premium-mcp/commit/ca344b23f4b78f13c6329fea85ca2baed84c5eed))
- **evals:** default EXPERIMENT_DELETE_TOOL_ENABLED=true so m03 tests real agent behavior ([27f6fe7](https://github.com/google/chrome-enterprise-premium-mcp/commit/27f6fe7e0b99fe0e48fab40488d194bd68758bd4))
- **evals:** default EXPERIMENT_DELETE_TOOL_ENABLED=true so m03 tests real agent behavior ([0aa6203](https://github.com/google/chrome-enterprise-premium-mcp/commit/0aa62030e92284471e82545afe249a3cdd7653bd))
- **evals:** ensure agent sees all tool content parts ([63e2391](https://github.com/google/chrome-enterprise-premium-mcp/commit/63e23914d8f848ef1bde51b1a2d168dc7cb45669))
- **eval:** simplify K24 golden response to conceptual answer ([90a8d17](https://github.com/google/chrome-enterprise-premium-mcp/commit/90a8d1741c0afb624709e9fb795c6f77e5a98da3))
- **evals:** move m02 to create_chrome_dlp_rule, add real connector-enablement case ([c09199f](https://github.com/google/chrome-enterprise-premium-mcp/commit/c09199f539f7730903f9c7dd8d4f214f6f3f1441))
- **evals:** move m02 to create_chrome_dlp_rule, add real connector-enablement case ([0d520eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/0d520ebc509f45fbfad2b43edd6e62e5c171dded))
- **eval:** soften K15 CAA/Incognito claim to match source ([299b6ea](https://github.com/google/chrome-enterprise-premium-mcp/commit/299b6ea3b7a8036773a5d37b2d555b8b051c9003))
- **evals:** reject cases that set both fixtures and scenario ([dc9d7f9](https://github.com/google/chrome-enterprise-premium-mcp/commit/dc9d7f9dd40a767a431ccd45a384d53115d52a9f))
- **evals:** reject cases that set both fixtures and scenario ([b943bac](https://github.com/google/chrome-enterprise-premium-mcp/commit/b943bac1bdcd223cc36889ee8f1b5ac62eaff1b8))
- **evals:** rewrite "soft FAIL" rubrics as binary pass/fail ([35e1733](https://github.com/google/chrome-enterprise-premium-mcp/commit/35e1733d7a3bf87abb9fa1f18a980b40a24d643b))
- **evals:** skip tool check in --dry-run instead of asserting expected==expected ([0b15b65](https://github.com/google/chrome-enterprise-premium-mcp/commit/0b15b65ca8e7a67f7352d9672b10287adf0769bc))
- **evals:** skip tool check in --dry-run instead of asserting expected==expected ([9fb9dea](https://github.com/google/chrome-enterprise-premium-mcp/commit/9fb9dea30089a4c78fb87e653d8aebfe54b23af0))
- **evals:** tighten P0-priority detection and Gemini options arg ([770602d](https://github.com/google/chrome-enterprise-premium-mcp/commit/770602d135b910dc2b46d508e60f6c933989c0b3))
- **evals:** tighten P0-priority detection and Gemini options arg ([7e6eb83](https://github.com/google/chrome-enterprise-premium-mcp/commit/7e6eb83fd1ab50a5a103fe1fd00a1e734ce8a2aa))
- **eval:** update evaluator knowledge accuracy and remove non-CEP eval ([a129d05](https://github.com/google/chrome-enterprise-premium-mcp/commit/a129d05f542b010a3cacfcee5f6bb82912468d47))
- **get_connector_policy:** align tool response with declared outputSchema ([235f5f5](https://github.com/google/chrome-enterprise-premium-mcp/commit/235f5f5ef53fd6cca7fb83bf161abac5a47e897c))
- **get_connector_policy:** align tool response with declared outputSchema ([473f5b8](https://github.com/google/chrome-enterprise-premium-mcp/commit/473f5b8e4ff14bed0a25206932eb9d749411ba19)), closes [#20](https://github.com/google/chrome-enterprise-premium-mcp/issues/20)
- **get_connector_policy:** replace stale item schema; declare configured ([68d8d39](https://github.com/google/chrome-enterprise-premium-mcp/commit/68d8d39a6f57d700e8babb48b3fa28c17c587274))
- **knowledge:** replace regex HTML stripper with cheerio parser ([590d752](https://github.com/google/chrome-enterprise-premium-mcp/commit/590d752ed2896f9ebb3c7fb36af7fd0a330c4c76))
- **knowledge:** tolerate junk inside closing tags so CodeQL bad-tag-filter passes ([ccdea0c](https://github.com/google/chrome-enterprise-premium-mcp/commit/ccdea0c67670906a616548da4a9582afbc01793b))
- **mcp-server:** defer startup banner until the assigned port is known ([43376da](https://github.com/google/chrome-enterprise-premium-mcp/commit/43376da308891ef44e4085e0502f9a8dab42436e))
- **mcp-server:** defer startup banner until the assigned port is known ([50282dc](https://github.com/google/chrome-enterprise-premium-mcp/commit/50282dc458c9bb83f12d6ca295721eb277ad0109))
- **mcp-server:** SSE server-instance leak, var-name clarity, missing sessionId in 400 ([3f61e77](https://github.com/google/chrome-enterprise-premium-mcp/commit/3f61e770dfc9a35d82047f020e98946f8ee1a274))
- **mcp-server:** SSE server-instance leak, var-name clarity, missing sessionId in 400 ([7ceead1](https://github.com/google/chrome-enterprise-premium-mcp/commit/7ceead1f5ca21541857894a489bbd233ad1f5e8a))
- proactively report and remediate auth errors ([072f26e](https://github.com/google/chrome-enterprise-premium-mcp/commit/072f26e5e4ab5767568e4da4d22eb06bd66b6f35))
- **prompts:** cep:health leads with the top finding ([ff4f728](https://github.com/google/chrome-enterprise-premium-mcp/commit/ff4f728aaa7f473efe47a8cd6ab4e9a762df6097))
- **prompts:** cep:health leads with the top finding ([#14](https://github.com/google/chrome-enterprise-premium-mcp/issues/14)) ([a0645c1](https://github.com/google/chrome-enterprise-premium-mcp/commit/a0645c1e837aafd4a93cbdf142ce8403ce39e448))
- **prompts:** cep:optimize leads with what the logs show ([1710da2](https://github.com/google/chrome-enterprise-premium-mcp/commit/1710da29c294c7a8a91caef1b4e74080876ef5ab))
- **prompts:** cep:optimize leads with what the logs show ([#15](https://github.com/google/chrome-enterprise-premium-mcp/issues/15)) ([c7b7df4](https://github.com/google/chrome-enterprise-premium-mcp/commit/c7b7df4108e21daaed394ea7057c0b84da525ccc))
- **prompts:** drop orphan '3.' from SHARED_DIAGNOSTIC_RULES ([35e310c](https://github.com/google/chrome-enterprise-premium-mcp/commit/35e310c9f768fc9e3d8dac1579c03f17ebc881e1))
- **prompts:** drop orphan '3.' from SHARED_DIAGNOSTIC_RULES ([20f7e66](https://github.com/google/chrome-enterprise-premium-mcp/commit/20f7e66d13a96b1216081d326ce22ed7099f6f10))
- **release:** include README files in snapshot, force LC_ALL=C sort for cross-machine determinism ([a1494db](https://github.com/google/chrome-enterprise-premium-mcp/commit/a1494db15d3ed614b044a09b49d151a68c21e6f6))
- resolve CURRENT_CUSTOMER alias in licensing API check ([55f21b7](https://github.com/google/chrome-enterprise-premium-mcp/commit/55f21b7ae7b8ed43a128b09a3567771b944aac0a))
- resolve get_connector_policy test failures ([cb2c2c5](https://github.com/google/chrome-enterprise-premium-mcp/commit/cb2c2c541a2fecdd88357534368b37b186b889dd))
- resolve path typos and mock dependencies to fix presubmits ([907cdc7](https://github.com/google/chrome-enterprise-premium-mcp/commit/907cdc7c7e14dfc848003dac9545902034a380d5))
- Resolve syntax error and missing import in knowledge tools ([d203eb8](https://github.com/google/chrome-enterprise-premium-mcp/commit/d203eb83d8081677ab807ded3ad2836d687a4ec1))
- **scripts:** cover prompt/boundary/licensing eval categories and run integration in npm test ([b57497c](https://github.com/google/chrome-enterprise-premium-mcp/commit/b57497cfae9bf2aafa0a57cb33f2aafb8a8bbd1d))
- **scripts:** cover prompt/boundary/licensing eval categories and run integration in npm test ([bc8caee](https://github.com/google/chrome-enterprise-premium-mcp/commit/bc8caee82e45ee81dcdeabf3dc4bde7b68d3a5c9))
- **security:** address CodeQL alerts across regex/URL/proto handling ([cd50c2f](https://github.com/google/chrome-enterprise-premium-mcp/commit/cd50c2f9d2da80fd9952eaf753e4ed73dc0eccb8))
- **security:** address CodeQL alerts across regex/URL/proto handling ([8625ef2](https://github.com/google/chrome-enterprise-premium-mcp/commit/8625ef242700dfdc0dfdbacc138e711e6c563b20))
- **security:** close CodeQL alert [#33](https://github.com/google/chrome-enterprise-premium-mcp/issues/33) by null-proto'ing top-level state maps ([d55c336](https://github.com/google/chrome-enterprise-premium-mcp/commit/d55c3365dbf8d5269751d66bd31b8f5ae3611ed6))
- **security:** resolve remaining CodeQL alerts in test fixtures ([3288945](https://github.com/google/chrome-enterprise-premium-mcp/commit/32889454377157c6ce820418a6ca1222367bd0de))
- **security:** resolve remaining CodeQL alerts in test fixtures ([68173a8](https://github.com/google/chrome-enterprise-premium-mcp/commit/68173a8525330b94f11bb5eaf316b6b3a9f589dc))
- **server:** handle SIGTERM for graceful Cloud Run shutdown ([d23a082](https://github.com/google/chrome-enterprise-premium-mcp/commit/d23a08229d96f8a3a2b87e5d73379acacea01075))
- **server:** handle SIGTERM for graceful Cloud Run shutdown ([5beb89f](https://github.com/google/chrome-enterprise-premium-mcp/commit/5beb89fbef0c6f912f9b1dec3324d690cf947fdd))
- **server:** scope session state per HTTP request ([49218fe](https://github.com/google/chrome-enterprise-premium-mcp/commit/49218fedf8ad17efa452b8b4e14a4016ba32b097))
- **server:** scope session state per HTTP request to prevent cross-customer leak ([bb71813](https://github.com/google/chrome-enterprise-premium-mcp/commit/bb71813a17f91548474ad02a21bfce782338e3bc))
- **server:** wrap /sse handler in try/catch ([25ec2a7](https://github.com/google/chrome-enterprise-premium-mcp/commit/25ec2a782a9a0e5173c76b75d8e6110f30d1c071))
- **server:** wrap /sse handler in try/catch so failures terminate the response ([b15f318](https://github.com/google/chrome-enterprise-premium-mcp/commit/b15f3189b1bcfc0b79514796aec4dbf19d41266b))
- **test/fake-api-server:** guard customerId in licenses fixture merge ([ece3b95](https://github.com/google/chrome-enterprise-premium-mcp/commit/ece3b95072eb28fa9f2c1ff9bb06c258644acd25))
- **test/scenarios:** derive serviceUsage seed from SERVICE_NAMES ([348a762](https://github.com/google/chrome-enterprise-premium-mcp/commit/348a7622b6c75c28bc1ccd6ea06bc7fe9ddbe2cc))
- **test/scenarios:** seed connectorPolicies and serviceUsage in eval base state ([23b83c4](https://github.com/google/chrome-enterprise-premium-mcp/commit/23b83c43a3c7953afd586278db5f74f8ed1a05bc))
- **test/scenarios:** seed connectorPolicies and serviceUsage in eval base state ([aa9484d](https://github.com/google/chrome-enterprise-premium-mcp/commit/aa9484d8f294c6b33c8e118d9c4e5e50ebc836de))
- **test:** skip ADC probe in startup-log tests to eliminate 8s race with 12s spawnSync timeout ([9781db5](https://github.com/google/chrome-enterprise-premium-mcp/commit/9781db54a2124f9632c42877b3deed6f4f497da8))
- **test:** skip ADC probe in startup-log tests to eliminate flaky timing race ([aff1070](https://github.com/google/chrome-enterprise-premium-mcp/commit/aff107070c4becc68c05ec121b96d06815a31c07))
- **test:** use 'value' key in fake RealtimeUrlCheck to match other connectors and the real API ([d91b047](https://github.com/google/chrome-enterprise-premium-mcp/commit/d91b04711f2c3a45f9763f72a460b2f95e101865))
- **test:** use 'value' key in fake RealtimeUrlCheck to match other connectors and the real API ([ea0af4c](https://github.com/google/chrome-enterprise-premium-mcp/commit/ea0af4c722cb8454622aa2c1a89f2b0b897c3c4d))
- **tools:** distinguish 404 from transient errors in delete_agent_dlp_rule ([254c7eb](https://github.com/google/chrome-enterprise-premium-mcp/commit/254c7eb818ecc3fe379166decc8af934783a0f16))
- **tools:** distinguish 404 from transient errors in delete_agent_dlp_rule pre-fetch ([e975021](https://github.com/google/chrome-enterprise-premium-mcp/commit/e9750215a4092180abc834a7fcecb89804813017))
- **tools:** don't claim API ENABLED before the long-running enable completes ([8c0f80f](https://github.com/google/chrome-enterprise-premium-mcp/commit/8c0f80f02bade05624da093f2654e207b17a77c3))
- **tools:** don't claim ENABLED before the long-running enable completes ([6967397](https://github.com/google/chrome-enterprise-premium-mcp/commit/6967397c6ee8d237f0173b61c5e896585278e4ff))
- **tools:** drop chained .describe() on orgUnitId in SEB tools ([4a8eaec](https://github.com/google/chrome-enterprise-premium-mcp/commit/4a8eaec2b4fea60081187a5ee16bf47425a83440))
- **tools:** drop chained .describe() on orgUnitId in SEB tools ([68b7c73](https://github.com/google/chrome-enterprise-premium-mcp/commit/68b7c73f24e94039b544319ba4a45794921230da))
- **tools:** let list_customer_profiles surface auth errors ([9a76b65](https://github.com/google/chrome-enterprise-premium-mcp/commit/9a76b6586b700337439f3bbb1e0f639d49aa427f))
- **tools:** let list_customer_profiles surface auth errors ([ed8a4ea](https://github.com/google/chrome-enterprise-premium-mcp/commit/ed8a4ea451a34d8aaebdfe218b6c40365f954b07))
- **tools:** propagate auth errors in all relevant tools ([863335b](https://github.com/google/chrome-enterprise-premium-mcp/commit/863335b9caffb3fa626ee6a773414978bab48297))
- **tools:** sanitize raw API trigger strings in list_dlp_rules summary ([ad7d796](https://github.com/google/chrome-enterprise-premium-mcp/commit/ad7d7968b122062b6467fe725c8338f3afed1897))
- **tools:** set skipAutoResolve on tools that don't take customerId ([1ad843f](https://github.com/google/chrome-enterprise-premium-mcp/commit/1ad843fcaeb0a3285fbfa22aca2a7eefd408a305))
- **tools:** set skipAutoResolve on tools that don't take customerId ([256b73b](https://github.com/google/chrome-enterprise-premium-mcp/commit/256b73bb41127cc8f29f73204cb041bbb9a2e700))
- use globalConnectorPolicies in eval base state ([7a51898](https://github.com/google/chrome-enterprise-premium-mcp/commit/7a51898017d8e422f2a8777b09d5516e3b0eca90))
- **util:** add 3s timeout to checkGCP metadata probe ([51c5d4d](https://github.com/google/chrome-enterprise-premium-mcp/commit/51c5d4de7ea8214990f8d047bc14c57497d0f959))
- **util:** add 3s timeout to checkGCP metadata probe ([4026e5a](https://github.com/google/chrome-enterprise-premium-mcp/commit/4026e5a73e3e6d5ff4a82c946a739eaf866c4f58))
- **util:** derive ADC scope lists from SCOPES constant in both remediation paths ([89f7a98](https://github.com/google/chrome-enterprise-premium-mcp/commit/89f7a98b7caa56dd9bc4803eb17c7e79dffa5946))
- **util:** derive ADC scope lists from SCOPES constant in both remediation paths ([b50547b](https://github.com/google/chrome-enterprise-premium-mcp/commit/b50547b13a35dca9019b09aa7034a6c7f6f1173b))
- **util:** make gcloud quota-project probe async with per-call timeout ([660fe64](https://github.com/google/chrome-enterprise-premium-mcp/commit/660fe64a21e7db3a16a0aaf63837ff0d240c5745))
- **util:** make gcloud quota-project probe async with per-call timeout ([08631b7](https://github.com/google/chrome-enterprise-premium-mcp/commit/08631b79be72e69ecc1a9670adbe80177cdec065))
- **util:** surface PERMISSION_DENIED immediately ([99174b8](https://github.com/google/chrome-enterprise-premium-mcp/commit/99174b8f0b45af4b9eb7c587ca0aeb7ae0b61c9e))
- **util:** surface PERMISSION_DENIED immediately instead of retrying for 78s ([493495f](https://github.com/google/chrome-enterprise-premium-mcp/commit/493495f4c303ebaecb5f1634ef5af7e992b80e80))
- **wrapper:** propagate customerId auto-resolve errors ([76a9de9](https://github.com/google/chrome-enterprise-premium-mcp/commit/76a9de9c6e0e4c729bd81f178b3e2a816a7a029e))
- **wrapper:** propagate customerId auto-resolve errors so auth remediation fires ([6425c51](https://github.com/google/chrome-enterprise-premium-mcp/commit/6425c51f9da5de8e151cd994b7dbcf770d9f148d))
