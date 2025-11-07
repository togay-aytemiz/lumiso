import os, json, glob, requests, sys, re
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
    limit, offset, out = 100, 0, {}
    while True:
        url = f"{BASE_URL}/case/{PROJECT}?limit={limit}&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        if r.status_code in (401, 404):
            die(f"Case list hata {r.status_code} body={r.text[:300]}")
        r.raise_for_status()
        body = r.json().get("result", {})
        entities = body.get("entities", []) or []
        for e in entities:
            ext = e.get("external_id")
            if ext:
                out[ext] = e["id"]
        if len(entities) < limit:
            break
        offset += limit
    print(f"[qase-sync] Existing cases fetched: {len(out)}")
    return out

def list_suites():
    suites = {}
    limit, offset = 100, 0
    while True:
        url = f"{BASE_URL}/suite/{PROJECT}?limit={limit}&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        if r.status_code in (401, 404):
            die(f"Suite list hata {r.status_code} body={r.text[:300]}")
        r.raise_for_status()
        body = r.json().get("result", {})
        entities = body.get("entities", []) or []
        for s in entities:
            suites[s["title"]] = s["id"]
        if len(entities) < limit:
            break
        offset += limit
    return suites

def create_suite(title):
    url = f"{BASE_URL}/suite/{PROJECT}"
    payload = {"title": title, "description": f"Auto created for suite {title}"}
    r = requests.post(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (401, 404, 400):
        die(f"Suite create hata {r.status_code} body={r.text[:300]}")
    r.raise_for_status()
    sid = r.json()["result"]["id"]
    print(f"[qase-sync] Suite created: {title} id={sid}")
    return sid

def get_or_create_suite_id(title, cache):
    if title in cache:
        return cache[title]
    sid = create_suite(title)
    cache[title] = sid
    return sid

def create_case(payload):
    r = requests.post(f"{BASE_URL}/case/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code >= 400:
        print("[qase-sync] create_case payload:", json.dumps(payload, ensure_ascii=False)[:1000])
        print("[qase-sync] create_case resp:", r.status_code, r.text[:1000])
    r.raise_for_status()
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] Created case {payload.get('external_id')} id={cid}")
    return cid

def update_case(case_id, payload):
    r = requests.patch(f"{BASE_URL}/case/{PROJECT}/{case_id}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code >= 400:
        print("[qase-sync] update_case payload:", json.dumps(payload, ensure_ascii=False)[:1000])
        print("[qase-sync] update_case resp:", r.status_code, r.text[:1000])
    r.raise_for_status()
    print(f"[qase-sync] Updated case id={case_id}")

def open_run(title, case_ids):
    if not case_ids:
        print("[qase-sync] Run açılmadı. Dahil edilecek case yok")
        return
    payload = {"title": title, "cases": case_ids}
    r = requests.post(f"{BASE_URL}/run/{PROJECT}", headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (401, 404, 400):
        die(f"Run create hata {r.status_code} body={r.text[:400]}")
    r.raise_for_status()
    rid = r.json()["result"]["id"]
    print(f"[qase-sync] Run created id={rid} cases={len(case_ids)}")

def map_json_case_to_qase(case, suite_id):
    steps = []
    for idx, s in enumerate(case.get("steps", []), start=1):
        if not isinstance(s, dict):
            print(f"[qase-sync] Uyarı: step dict değil, atlandı ext={case.get('external_id')} idx={idx}")
            continue
        steps.append({
            "position": idx,
            "action": s.get("action", ""),
            "expected_result": s.get("expected_result", "")
        })
    return {
        "title": case["title"],
        "external_id": case["external_id"],
        "suite_id": suite_id,
        "description": case.get("description", ""),
        "steps": steps,
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
    with open(file_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)

    suites = []

    if isinstance(data, dict) and "cases" in data and "suite" in data:
        suites.append((data["suite"], data.get("cases", [])))
        return suites

    if isinstance(data, list) and all(isinstance(x, dict) and "suite" in x and "cases" in x for x in data):
        for obj in data:
            suites.append((obj["suite"], obj.get("cases", [])))
        return suites

    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k, v in data.items():
            suites.append((k, v))
        return suites

    die(f"JSON biçimi desteklenmiyor file={file_path}")

def make_auto_id(suite_name: str, index: int) -> str:
    slug = re.sub(r'[^A-Za-z0-9]+', '-', suite_name).upper().strip('-')
    return f"{slug}-{index:03d}"

def validate_and_fill_case(c, file_path, suite, index, used_ids):
    if "title" not in c or not isinstance(c["title"], str) or not c["title"].strip():
        die(f"Gerekli alan eksik title file={file_path} suite={suite}")
    if "external_id" not in c or not isinstance(c["external_id"], str) or not c["external_id"].strip():
        c["external_id"] = make_auto_id(suite, index)
        print(f"[qase-sync] external_id otomatik atandı ext={c['external_id']} suite={suite}")
    base = c["external_id"]
    inc = 1
    while c["external_id"] in used_ids:
        inc += 1
        c["external_id"] = f"{base}-{inc}"
    used_ids.add(c["external_id"])
    if "steps" in c and not isinstance(c["steps"], list):
        die(f"steps liste olmalı file={file_path} suite={suite} ext={c.get('external_id')}")

def main():
    check_env()
    ext_to_id = get_all_cases_by_external_id()
    suite_cache = list_suites()
    files = load_target_files()
    if not files:
        die("JSON dosyası bulunamadı. docs manual testing yolunu kontrol et")

    explicit_ids = set()
    if os.environ.get("RETEST_IDS"):
        explicit_ids = {x.strip() for x in os.environ["RETEST_IDS"].split(",") if x.strip()}

    created, updated = 0, 0
    touched_case_ids = []
    used_ids = set(ext_to_id.keys())

    for fp in files:
        for suite_name, cases in parse_file_into_suites(fp):
            sid = get_or_create_suite_id(suite_name, suite_cache)
            print(f"[qase-sync] File={fp} suite={suite_name} suite_id={sid} case_count={len(cases)}")
            for idx, c in enumerate(cases, start=1):
                if not isinstance(c, dict):
                    print(f"[qase-sync] Atlandı dict değil file={fp}")
                    continue
                validate_and_fill_case(c, fp, suite_name, idx, used_ids)
                payload = map_json_case_to_qase(c, sid)
                ext = payload["external_id"]
                if ext in ext_to_id:
                    update_case(ext_to_id[ext], payload)
                    case_id = ext_to_id[ext]
                    updated += 1
                else:
                    case_id = create_case(payload)
                    ext_to_id[ext] = case_id
                    created += 1
                if not explicit_ids or ext in explicit_ids:
                    touched_case_ids.append(case_id)

    print(f"[qase-sync] Summary created={created} updated={updated} included_in_run={len(touched_case_ids)}")
    title = "Manual re test auto generated" if not explicit_ids else "Manual re test targeted by external_id"
    open_run(title, touched_case_ids)

if __name__ == "__main__":
    main()