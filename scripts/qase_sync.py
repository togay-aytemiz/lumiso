# scripts/qase_sync.py
import os, json, glob, requests, sys, re
from pathlib import Path

API_TOKEN = os.environ.get("QASE_API_TOKEN")
PROJECT   = os.environ.get("QASE_PROJECT", "").trim() if hasattr(str, "trim") else os.environ.get("QASE_PROJECT", "").strip()
BASE_URL  = os.environ.get("QASE_BASE_URL", "https://api.qase.io/v1")
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def die(msg):
    print(f"[qase-sync] {msg}")
    sys.exit(1)

def must_env():
    if not API_TOKEN:
        die("QASE_API_TOKEN missing")
    if not PROJECT:
        die("QASE_PROJECT missing")

# ---------- CASE/SUITE DISCOVERY ----------

def list_case_ids():
    # robust pagination, prefer page param; if not supported, fall back to offset
    ids = []
    page = 1
    while True:
        u = f"{BASE_URL}/case/{PROJECT}?limit=100&page={page}"
        r = requests.get(u, headers=HEADERS)
        if r.status_code in (401,404):
            # try offset style if page not supported
            break
        r.raise_for_status()
        res = r.json().get("result") or {}
        ents = res.get("entities") or []
        for e in ents:
            cid = e.get("id")
            if cid:
                ids.append(cid)
        if len(ents) < 100:
            return ids
        page += 1

    # fallback via offset
    offset = 0
    while True:
        u = f"{BASE_URL}/case/{PROJECT}?limit=100&offset={offset}"
        r = requests.get(u, headers=HEADERS)
        if r.status_code in (401,404):
            r.raise_for_status()
        r.raise_for_status()
        res = r.json().get("result") or {}
        ents = res.get("entities") or []
        for e in ents:
            cid = e.get("id")
            if cid:
                ids.append(cid)
        if len(ents) < 100:
            break
        offset += 100
    return ids

def get_case_detail(case_id):
    u = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.get(u, headers=HEADERS)
    r.raise_for_status()
    return r.json().get("result") or {}

def build_extid_map():
    ids = list_case_ids()
    mapping = {}
    for cid in ids:
        detail = get_case_detail(cid)
        ext = detail.get("external_id")
        if ext:
            mapping[ext] = detail.get("id")
    print(f"[qase-sync] existing_cases_by_external_id={len(mapping)} total_ids={len(ids)}")
    return mapping

def list_suites():
    suites = {}
    limit, offset = 100, 0
    while True:
        u = f"{BASE_URL}/suite/{PROJECT}?limit={limit}&offset={offset}"
        r = requests.get(u, headers=HEADERS)
        if r.status_code in (401,404):
            r.raise_for_status()
        r.raise_for_status()
        res = r.json().get("result") or {}
        for s in res.get("entities", []) or []:
            suites[s["title"]] = s["id"]
        if len(res.get("entities", [])) < limit:
            break
        offset += limit
    return suites

def create_suite(title):
    u = f"{BASE_URL}/suite/{PROJECT}"
    payload = {"title": title, "description": f"Auto created for suite {title}"}
    r = requests.post(u, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404):
        die(f"suite_create_failed {r.status_code} {r.text[:400]}")
    rid = r.json()["result"]["id"]
    print(f"[qase-sync] suite_created title={title} id={rid}")
    return rid

def get_or_create_suite_id(title, cache):
    if title in cache:
        return cache[title]
    sid = create_suite(title)
    cache[title] = sid
    return sid

# ---------- CREATE UPDATE CASE ----------

def map_payload(case, suite_id):
    steps = []
    for idx, s in enumerate(case.get("steps", []), start=1):
        if not isinstance(s, dict):
            print(f"[qase-sync] warn_skip_non_dict_step ext={case.get('external_id')} idx={idx}")
            continue
        steps.append({
            "position": idx,
            "action": s.get("action",""),
            "expected_result": s.get("expected_result","")
        })

    # promote root expected_result into description for visible UX
    root_exp = (case.get("expected_result") or "").strip()
    desc = (case.get("description") or "").strip()
    if root_exp:
        desc = (desc + ("\n\n" if desc else "")) + f"**Expected Result:** {root_exp}"

    return {
        "title":        case["title"],
        "external_id":  case["external_id"],
        "suite_id":     suite_id,
        "description":  desc,
        "steps":        steps,
        "automation":   False
    }

def create_case(payload):
    u = f"{BASE_URL}/case/{PROJECT}"
    r = requests.post(u, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404,409,422):
        txt = r.text[:600]
        # if external_id already taken, try to resolve and patch
        if "external" in txt.lower() and ("taken" in txt.lower() or "exists" in txt.lower()):
            cid = find_case_id_by_external_id(payload["external_id"])
            if cid:
                print(f"[qase-sync] create_conflict ext={payload['external_id']} -> patch id={cid}")
                return update_case(cid, payload)
        # fall through if not resolvable
        die(f"case_create_failed {r.status_code} {txt}")
    rid = r.json()["result"]["id"]
    print(f"[qase-sync] case_created ext={payload.get('external_id')} id={rid}")
    return rid

def update_case(case_id, payload):
    u = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.patch(u, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404):
        die(f"case_update_failed id={case_id} {r.status_code} {r.text[:400]}")
    print(f"[qase-sync] case_updated id={case_id}")
    return case_id

def find_case_id_by_external_id(ext):
    # primary path try search endpoint with QQL
    try:
        q = f'case.external_id:"{ext}" AND project:{PROJECT}'
        u = f"{BASE_URL}/search?query={requests.utils.quote(q)}"
        r = requests.get(u, headers=HEADERS)
        if r.ok:
            data = r.json().get("result") or {}
            # shape depends on API, try common fields
            for hit in (data.get("entities") or []):
                if str(hit.get("external_id") or "") == str(ext):
                    return hit.get("id")
    except Exception:
        pass
    # fallback: walk all cases and match by ext id
    for cid, e in (list(build_extid_map().items())):
        if cid == ext:
            return e
    return None

# ---------- IO ----------

def load_files():
    changed = os.environ.get("CHANGED_FILES","").strip()
    suite_hint = os.environ.get("RUN_SUITE","").strip()
    if changed:
        files = [p for p in changed.splitlines() if p.endswith(".json")]
        if files:
            print(f"[qase-sync] changed_files={files}")
        return files
    if suite_hint:
        return glob.glob(f"docs/manual-testing/tests/*{suite_hint}*.json")
    return glob.glob("docs/manual-testing/tests/*.json")

def parse_suites(file_path):
    with open(file_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)
    suites = []
    if isinstance(data, dict) and "suite" in data and "cases" in data:
        suites.append((data["suite"], data.get("cases", [])))
        return suites
    if isinstance(data, list) and all(isinstance(x, dict) and "suite" in x and "cases" in x for x in data):
        for obj in data:
            suites.append((obj["suite"], obj.get("cases", [])))
        return suites
    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k,v in data.items():
            suites.append((k, v))
        return suites
    die(f"unsupported JSON shape file={file_path}")

def ensure_case_shape(c, file_path, suite, idx, known_exts):
    if "title" not in c or not str(c["title"]).strip():
        die(f"missing title file={file_path} suite={suite}")
    # fill or validate external_id
    ext = str(c.get("external_id") or "").strip()
    if not ext:
        base = re.sub(r"[^A-Za-z0-9]+","-",suite).upper().strip("-")
        ext = f"{base}-{idx:03d}"
        c["external_id"] = ext
        print(f"[qase-sync] auto_extid ext={ext} suite={suite}")
    # keep unique
    seed = c["external_id"]
    bump = 1
    while c["external_id"] in known_exths:
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
        die("no JSON under docs/manual-testing/tests")

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
                ensure_control = c  # just alias
                ensure_case_shape(ensure_control, fp, suite_name, i, known_exts)
                payload = map_payload(ensure_control, sid)
                ext = payload["external_id"]

                if ext in existing:
                    cid = update_case(existing[ext], payload)
                    updated += 1
                else:
                    cid = create_case(payload)
                    existing[ext] = cid
                    created += 1
                touched.append(cid)

    print(f"[qase-sync] summary created={created} updated={updated} touched={len(touched)}")

    if touched:
        u = f"{BASE_URL}/run/{PROJECT}"
        run_payload = {"title": "Manual re test auto generated", "cases": touched}
        r = requests.post(u, headers=HEADERS, data=json.dumps(run_payload))
        r.raise_for_status()
        run_id = r.json()["result"]["id"]
        print(f"[qase-sync] run_created id={run_id} url=https://app.qase.io/run/{PROJECT}/{run_id}")

if __name__ == "__main__":
    main()