#!/usr/bin/env python3
"""
Comprehensive OSM Building Extractor for Saint Petersburg
Extracts all real building footprints (ways and multipolygon relations)
in the central satellite bounding box into public/data/spb_buildings.json
"""

import urllib.request
import urllib.parse
import json
import ssl
import sys
import os

ctx = ssl._create_unverified_context()
# Bounding box matching the 7x7 satellite orthophoto grid
BBOX = "59.9302,30.2948,59.9495,30.3333"

query = f"""
[out:json][timeout:60];
(
  way["building"]({BBOX});
  relation["building"]({BBOX});
);
out body;
>;
out skel qt;
"""

print("📡 Fetching real buildings from Overpass API...")
req = urllib.request.Request(
    "https://overpass-api.de/api/interpreter",
    data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
    headers={"User-Agent": "SaintP-Isometric-Map/2.0"}
)

try:
    with urllib.request.urlopen(req, timeout=90, context=ctx) as r:
        raw_data = json.loads(r.read())
except Exception as e:
    print(f"❌ Error fetching from Overpass API: {e}")
    sys.exit(1)

elements = raw_data.get("elements", [])
print(f"📦 Total raw elements received: {len(elements)}")

# 1. Index all nodes: id -> (lon, lat)
nodes = {}
ways = {}
relations = []

for el in elements:
    el_type = el.get("type")
    if el_type == "node":
        nodes[el["id"]] = (el["lon"], el["lat"])
    elif el_type == "way":
        ways[el["id"]] = el
    elif el_type == "relation":
        relations.append(el)

print(f"Indexed {len(nodes)} nodes, {len(ways)} ways, {len(relations)} relations.")

buildings = []

def parse_levels(tags, default_levels=4.0):
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"].replace(",", ".").strip())
        except:
            pass
    if "height" in tags:
        try:
            h = float(tags["height"].replace("m", "").replace(",", ".").strip())
            return max(1.0, round(h / 3.4, 1))
        except:
            pass
    return default_levels

def get_color(tags):
    return tags.get("building:colour", tags.get("colour", ""))

def get_roof_color(tags):
    return tags.get("roof:colour", tags.get("roof:color", ""))

def get_roof_shape(tags):
    return tags.get("roof:shape", "sloped")

# 2. Extract standard building ways (that are not part of relations or are standalone)
for way_id, way in ways.items():
    tags = way.get("tags", {})
    if "building" not in tags:
        continue
    node_ids = way.get("nodes", [])
    coords = [nodes[nid] for nid in node_ids if nid in nodes]
    if len(coords) < 3:
        continue

    # Ensure closed polygon
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    name = tags.get("name", tags.get("name:ru", ""))
    levels = parse_levels(tags, default_levels=3.5)

    buildings.append({
        "id": way_id,
        "name": name,
        "levels": levels,
        "color": get_color(tags),
        "roof_color": get_roof_color(tags),
        "roof_shape": get_roof_shape(tags),
        "polygon": coords
    })

# 3. Extract relation multipolygons (e.g. Winter Palace, General Staff, Admiralty)
for rel in relations:
    tags = rel.get("tags", {})
    members = rel.get("members", [])
    name = tags.get("name", tags.get("name:ru", ""))
    levels = parse_levels(tags, default_levels=4.0)
    col = get_color(tags)
    rcol = get_roof_color(tags)
    rshape = get_roof_shape(tags)

    outer_way_ids = [m["ref"] for m in members if m.get("role") in ("outer", "") and m.get("type") == "way"]
    
    # Try to connect outer segments into closed ring(s)
    segments = []
    for wid in outer_way_ids:
        if wid in ways:
            w = ways[wid]
            w_nodes = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
            if len(w_nodes) >= 2:
                segments.append(w_nodes)

    if not segments:
        continue

    # If simple single closed way
    if len(segments) == 1 and segments[0][0] == segments[0][-1] and len(segments[0]) >= 4:
        buildings.append({
            "id": rel["id"],
            "name": name,
            "levels": levels,
            "color": col,
            "roof_color": rcol,
            "roof_shape": rshape,
            "polygon": segments[0]
        })
        continue

    # Chain segments together
    rings = []
    current_ring = list(segments[0])
    remaining = segments[1:]

    max_steps = len(segments) * 3
    steps = 0
    while remaining and steps < max_steps:
        steps += 1
        found = False
        last_pt = current_ring[-1]
        for i, seg in enumerate(remaining):
            # Check match at start
            if abs(seg[0][0] - last_pt[0]) < 1e-5 and abs(seg[0][1] - last_pt[1]) < 1e-5:
                current_ring.extend(seg[1:])
                remaining.pop(i)
                found = True
                break
            # Check match at reversed end
            elif abs(seg[-1][0] - last_pt[0]) < 1e-5 and abs(seg[-1][1] - last_pt[1]) < 1e-5:
                current_ring.extend(list(reversed(seg))[1:])
                remaining.pop(i)
                found = True
                break
        if not found:
            # End of current ring, start new ring if remaining
            rings.append(current_ring)
            current_ring = list(remaining.pop(0))

    rings.append(current_ring)

    for idx, ring in enumerate(rings):
        if len(ring) >= 3:
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            buildings.append({
                "id": rel["id"] + idx * 10000000,
                "name": name,
                "levels": levels,
                "color": col,
                "roof_color": rcol,
                "roof_shape": rshape,
                "polygon": ring
            })

# Remove duplicates by id
seen_ids = set()
unique_buildings = []
for b in buildings:
    if b["id"] not in seen_ids:
        seen_ids.add(b["id"])
        unique_buildings.append(b)

out_file = os.path.join(os.path.dirname(__file__), "..", "public", "data", "spb_buildings.json")
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(unique_buildings, f, ensure_ascii=False)

print(f"✨ Successfully saved {len(unique_buildings)} real Saint Petersburg buildings to {out_file}!")
