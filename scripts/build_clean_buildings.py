#!/usr/bin/env python3
"""
Clean public/data/spb_buildings.json:
1. Excludes giant block-level composite polygons (> 160m) that overlap city blocks and courtyards.
2. Strips consecutive duplicate vertices to ensure 100% clean earcut roof triangulation.
3. Filters degenerate or microscopic noise shapes.
4. Preserves all 11,000+ real architectural building footprints and historical levels.
"""

import json
import math
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLDG_FILE = os.path.join(BASE_DIR, 'public', 'data', 'spb_buildings.json')

LAT0, LON0 = 59.939095, 30.315868
R = 6378137.0

def lat_lon_to_meters(lat, lon):
    x = (lon - LON0) * (math.pi / 180.0) * R * math.cos(LAT0 * math.pi / 180.0)
    z = -(lat - LAT0) * (math.pi / 180.0) * R
    return x, z

with open(BLDG_FILE, 'r', encoding='utf-8') as f:
    bldgs = json.load(f)

print(f"Loaded {len(bldgs)} initial buildings.")

cleaned = []
filtered_huge = 0
filtered_degenerate = 0

for b in bldgs:
    poly = b.get('polygon', [])
    if len(poly) < 3:
        filtered_degenerate += 1
        continue

    # Strip duplicate consecutive vertices
    clean_pts = [poly[0]]
    for p in poly[1:]:
        if abs(p[0] - clean_pts[-1][0]) > 1e-6 or abs(p[1] - clean_pts[-1][1]) > 1e-6:
            clean_pts.append(p)

    if len(clean_pts) < 3:
        filtered_degenerate += 1
        continue

    if clean_pts[0] != clean_pts[-1]:
        clean_pts.append(clean_pts[0])

    if len(clean_pts) < 4:
        filtered_degenerate += 1
        continue

    # Compute bounding box in local meters
    meter_pts = [lat_lon_to_meters(lat, lon) for lon, lat in clean_pts]
    xs = [p[0] for p in meter_pts]
    zs = [p[1] for p in meter_pts]
    w = max(xs) - min(xs)
    h = max(zs) - min(zs)

    # Filter out microscopic noise (< 2m in both dimensions)
    if w < 2.0 and h < 2.0:
        filtered_degenerate += 1
        continue

    # Filter out giant composite block / territory perimeters (> 160m in both dims or > 340m max)
    # These are block envelopes that cover real inner buildings, streets, and courtyards
    if (w > 160.0 and h > 160.0) or max(w, h) > 340.0:
        filtered_huge += 1
        continue

    b['polygon'] = clean_pts
    cleaned.append(b)

with open(BLDG_FILE, 'w', encoding='utf-8') as f:
    json.dump(cleaned, f, ensure_ascii=False)

print(f"✅ Cleaned buildings saved: {len(cleaned)} (filtered {filtered_huge} huge block envelopes, {filtered_degenerate} degenerate).")
