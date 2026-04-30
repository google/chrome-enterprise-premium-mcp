# Cloud Run + Gemini Enterprise

## Recommendation: prefer OAuth over service-account + DWD

For Cloud Run deployments consumed by Gemini Enterprise, the recommended auth pattern is **OAuth on behalf of the user**, not server-side service-account + domain-wide-delegation (DWD) impersonation. SA + DWD grants the server's service account the ability to impersonate any user in the domain for the granted scopes — too broad as a default. The OAuth flow scopes are bounded to the consenting user and revocable at `myaccount.google.com`.

The reference pattern is the [ADK + OAuth + Gemini Enterprise article](https://fmind.medium.com/powering-up-your-agent-in-production-with-adk-oauth-and-gemini-enterprise-a52b0716fcba). Authorization Code flow with redirect URI `https://vertexaisearch.cloud.google.com/oauth-redirect`, consent handled by the Vertex AI Agent Engine on the user's behalf, tokens cached in agent state.

## Status of this guide

The existing `mcp auth login` flow uses a loopback redirect URI for local CLI use; Vertex AI Agent Engine expects a web redirect URI. The web-redirect OAuth factory lives in PR #117 (issue #114). A complete Cloud Run + Gemini Enterprise deployment guide is out of scope of this repository for now; the [ADK + OAuth + Gemini Enterprise reference](https://fmind.medium.com/powering-up-your-agent-in-production-with-adk-oauth-and-gemini-enterprise-a52b0716fcba) is the canonical pattern.

## What is in the repository today

- `lib/util/credential/bearer.js` implements the SA + DWD impersonation path for callers that already have an ID token and a DWD-configured service account. Use this only when OAuth is not viable (cross-org automation, headless contexts).
- `lib/util/credential/oauth_flow.js` implements the loopback OAuth flow for local CLI use (`mcp auth login`). It does not target Cloud Run.

When the web-redirect OAuth path lands, this document will gain step-by-step deployment instructions. Until then, follow the ADK reference linked above.
