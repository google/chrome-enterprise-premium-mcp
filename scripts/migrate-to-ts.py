#!/usr/bin/env python3
"""
TypeScript Migration Tool (Zero-Touch)

Automates the migration of .js files to .ts by performing a 'git mv'
and creating 'Tombstone' shims for backward compatibility.

Supports a two-phase commit strategy to preserve Git rename history.
"""

import os
import argparse
import subprocess

SHIM_TEMPLATE = """/*
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
 * @file TypeScript Migration Exports Shim (Tombstone) for {js_file}.
 * This file allows existing JavaScript consumers to continue importing from
 * this path while the underlying implementation is migrated to TypeScript.
 */

export * from './{ts_base}'
"""

def run_command(cmd):
    """Executes a shell command and returns the result."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error executing {' '.join(cmd)}: {e.stderr}")
        return False

def migrate_batch(js_files, auto_commit=False):
    """Performs the two-phase migration for a batch of files."""
    valid_targets = []
    for js_path in js_files:
        if not js_path.endswith('.js'):
            print(f"Skipping {js_path}: Not a .js file")
            continue
        if not os.path.exists(js_path):
            print(f"Skipping {js_path}: File not found")
            continue
        
        ts_path = js_path[:-3] + '.ts'
        valid_targets.append({
            'js': js_path,
            'ts': ts_path,
            'ts_base': os.path.basename(ts_path)
        })

    if not valid_targets:
        print("No valid files to migrate.")
        return

    # --- PHASE 1: RENAMES ---
    print(f"Phase 1: Renaming {len(valid_targets)} files...")
    for target in valid_targets:
        if not run_command(['git', 'mv', target['js'], target['ts']]):
            print(f"Aborting: Failed to rename {target['js']}")
            return

    if auto_commit:
        msg = f"chore: rename {len(valid_targets)} files to .ts (100% logic identity)"
        if run_command(['git', 'commit', '-m', msg]):
            print(f"Committed Phase 1: {msg}")
        else:
            print("Warning: Failed to commit Phase 1. Continuing with staging.")

    # --- PHASE 2: SHIMS ---
    print(f"Phase 2: Creating {len(valid_targets)} shims...")
    for target in valid_targets:
        try:
            with open(target['js'], 'w') as f:
                f.write(SHIM_TEMPLATE.format(js_file=target['js'], ts_base=target['ts_base']))
            run_command(['git', 'add', target['js']])
        except Exception as e:
            print(f"Error creating shim for {target['js']}: {e}")
            return

    if auto_commit:
        msg = f"chore: add backward-compatibility shims for {len(valid_targets)} files"
        if run_command(['git', 'commit', '-m', msg]):
            print(f"Committed Phase 2: {msg}")
        else:
            print("Warning: Failed to commit Phase 2.")

    print(f"\nMigration complete. {len(valid_targets)} files processed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Zero-Touch JS to TS Migrator")
    parser.add_argument('files', nargs='+', help='.js files to migrate')
    parser.add_argument('--commit', action='store_true', 
                        help='Perform a two-phase commit (Rename first, then Shims)')
    
    args = parser.parse_args()
    migrate_batch(args.files, auto_commit=args.commit)
