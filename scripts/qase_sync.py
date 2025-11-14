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

def find_case_id_by_external_id(ext):
    if not ext:
        return None
    query = f'case.external_id:"{ext}" AND project:{PROJECT}'
    try:
        r = requests.get(f"{BASE_URL}/search", headers=HEADERS, params={"query": query, "limit": 1})
        if r.status_code == 404:
            return None
        r.raise_for_status()
        entities = (r.json().get("result") or {}).get("entities") or []
        for ent in entities:
            if str(ent.get("external_id")).strip() == ext:
                return ent.get("id")
    except requests.RequestException as exc:
        print(f"[qase-sync] warn_search_failed ext={ext} err={exc}")
    return None

def extract_external_ref(case_detail):
    for key in ("external_id", "code", "number"):
        val = case_detail.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    desc = case_detail.get("description")
    if isinstance(desc, str):
        for line in desc.splitlines():
            if line.lower().startswith("external id:"):
                return line.split(":", 1)[1].strip()
    return ""

def build_indexes():
    ids = list_case_ids()
    ext_map, title_map = {}, {}
    for cid in ids:
        d = get_case_detail(cid)
        ext = extract_external_ref(d)
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
    ext = case["external_id"].strip()
    filtered_lines = [line for line in desc.splitlines() if not line.lower().startswith("external id:")]
    desc = "\n".join(filtered_lines).strip()
    desc = (desc + ("\n\n" if desc else "")) + f"External ID: {ext}"
    return {
        "title": case["title"],
        "external_id": ext,
        "suite_id": suite_id,
        "description": desc,
        "steps": steps,
        "automation": False
    }

def normalize_step_list(steps):
    normalized = []
    for s in steps or []:
        if not isinstance(s, dict): continue
        action = str(s.get("action") or "").strip()
        expected = str(s.get("expected_result") or "").strip()
        normalized.append((action, expected))
    return normalized

def create_case(payload):
    r = requests.post(f"{BASE_URL}/case/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404,409,422):
        fail(f"case_create_failed {r.status_code} {r.text[:600]}")
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] case_created ext={payload['external_id']} id={cid}")
    return cid

def delete_case(case_id):
    r = requests.delete(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS)
    if r.status_code not in (200,204,404):
        fail(f"case_delete_failed id={case_id} {r.status_code} {r.text[:300]}")
    status = "not_found" if r.status_code == 404 else "deleted"
    print(f"[qase-sync] case_{status} id={case_id}")

def update_case(case_id, payload):
    r = requests.patch(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400,401,404):
        fail(f"case_update_failed id={case_id} {r.status_code} {r.text[:400]}")
    fresh = get_case_detail(case_id)
    fresh_title = (fresh.get("title") or "").strip()
    payload_steps = payload.get("steps") or []
    fresh_steps = fresh.get("steps") or []
    payload_norm = normalize_step_list(payload_steps)
    fresh_norm = normalize_step_list(fresh_steps)
    recreate_reason = None
    if fresh_title != payload.get("title"):
        recreate_reason = f"title mismatch wanted={payload.get('title')} got={fresh_title}"
    elif payload_norm and len(fresh_norm) != len(payload_norm):
        recreate_reason = f"steps mismatch wanted={len(payload_norm)} got={len(fresh_norm)}"
    elif payload_norm and fresh_norm != payload_norm:
        recreate_reason = "step content mismatch"
    if recreate_reason:
        print(f"[qase-sync] warn_recreate id={case_id} reason={recreate_reason}")
        delete_case(case_id)
        return create_case(payload)
    else:
        print(f"[qase-sync] case_updated id={case_id} ext={payload.get('external_id')} title={fresh_title}")
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
        for o in data:
            suites.append((o["suite"], o.get("cases", [])))
        return suites
    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k,v in data.items():
            suites.append((k,v))
        return suites
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

                cid = ext_map.get(ext)
                if not cid:
                    cid = find_case_id_by_external_id(ext)
                    if cid:
                        ext_map[ext] = cid

                if cid:
                    cid = update_case(cid, payload)
                    ext_map[ext] = cid
                    updated += 1
                elif title_key in title_map:
                    # migrate old case without external_id to this external_id
                    cid = title_map[title_key]
                    print(f"[qase-sync] migrating title match to set external_id ext={ext} id={cid}")
                    cid = update_case(cid, payload)
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
