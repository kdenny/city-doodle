#!/usr/bin/env python3
"""
Create Linear tickets from TICKETS.md with proper dependencies.

This script:
1. Parses TICKETS.md to extract all tickets
2. Creates them in Linear
3. Sets up blocking relationships
"""

import os
import re
import sys
from dataclasses import dataclass, field

import requests

LINEAR_API_URL = "https://api.linear.app/graphql"
API_KEY = os.environ.get("LINEAR_API_KEY")
TEAM_ID = "48a87c3c-6f07-4af2-b5aa-4e100919ba26"

if not API_KEY:
    print("ERROR: LINEAR_API_KEY not set")
    sys.exit(1)

HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json",
}


@dataclass
class TicketDef:
    """Ticket definition from TICKETS.md"""

    id: str  # Our ID like SETUP-001
    title: str
    type: str  # Task, Chore, Design
    priority: str  # P0, P1, P2, P3
    description: str
    blocked_by: list[str] = field(default_factory=list)
    assignee: str | None = None
    linear_id: str | None = None  # CITY-XX after creation
    linear_uuid: str | None = None  # Internal UUID


def execute_query(query: str, variables: dict = None) -> dict:
    """Execute GraphQL query against Linear API."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    response = requests.post(LINEAR_API_URL, headers=HEADERS, json=payload, timeout=30)
    response.raise_for_status()
    result = response.json()

    if "errors" in result:
        print(f"GraphQL errors: {result['errors']}")

    return result


def parse_tickets_md(filepath: str) -> list[TicketDef]:
    """Parse TICKETS.md and extract ticket definitions."""
    with open(filepath) as f:
        content = f.read()

    tickets = []

    # More comprehensive pattern
    sections = re.split(r"\n(?=### [A-Z])", content)

    for section in sections:
        if not section.strip().startswith("### "):
            continue

        lines = section.strip().split("\n")
        header = lines[0]

        # Parse header: ### ID: Title
        header_match = re.match(r"### ([A-Z0-9-]+): (.+)", header)
        if not header_match:
            continue

        ticket_id = header_match.group(1)
        title = header_match.group(2).strip()

        # Parse metadata
        ticket_type = "Task"
        priority = "P1"
        blocked_by = []
        assignee = None
        description_lines = []
        in_description = False

        for line in lines[1:]:
            line = line.strip()

            if line.startswith("**Type:**"):
                ticket_type = line.replace("**Type:**", "").strip()
            elif line.startswith("**Priority:**"):
                priority = line.replace("**Priority:**", "").strip()
            elif line.startswith("**Blocked By:**"):
                blocked_str = line.replace("**Blocked By:**", "").strip()
                blocked_by = [b.strip() for b in blocked_str.split(",") if b.strip()]
            elif line.startswith("**Assignee:**"):
                assignee = line.replace("**Assignee:**", "").strip()
            elif line.startswith("**Description:**"):
                in_description = True
            elif line.startswith("**Acceptance Criteria:**"):
                in_description = False
                description_lines.append("\n## Acceptance Criteria")
            elif line.startswith("- [ ]"):
                description_lines.append(line)
            elif in_description or (not line.startswith("**") and line):
                if line and not line.startswith("---"):
                    description_lines.append(line)

        description = "\n".join(description_lines).strip()

        tickets.append(
            TicketDef(
                id=ticket_id,
                title=title,
                type=ticket_type,
                priority=priority,
                description=description,
                blocked_by=blocked_by,
                assignee=assignee,
            )
        )

    return tickets


def get_label_ids() -> dict[str, str]:
    """Fetch existing labels and their IDs (case-insensitive lookup)."""
    query = """
    query GetLabels($teamId: String!) {
        team(id: $teamId) {
            labels {
                nodes {
                    id
                    name
                }
            }
        }
    }
    """
    result = execute_query(query, {"teamId": TEAM_ID})
    labels = result.get("data", {}).get("team", {}).get("labels", {}).get("nodes", [])
    # Store both original name and lowercase for matching
    label_map = {}
    for label in labels:
        label_map[label["name"]] = label["id"]
        label_map[label["name"].lower()] = label["id"]
    return label_map


def create_label(name: str) -> str | None:
    """Create a label and return its ID."""
    mutation = """
    mutation CreateLabel($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
            success
            issueLabel {
                id
                name
            }
        }
    }
    """
    result = execute_query(mutation, {"input": {"name": name, "teamId": TEAM_ID}})
    data = result.get("data")
    if data and data.get("issueLabelCreate") and data["issueLabelCreate"].get("issueLabel"):
        return data["issueLabelCreate"]["issueLabel"].get("id")
    return None


def ensure_labels(ticket_types: set[str], priorities: set[str]) -> dict[str, str]:
    """Ensure all needed labels exist and return their IDs."""
    existing = get_label_ids()
    all_labels = {}

    needed = ticket_types | priorities

    for label_name in needed:
        # Check case-insensitive
        if label_name in existing:
            all_labels[label_name] = existing[label_name]
        elif label_name.lower() in existing:
            all_labels[label_name] = existing[label_name.lower()]
        else:
            print(f"Creating label: {label_name}")
            try:
                label_id = create_label(label_name)
                if label_id:
                    all_labels[label_name] = label_id
            except Exception as e:
                print(f"  Warning: Could not create label {label_name}: {e}")

    return all_labels


def create_ticket(ticket: TicketDef, label_ids: dict[str, str]) -> tuple[str, str]:
    """Create a single ticket in Linear. Returns (identifier, uuid)."""
    mutation = """
    mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
            success
            issue {
                id
                identifier
                title
            }
        }
    }
    """

    # Build description with our tracking ID
    full_description = f"**Internal ID:** {ticket.id}\n\n{ticket.description}"

    # Build input
    input_obj = {
        "teamId": TEAM_ID,
        "title": ticket.title,
        "description": full_description,
    }

    # Add labels
    labels_to_add = []
    if ticket.type in label_ids:
        labels_to_add.append(label_ids[ticket.type])
    if ticket.priority in label_ids:
        labels_to_add.append(label_ids[ticket.priority])

    if labels_to_add:
        input_obj["labelIds"] = labels_to_add

    result = execute_query(mutation, {"input": input_obj})
    issue = result.get("data", {}).get("issueCreate", {}).get("issue", {})

    return issue.get("identifier"), issue.get("id")


def create_blocking_relation(blocking_uuid: str, blocked_uuid: str):
    """Create a 'blocks' relation between two issues."""
    mutation = """
    mutation CreateRelation($input: IssueRelationCreateInput!) {
        issueRelationCreate(input: $input) {
            success
            issueRelation {
                id
            }
        }
    }
    """
    input_obj = {
        "issueId": blocked_uuid,  # The blocked issue
        "relatedIssueId": blocking_uuid,  # The blocking issue
        "type": "blocks",
    }

    result = execute_query(mutation, {"input": input_obj})
    return result.get("data", {}).get("issueRelationCreate", {}).get("success", False)


def main():
    print("=" * 60)
    print("  Linear Ticket Creator")
    print("=" * 60)
    print()

    # Parse tickets
    tickets_file = os.path.join(os.path.dirname(__file__), "..", "TICKETS.md")
    tickets = parse_tickets_md(tickets_file)

    if not tickets:
        print("No tickets found in TICKETS.md")
        return

    print(f"Found {len(tickets)} tickets to create")
    print()

    # Filter to only V1 tickets (exclude V2- prefix)
    v1_tickets = [t for t in tickets if not t.id.startswith("V2-")]
    v2_tickets = [t for t in tickets if t.id.startswith("V2-")]

    print(f"  V1 tickets: {len(v1_tickets)}")
    print(f"  V2 tickets: {len(v2_tickets)} (will be created but marked lower priority)")
    print()

    # Collect all types and priorities
    types = {t.type for t in tickets}
    priorities = {t.priority for t in tickets}

    print(f"Types: {types}")
    print(f"Priorities: {priorities}")
    print()

    # Ensure labels exist
    print("Setting up labels...")
    label_ids = ensure_labels(types, priorities)
    print(f"Labels ready: {list(label_ids.keys())}")
    print()

    # Create tickets
    print("Creating tickets...")
    id_map = {}  # Our ID -> Linear UUID

    for i, ticket in enumerate(tickets, 1):
        print(f"  [{i}/{len(tickets)}] Creating {ticket.id}: {ticket.title[:40]}...")
        try:
            identifier, uuid = create_ticket(ticket, label_ids)
            ticket.linear_id = identifier
            ticket.linear_uuid = uuid
            id_map[ticket.id] = uuid
            print(f"           -> {identifier}")
        except Exception as e:
            print(f"           -> FAILED: {e}")

    print()
    print("Creating blocking relationships...")

    # Create blocking relations
    relations_created = 0
    for ticket in tickets:
        if not ticket.blocked_by or not ticket.linear_uuid:
            continue

        for blocker_id in ticket.blocked_by:
            blocker_uuid = id_map.get(blocker_id)
            if not blocker_uuid:
                print(f"  Warning: {ticket.id} blocked by unknown {blocker_id}")
                continue

            try:
                success = create_blocking_relation(blocker_uuid, ticket.linear_uuid)
                if success:
                    relations_created += 1
                    print(f"  {blocker_id} -> blocks -> {ticket.id}")
            except Exception as e:
                print(f"  Failed: {blocker_id} -> {ticket.id}: {e}")

    print()
    print("=" * 60)
    print(f"  Done! Created {len([t for t in tickets if t.linear_id])} tickets")
    print(f"  Created {relations_created} blocking relationships")
    print("=" * 60)

    # Output mapping for reference
    print()
    print("ID Mapping:")
    for ticket in tickets:
        if ticket.linear_id:
            print(f"  {ticket.id} -> {ticket.linear_id}")


if __name__ == "__main__":
    main()
