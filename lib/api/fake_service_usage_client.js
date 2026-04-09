/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @fileoverview Fake implementation of the ServiceUsageClient interface for testing.
 */
import { ServiceUsageClient } from './interfaces/service_usage_client.js'

export class FakeServiceUsageClient extends ServiceUsageClient {
  constructor() {
    super()
    this.services = {
      'admin.googleapis.com': 'DISABLED',
    }
  }

  async getServiceStatus(projectId, serviceName, _authToken) {
    return {
      name: `projects/${projectId}/services/${serviceName}`,
      state: this.services[serviceName] || 'DISABLED',
    }
  }

  async enableService(projectId, serviceName, _authToken) {
    this.services[serviceName] = 'ENABLED'
    return {
      done: true,
      response: {
        state: 'ENABLED',
      },
    }
  }
}
