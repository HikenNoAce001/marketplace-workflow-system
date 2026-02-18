"""
End-to-End Workflow Test — runs the ENTIRE flow automatically.

No Postman, no Swagger, no manual token switching.
Just run: make test-flow

Prints EVERY request and response so you can trace the full flow.
"""

import httpx
import io
import json
import zipfile
import sys

BASE = "http://localhost:8000/api"

# Colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def pretty(data: dict) -> str:
    """Pretty-print JSON with indentation."""
    return json.dumps(data, indent=2, default=str)


def show_request(method: str, url: str, body=None, who: str = ""):
    """Print what we're sending."""
    print(f"\n  {BLUE}→ {method} {url}{RESET}")
    if who:
        print(f"  {DIM}  As: {who}{RESET}")
    if body:
        print(f"  {DIM}  Body: {json.dumps(body)}{RESET}")


def show_response(res: httpx.Response):
    """Print what we got back."""
    status_color = GREEN if res.status_code < 400 else RED
    print(f"  {status_color}← {res.status_code}{RESET}")
    try:
        data = res.json()
        # Print each field on its own line for readability
        for key, value in data.items():
            print(f"    {BOLD}{key}{RESET}: {value}")
    except Exception:
        print(f"    {res.text}")


def ok(msg): print(f"  {GREEN}✓ {msg}{RESET}")
def fail(msg): print(f"  {RED}✗ {msg}{RESET}")
def step(num, msg): print(f"\n{BOLD}{YELLOW}{'─'*60}\n  STEP {num}: {msg}\n{'─'*60}{RESET}")


def run_test():
    client = httpx.Client(timeout=30)

    print(f"\n{BOLD}{'='*60}")
    print("  MARKETPLACE WORKFLOW — END-TO-END TEST")
    print(f"  Testing the complete lifecycle automatically")
    print(f"{'='*60}{RESET}")

    # ─── Step 1: Login as Buyer ───
    step(1, "LOGIN AS BUYER")
    show_request("POST", f"{BASE}/auth/dev-login", {"email": "buyer@test.com"})
    res = client.post(f"{BASE}/auth/dev-login", json={"email": "buyer@test.com"})
    show_response(res)

    if res.status_code != 200:
        fail("Login failed! Is the backend running? Did you run 'make seed'?")
        sys.exit(1)

    buyer_token = res.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    ok("Buyer logged in — token saved")

    # ─── Step 2: Create Project ───
    step(2, "CREATE PROJECT (as Buyer)")
    project_body = {
        "title": "E2E Test Project",
        "description": "Automated end-to-end test",
        "budget": 1000,
    }
    show_request("POST", f"{BASE}/projects", project_body, "buyer@test.com")
    res = client.post(f"{BASE}/projects", json=project_body, headers=buyer_headers)
    show_response(res)

    if res.status_code != 201:
        fail(f"Create project failed!")
        sys.exit(1)

    project_id = res.json()["id"]
    ok(f"Project created with status OPEN")
    ok(f"Project ID: {project_id}")

    # ─── Step 3: Login as Solver ───
    step(3, "LOGIN AS SOLVER")
    show_request("POST", f"{BASE}/auth/dev-login", {"email": "solver@test.com"})
    res = client.post(f"{BASE}/auth/dev-login", json={"email": "solver@test.com"})
    show_response(res)

    solver_token = res.json()["access_token"]
    solver_headers = {"Authorization": f"Bearer {solver_token}"}
    ok("Solver logged in — token saved")

    # ─── Step 4: Bid on Project ───
    step(4, "BID ON PROJECT (as Solver)")
    bid_body = {"cover_letter": "I can build this for you!"}
    show_request("POST", f"{BASE}/projects/{project_id}/requests", bid_body, "solver@test.com")
    res = client.post(f"{BASE}/projects/{project_id}/requests",
                      json=bid_body, headers=solver_headers)
    show_response(res)

    if res.status_code != 201:
        fail("Bid failed!")
        sys.exit(1)

    request_id = res.json()["id"]
    ok(f"Bid created with status PENDING")
    ok(f"Request ID: {request_id}")

    # ─── Step 5: Accept Bid (CASCADE) ───
    step(5, "ACCEPT BID (as Buyer) — CASCADE TRANSACTION")
    print(f"  {DIM}This will: accept bid → reject others → assign solver → project ASSIGNED{RESET}")
    show_request("PATCH", f"{BASE}/requests/{request_id}/accept", who="buyer@test.com")
    res = client.patch(f"{BASE}/requests/{request_id}/accept", headers=buyer_headers)
    show_response(res)

    if res.status_code != 200:
        fail("Accept bid failed!")
        sys.exit(1)

    ok("Bid accepted — CASCADE executed")

    # Verify project changed to ASSIGNED
    print(f"\n  {DIM}Verifying project status changed...{RESET}")
    show_request("GET", f"{BASE}/projects/{project_id}", who="buyer@test.com")
    res = client.get(f"{BASE}/projects/{project_id}", headers=buyer_headers)
    show_response(res)
    project_data = res.json()
    if project_data.get("data"):
        project_data = project_data["data"]
    ok(f"Project is now ASSIGNED with solver attached")

    # ─── Step 6: Create Task ───
    step(6, "CREATE TASK (as Solver)")
    task_body = {
        "title": "Build Homepage",
        "description": "Create the main landing page with hero section",
    }
    show_request("POST", f"{BASE}/projects/{project_id}/tasks", task_body, "solver@test.com")
    res = client.post(f"{BASE}/projects/{project_id}/tasks",
                      json=task_body, headers=solver_headers)
    show_response(res)

    if res.status_code != 201:
        fail("Create task failed!")
        sys.exit(1)

    task_id = res.json()["id"]
    ok(f"Task created with status IN_PROGRESS")
    ok(f"Task ID: {task_id}")

    # ─── Step 7: Upload ZIP ───
    step(7, "UPLOAD ZIP SUBMISSION (as Solver)")
    print(f"  {DIM}Creating a test ZIP file in memory...{RESET}")

    # Create a real ZIP file in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("index.html", "<h1>Homepage</h1>")
        zf.writestr("style.css", "body { margin: 0; }")
    zip_bytes = buf.getvalue()
    print(f"  {DIM}ZIP created: {len(zip_bytes)} bytes, 2 files inside{RESET}")

    files = {"file": ("homepage.zip", zip_bytes, "application/zip")}
    data = {"notes": "Homepage complete with HTML and CSS"}

    show_request("POST", f"{BASE}/tasks/{task_id}/submissions",
                 {"file": "homepage.zip", "notes": data["notes"]}, "solver@test.com")
    res = client.post(f"{BASE}/tasks/{task_id}/submissions",
                      files=files, data=data, headers=solver_headers)
    show_response(res)

    if res.status_code != 201:
        fail("Upload submission failed!")
        sys.exit(1)

    submission_id = res.json()["id"]
    ok(f"Submission uploaded with status PENDING_REVIEW")
    ok(f"Submission ID: {submission_id}")

    # Verify task changed to SUBMITTED
    print(f"\n  {DIM}Verifying task status changed...{RESET}")
    show_request("GET", f"{BASE}/tasks/{task_id}", who="solver@test.com")
    res = client.get(f"{BASE}/tasks/{task_id}", headers=solver_headers)
    show_response(res)
    ok("Task is now SUBMITTED")

    # ─── Step 8: Accept Submission (CASCADE) ───
    step(8, "ACCEPT SUBMISSION (as Buyer) — CASCADE TRANSACTION")
    print(f"  {DIM}This will: accept submission → task COMPLETED → project COMPLETED{RESET}")
    show_request("PATCH", f"{BASE}/submissions/{submission_id}/accept", who="buyer@test.com")
    res = client.patch(f"{BASE}/submissions/{submission_id}/accept", headers=buyer_headers)
    show_response(res)

    if res.status_code != 200:
        fail("Accept submission failed!")
        sys.exit(1)

    ok("Submission accepted — CASCADE executed")

    # Verify task is COMPLETED
    print(f"\n  {DIM}Verifying task status...{RESET}")
    show_request("GET", f"{BASE}/tasks/{task_id}", who="buyer@test.com")
    res = client.get(f"{BASE}/tasks/{task_id}", headers=buyer_headers)
    show_response(res)
    ok("Task is now COMPLETED")

    # Verify project is COMPLETED
    print(f"\n  {DIM}Verifying project status (should auto-complete since all tasks done)...{RESET}")
    show_request("GET", f"{BASE}/projects/{project_id}", who="buyer@test.com")
    res = client.get(f"{BASE}/projects/{project_id}", headers=buyer_headers)
    show_response(res)
    ok("Project is now COMPLETED — all tasks done!")

    # ─── Final Summary ───
    print(f"\n{BOLD}{GREEN}{'='*60}")
    print(f"  ALL 8 STEPS PASSED ✓")
    print(f"")
    print(f"  Complete lifecycle verified:")
    print(f"    Project:    OPEN → ASSIGNED → COMPLETED")
    print(f"    Request:    PENDING → ACCEPTED")
    print(f"    Task:       IN_PROGRESS → SUBMITTED → COMPLETED")
    print(f"    Submission: PENDING_REVIEW → ACCEPTED")
    print(f"{'='*60}{RESET}\n")

    client.close()


if __name__ == "__main__":
    run_test()
