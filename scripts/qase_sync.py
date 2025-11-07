# scripts/qase_sync.py
import os
import re
import json
import glob
import sys
import requests
from pathlib import Path

API_TOKEN = os.environ.get("QASE_API_TOKEN")
PROJECT   = (os.environ.get("QASE_PROJECT") or "").strip()
BASE_URL  = os.environ.get("QASE_BASE_URL", "https://api.qase.io/v1")
HEADERS   = {"Content-Type": "application/json", "Token": API_TOKEN}

def fail(msg: str):
    print(f"[qase-sync] {msg}")
    sys.exit(1)

def require_env():
    if not API_TOKEN:
        fail("QASE_API_TOKEN missing")
    if not PROJECT:
        fail("QASE_PROJECT missing")

# 1) Case ve suite keşfi

def list_case_ids() -> list[int]:
    ids = []
    # offset tabanlı sayfalama
    offset = 0
    while True:
        url = f"{BASE_URL}/case/{PROJECT}?limit=100&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        r.raise_for_status()
        res = r.json().get("result") or {}
        ents = res.get("entities") or []
        for e in ents:
            if "id" in e:
                ids.append(e["id"])
        if len(ents) < 100:
            break
        offset += 100
    return ids

def get_case_detail(case_id: int) -> dict:
    url = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.json().get("result") or {}

def build_external_id_map() -> dict[str, int]:
    mapping: dict[str, int] = {}
    ids = list_case_ids()
    for cid in ids:
        detail = get_case_detail(cid)
        ext = (detail.get("external_id") or "").strip()
        if ext:
            mapping[ext] = detail["id"]
    print(f"[qase-sync] existing_cases_by_external_id={len(mapping)} total_ids={len(ids)}")
    return mapping

def list_suites() -> dict[str, int]:
    suites: dict[str, int] = {}
    offset = 0
    while True:
        url = f"{BASE_URL}/suite/{PROJECT}?limit=100&offset={offset}"
        r = requests.get(url, headers=HEADERS)
        r.raise_for_status()
        res = r.json().get("result") or {}
        ents = res.get("entities") or []
        for s in ents:
            suites[s["title"]] = s["id"]
        if len(ents) < 100:
            break
        offset += 100
    return suites

def create_suite(title: str) -> int:
    url = f"{BASE_URL}/suite/{PROJECT}"
    payload = {"title": title, "description": f"Auto created for suite {title}"}
    r = requests.post(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404):
        fail(f"suite_create_failed {r.status_code} {r.text[:400]}")
    sid = r.json()["result"]["id"]
    print(f"[qase-sync] suite_created title={title} id={sid}")
    return sid

def get_or_create_suite_id(title: str, cache: dict[str, int]) -> int:
    if title in cache:
        return cache[title]
    sid = create_suite(title)
    cache[title] = sid
    return sid

# 2) Create Update

def map_payload(case: dict, suite_id: int) -> dict:
    # adımlar
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

    # kök expected_result metnini description içine görünür şekilde ekle
    root_exp = (case.get("expected_result") or "").strip()
    desc = (case.get("description") or "").strip()
    if root_exp:
        desc = (desc + ("\n\n" if desc else "")) + f"**Expected Result:** {root_exp}"

    payload = {
        "title":       case["title"],
        "external_id": case["external_id"],
        "suite_id":    suite_id,
        "description": desc,
        "steps":       steps,
        "automation":  False
    }
    return payload

def create_case(payload: dict) -> int:
    url = f"{BASE_URL}/case/{PROJECT}"
    r = requests.post(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404, 409, 422):
        txt = r.text[:600]
        # external_id mevcutsa patch dene
        if "external" in txt.lower() and ("taken" in txt.lower() or "exist" in txt.lower()):
            return update_by_external_id(payload["external_id"], payload)
        fail(f"case_create_failed {r.status_code} {txt}")
    r.raise_for_status()
    cid = r.json()["result"]["id"]
    print(f"[qase-sync] case_created ext={payload['external_id']} id={cid}")
    return cid

def update_case(case_id: int, payload: dict) -> int:
    url = f"{BASE_URL}/case/{PROJECT}/{case_id}"
    r = requests.patch(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code in (400, 401, 404):
        fail(f"case_update_failed id={case_id} {r.status_code} {r.text[:400]}")
    print(f"[qase-sync] case_updated id={case_id}")
    return case_id

def update_by_external_id(ext: str, payload: dict) -> int:
    # tam harita ile güncelle
    mapping = build_external_id_map()
    cid = mapping.get(ext)
    if not cid:
        fail(f"cannot_find_case_for_external_id ext={ext}")
    return update_case(cid, payload)

# 3) Dosya okuma

def load_files() -> list[str]:
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

def parse_suites(file_path: str) -> list[tuple[str, list]]:
    with open(file_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)

    suites: list[tuple[str, list]] = []

    # biçim 1: tek suite objesi
    if isinstance(data, dict) and "suite" in data and "cases" in data:
        suites.append((data["suite"], data.get("cases", [])))
        return suites

    # biçim 2: suite objelerinden oluşan liste
    if isinstance(data, list) and all(isinstance(x, dict) and "suite" in x and "cases" in x for x in data):
        for obj in data:
            suites.append((obj["suite"], obj.get("cases", [])))
        return suites

    # biçim 3: sözlük, anahtar suite adı, değer case listesi
    if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
        for k, v in data.items():
            suites.append((k, v))
        return suites

    fail(f"unsupported JSON shape file={file_path}")

def ensure_case_shape(case: dict, file_path: str, suite: str, idx: int, seen_exts: set[str]):
    # title
    if "title" not in case or not str(case["title"]).strip():
        fail(f"missing title file={file_path} suite={suite}")
    # external_id
    ext = (str(case.get("external_id") or "").strip())
    if not ext:
        base = re.sub(r"[^A-Za-z0-9]+", "-", suite).upper().strip("-")
        ext = f"{base}-{idx:03d}"
        case["external_id"] = ext
        print(f"[qase-sync] auto_external_id ext={ext} suite={suite}")
    else:
        case["external_id"] = ext
    # tekil yap
    if ext in seen_exts:
        fail(f"duplicate external_id in input file={file_path} suite={suite} ext={ext}")
    seen_exts.add(ext)
    # steps tipi
    if "steps" in case and not isinstance(case["steps"], list):
        fail(f"steps must be list file={file_path} suite={suite} ext={case['external_id']}")

# 4) Ana akış

def main():
    require_env()
    existing_map = build_external_id_map()
    suite_cache = list_suites()
    files = load_files()
    if not files:
        fail("no JSON under docs manual testing path")

    created = 0
    updated = 0
    touched_ids: list[int] = []
    seen_exts: set[str] = set(existing_map.keys())

    for fp in files:
        for suite_name, cases in parse_suites(fp):
            sid = get_or_create_suite_id(suite_name, suite_cache)
            print(f"[qase-sync] file={fp} suite={suite_name} sid={sid} count={len(cases)}")
            for i, c in enumerate(cases, start=1):
                if not isinstance(c, dict):
                    print(f"[qase-sync] skip_non_dict_case file={fp}")
                    continue
                ensure_case_shape(c, fp, suite_name, i, seen_exts)
                payload = map_payload(c, sid)
                ext = payload["external_id"]
                if ext in existing_map:
                    cid = update_case(existing_map[ext], payload)
                    updated += 1
                else:
                    cid = create_case(payload)
                    existing_map[ext] = cid
                    created += 1
                touched_ids.append(cid)

    print(f"[qase-sync] summary created={created} updated={updated} touched={len(touched_ids)}")

    if touched_ids:
        url = f"{BASE_URL}/run/{PROJECT}"
        run_payload = {"title": "Manual re test auto generated", "cases": touched_ids}
        r = requests.post(url, headers=HEADERS, data=json.dumps(run_payload))
        r.raise_for_status()
        run_id = r.json()["result"]["id"]
        print(f"[qase-sync] run_created id={run_id} url=https://app.qase.io/run/{PROJECT}/{run_id}")

if __name__ == "__main__":
    main()