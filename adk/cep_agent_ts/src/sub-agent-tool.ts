/**
 * @fileoverview Wraps a BaseAgent instance as a tool for the Orchestrator.
 */

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

import { BaseAgent, LocalTool } from "./base-agent.js";

/**
 * Adapter that exposes a BaseAgent as a LocalTool for function calling.
 */
export class SubAgentTool implements LocalTool {
  name: string;
  description: string;
  parameters: any;
  private agent: BaseAgent;

  /**
   * Initializes the SubAgentTool.
   */
  constructor(name: string, description: string, agent: BaseAgent) {
    this.name = name;
    this.description = description;
    this.agent = agent;
    this.parameters = {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt or question to ask the sub-agent.",
        },
      },
      required: ["prompt"],
    };
  }

  /**
   * Executes the wrapped agent with the given arguments.
   */
  async execute(args: any): Promise<string> {
    const prompt = args.prompt;
    if (!prompt) {
      throw new Error("Missing required argument: prompt");
    }
    console.log(`[agent:sub] Executing ${this.name} with prompt: "${prompt}"`);
    return await this.agent.run(prompt);
  }
}
