# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import copy
import os
from typing import Any, Dict, Optional
import uuid

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request
import uvicorn


app = FastAPI(title="Fake Google APIs for MCP Testing")


# --- Function to generate initial in-memory state ---
def get_initial_state():
  return {
      "default_customer_id": "C0123456",  # Explicit default customer
      "customers": {
          "C0123456": {"id": "C0123456", "customerDomain": "example.com"}
      },
      "org_units": {
          "C0123456": {
              "fakeOUId1": {
                  "name": "Root OU",
                  "orgUnitId": "id:fakeOUId1",
                  "orgUnitPath": "/",
                  "parentOrgUnitId": None,
              },
              "fakeOUId2": {
                  "name": "Child OU",
                  "orgUnitId": "id:fakeOUId2",
                  "orgUnitPath": "/Child OU",
                  "parentOrgUnitId": "id:fakeOUId1",
              },
          }
      },
      "policies": {
          "policies/fakeDlpRule1": {
              "name": "policies/fakeDlpRule1",
              "customer": "customers/C0123456",
              "policyQuery": {"orgUnit": "orgUnits/fakeOUId1"},
              "setting": {
                  "type": "settings/rule.dlp",
                  "value": {
                      "displayName": "🤖 Block test123.com",
                      "description": (
                          "Prevent upload of sensitive data to test123.com"
                      ),
                      "state": "ACTIVE",
                      "triggers": ["google.workspace.chrome.file.v1.upload"],
                      "condition": {
                          "contentCondition": (
                              'all_content.contains("test123.com")'
                          )
                      },
                      "action": {"chromeAction": {"blockContent": {}}},
                  },
              },
          },
          "policies/fakeDetector1": {
              "name": "policies/fakeDetector1",
              "customer": "customers/C0123456",
              "policyQuery": {"orgUnit": "orgUnits/fakeOUId1"},
              "setting": {
                  "type": "settings/detector.url_list",
                  "value": {
                      "displayName": "Fake URL Detector",
                      "description": "A fake URL list detector for testing",
                      "url_list": {"urls": ["malware.com"]},
                  },
              },
          },
          "policies/fakeTempDetector1": {
              "name": "policies/fakeTempDetector1",
              "customer": "customers/C0123456",
              "policyQuery": {"orgUnit": "orgUnits/fakeOUId1"},
              "setting": {
                  "type": "settings/detector.url_list",
                  "value": {
                      "displayName": "End-to-End Temp Detector",
                      "description": "A temporary detector for testing",
                      "url_list": {"urls": ["temp.com"]},
                  },
              },
          },
          "policies/akajj264apk5psphei": {
              "name": "policies/akajj264apk5psphei",
              "customer": "customers/C0123456",
              "policyQuery": {"orgUnit": "orgUnits/fakeOUId1"},
              "setting": {
                  "type": "settings/detector.regex",
                  "value": {
                      "displayName": "Fake Regex Detector",
                      "description": "A fake regex detector for testing",
                      "regular_expression": {"expression": ".*"},
                  },
              },
          },
      },
      "activities": [],
      "browser_versions": [
          {"version": "120.0.6099.71", "count": "15", "channel": "STABLE"},
          {"version": "121.0.6167.85", "count": "3", "channel": "BETA"},
      ],
      "profiles": [],
      "licenses": {
          "C0123456": {
              "101040": {
                  "1010400001": [
                      {"userId": "user1@example.com", "skuId": "1010400001", "productId": "101040"}
                  ]
              }
          }
      }
  }


# --- In-Memory State ---
state: Dict[str, Any] = get_initial_state()


def flush_print(message):
  print(message, flush=True)


def get_customer_id_key(customer_key: str) -> str:
  if customer_key == "my_customer":  # Special key used in admin_sdk.js
    return state["default_customer_id"]
  if customer_key in state["customers"]:
    return customer_key
  raise HTTPException(
      status_code=404, detail=f"Customer {customer_key} not found"
  )


# --- Fake Admin SDK Endpoints ---


@app.get("/admin/directory/v1/customers/{customerKey}/orgunits")
async def fake_list_orgunits(
    customerKey: str,
    type: Optional[str] = None,
    orgUnitPath: Optional[str] = None,
):
  if orgUnitPath:
    raise HTTPException(
        status_code=501,
        detail="orgUnitPath filtering is not implemented in fake server",
    )

  customer_id = get_customer_id_key(customerKey)
  if customer_id not in state["org_units"]:
    return {"organizationUnits": []}

  all_units = list(state["org_units"][customer_id].values())
  if type == "ALL_INCLUDING_PARENT":
    return {"organizationUnits": all_units}
  else:
    raise HTTPException(
        status_code=501, detail=f"Type {type} is not implemented in fake server"
    )


@app.get("/admin/directory/v1/customers/{customerKey}")
async def fake_get_customer(customerKey: str, request: Request):
  try:
    customer_id = get_customer_id_key(customerKey)
    if customer_id in state["customers"]:
      customer_data = state["customers"][customer_id]
      return customer_data
    raise HTTPException(status_code=404, detail="Customer not found")
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in fake_get_customer: {e}", flush=True)
    raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/reports/v1/activity/users/{userKey}/applications/chrome")
async def fake_list_activities(
    userKey: str,
    eventName: Optional[str] = None,
    startTime: Optional[str] = None,
    endTime: Optional[str] = None,
    maxResults: Optional[int] = None,
):
  # Ignore filters for mock simplicity
  return {"items": state.get("activities", [])}


@app.get("/licensing/v1/product/{productId}/sku/{skuId}/user")
async def fake_list_licenses(productId: str, skuId: str, customerId: str):
  customer_id = get_customer_id_key(customerId)
  licenses = state.get("licenses", {}).get(customer_id, {}).get(productId, {}).get(skuId, [])
  return {"items": licenses}

@app.get("/licensing/v1/product/{productId}/sku/{skuId}/user/{userId}")
async def fake_get_user_license(productId: str, skuId: str, userId: str):
  for customer_licenses in state.get("licenses", {}).values():
    product_licenses = customer_licenses.get(productId, {})
    sku_licenses = product_licenses.get(skuId, [])
    for license in sku_licenses:
      if license.get("userId") == userId:
        return license
  raise HTTPException(status_code=404, detail="User license not found")


# --- Fake Chrome Management Endpoints ---


@app.get("/v1/customers/{customer_id}/reports:countChromeVersions")
async def fake_count_chrome_versions(
    customer_id: str, orgUnitId: Optional[str] = None
):
  get_customer_id_key(customer_id)  # Validate customer
  # Ignore orgUnitId filtering for mock simplicity
  return {"browserVersions": state.get("browser_versions", [])}


@app.get("/v1/customers/{customer_id}/profiles")
async def fake_list_profiles(customer_id: str, orgUnitId: Optional[str] = None):
  get_customer_id_key(customer_id)  # Validate customer
  if orgUnitId:
    raise HTTPException(
        status_code=501, detail="orgUnitId is not implemented in fake server"
    )
  return {"chromeBrowserProfiles": state["profiles"]}


# --- Fake Chrome Policy Endpoints ---


@app.post("/v1/customers/{customer_id}/policies:resolve")
async def fake_resolve_policies(customer_id: str, body: Dict[str, Any]):
  get_customer_id_key(customer_id)
  policy_schema_filter = body.get("policySchemaFilter")
  if policy_schema_filter and policy_schema_filter not in [
      "chrome.users.OnFileAttachedConnectorPolicy",
      "chrome.users.OnFileDownloadedConnectorPolicy",
      "chrome.users.OnBulkTextEntryConnectorPolicy",
      "chrome.users.OnPrintAnalysisConnectorPolicy",
      "chrome.users.RealtimeUrlCheck",
      "chrome.users.OnSecurityEvent",
  ]:
    raise HTTPException(
        status_code=501,
        detail=(
            f"Policy schema filter {policy_schema_filter} is not implemented in"
            " fake server"
        ),
    )
  return {"resolvedPolicies": []}


# --- Fake Cloud Identity Endpoints ---


@app.get("/v1beta1/policies")
async def fake_list_policies_v1beta1(
    request: Request, filter: Optional[str] = None
):
  flush_print(
      f"--- fake_list_policies_v1beta1 called with filter: {filter} ---"
  )

  # Use the explicit default customer ID from the state
  customer_id = state["default_customer_id"]

  policies = list(state["policies"].values())

  # Filter by customer
  policies = [
      p for p in policies if p.get("customer") == f"customers/{customer_id}"
  ]

  if filter:
    # Filter by type
    if 'setting.type.matches("rule.dlp")' in filter:
      policies = [
          p
          for p in policies
          if p.get("setting", {}).get("type") == "settings/rule.dlp"
      ]
    elif 'setting.type.matches("detector")' in filter:
      policies = [
          p
          for p in policies
          if p.get("setting", {})
          .get("type", "")
          .startswith("settings/detector")
      ]
    else:
      raise HTTPException(
          status_code=501,
          detail=f"Filter {filter} is not implemented in fake server",
      )

  return {"policies": policies}


@app.post("/v1beta1/customers/{customer_id}/policies")
async def fake_create_policy(customer_id: str, body: Dict[str, Any]):
  get_customer_id_key(customer_id)

  # Basic validation for DLP rules
  setting = body.get("setting", {})
  setting_type = setting.get("type", "")
  setting_value = setting.get("value", {})
  policy_query = body.get("policyQuery", {})

  if setting_type == "settings/rule.dlp":
    if not setting_value.get("displayName"):
      raise HTTPException(
          status_code=400,
          detail=(
              "Invalid config: 'displayName' is required and must not be empty."
          ),
      )

    triggers = setting_value.get("triggers")
    if not isinstance(triggers, list) or not any(
        t.startswith("google.workspace.chrome.") for t in triggers
    ):
      raise HTTPException(
          status_code=400,
          detail=(
              "Invalid config: 'triggers' must be a list and contain at least"
              " one valid Chrome trigger."
          ),
      )

    action = setting_value.get("action", {})
    chrome_action = action.get("chromeAction", {})
    if not (
        "blockContent" in chrome_action
        or "warnUser" in chrome_action
        or "auditOnly" in chrome_action
    ):
      raise HTTPException(
          status_code=400,
          detail=(
              "Invalid config: a valid Chrome action is required."
          ),
      )

    if not policy_query.get("orgUnit"):
      raise HTTPException(
          status_code=400,
          detail="Invalid config: 'orgUnit' is required in policyQuery.",
      )

  elif setting_type == "settings/detector.url_list":
    url_list = setting_value.get("url_list", {}).get("urls", [])
    if not isinstance(url_list, list) or len(url_list) == 0:
      raise HTTPException(
          status_code=400,
          detail="Invalid config: 'url_list.urls' must be a non-empty list.",
      )

  elif setting_type == "settings/detector.word_list":
    word_list = setting_value.get("word_list", {}).get("words", [])
    if not isinstance(word_list, list) or len(word_list) == 0:
      raise HTTPException(
          status_code=400,
          detail="Invalid config: 'word_list.words' must be a non-empty list.",
      )

  elif setting_type == "settings/detector.regex":
    expression = setting_value.get("regular_expression", {}).get("expression")
    if not expression:
      raise HTTPException(
          status_code=400,
          detail="Invalid config: 'regular_expression.expression' is required.",
      )

  policy_id = f"fakePolicy_{uuid.uuid4()}"
  policy_name = f"policies/{policy_id}"
  new_policy = copy.deepcopy(body)
  new_policy["name"] = policy_name
  # Ensure customer is set in the policy body
  new_policy["customer"] = f"customers/{customer_id}"
  ou_id = new_policy.get("policyQuery", {}).get("orgUnit", "")
  if ou_id:
    new_policy["policyQuery"]["orgUnitId"] = ou_id.split("/")[-1]
  state["policies"][policy_name] = new_policy
  return {"done": True, "response": new_policy}


@app.get("/v1beta1/{name:path}")
async def fake_get_policy(name: str):
  if name in state["policies"]:
    return state["policies"][name]
  raise HTTPException(status_code=404, detail=f"Policy {name} not found")


@app.delete("/v1beta1/{name:path}")
async def fake_delete_policy(name: str):
  if name in state["policies"]:
    del state["policies"][name]
    return {}
  raise HTTPException(status_code=404, detail=f"Policy {name} not found")


# --- Helper to reset state for tests ---
@app.post("/test/reset")
async def reset_state():
  global state
  state = get_initial_state()
  return {"message": "State reset"}


if __name__ == "__main__":
  port = int(os.environ.get("PORT", 8008))
  uvicorn.run(app, host="0.0.0.0", port=port)
