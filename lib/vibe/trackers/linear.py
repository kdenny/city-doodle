"""Linear.app ticket tracker integration."""

import os
from typing import Any

import requests

from lib.vibe.trackers.base import Ticket, TrackerBase

LINEAR_API_URL = "https://api.linear.app/graphql"


class LinearTracker(TrackerBase):
    """Linear.app integration."""

    def __init__(self, api_key: str | None = None, team_id: str | None = None):
        self._api_key = api_key or os.environ.get("LINEAR_API_KEY")
        self._team_id = team_id
        self._headers: dict[str, str] = {}
        if self._api_key:
            self._headers = {
                "Authorization": self._api_key,
                "Content-Type": "application/json",
            }

    @property
    def name(self) -> str:
        return "linear"

    def authenticate(self, **kwargs: Any) -> bool:
        """Authenticate with Linear API."""
        api_key = kwargs.get("api_key") or self._api_key
        if not api_key:
            return False

        self._api_key = api_key
        self._headers = {
            "Authorization": api_key,
            "Content-Type": "application/json",
        }

        # Test authentication
        query = """
        query {
            viewer {
                id
                name
            }
        }
        """
        try:
            response = self._execute_query(query)
            return "viewer" in response.get("data", {})
        except Exception:
            return False

    def _execute_query(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL query against Linear API."""
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        response = requests.post(LINEAR_API_URL, headers=self._headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_ticket(self, ticket_id: str) -> Ticket | None:
        """Fetch a single ticket by ID or identifier."""
        query = """
        query GetIssue($id: String!) {
            issue(id: $id) {
                id
                identifier
                title
                description
                state { id name }
                team { id }
                labels { nodes { name } }
                url
            }
        }
        """
        try:
            result = self._execute_query(query, {"id": ticket_id})
            issue = result.get("data", {}).get("issue")
            if not issue:
                return None
            return self._parse_issue(issue)
        except Exception:
            return None

    def list_tickets(
        self,
        status: str | None = None,
        labels: list[str] | None = None,
        limit: int = 50,
    ) -> list[Ticket]:
        """List tickets with optional filters."""
        query = """
        query ListIssues($first: Int!, $filter: IssueFilter) {
            issues(first: $first, filter: $filter) {
                nodes {
                    id
                    identifier
                    title
                    description
                    state { name }
                    labels { nodes { name } }
                    url
                }
            }
        }
        """
        filter_obj: dict[str, Any] = {}
        if self._team_id:
            filter_obj["team"] = {"id": {"eq": self._team_id}}
        if status:
            filter_obj["state"] = {"name": {"eq": status}}
        if labels:
            filter_obj["labels"] = {"name": {"in": labels}}

        variables: dict[str, Any] = {"first": limit}
        if filter_obj:
            variables["filter"] = filter_obj

        try:
            result = self._execute_query(query, variables)
            issues = result.get("data", {}).get("issues", {}).get("nodes", [])
            return [self._parse_issue(issue) for issue in issues]
        except Exception:
            return []

    def create_ticket(
        self,
        title: str,
        description: str,
        labels: list[str] | None = None,
    ) -> Ticket:
        """Create a new ticket in Linear."""
        mutation = """
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    description
                    state { name }
                    labels { nodes { name } }
                    url
                }
            }
        }
        """
        input_obj: dict[str, Any] = {
            "title": title,
            "description": description,
        }
        if self._team_id:
            input_obj["teamId"] = self._team_id
        if labels:
            label_ids = self._get_or_create_label_ids(self._team_id, labels)
            if label_ids:
                input_obj["labelIds"] = label_ids

        result = self._execute_query(mutation, {"input": input_obj})
        issue = result.get("data", {}).get("issueCreate", {}).get("issue")
        if not issue:
            raise RuntimeError("Failed to create ticket")
        return self._parse_issue(issue)

    def update_ticket(
        self,
        ticket_id: str,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        labels: list[str] | None = None,
    ) -> Ticket:
        """Update an existing ticket."""
        input_obj: dict[str, Any] = {}
        if title:
            input_obj["title"] = title
        if description:
            input_obj["description"] = description
        if status:
            # Resolve status name to workflow state ID
            issue = self.get_ticket(ticket_id)
            if not issue:
                raise RuntimeError(f"Ticket not found: {ticket_id}")
            team_id = (issue.raw.get("team") or {}).get("id") or self._team_id
            if not team_id:
                raise RuntimeError("Cannot resolve status: issue has no team")
            state_id = self._get_workflow_state_id(team_id, status)
            if not state_id:
                raise RuntimeError(
                    f"No workflow state named '{status}' for this team. "
                    "Check state name in Linear (e.g. Done, Canceled, In Progress)."
                )
            input_obj["stateId"] = state_id

        if labels:
            issue = issue if status else self.get_ticket(ticket_id)
            if not issue:
                raise RuntimeError(f"Ticket not found: {ticket_id}")
            team_id = (issue.raw.get("team") or {}).get("id") or self._team_id
            label_ids = self._get_or_create_label_ids(team_id, labels)
            if label_ids:
                input_obj["labelIds"] = label_ids

        mutation = """
        mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    description
                    state { name }
                    labels { nodes { name } }
                    url
                }
            }
        }
        """
        result = self._execute_query(mutation, {"id": ticket_id, "input": input_obj})
        issue = result.get("data", {}).get("issueUpdate", {}).get("issue")
        if not issue:
            raise RuntimeError("Failed to update ticket")
        return self._parse_issue(issue)

    def comment_ticket(self, ticket_id: str, body: str) -> None:
        """Add a comment to a Linear issue."""
        issue = self.get_ticket(ticket_id)
        if not issue:
            raise RuntimeError(f"Ticket not found: {ticket_id}")
        issue_uuid = issue.raw.get("id")
        if not issue_uuid:
            raise RuntimeError("Cannot comment: issue has no id")

        mutation = """
        mutation CreateComment($input: CommentCreateInput!) {
            commentCreate(input: $input) {
                success
                comment { id }
            }
        }
        """
        self._execute_query(
            mutation,
            {"input": {"issueId": issue_uuid, "body": body}},
        )

    def validate_config(self) -> tuple[bool, list[str]]:
        """Validate Linear configuration."""
        issues = []

        if not self._api_key:
            issues.append("LINEAR_API_KEY not set")

        if not self._team_id:
            issues.append("Linear team ID not configured")

        if self._api_key and not self.authenticate():
            issues.append("LINEAR_API_KEY is invalid or expired")

        return len(issues) == 0, issues

    def _get_or_create_label_ids(self, team_id: str | None, label_names: list[str]) -> list[str]:
        """Resolve label names to IDs, creating any that don't exist."""
        if not team_id or not label_names:
            return []
        label_names = self._normalize_labels(label_names)
        # Build name->id map for existing labels
        query = """
        query TeamLabels($teamId: String!) {
            team(id: $teamId) {
                labels { nodes { id name } }
            }
        }
        """
        try:
            result = self._execute_query(query, {"teamId": team_id})
            nodes = result.get("data", {}).get("team", {}).get("labels", {}).get("nodes", [])
            name_to_id = {n.get("name", ""): n["id"] for n in nodes if n.get("id")}
        except Exception:
            name_to_id = {}

        ids = []
        for name in label_names:
            if name in name_to_id:
                ids.append(name_to_id[name])
            else:
                new_id = self._create_label(team_id, name)
                if new_id:
                    ids.append(new_id)
        return ids

    def _create_label(self, team_id: str, name: str) -> str | None:
        """Create a new label in Linear and return its ID."""
        mutation = """
        mutation CreateLabel($input: IssueLabelCreateInput!) {
            issueLabelCreate(input: $input) {
                success
                issueLabel { id name }
            }
        }
        """
        try:
            result = self._execute_query(mutation, {"input": {"name": name, "teamId": team_id}})
            label = result.get("data", {}).get("issueLabelCreate", {}).get("issueLabel")
            return label.get("id") if label else None
        except Exception:
            return None

    def _get_label_ids(self, team_id: str | None, label_names: list[str]) -> list[str]:
        """Resolve label names to Linear label IDs for the team."""
        if not team_id or not label_names:
            return []
        label_names = self._normalize_labels(label_names)
        query = """
        query TeamLabels($teamId: String!) {
            team(id: $teamId) {
                labels { nodes { id name } }
            }
        }
        """
        try:
            result = self._execute_query(query, {"teamId": team_id})
            nodes = result.get("data", {}).get("team", {}).get("labels", {}).get("nodes", [])
            name_to_id = {n.get("name", ""): n["id"] for n in nodes if n.get("id")}
            return [name_to_id[n] for n in label_names if n in name_to_id]
        except Exception:
            return []

    def list_labels(self) -> list[dict[str, str]]:
        """List all labels with their IDs for the configured team."""
        query = """
        query ListLabels($teamId: String) {
            issueLabels(filter: { team: { id: { eq: $teamId } } }, first: 100) {
                nodes {
                    id
                    name
                    color
                }
            }
        }
        """
        variables = {}
        if self._team_id:
            variables["teamId"] = self._team_id

        try:
            result = self._execute_query(query, variables if variables else None)
            nodes = result.get("data", {}).get("issueLabels", {}).get("nodes", [])
            return [
                {
                    "id": node.get("id", ""),
                    "name": node.get("name", ""),
                    "color": node.get("color", ""),
                }
                for node in nodes
            ]
        except Exception:
            return []

    def _get_workflow_state_id(self, team_id: str, state_name: str) -> str | None:
        """Resolve workflow state name to state ID for a team."""
        query = """
        query WorkflowStates($teamId: String!) {
            team(id: $teamId) {
                states {
                    nodes {
                        id
                        name
                    }
                }
            }
        }
        """
        try:
            result = self._execute_query(query, {"teamId": team_id})
            nodes = result.get("data", {}).get("team", {}).get("states", {}).get("nodes", [])
            for node in nodes:
                if node.get("name", "").lower() == state_name.lower():
                    return node.get("id")
            return None
        except Exception:
            return None

    def _parse_issue(self, issue: dict) -> Ticket:
        """Parse a Linear issue into a Ticket."""
        state = issue.get("state") or {}
        return Ticket(
            id=issue.get("identifier", issue.get("id", "")),
            title=issue.get("title", ""),
            description=issue.get("description", ""),
            status=state.get("name", ""),
            labels=[label["name"] for label in issue.get("labels", {}).get("nodes", [])],
            url=issue.get("url", ""),
            raw=issue,
        )

    def _resolve_issue_id(self, ticket_id: str) -> str | None:
        """Resolve a ticket identifier (e.g. CITY-123) to a Linear UUID."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return None
        return ticket.raw.get("id")

    def add_blocking(self, blocker_id: str, blocked_id: str) -> bool:
        """Create a blocking relationship: blocker_id blocks blocked_id.

        Args:
            blocker_id: The ticket that blocks (prerequisite)
            blocked_id: The ticket that is blocked (dependent)

        Returns:
            True if relationship was created successfully.
        """
        # Resolve identifiers to UUIDs
        blocker_uuid = self._resolve_issue_id(blocker_id)
        blocked_uuid = self._resolve_issue_id(blocked_id)

        if not blocker_uuid or not blocked_uuid:
            raise RuntimeError(
                f"Could not resolve ticket IDs: {blocker_id}={blocker_uuid}, {blocked_id}={blocked_uuid}"
            )

        mutation = """
        mutation CreateIssueRelation($input: IssueRelationCreateInput!) {
            issueRelationCreate(input: $input) {
                success
                issueRelation {
                    id
                    type
                }
            }
        }
        """
        # In Linear, "blocks" relation type means: issueId blocks relatedIssueId
        input_obj = {
            "issueId": blocker_uuid,
            "relatedIssueId": blocked_uuid,
            "type": "blocks",
        }

        try:
            result = self._execute_query(mutation, {"input": input_obj})
            success = result.get("data", {}).get("issueRelationCreate", {}).get("success", False)
            return success
        except Exception as e:
            raise RuntimeError(f"Failed to create blocking relationship: {e}") from e

    def remove_blocking(self, blocker_id: str, blocked_id: str) -> bool:
        """Remove a blocking relationship between two tickets.

        Args:
            blocker_id: The ticket that blocks (prerequisite)
            blocked_id: The ticket that is blocked (dependent)

        Returns:
            True if relationship was removed successfully.
        """
        # First, find the relation ID
        blocker_uuid = self._resolve_issue_id(blocker_id)
        if not blocker_uuid:
            raise RuntimeError(f"Could not resolve ticket ID: {blocker_id}")

        # Query relations for the blocker issue
        query = """
        query GetIssueRelations($id: String!) {
            issue(id: $id) {
                relations {
                    nodes {
                        id
                        type
                        relatedIssue {
                            identifier
                        }
                    }
                }
            }
        }
        """
        try:
            result = self._execute_query(query, {"id": blocker_id})
            relations = (
                result.get("data", {}).get("issue", {}).get("relations", {}).get("nodes", [])
            )

            # Find the blocking relation to the blocked ticket
            relation_id = None
            for rel in relations:
                if rel.get("type") == "blocks":
                    related = rel.get("relatedIssue", {})
                    if related.get("identifier") == blocked_id:
                        relation_id = rel.get("id")
                        break

            if not relation_id:
                return False  # No such relation exists

            # Delete the relation
            mutation = """
            mutation DeleteIssueRelation($id: String!) {
                issueRelationDelete(id: $id) {
                    success
                }
            }
            """
            result = self._execute_query(mutation, {"id": relation_id})
            return result.get("data", {}).get("issueRelationDelete", {}).get("success", False)
        except Exception as e:
            raise RuntimeError(f"Failed to remove blocking relationship: {e}") from e

    def get_blocking_relationships(self, ticket_id: str) -> dict[str, list[str]]:
        """Get blocking relationships for a ticket.

        Returns:
            Dict with 'blocks' (tickets this one blocks) and 'blocked_by' (tickets blocking this one).
        """
        query = """
        query GetIssueRelations($id: String!) {
            issue(id: $id) {
                relations {
                    nodes {
                        type
                        relatedIssue {
                            identifier
                            title
                        }
                    }
                }
                inverseRelations {
                    nodes {
                        type
                        issue {
                            identifier
                            title
                        }
                    }
                }
            }
        }
        """
        try:
            result = self._execute_query(query, {"id": ticket_id})
            issue = result.get("data", {}).get("issue", {})

            blocks = []
            blocked_by = []

            # Relations where this issue is the source
            for rel in issue.get("relations", {}).get("nodes", []):
                if rel.get("type") == "blocks":
                    related = rel.get("relatedIssue", {})
                    blocks.append(related.get("identifier", ""))

            # Inverse relations where this issue is the target
            for rel in issue.get("inverseRelations", {}).get("nodes", []):
                if rel.get("type") == "blocks":
                    source = rel.get("issue", {})
                    blocked_by.append(source.get("identifier", ""))

            return {"blocks": blocks, "blocked_by": blocked_by}
        except Exception:
            return {"blocks": [], "blocked_by": []}

    def list_projects(self) -> list[dict[str, str]]:
        """List all projects for the configured team."""
        query = """
        query ListProjects($teamId: String) {
            projects(filter: { accessibleTeams: { id: { eq: $teamId } } }, first: 100) {
                nodes {
                    id
                    name
                    description
                    state
                    url
                }
            }
        }
        """
        variables = {}
        if self._team_id:
            variables["teamId"] = self._team_id

        try:
            result = self._execute_query(query, variables if variables else None)
            nodes = result.get("data", {}).get("projects", {}).get("nodes", [])
            return [
                {
                    "id": node.get("id", ""),
                    "name": node.get("name", ""),
                    "description": node.get("description", ""),
                    "state": node.get("state", ""),
                    "url": node.get("url", ""),
                }
                for node in nodes
            ]
        except Exception:
            return []

    def _get_project_id(self, project_name: str) -> str | None:
        """Resolve project name to project ID."""
        projects = self.list_projects()
        for proj in projects:
            if proj.get("name", "").lower() == project_name.lower():
                return proj.get("id")
        return None

    def set_project(self, ticket_id: str, project_id: str) -> bool:
        """Assign a ticket to a project.

        Args:
            ticket_id: The ticket identifier (e.g. CITY-123)
            project_id: The project UUID

        Returns:
            True if assignment was successful.
        """
        issue_uuid = self._resolve_issue_id(ticket_id)
        if not issue_uuid:
            raise RuntimeError(f"Could not resolve ticket ID: {ticket_id}")

        mutation = """
        mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
            }
        }
        """
        try:
            result = self._execute_query(
                mutation, {"id": ticket_id, "input": {"projectId": project_id}}
            )
            return result.get("data", {}).get("issueUpdate", {}).get("success", False)
        except Exception as e:
            raise RuntimeError(f"Failed to set project: {e}") from e
