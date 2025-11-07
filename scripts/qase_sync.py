# scripts/qase_sync.py
import os, json, glob, requests, sys
from pathlib import Path

API_TOKEN = os.environ.get("QASE_API_TOKEN")
PROJECT   = os.environ.get("QASE_PROJECT", "").strip()
BASE_URL  = os.environ.get("QASE_BASE_URL", "https://api.qase.io/v1")
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def die(msg):
    print(f"[qase-sync] {msg}")
    sys.exit(1)

def check_env():
    if not API_TOKEN:
        die("QASE_API_TOKEN eksik")
    if not PROJECT:
        die("QASE_PROJECT eksik")

def get_all_cases_by_external_id():
    limit = 100
    offset = 0
    out = {}
    while True:
        url = f"{BASE_URL}/case/{PROJECT}?limit={limit}&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        if r.status_code == 404:
            die(f"Project bulunamadı PROJECT={PROJECT}")
        if r.status_code == 401:
            die("Yetkisiz token")
        try:
            r.raise_for_status()
            body = r.json()
        except Exception:
            die(f"Listeleme parse hatası status={r.status_code} body={r.text[:300]}")
        result = body.get("result", {})
        entities = result.get("entities", []) or []
        for e in entities:
            ext = e.get("external_id")
            if ext:
                out[ext] = e["id"]
        if len(entities) < limit:
            break
        offset += limit
    print(f"[qase-sync] Existing cases fetched: {len(out)}")
    return out

def create_case(payload):
    r = requests.post(f"{BASE_URL}/case/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (401, 404):
        die(f"Create case hata {r.status_code} body={r.text[:300]}")
    r.raise_for_status()
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] Created case {payload.get('external_id')} id={cid}")
    return cid

def update_case(case_id, payload):
    r = requests.patch(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (401, 404):
        die(f"Update case hata {r.status_code} body={r.text[:300]}")
    r.raise_for_status()
    print(f"[qase-sync] Updated case id={case_id}")

def open_run(title, case_ids):
    if not case_ids:
        print("[qase-sync] Run açılmadı. Dahil edilecek case yok")
        return
    payload = {"title": title, "cases": case_ids}
    r = requests.post(f"{BASE_URL}/run/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (401, 404):
        die(f"Create run hata {r.status_code} body={r.text[:300]}")
    r.raise_for_status()
    rid = r.json()["result"]["id"]
    print(f"[qase-sync] Run created id={rid} cases={len(case_ids)}")

def map_json_case_to_qase(case, suite_name):
    steps = []
    for s in case.get("steps", []):
        if not isinstance(s, dict):
            continue
        steps.append({
            "action": s.get("action", ""),
            "expected_result": s.get("expected_result", "")
        })
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
        files = [f for f in changed.splitlines() if f.endswith(".json")]
        if files:
            print(f"[qase-sync] Changed files: {files}")
        return files
    if manual_suite:
        return glob.glob("docs/manual-testing/tests/*" + manual_suite + "*.json")
    return glob.glob("docs/manual-testing/tests/*.json")

def parse_file_into_suites(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    suites = []

    if isinstance(data, dict) and "cases" in data:
        suite_name = data.get("suite") or Path(file_path).stem
        suites.append((suite_name, data.get("cases", [])))

    elif isinstance(data, list):
        suite_name = Path(file_path).stem
        suites.append((suite_name, data))

    elif isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, list):
                suites.append((k, v))

    if not suites:
        die(f"JSON biçimi desteklenmiyor file={file_path}")
    return suites

def main():
    check_env()
    ext_to_id = get_all_cases_by_external_id()
    files = load_target_files()
    if not files:
        die("JSON dosyası bulunamadı docs manual testing yolunu kontrol et")

    explicit_ids = set()
    if os.environ.get("RETEST_IDS"):
        explicit_ids = {x.strip() for x in os.environ["RETEST_IDS"].split(",") if x.strip()}

    touched_case_ids = []

    for fp in files:
        for suite, cases in parse_file_into_suites(fp):
            print(f"[qase-sync] File={fp} suite={suite} case_count={len(cases)}")
            for c in cases:
                if not isinstance(c, dict):
                    print(f"[qase-sync] Atlandı. Dict değil file={fp}")
                    continue
                if "external_id" not in c or "title" not in c:
                    print(f"[qase-sync] Atlandı. external_id ya da title eksik file={fp}")
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

    title = "Manual re test auto generated" if not explicit_ids else "Manual re test targeted by external_id"
    open_run(title, touched_case_ids)

if __name__ == "__main__":
    main()