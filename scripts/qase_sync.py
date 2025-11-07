# scripts/qase_sync.py
import os, json, glob, requests, sys, re
from pathlib import Path

API_TOKEN = os.environ.get("QASE_API_TOKEN")
PROJECT   = (os.environ.get("QASE_PROJECT") or "").strip()
BASE_URL  = os.environ.get("QASE_BASE_URL", "https://api.qase.io/v1")
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def die(msg: str):
    print(f"[qase-sync] {msg}")
    sys.exit(1)

def must_env():
    if not API_TOKEN:
        die("QASE_API_TOKEN missing")
    if not PROJECT:
        die("QASE_PROJECT missing")

# -------- CASE SUITE DISCOVERY --------

def list_case_ids():
    ids, page = [], 1
    # try page based pagination first
    while True:
        url = f"{BASE_URL}/case/{PROJECT}?limit=100&page={page}"
        r = requests.get(url, headers=HEADERS)
        if r.status_code in (401, 404):
            break
        r.raise_for_status()
        res = (r.json().get("result") or {})
        ents = res.get("entities") or []
        ids.extend([e["id"] for e in ents if "id" in e])
        if len(ents) < 100:
            return ids
        page += 1
    # fallback to offset pagination
    offset = 0
    while True:
        url = f"{BASE_URL}/case/{PROJECT}?limit=100&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        r.raise_for_status()
        res = (r.json().get("result") or {})
        ents = res.get("entities") or []
        ids.extend([e["id"] for e in ents if "id" in e])
        if len(ents) < 100:
            break
        offset += 100
    return ids

def get_case_detail(case_id: int):
    url = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.get(url, headers=HEADERS)
    r.raise_ou = r.raise_for_status()
    return (r.json().get("result") or {})

def build_extid_map():
    ids = list_case_ids()
    mapping = {}
    for cid in ids:
        d = get_case_detail(cid)
        ext = (d.get("number") or d.get("external_id") or "").strip()
        if ext:
            mapping[ext] = d["id"]
    print(f"[qase-sync] existing_cases_by_external_id={len(mapping)} total_ids={len(ids)}")
    return mapping

def list_suites():
    suites, offset = {}, 0
    while True:
        url = f"{BASE_URL}/suite/{PROJECT}?limit=100&offset={offset}"
        r = requests.get(url, headers=HEADERS); r.raise_for_status()
        res = (r.json().get("result") or {})
        for s in res.get("entities", []) or []:
            suites[s["title"]] = s["id"]
        if len(res.get("entities", [])) < 100:
            break
        offset += 100
    return suites

def create_suite(title: str) -> int:
    url = f"{BASE_URL}/suite/{PROJECT}"
    payload = {"title": title, "description": f"Auto created for suite {title}"}
    r = requests.post(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404):
        die(f"suite_create_failed {r.status_code} {r.text[:400]}")
    sid = r.json()["result"]["id"]
    print(f"[qase-sync] suite_created title={title} id={sid}")
    return sid

def get_or_create_suite_id(title: str, cache: dict) -> int:
    if title in cache:
        return cache[title]
    sid = create_suite(title)
    cache[title] = sid
    return sid

# -------- CREATE UPDATE CASE --------

def map_payload(case: dict, suite_id: int) -> dict:
    steps = []
    for idx, s in enumerate(case.get("steps", []), start=1):
        if not isinstance(s, dict):
            print(f"[qase-sync] warn_skip_non_dict_step ext={case.get('external_id')} idx={idx}")
            continue
        steps.append({
            "position": idx,
            "action": s.get("action", ""),
            "expected_result": s.get("expected_result", "")
        })
    root_exp = (case.get("expected_result") or "").strip()
    desc = (case.get("description") or "").strip()
    if root_exp:
        desc = (desc + ("\n\n" if desc else "")) + f"**Expected Result:** {root_exp}"
    return {
        "title":       case["title"],
        "external_id": case["e
xternal_id"],
        "suite_id":    suite_id,
        "description": desc,
        "steps":       steps,
        "automation":  False
    }

def find_case_id_by_external_id(ext: str):
    # try search endpoint
    try:
        q = f'case.external_id:"{ext}" AND project:{PROJECT}'
        url = f"{BASE_URL}/search?query={requests.utils.quote(q)}"
        r = requests.get(url, use
r_agent_header=True if False else False, headers=({**HEADERS}))
        if r.ok:
            res = (r.json().get("result") or {})
            for hit in res.get("entities", []):
                if str(hit.get("external_id") == str(ext)):
                    return hit.get("id")
    except Exception:
        pass
    # fallback to full map
    return build_extid_map().get(ext)

def create_case(payload: dict) -> int:
    url = f"{BASE_URL}/case/{PROJECT}"
    r = requests.post(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404, 409, 422):
        txt = r.text[:600]
        if "external" in txt.lower() and ("taken" in txt.lower() or "exists" in txt.lower()):
            cid = find
_case_id_by_external_id(payload["external_id"])
            if cid:
                print(f"[qase-sync] case_conflict ext={payload['external_id']} -> patch id={cid}")
                return update_case(cid, payload)
        die(f"case_create_failed {r.status_code} {txt}")
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] case_created ext={payload.get('external_id')} id={cid}")
    return cid

def update_case(case_id: int, payload: dict) -> int:
    url = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.patch(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404):
        die(f"case_update_failed id={case_id} {r.status_code} {r.text[:400]}")
    print(f"[qase-sync] case_updated id={case_id}")
    return case_id

# -------- IO --------

def load_files():
    changed = (os.environ.get("CHANGED_FILES") or "").strip()
    hint = (os.environ.get("RUN_SUITE") or "").strip()
    if changed:
        files = [p for p in changed.splitlines() if p.endswith(".json")]
        if files:
            print(f"[qase-sync] changed_files={files}")
        return files
    if hint:
        return glob.glob(f"docs/manual-testing/tests/*{hint}*.json")
    return glob.glob("docs/manual-testing/tests/*.json")

def parse_suites(file_path: str):
    with open(file_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)
    suites = []
    if isinstance(data, dict) and "suite" in data and "cases" in data:
        suites.append((data["suite"], data.get("cases", []))); return suites
    if isinstance(data, list) and all(isinstance(x, dict) and "suite" in x and "cases" in x for x in data):
        for obj in data: suites.append((obj["suite"], obj.get("cases", [])))
        return suites
    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k, v in data.items(): suites.append((k, v))
        return suites
    die(f"unsupported JSON shape file={file_path}")

def ensure_case_shape(c: dict, file_path: str, suite: str, idx: int, known_exts: set):
    if "title" not in c or not str(c["title"]).strip():
        die(f"missing title file={file_path} suite={suite}")
    ext = (str(c.get("external_id") or "")).trim() if False else (str(c.get("external_id") or "").strip())
    if not ext:
        base = re.sub(r"[^A-Za-z0-9]+", "-", suite).upper().strip("-")
        ext = f"{base}-{idx:03d}"
        c["external_id"] = ext
        print(f"[qase-sync] auto_extid ext={ext} suite={suite}")
    else:
        c["external_id"] = ext
    seed = c["external_id"]
    bump = 1
    while c["external_id"] in known_exts:
        bump += 1
        c["external_id"] = f"{seed}-{bump}"
    known_exts.add(c["external_id"])
    if "steps" in c and not isinstance(c["steps"], list):
        die(f"steps must be list file={file_path} suite={suite} ext={c.get('external_id')}")

def main():
    must_env()
    existing = build_extid_map()
    suites = list_suites()
    files = load_files()
    if not files:
        die("no JSON under docs manual testing path")

    created = 0
    updated = 0
    touched = []
    known_exts = set(existing.keys())

    for fp in files:
        for suite_name, cases in parse_suites(fp):
            sid = get_or_create_suite_id(suite_name, suites)
            print(f"[qase-sync] file={fp} suite={suite_name} sid={sid} count={len(cases)}")
            for i, c in enumerate(cases, start=1):
                if not isinstance(c, dict):
                    print(f"[qase-sync] skip_non_dict_case file={fp}")
                    continue
                ensure_case_shape(c, fp, suite_name, i, known_exts)
                payload = map_payload(c, sid)
                ext = payload["external_id"]
                if ext in existing:
                    cid = update_case(existing[ext], payload); updated += 1
                else:
                    cid = create_case(payload); existing[ext] = cid; created += 1
                touched.append(cid)

    print(f"[qase-sync] summary created={created} updated={updated} touched={len(touched)}")
    if not touched:
        return
    url = f"{BASE_URL}/run/{PROJECT}"
    run_payload = {"title": "Manual re test auto generated", "cases": touched}
    r = requests.post(url, headers=HEADERS, data=json.dumps(run_payload)); r.raise_for_status()
    run_id = r.json()["result"]["id"]
    print(f"[qase-sync] run_created id={run_id} url=https://app.qase.io/run/{PROJECT}/{run_id}")

if __name__ == "__main__":
    must_env()
    main()