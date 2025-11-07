# scripts/qase_sync.py
import os, json, glob, sys, requests

API_TOKEN = os.environ.get("QASE_API_TOKEN")
PROJECT   = (os.environ.get("QASE_PROJECT") or "").strip()
BASE_URL  = os.environ.get("QASE_BASE_URL", "https://api.qase.io/v1")
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def fail(msg): print(f"[qase-sync] {msg}"); sys.exit(1)
def require_env():
    if not API_TOKEN: fail("QASE_API_TOKEN missing")
    if not PROJECT:   fail("QASE_PROJECT missing")

# ---------- Qase helpers ----------
def list_case_ids():
    ids, offset = [], 0
    while True:
        r = requests.get(f"{BASE_URL}/case/{PROJECT}?limit=100&offset={offset}", headers=HEADERS); r.raise_for_status()
        ents = (r.json().get("result") or {}).get("entities", []) or []
        ids += [e["id"] for e in ents if "id" in e]
        if len(ents) < 100: break
        offset += 100
    return ids

def get_case_detail(cid):
    r = requests.get(f"{BASE_URL}/case/{PROJECT}/{cid}", headers=HEADERS); r.raise_for_status()
    return r.json().get("result") or {}

def build_indexes():
    ids = list_case_ids()
    ext_map, title_map = {}, {}
    for cid in ids:
        d = get_case_detail(cid)
        ext = (d.get("external_id") or "").strip()
        title = (d.get("title") or "").strip().lower()
        suite_id = d.get("suite_id")
        if ext:
            ext_map[ext] = cid
        else:
            if suite_id and title:
                title_map[(suite_id, title)] = cid
    print(f"[qase-sync] index ext_map={len(ext_map)} title_map_empty_ext={len(title_map)} total_ids={len(ids)}")
    return ext_map, title_map

def list_suites():
    suites, offset = {}, 0
    while True:
        r = requests.get(f"{BASE_URL}/suite/{PROJECT}?limit=100&offset={offset}", headers=HEADERS); r.raise_for_status()
        ents = (r.json().get("result") or {}).get("entities", []) or []
        for s in ents: suites[s["title"]] = s["id"]
        if len(ents) < 100: break
        offset += 100
    return suites

def create_suite(title):
    payload = {"title": title, "description": f"Auto created for suite {title}"}
    r = requests.post(f"{BASE_URL}/suite/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404): fail(f"suite_create_failed {r.status_code} {r.text[:400]}")
    sid = r.json()["result"]["id"]
    print(f"[qase-sync] suite_created title={title} id={sid}")
    return sid

def get_or_create_suite_id(title, cache):
    if title in cache: return cache[title]
    sid = create_suite(title); cache[title] = sid; return sid

# ---------- Case create update ----------
def map_payload(case, suite_id):
    steps = []
    for idx, s in enumerate(case.get("steps", []), start=1):
        if not isinstance(s, dict): continue
        steps.append({"position": idx, "action": s.get("action",""), "expected_result": s.get("expected_result","")})
    root_exp = (case.get("expected_result") or "").strip()
    desc = (case.get("description") or "").strip()
    if root_exp:
        desc = (desc + ("\n\n" if desc else "")) + f"**Expected Result:** {root_exp}"
    return {
        "title": case["title"],
        "external_id": case["external_id"],
        "suite_id": suite_id,
        "description": desc,
        "steps": steps,
        "automation": False
    }

def create_case(payload):
    r = requests.post(f"{BASE_URL}/case/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404,409,422):
        fail(f"case_create_failed {r.status_code} {r.text[:600]}")
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] case_created ext={payload['external_id']} id={cid}")
    return cid

def update_case(case_id, payload):
    r = requests.patch(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404):
        fail(f"case_update_failed id={case_id} {r.status_code} {r.text[:400]}")
    print(f"[qase-sync] case_updated id={case_id}")
    return case_id

# ---------- IO ----------
def load_files():
    changed = (os.environ.get("CHANGED_FILES") or "").strip()
    hint    = (os.environ.get("RUN_SUITE") or "").strip()
    if changed:
        files = [p for p in changed.splitlines() if p.endswith(".json")]
        if files: print(f"[qase-sync] changed_files={files}")
        return files
    if hint:
        return glob.glob(f"docs/manual-testing/tests/*{hint}*.json")
    return glob.glob("docs/manual-testing/tests/*.json")

def parse_suites(fp):
    with open(fp, "r", encoding="utf-8-sig") as f: data = json.load(f)
    suites = []
    if isinstance(data, dict) and "suite" in data and "cases" in data: return [(data["suite"], data.get("cases", []))]
    if isinstance(data, list) and all(isinstance(x, dict) and "suite" in x and "cases" in x for x in data):
        for o in data: suites.append((o["suite"], o.get("cases", []))); return suites
    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k,v in data.items(): suites.append((k,v)); return suites
    fail(f"unsupported JSON shape file={fp}")

def ensure_case_shape(c, fp, suite, idx, seen_exts):
    if "title" not in c or not str(c["title"]).strip(): fail(f"missing title file={fp} suite={suite}")
    ext = str(c.get("external_id") or "").strip()
    if not ext: fail(f"missing external_id file={fp} suite={suite} title={c.get('title')}")
    if ext in seen_exts: fail(f"duplicate external_id in input file={fp} suite={suite} ext={ext}")
    seen_exts.add(ext)
    if "steps" in c and not isinstance(c["steps"], list): fail(f"steps must be list file={fp} suite={suite} ext={ext}")

# ---------- Main ----------
def main():
    require_env()
    ext_map, title_map = build_indexes()
    suite_cache = list_suites()
    files = load_files()
    if not files: fail("no JSON under docs manual testing path")

    created = updated = 0
    touched = []
    seen_exts = set()

    for fp in files:
        for suite_name, cases in parse_suites(fp):
            sid = get_or_create_suite_id(suite_name, suite_cache)
            print(f"[qase-sync] file={fp} suite={suite_name} sid={sid} count={len(cases)}")
            for i, c in enumerate(cases, start=1):
                if not isinstance(c, dict): continue
                ensure_case_shape(c, fp, suite_name, i, seen_exts)
                payload = map_payload(c, sid)
                ext = payload["external_id"]
                title_key = (sid, payload["title"].strip().lower())

                if ext in ext_map:
                    cid = update_case(ext_map[ext], payload)
                    updated += 1
                elif title_key in title_map:
                    # migrate old case without external_id to this external_id
                    cid = title_map[title_key]
                    print(f"[qase-sync] migrating title match to set external_id ext={ext} id={cid}")
                    update_case(cid, payload)
                    ext_map[ext] = cid
                    updated += 1
                else:
                    cid = create_case(payload)
                    ext_map[ext] = cid
                    created += 1
                touched.append(cid)

    print(f"[qase-sync] summary created={created} updated={updated} touched={len(touched)}")

    if touched:
        r = requests.post(f"{BASE_URL}/run/{PROJECT}", headers=HEADERS,
                          data=json.dumps({"title": "Manual re test auto generated", "cases": touched}))
        r.raise_for_status()
        run_id = r.json()["result"]["id"]
        print(f"[qase-sync] run_created id={run_id} url=https://app.qase.io/run/{PROJECT}/{run_id}")

if __name__ == "__main__":
    main()
