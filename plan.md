# Kokoro configuration plan for chrome-enterprise-premium-mcp

Use this plan to configure the testing and release workflows for the chrome-enterprise-premium-mcp repository.

This plan integrates your repository with Google's standard open-source developer infrastructure, utilizing a custom Team GitHub App for secure release automation and keeping Kokoro strictly for secure, hermetic testing.

---

## System architecture

The CI/CD workflow splits tasks across specialized services:

1.  **CI (testing):** Kokoro handles CI (testing). Kokoro runs your hermetic test suite (`npm run presubmit`) on GCP-based container workers for all pull requests (presubmits) and merges to the `main` branch (continuous).
2.  **CD (releasing):** A custom Team GitHub App (e.g., `chrome-enterprise-premium-mcp-releaser`) handles CD (releasing). This App is authenticated via ephemeral, short-lived installation tokens in a local GitHub Action workflow (`.github/workflows/release-please.yml`). The App bot is registered with OSPO to automatically bypass the Google CLA check.
3.  **Publishing (NPM):** Your existing GitHub Actions workflow (`npm-publish.yml`) uses Wombat (go/wombat) to securely publish packages to npmjs.org after tag publication.

```
                               +--------------------+
                               | GitHub Repository  |
                               +--------------------+
                                   /            \
          [Pull Request / Merges] /              \ [Tag / Release Published]
                                 v                v
                       +----------------+   +----------------------+
                       | GitHub Webhook |   | GitHub Actions (npm) |
                       +----------------+   +----------------------+
                              |                      |
                              v                      | [Publish via Wombat]
                       +----------------+             v
                       | Kokoro CI/CD   |       +------------+
                       | (ubuntu2004)   |       | npmjs.org  |
                       +----------------+       +------------+
                              |
                              v [Runs Tests]
                       +----------------+
                       |  npm presubmit |
                       +----------------+
```

---

## Setup steps

### Step 1: Register the custom Team GitHub App and allowlist for CLA bypass

Because the centralized Google-wide release App has been decommissioned, you must register a team-scoped App and allowlist its commits to bypass the Google CLA check.

1.  **Create an Internal Google Group:**
    - Navigate to `go/creategroup` and create a group named `chrome-enterprise-premium-mcp-robot@google.com` (using a compliant `-robot` suffix). Add team maintainers to this group.
2.  **Register the GitHub App:**
    - Create a dedicated GitHub App under the `google` organization named `chrome-enterprise-premium-mcp-releaser`.
    - Configure **Repository Permissions**:
      - `Contents`: Read & Write
      - `Pull Requests`: Read & Write
    - Generate a Private Key (`.pem`) file and record the App ID.
3.  **Save Secrets on GitHub:**
    - Save the credentials as Repository Secrets in your GitHub repository settings:
      - `RELEASE_PLEASE_APP_ID`: Your GitHub App ID
      - `RELEASE_PLEASE_APP_PRIVATE_KEY`: The entire contents of the Private Key file.
4.  **Allowlist the App Bot (CLA Bypass):**
    - File a bug at `go/signcla-robot-account`.
    - Provide the internal group email (`chrome-enterprise-premium-mcp-robot@google.com`) and the exact GitHub App bot username (`chrome-enterprise-premium-mcp-releaser[bot]`).
    - An OSPO administrator will run the organization mapping tool to allowlist the bot user:
      `$ /usr/bin/admin_session --reason="b/338592426" -- /google/data/ro/teams/opensource/github googler -team=false -username chrome-enterprise-premium-mcp-releaser[bot] -email chrome-enterprise-premium-mcp-robot@google.com`

---

### Step 2: Create Kokoro configurations in Piper

Define the testing job parameters in Piper.

The Piper workspace `cliagent_cep_mcp_kokoro_setup` has been created, and the configurations are uploaded for you in **[cl/910992176](http://cl/910992176)**.

The CL contains the following files in the `//depot/google3/devtools/kokoro/config/prod/chrome-enterprise-premium-mcp/` directory:

#### 1. OWNERS

```owners
cloud-bce-core-platform-eng-team.prod
```

This designates the team Borg role account as the owner of the configurations.

#### 2. common.cfg

```protobuf
# -*- protobuffer -*-
# proto-file: google3/devtools/kokoro/config/proto/job.proto
# proto-message: JobConfig

admins {
  mdb_group: "cloud-bce-core-platform-eng-team"
}
email_to: "cloud-bce-core-platform-eng-team@google.com"

cluster: GCP_UBUNTU_DOCKER
pool: "ubuntu2004"

multi_scm {
  github_scm {
    owner: "google"
    repository: "chrome-enterprise-premium-mcp"
    name: "chrome-enterprise-premium-mcp"
    branch: "main"
    presubmit_branch_regex: "main"

    commit_status_context: "Kokoro CI"
  }
  build_config_dir: "chrome-enterprise-premium-mcp/kokoro"
}
```

> [!NOTE]
> This configuration uses the container-based `ubuntu2004` pool on the `GCP_UBUNTU_DOCKER` cluster. Because the GitHub app handles releases, the Kokoro test VM does not require secure Keystore tokens or credentials.

#### 3. presubmit.cfg

```protobuf
# -*- protobuffer -*-
# proto-file: google3/devtools/kokoro/config/proto/job.proto
# proto-message: JobConfig
type: PRESUBMIT_GITHUB
```

#### 4. continuous.cfg

```protobuf
# -*- protobuffer -*-
# proto-file: google3/devtools/kokoro/config/proto/job.proto
# proto-message: JobConfig
type: CONTINUOUS_INTEGRATION
```

**Review and submit [cl/910992176](http://cl/910992176).**

---

### Step 3: Create build scripts and workflows in GitHub

Add the execution scripts and GHA release workflow to your GitHub repository.

The local Git branch `setup-kokoro-ci` has been created, and the files are committed and pushed to remote:

#### 1. .github/workflows/release-please.yml

```yaml
name: release-please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Ephemeral GitHub App Token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_PLEASE_APP_PRIVATE_KEY }}

      - name: Run Release Please
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ steps.app-token.outputs.token }}
```

#### 2. kokoro/presubmit.cfg

```protobuf
# -*- protobuffer -*-
# proto-file: google3/devtools/kokoro/config/proto/build.proto
# proto-message: BuildConfig
build_file: "github/chrome-enterprise-premium-mcp/kokoro/build.sh"
```

#### 3. kokoro/continuous.cfg

```protobuf
# -*- protobuffer -*-
# proto-file: google3/devtools/kokoro/config/proto/build.proto
# proto-message: BuildConfig
build_file: "github/chrome-enterprise-premium-mcp/kokoro/build.sh"
```

#### 4. kokoro/build.sh

```bash
#!/bin/bash
set -e
set -x

BUILD_ROOT="${KOKORO_ARTIFACTS_DIR}/github/chrome-enterprise-premium-mcp"
cd "${BUILD_ROOT}"

echo "Installing dependencies..."
npm ci

echo "Running presubmit checks..."
npm run presubmit

echo "Build completed successfully."
```

**Push the `setup-kokoro-ci` branch to GitHub and merge it to the `main` branch.**

---

### Step 4: Register GitHub webhook

> [!IMPORTANT]
> You must submit the Piper changelist ([cl/910992176](http://cl/910992176)) in Step 2 **before** running these commands. The Kokoro webhook subscriber service reads configurations directly from the submitted main Google3 repository and will fail if the changelist is still pending.

Execute the following commands from your terminal after [cl/910992176](http://cl/910992176) is submitted (requires active Google credentials using `gcert`):

```bash
stubby call --proto2 blade:kokoro-github-subscriber \
SubscriberService.CreateWebhook 'full_job_name: "chrome-enterprise-premium-mcp/presubmit"'

stubby call --proto2 blade:kokoro-github-subscriber \
SubscriberService.CreateWebhook 'full_job_name: "chrome-enterprise-premium-mcp/continuous"'
```

---

## Verification

### Presubmit (pull request)

To verify the presubmit workflow:

1.  Create a new Git branch.
2.  Make a minor modification to a file.
3.  Commit and push the branch to GitHub.
4.  To create a pull request, navigate to the GitHub page of your repository, and click **Compare & pull request**.
5.  Verify that the Kokoro CI check appears on the pull request page, executes, and reports a successful status.
6.  To monitor the run, navigate to the Test Fusion page:
    [Test Fusion Presubmit](http://fusion2/ci/kokoro/prod:chrome-enterprise-premium-mcp%2Fpresubmit)

### Continuous integration (post-merge)

To verify the continuous integration workflow:

1.  Merge the pull request into the `main` branch.
2.  Verify that a post-submit build triggers automatically.
3.  To monitor the run, navigate to the Test Fusion page:
    [Test Fusion Continuous](http://fusion2/ci/kokoro/prod:chrome-enterprise-premium-mcp%2Fcontinuous)

---

## Known limitations and operational warnings

### 1. Gemini Extension Package Dependency Mismatch

In `gemini-extension.json`, the execution argument specifies a hardcoded server package dependency:
`"args": ["-y", "@google/chrome-enterprise-premium-mcp@^1.2.0"]`

- **The Issue:** While `release-please` is configured via `jsonpath` to update the extension's own version string `$.version` in `gemini-extension.json`, it **cannot** update the package dependency version in `args[1]` because the release bot only supports direct key overwrites, not regex substitutions in string arrays.
- **Operational Requirement:** During major or breaking releases, you must **manually** update the package dependency version range in `gemini-extension.json`'s `args` to ensure that the extension executes the matching server version. (Our new `extension_version.test.js` unit test will fail and block the PR if you forget to do this).

---

## Verified internal sources and technical references

This configuration aligns with the following Google internal documentation and playbooks:

1.  [Kokoro Dynamic Pool Deprecation](http://go/kokoro-dynamic-deprecation): Outlines the deprecation of legacy `dynamic` pools and the recommended migration path to `ubuntu2004` containers under the `GCP_UBUNTU_DOCKER` cluster.
2.  [Kokoro OS Support Status](http://go/kokoro-os-support-status): Serves as the source of truth for supported operating systems and container distributions.
3.  [Configuring Multi-SCM](http://go/kokoro-multi-scm-config): Details the layout of `multi_scm` configurations and the syntax required to point `build_config_dir` directly to GitHub directories.
4.  [Open Source Eng Robot Account & App Processes](http://go/opensource-eng/processes): Documents Google policies regarding custom App creation, Valentine secret security, and the official `go/signcla-robot-account` allowlist process.
5.  [Release Please Basics](http://go/release-please-basics): Details the setup and configuration files (`release-please-config.json` and `.release-please-manifest.json`) for manifest-driven version updates.
