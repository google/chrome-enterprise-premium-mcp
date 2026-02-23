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
        "default_customer_id": "C0123456", # Explicit default customer
        "customers": {
            "C0123456": {"id": "C0123456", "customerDomain": "example.com"}
        },
        "org_units": {
            "C0123456": {
                "fakeOUId1": {"name": "Root OU", "orgUnitId": "id:fakeOUId1", "parentOrgUnitId": None},
                "fakeOUId2": {"name": "Child OU", "orgUnitId": "id:fakeOUId2", "parentOrgUnitId": "id:fakeOUId1"},
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
                        "displayName": "Block test123.com",
                        "description": "Prevent upload of sensitive data to test123.com",
                        "state": "ACTIVE",
                        "triggers": ["google.workspace.chrome.file.v1.upload"],
                        "condition": {
                            "contentCondition": "all_content.contains(\"test123.com\")"
                        },
                        "action": {"chromeAction": {"blockContent": {}}},
                    },
                },
            }
        },
        "activities": [],
        "browser_versions": [
            {"version": "120.0.6099.71", "count": "15", "channel": "STABLE"},
            {"version": "121.0.6167.85", "count": "3", "channel": "BETA"},
        ],
        "profiles": [],
    }

# --- In-Memory State ---
state: Dict[str, Any] = get_initial_state()

def flush_print(message):
    print(message, flush=True)

def get_customer_id_key(customer_key: str) -> str:
    if customer_key == "my_customer": # Special key used in admin_sdk.js
        return state["default_customer_id"]
    if customer_key in state["customers"]:
        return customer_key
    raise HTTPException(status_code=404, detail=f"Customer {customer_key} not found")

# --- Fake Admin SDK Endpoints ---

@app.get("/admin/directory/v1/customers/{customerKey}/orgunits")
async def fake_list_orgunits(customerKey: str, type: Optional[str] = None):
    customer_id = get_customer_id_key(customerKey)
    if customer_id in state["org_units"]:
        return {"organizationUnits": list(state["org_units"][customer_id].values())}
    return {"organizationUnits": []}

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
async def fake_list_activities(userKey: str, applicationName: str):
    # Basic mock, can be expanded with more filtering logic
    return {"items": state["activities"]}

# --- Fake Chrome Management Endpoints ---

@app.get("/v1/customers/{customer_id}/reports:countChromeVersions")
async def fake_count_chrome_versions(customer_id: str, orgUnitId: Optional[str] = None):
    get_customer_id_key(customer_id) # Validate customer
    return {"browserVersions": state["browser_versions"]}

@app.get("/v1/customers/{customer_id}/profiles")
async def fake_list_profiles(customer_id: str):
    get_customer_id_key(customer_id) # Validate customer
    return {"chromeBrowserProfiles": state["profiles"]}

# --- Fake Chrome Policy Endpoints ---

@app.post("/v1/customers/{customer_id}/policies:resolve")
async def fake_resolve_policies(customer_id: str, body: Dict[str, Any]):
    get_customer_id_key(customer_id)
    return {"resolvedPolicies": []}

# --- Fake Cloud Identity Endpoints ---

@app.get("/v1beta1/policies")
async def fake_list_policies_v1beta1(request: Request, filter: Optional[str] = None):
    flush_print(f"--- fake_list_policies_v1beta1 called with filter: {filter} ---")

    # Use the explicit default customer ID from the state
    customer_id = state["default_customer_id"]

    policies = list(state["policies"].values())

    # Filter by customer
    policies = [p for p in policies if p.get("customer") == f"customers/{customer_id}"]

    if filter:
        # Filter by type
        if 'setting.type.matches("rule.dlp")' in filter:
            policies = [p for p in policies if p.get("setting", {}).get("type") == "settings/rule.dlp"]
        elif 'setting.type.matches("detector")' in filter:
             policies = [p for p in policies if p.get("setting", {}).get("type") == "settings/detector.url_list"]

    return {"policies": policies}

@app.post("/v1beta1/customers/{customer_id}/policies")
async def fake_create_policy(customer_id: str, body: Dict[str, Any]):
    get_customer_id_key(customer_id)
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
    return new_policy

@app.get("/v1beta1/{name=policies/*}")
async def fake_get_policy(name: str):
    if name in state["policies"]:
        return state["policies"][name]
    raise HTTPException(status_code=404, detail=f"Policy {name} not found")

@app.delete("/v1beta1/{name=policies/*}")
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
