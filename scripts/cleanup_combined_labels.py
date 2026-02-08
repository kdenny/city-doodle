#!/usr/bin/env python3
"""Clean up combined comma-separated labels in Linear.

This script:
1. Finds all tickets with combined labels (e.g. "Bug,frontend,Low Risk,v1")
2. Splits them into individual labels and re-tags each ticket
3. Deletes the junk combined labels afterward
"""

import os
import sys
import time

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests as req
from lib.vibe.config import load_config
from lib.vibe.trackers.linear import LINEAR_API_URL, LinearTracker


def main() -> None:
    config = load_config()
    team_id = config.get("tracker", {}).get("config", {}).get("team_id")
    if not team_id:
        print("ERROR: No team_id configured")
        sys.exit(1)

    tracker = LinearTracker(team_id=team_id)

    # Step 1: Build name->id map for individual labels
    result = tracker._execute_query(
        """
        query TeamLabels($teamId: String!) {
            team(id: $teamId) {
                labels(first: 250) { nodes { id name } }
            }
        }
        """,
        {"teamId": team_id},
    )
    all_labels = result.get("data", {}).get("team", {}).get("labels", {}).get("nodes", [])
    individual_labels = {n["name"]: n["id"] for n in all_labels if "," not in n.get("name", "")}
    combined_labels = [n for n in all_labels if "," in n.get("name", "")]

    print(f"Individual labels available: {len(individual_labels)}")
    print(f"Combined (junk) labels to clean: {len(combined_labels)}")

    # Step 2: Find all tickets with combined labels
    payload = {
        "query": """
        query ListIssues($first: Int!, $filter: IssueFilter) {
            issues(first: $first, filter: $filter) {
                nodes {
                    id identifier title
                    labels { nodes { id name } }
                }
            }
        }
        """,
        "variables": {
            "first": 200,
            "filter": {"team": {"id": {"eq": team_id}}},
        },
    }
    response = req.post(LINEAR_API_URL, headers=tracker._headers, json=payload, timeout=30)
    result = response.json()
    issues = result.get("data", {}).get("issues", {}).get("nodes", [])

    affected = []
    for issue in issues:
        labels = issue.get("labels", {}).get("nodes", [])
        has_combined = any("," in l.get("name", "") for l in labels)
        if has_combined:
            affected.append(issue)

    print(f"\nTickets to fix: {len(affected)}")

    # Step 3: Fix each ticket
    for issue in affected:
        identifier = issue["identifier"]
        current_labels = issue.get("labels", {}).get("nodes", [])
        current_names = [l["name"] for l in current_labels]

        # Split combined labels into individual names
        new_names: list[str] = []
        for name in current_names:
            if "," in name:
                parts = [p.strip() for p in name.split(",")]
                new_names.extend(p for p in parts if p)
            else:
                new_names.append(name)

        # Deduplicate
        new_names = list(dict.fromkeys(new_names))

        # Resolve to IDs
        new_ids = tracker._get_or_create_label_ids(team_id, new_names)

        if not new_ids:
            print(f"  SKIP {identifier}: could not resolve any labels from {new_names}")
            continue

        # Update the ticket
        try:
            update_result = tracker._execute_query(
                """
                mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
                    issueUpdate(id: $id, input: $input) {
                        success
                        issue {
                            identifier
                            labels { nodes { name } }
                        }
                    }
                }
                """,
                {"id": identifier, "input": {"labelIds": new_ids}},
            )
            updated = update_result.get("data", {}).get("issueUpdate", {})
            if updated and updated.get("success"):
                result_labels = [
                    l["name"]
                    for l in updated.get("issue", {}).get("labels", {}).get("nodes", [])
                ]
                print(f"  FIXED {identifier}: {current_names} -> {result_labels}")
            else:
                print(f"  FAIL  {identifier}: API returned {update_result}")
        except Exception as e:
            print(f"  ERROR {identifier}: {e}")

        time.sleep(0.2)  # Rate limit

    # Step 4: Delete combined (junk) labels
    print(f"\nDeleting {len(combined_labels)} combined labels...")
    deleted = 0
    for label in combined_labels:
        try:
            del_result = tracker._execute_query(
                """
                mutation DeleteLabel($id: String!) {
                    issueLabelDelete(id: $id) {
                        success
                    }
                }
                """,
                {"id": label["id"]},
            )
            success = del_result.get("data", {}).get("issueLabelDelete", {}).get("success", False)
            if success:
                deleted += 1
            else:
                print(f"  FAIL to delete: {label['name']}")
        except Exception as e:
            print(f"  ERROR deleting {label['name']}: {e}")
        time.sleep(0.1)

    print(f"Deleted {deleted}/{len(combined_labels)} junk labels")

    # Also clean up test tickets
    test_tickets = ["CITY-518", "CITY-519", "CITY-523"]
    print(f"\nCleaning up test tickets: {test_tickets}")
    for tid in test_tickets:
        try:
            ticket = tracker.get_ticket(tid)
            if ticket and "test" in ticket.title.lower():
                tracker.update_ticket(tid, status="Canceled")
                print(f"  Canceled {tid}")
        except Exception:
            pass

    print("\nDone!")


if __name__ == "__main__":
    main()
