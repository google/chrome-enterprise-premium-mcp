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

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LOGO } from './banner-logo.js'

interface PackageJson {
  version: string
}

function findPackageJson(startDir: string): string {
  let current = startDir
  while (true) {
    const p = join(current, 'package.json')
    if (existsSync(p)) {
      return p
    }
    const parent = dirname(current)
    if (parent === current) {
      throw new Error('Could not find package.json.')
    }
    current = parent
  }
}

const startDir = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(findPackageJson(startDir), 'utf8')) as PackageJson

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g
const visibleLen = (s: string): number => s.replace(ANSI_RE, '').length

const colorize = process.env.NO_COLOR ? (s: string): string => s.replace(ANSI_RE, '') : (s: string): string => s

const RENDERED_LOGO = LOGO.map(colorize)
const LOGO_WIDTH = Math.max(...RENDERED_LOGO.map(visibleLen))
const GUTTER = '    '

const red = (s: string): string => colorize(`\x1b[31m${s}\x1b[0m`)
const yellow = (s: string): string => colorize(`\x1b[33m${s}\x1b[0m`)
export const dim = (s: string): string => colorize(`\x1b[38;2;204;204;0m${s}\x1b[0m`)

const padLogo = (line: string): string => line + ' '.repeat(Math.max(0, LOGO_WIDTH - visibleLen(line)))

export type BannerFieldValue = string | string[]

export interface BannerStatus {
  transport: BannerFieldValue
  auth: BannerFieldValue
  apiCreds: BannerFieldValue
  scopes: BannerFieldValue
  dataAccess: BannerFieldValue
  knowledge: BannerFieldValue
}

// String → yellow value. Array → first element yellow, remainder dimmed
// (e.g. ['OAuth', '(Enforced)'] → "OAuth (Enforced)" with parens dimmed).
const fmtField = (v: BannerFieldValue): string => {
  if (Array.isArray(v)) {
    const [head, ...rest] = v
    return rest.length ? `${yellow(head)} ${dim(rest.join(' '))}` : yellow(head)
  }
  return yellow(v)
}

/**
 * Print the startup banner: ANSI logo on the left, status fields on the right.
 * @param status Status fields shown alongside the logo.
 */
export function printBanner({ transport, auth, apiCreds, scopes, dataAccess, knowledge }: BannerStatus): void {
  const rows: string[] = [
    red('Chrome Enterprise Premium'),
    `MCP Server v${pkg.version}`,
    '',
    `Transport mode:  ${fmtField(transport)}`,
    `Transport auth:  ${fmtField(auth)}`,
    `API credentials: ${fmtField(apiCreds)}`,
    '',
    `Auth scopes:     ${fmtField(scopes)}`,
    `Data access:     ${fmtField(dataAccess)}`,
    `Knowledge:       ${fmtField(knowledge)}`,
    '',
  ]

  console.log()
  for (let i = 0; i < RENDERED_LOGO.length; i++) {
    const text = rows[i] ?? ''
    console.log(text ? `${padLogo(RENDERED_LOGO[i])}${GUTTER}${text}` : padLogo(RENDERED_LOGO[i]))
  }
  console.log()
}
