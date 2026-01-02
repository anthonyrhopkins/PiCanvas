#!/usr/bin/env python3
"""
PiCanvas VS Code Extension Log Collector

Collects VS Code and VS Code Insiders extension logs and usage statistics.
Sends data to the analytics server and aggregates with test reports.

Usage:
    python3 collect_vscode_logs.py
    python3 collect_vscode_logs.py --server http://localhost:4200
    python3 collect_vscode_logs.py --version "1.95.0"
"""

import json
import os
import sys
import glob
import argparse
import requests
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import platform

class VSCodeLogCollector:
    """Collects VS Code extension logs and usage data"""
    
    def __init__(self, server_url: str = "http://localhost:4200", data_dir: str = "."):
        self.server_url = server_url
        self.data_dir = data_dir
        self.logs: List[Dict[str, Any]] = []
        self.platform = platform.system()
        
    def get_vscode_paths(self) -> Dict[str, Path]:
        """Get VS Code data paths for different platforms"""
        if self.platform == "Darwin":  # macOS
            base = Path.home() / "Library" / "Application Support"
            return {
                "stable": base / "Code" / "Logs",
                "insiders": base / "Code - Insiders" / "Logs"
            }
        elif self.platform == "Windows":
            base = Path.home() / "AppData" / "Roaming"
            return {
                "stable": base / "Code" / "Logs",
                "insiders": base / "Code - Insiders" / "Logs"
            }
        else:  # Linux
            base = Path.home() / ".config"
            return {
                "stable": base / "Code" / "Logs",
                "insiders": base / "Code - Insiders" / "Logs"
            }
    
    def extract_version_from_logs(self, log_path: Path, version_type: str) -> str:
        """Extract VS Code version from log files"""
        try:
            log_file = log_path / "20250101T000000.log" if log_path.exists() else None
            if log_file and log_file.exists():
                with open(log_file, 'r') as f:
                    content = f.read()
                    if 'VS Code' in content:
                        # Try to extract version
                        for line in content.split('\n'):
                            if 'version' in line.lower():
                                # Parse version from log line
                                import re
                                match = re.search(r'(\d+\.\d+\.\d+)', line)
                                if match:
                                    return f"{match.group(1)}{'-insiders' if version_type == 'insiders' else ''}"
            return f"1.95.0{'-insiders' if version_type == 'insiders' else ''}"
        except Exception as e:
            print(f"Warning: Could not extract version: {e}")
            return f"1.95.0{'-insiders' if version_type == 'insiders' else ''}"
    
    def collect_extension_logs(self) -> List[Dict[str, Any]]:
        """Collect extension-specific logs"""
        logs = []
        vscode_paths = self.get_vscode_paths()
        
        for log_type, log_path in vscode_paths.items():
            if not log_path.exists():
                print(f"⚠️  {log_type} logs not found at {log_path}")
                continue
            
            print(f"📂 Scanning {log_type} logs at {log_path}")
            
            # Get the latest log file
            log_files = sorted(log_path.glob("*.log"), reverse=True)[:5]
            
            for log_file in log_files:
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        
                        # Check for PiCanvas extension activity
                        if 'picanvas' in content.lower() or 'extension' in content.lower():
                            version = self.extract_version_from_logs(log_path, log_type)
                            
                            logs.append({
                                "timestamp": datetime.now().isoformat(),
                                "version": version,
                                "type": log_type,
                                "eventType": "Extension Activity",
                                "details": f"PiCanvas extension activity detected in {log_file.name}",
                                "status": "success",
                                "logFile": log_file.name,
                                "platform": self.platform,
                                "metadata": {
                                    "file_size": log_file.stat().st_size,
                                    "modified": datetime.fromtimestamp(log_file.stat().st_mtime).isoformat()
                                }
                            })
                except Exception as e:
                    print(f"⚠️  Error reading {log_file}: {e}")
        
        return logs
    
    def load_existing_logs(self) -> List[Dict[str, Any]]:
        """Load existing logs from vscode-logs.json"""
        log_file = Path(self.data_dir) / "vscode-logs.json"
        if log_file.exists():
            try:
                with open(log_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️  Could not load existing logs: {e}")
        return []
    
    def save_logs(self, logs: List[Dict[str, Any]]):
        """Save logs to file"""
        log_file = Path(self.data_dir) / "vscode-logs.json"
        try:
            with open(log_file, 'w') as f:
                json.dump(logs, f, indent=2)
            print(f"✅ Saved {len(logs)} logs to {log_file}")
        except Exception as e:
            print(f"❌ Error saving logs: {e}")
    
    def send_to_server(self, logs: List[Dict[str, Any]]):
        """Send logs to analytics server"""
        if not logs:
            print("ℹ️  No new logs to send")
            return
        
        try:
            headers = {'Content-Type': 'application/json'}
            
            for log in logs:
                response = requests.post(
                    f"{self.server_url}/api/analytics/vscode/log",
                    json=log,
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code in [200, 201]:
                    print(f"✅ Sent: {log['eventType']} ({log['version']})")
                else:
                    print(f"⚠️  Server returned {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"⚠️  Could not connect to server at {self.server_url}")
            print("   Make sure the analytics server is running:")
            print("   npm start --prefix ./analytics")
        except Exception as e:
            print(f"❌ Error sending logs: {e}")
    
    def collect_and_aggregate(self):
        """Collect logs and aggregate with existing data"""
        print("\n🔄 Collecting VS Code logs...\n")
        
        # Collect new logs
        new_logs = self.collect_extension_logs()
        
        # Load existing logs
        existing_logs = self.load_existing_logs()
        
        # Merge (avoid duplicates based on timestamp and version)
        merged_logs = existing_logs.copy()
        existing_timestamps = {(log['timestamp'], log['version']) for log in existing_logs}
        
        for log in new_logs:
            if (log['timestamp'], log['version']) not in existing_timestamps:
                merged_logs.append(log)
        
        # Save merged logs
        self.save_logs(merged_logs)
        
        # Send to server
        print("\n📤 Sending logs to analytics server...\n")
        self.send_to_server(new_logs)
        
        # Print summary
        self.print_summary(merged_logs)
    
    def print_summary(self, logs: List[Dict[str, Any]]):
        """Print collection summary"""
        if not logs:
            print("\n📊 No VS Code logs collected\n")
            return
        
        stable_count = len([l for l in logs if l['type'] == 'stable'])
        insiders_count = len([l for l in logs if l['type'] == 'insiders'])
        
        print("\n" + "="*60)
        print("📊 VS Code Logs Summary")
        print("="*60)
        print(f"Total Logs:           {len(logs)}")
        print(f"Stable Version:       {stable_count}")
        print(f"Insiders Version:     {insiders_count}")
        print(f"Collection Time:      {datetime.now().isoformat()}")
        print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Collect VS Code extension logs and send to analytics server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 collect_vscode_logs.py
  python3 collect_vscode_logs.py --server http://localhost:4200
  python3 collect_vscode_logs.py --data-dir ../
        """
    )
    
    parser.add_argument(
        '--server',
        default='http://localhost:4200',
        help='Analytics server URL (default: http://localhost:4200)'
    )
    parser.add_argument(
        '--data-dir',
        default='.',
        help='Directory to store logs (default: current directory)'
    )
    parser.add_argument(
        '--version',
        help='Override VS Code version'
    )
    
    args = parser.parse_args()
    
    collector = VSCodeLogCollector(
        server_url=args.server,
        data_dir=args.data_dir
    )
    
    collector.collect_and_aggregate()


if __name__ == '__main__':
    main()
