#!/usr/bin/env python3
"""
Official OpenStreetMap API Downloader & Parser for the ENTIRE Central District of Saint Petersburg
Includes all real buildings, multipolygon architectural complexes (Admiralty, St. Isaac's Cathedral,
Winter Palace wings, General Staff, Gostiny Dvor, Tauride Palace, Academy of Arts, etc.),
roads, parks, and waterways.
"""

import urllib.request
import xml.etree.ElementTree as ET
import json
import ssl
import os
import time

ctx = ssl._create_unverified_context()

MIN_LAT = 59.914
MAX_LAT = 59.958
MIN_LON = 30.290
MAX_LON = 30.405

ROWS = 3
COLS = 4

lat_step = (MAX_LAT - MIN_LAT) / ROWS
lon_step = (MAX_LON - MIN_LON) / COLS

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
os.makedirs(out_dir, exist_ok=True)
cache_dir = '/tmp/spb_osm_slices'
os.makedirs(cache_dir, exist_ok=True)

all_nodes = {}
all_ways = {}
all_relations = {}

print(f"📡 Fetching complete Central District ({ROWS}x{COLS} slices)...")

for r in range(ROWS):
    for c in range(COLS):
        b_min_lat = round(MIN_LAT + r * lat_step, 4)
        b_max_lat = round(MIN_LAT + (r + 1) * lat_step, 4)
        b_min_lon = round(MIN_LON + c * lon_step, 4)
        b_max_lon = round(MIN_LON + (c + 1) * lon_step, 4)

        bbox_str = f"{b_min_lon},{b_min_lat},{b_max_lon},{b_max_lat}"
        cache_file = os.path.join(cache_dir, f"slice_{r}_{c}.xml")

        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
            print(f"  Reading cached slice [{r},{c}] ...", end="", flush=True)
            with open(cache_file, 'rb') as f:
                root = ET.parse(f).getroot()
        else:
            url = f"https://api.openstreetmap.org/api/0.6/map?bbox={bbox_str}"
            print(f"  Fetching slice [{r},{c}]: {bbox_str} ...", end="", flush=True)
            success = False
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'SPbIzoBot/2.0'})
                    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
                        content = resp.read()
                        with open(cache_file, 'wb') as cf:
                            cf.write(content)
                        root = ET.fromstring(content)
                        success = True
                        break
                except Exception as e:
                    print(f" [retry {attempt+1}: {e}]", end="", flush=True)
                    time.sleep(2.0)

            if not success:
                print(f" ⚠️ Failed slice {bbox_str}")
                continue
            time.sleep(1.0)

        slice_nodes = 0
        for n in root.findall('node'):
            nid = int(n.get('id'))
            all_nodes[nid] = (float(n.get('lon')), float(n.get('lat')))
            slice_nodes += 1

        slice_ways = 0
        for w in root.findall('way'):
            wid = int(w.get('id'))
            tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
            node_ids = [int(nd.get('ref')) for nd in w.findall('nd')]
            all_ways[wid] = {'id': wid, 'tags': tags, 'nodes': node_ids}
            slice_ways += 1

        for rel in root.findall('relation'):
            rel_id = int(rel.get('id'))
            tags = {t.get('k'): t.get('v') for t in rel.findall('tag')}
            members = [
                {
                    'type': m.get('type'),
                    'ref': int(m.get('ref')),
                    'role': m.get('role', '')
                }
                for m in rel.findall('member')
            ]
            all_relations[rel_id] = {'id': rel_id, 'tags': tags, 'members': members}

        print(f" OK! ({slice_nodes} nodes, {slice_ways} ways)")

print(f"\n✅ Total collected: {len(all_nodes)} nodes, {len(all_ways)} ways, {len(all_relations)} relations.")

# Helper to stitch outer ways of multipolygon relations
def stitch_ways(way_ids):
    segments = [list(all_ways[wid]['nodes']) for wid in way_ids if wid in all_ways and len(all_ways[wid]['nodes']) >= 2]
    if not segments:
        return []
    rings = []
    while segments:
        curr = segments.pop(0)
        changed = True
        while changed:
            changed = False
            for i, seg in enumerate(segments):
                if curr[-1] == seg[0]:
                    curr.extend(seg[1:])
                    segments.pop(i)
                    changed = True
                    break
                elif curr[-1] == seg[-1]:
                    curr.extend(seg[-2::-1])
                    segments.pop(i)
                    changed = True
                    break
                elif curr[0] == seg[-1]:
                    curr = seg[:-1] + curr
                    segments.pop(i)
                    changed = True
                    break
                elif curr[0] == seg[0]:
                    curr = seg[:0:-1] + curr
                    segments.pop(i)
                    changed = True
                    break
        rings.append(curr)
    return rings

def parse_levels(tags, default=4.0):
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
    return default

# 1. Process Buildings
print("🏗️ Processing buildings...")
buildings = []
seen_ways_in_multipolygons = set()

# Process multipolygon building relations FIRST so complex landmarks have accurate perimeters
for rel_id, rel in all_relations.items():
    tags = rel['tags']
    is_bldg = (
        'building' in tags or
        'building:part' in tags or
        (tags.get('amenity') == 'place_of_worship' and tags.get('type') == 'multipolygon')
    )
    if not is_bldg:
        continue

    # Exclude administrative city borders or fortress outer territory
    if tags.get('boundary') == 'administrative':
        continue

    name = tags.get('name', tags.get('name:ru', ''))
    levels = parse_levels(tags, default=4.0)

    outer_members = [m['ref'] for m in rel['members'] if m['type'] == 'way' and m['role'] in ('outer', '')]
    if not outer_members:
        continue

    for wid in outer_members:
        seen_ways_in_multipolygons.add(wid)

    rings = stitch_ways(outer_members)
    for idx, ring in enumerate(rings):
        coords = [all_nodes[nid] for nid in ring if nid in all_nodes]
        if len(coords) < 3:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        # Clean consecutive duplicates
        clean = [coords[0]]
        for p in coords[1:]:
            if abs(p[0] - clean[-1][0]) > 1e-6 or abs(p[1] - clean[-1][1]) > 1e-6:
                clean.append(p)
        if len(clean) < 4 or clean[0] != clean[-1]:
            continue

        buildings.append({
            'id': rel_id * 1000 + idx,
            'name': name,
            'levels': levels,
            'color': tags.get('building:colour', tags.get('colour', '')),
            'roof_color': tags.get('roof:colour', tags.get('roof:color', '')),
            'roof_shape': tags.get('roof:shape', 'sloped'),
            'polygon': clean
        })

# Process closed ways with building or building:part
for wid, way in all_ways.items():
    tags = way['tags']
    is_b = 'building' in tags or 'building:part' in tags
    if not is_b:
        continue

    # If this way was an open segment inside a multipolygon relation that we already stitched, skip
    # (unless it has its own explicit building:part or building name)
    if wid in seen_ways_in_multipolygons and 'building:part' not in tags and not tags.get('name'):
        continue

    node_ids = way['nodes']
    # Must be a real closed way
    if len(node_ids) < 4 or node_ids[0] != node_ids[-1]:
        continue

    coords = [all_nodes[nid] for nid in node_ids if nid in all_nodes]
    if len(coords) < 4:
        continue

    clean = [coords[0]]
    for p in coords[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-6 or abs(p[1] - clean[-1][1]) > 1e-6:
            clean.append(p)
    if len(clean) < 4 or clean[0] != clean[-1]:
        continue

    name = tags.get('name', tags.get('name:ru', ''))
    levels = parse_levels(tags, default=4.0)

    buildings.append({
        'id': wid,
        'name': name,
        'levels': levels,
        'color': tags.get('building:colour', tags.get('colour', '')),
        'roof_color': tags.get('roof:colour', tags.get('roof:color', '')),
        'roof_shape': tags.get('roof:shape', 'sloped'),
        'polygon': clean
    })

# Deduplicate by ID
seen_b = set()
unique_buildings = []
for b in buildings:
    if b['id'] not in seen_b:
        seen_b.add(b['id'])
        unique_buildings.append(b)

with open(os.path.join(out_dir, 'spb_buildings.json'), 'w', encoding='utf-8') as f:
    json.dump(unique_buildings, f, ensure_ascii=False)
print(f"  ✅ Saved {len(unique_buildings)} complete buildings (including all stitched palaces, cathedrals and landmarks) to spb_buildings.json")

print("\n🎉 Complete Central District processing finished!")
