# scripts/qase_sync.py
import os, json, glob, requests
from pathlib import Path

API_TOKEN = os.environ["QASE_API_TOKEN"]
PROJECT   = os.environ.get("QASE_PROJECT", "CRM")
BASE_URL  = "https://api.qase.io/v1"
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def get_all_cases_by_external_id():
    url = f"{BASE_URL}/case/{PROJECT}?limit=100&page=1"
    out = {}
    while url:
        r = requests.get(url, headers=HEADERS)
        r.raise_for_status()
        data = r.json()["result"]
        for e in data["entities"]:
            ext = e.get("external_id")
            if ext:
                out[ext] = e["id"]
        url = data["links"].get("next")
    return out

def create_case(payload):
    r = requests.post(f"{BASE_URL}/case/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    r.raise_for_status()
    return r.json()["result"]["id"]

def update_case(case_id, payload):
    r = requests.patch(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS, data=json.dumps(payload))
    r.raise_for_status()

def open_run(title, case_ids):
    if not case_ids:
        return
    payload = {"title": title, "cases": case_ids}
    r = requests.post(f"{BASE_URL}/run/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    r.raise_for_status()

def map_json_case_to_qase(case, suite_name):
    steps = [{"action": s.get("action", ""), "expected_result": s.get("expected_result", "")}
             for s in case.get("steps", [])]
    return {
        "title": case["title"],
        "external_id": case["external_id"],
        "suite_title": suite_name,
        "description": case.get("description", ""),
        "steps": steps,
        "priority": "medium",
        "severity": "normal",
        "behavior": "positive",
        "automation": False
    }

def load_target_files():
    changed = os.environ.get("CHANGED_FILES", "").strip()
    manual_suite = os.environ.get("RUN_SUITE", "").strip()
    if changed:
        return [f for f in changed.splitlines() if f.endswith(".json")]
    if manual_suite:
        return glob.glob(f"docs/manual-testing/tests/*{manual_suite}*.json")
    return glob.glob("docs/manual-testing/tests/*.json")

def parse_suite(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    suite = data.get("suite") or Path(file_path).stem
    return suite, data.get("cases", [])

def main():
    ext_to_id = get_all_cases_by_external_id()
    files = load_target_files()
    explicit_ids = set()
    if os.environ.get("RETEST_IDS"):
        explicit_ids = {x.strip() for x in os.environ["RETEST_IDS"].split(",") if x.strip()}
    touched_case_ids = []

    for fp in files:
        suite, cases = parse_suite(fp)
        for c in cases:
            if "external_id" not in c or "title" not in c:
                continue
            payload = map_json_case_to_qase(c, suite)
            ext = payload["external_id"]
            if ext in ext_to_id:
                update_case(ext_to_id[ext], payload)
                case_id = ext_to_id[ext]
            else:
                case_id = create_case(payload)
                ext_to_id[ext] = case_id
            if not explicit_ids or ext in explicit_ids:
                touched_case_ids.append(case_id)

    title = "Manual re test auto generated"
    if explicit_ids:
        title = "Manual re test targeted by external_id"
    open_run(title, touched_case_ids)

if __name__ == "__main__":
    main()