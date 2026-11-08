#!/usr/bin/env python3
"""
Stitch real OpenStreetMap water relations and closed ways into public/data/spb_water.json
Includes the Great Neva, Little Neva, Neva, Moika, Fontanka, Griboedov Canal,
Kryukov Canal, Obvodny Canal, Kronverk Strait, New Holland Basin, Swan Canal, etc.
"""

import json
import math
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_WATER_FILE = os.path.join(BASE_DIR, 'public', 'data', 'spb_water_raw.json')
OUT_WATER_FILE = os.path.join(BASE_DIR, 'public', 'data', 'spb_water.json')

# Center of map (Palace Square)
LAT0, LON0 = 59.939095, 30.315868
R = 6378137.0

def lat_lon_to_meters(lat, lon):
    x = (lon - LON0) * (math.pi / 180.0) * R * math.cos(LAT0 * math.pi / 180.0)
    z = -(lat - LAT0) * (math.pi / 180.0) * R
    return x, z

def meters_to_lat_lon(x, z):
    lat = LAT0 - (z / R) * (180.0 / math.pi)
    lon = LON0 + (x / (R * math.cos(LAT0 * math.pi / 180.0))) * (180.0 / math.pi)
    return lon, lat

with open(RAW_WATER_FILE, 'r', encoding='utf-8') as f:
    raw = json.load(f)

nodes = {el['id']: (el['lon'], el['lat']) for el in raw['elements'] if el['type'] == 'node'}
ways = {el['id']: el['nodes'] for el in raw['elements'] if el['type'] == 'way'}
rels = [el for el in raw['elements'] if el['type'] == 'relation']

print(f"Loaded raw water: {len(nodes)} nodes, {len(ways)} ways, {len(rels)} relations.")

def stitch_ways(way_ids):
    segments = []
    for wid in way_ids:
        if wid in ways:
            pts = ways[wid]
            if len(pts) >= 2:
                segments.append(list(pts))
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

water_polygons = []

# Map bounds in meters for clipping giant Neva relation (rel 2599821 extends to Lake Ladoga)
# Central district + surroundings: X in [-5500, 6500], Z in [-3500, 3500]
MIN_X, MAX_X = -5500, 6800
MIN_Z, MAX_Z = -3800, 3800

def clean_ring(coords):
    """Remove consecutive duplicate points and ensure closed"""
    if len(coords) < 3:
        return []
    cleaned = [coords[0]]
    for pt in coords[1:]:
        if abs(pt[0] - cleaned[-1][0]) > 1e-6 or abs(pt[1] - cleaned[-1][1]) > 1e-6:
            cleaned.append(pt)
    if len(cleaned) < 3:
        return []
    if cleaned[0] != cleaned[-1]:
        cleaned.append(cleaned[0])
    return cleaned

for r in rels:
    name = r.get('tags', {}).get('name', r.get('tags', {}).get('waterway', 'Река / Канал'))
    rel_id = r['id']
    members = r.get('members', [])
    outer_ways = [m['ref'] for m in members if m.get('role') in ('outer', '') and m['type'] == 'way']

    # For giant Neva relation 2599821 (which goes to Ladoga), filter ways to our district bounds
    if rel_id == 2599821:
        filtered_ways = []
        for wid in outer_ways:
            if wid in ways:
                for nid in ways[wid]:
                    if nid in nodes:
                        lon, lat = nodes[nid]
                        x, z = lat_lon_to_meters(lat, lon)
                        if (MIN_X - 500) <= x <= (MAX_X + 500) and (MIN_Z - 500) <= z <= (MAX_Z + 500):
                            filtered_ways.append(wid)
                            break
        outer_ways = filtered_ways

    rings = stitch_ways(outer_ways)
    for idx, ring in enumerate(rings):
        coords = [nodes[nid] for nid in ring if nid in nodes]
        if len(coords) < 3:
            continue
        
        # If giant Neva was clipped, ensure it forms a closed bounding loop
        if rel_id == 2599821 and coords[0] != coords[-1]:
            # Close it by following bounding boundary
            coords.append(coords[0])

        coords = clean_ring(coords)
        if len(coords) >= 4:
            water_polygons.append({
                'id': rel_id * 100 + idx,
                'name': name,
                'polygon': coords
            })

# Standalone closed water ways (ponds in parks, basins)
for el in raw['elements']:
    if el.get('type') == 'way':
        tags = el.get('tags', {})
        if 'water' in tags or 'waterway' in tags or 'natural' in tags:
            wnodes = el.get('nodes', [])
            if len(wnodes) >= 4 and wnodes[0] == wnodes[-1]:
                coords = [nodes[nid] for nid in wnodes if nid in nodes]
                coords = clean_ring(coords)
                if len(coords) >= 4:
                    water_polygons.append({
                        'id': el['id'],
                        'name': tags.get('name', tags.get('waterway', tags.get('natural', 'Пруд'))),
                        'polygon': coords
                    })

# Deduplicate by ID
seen_ids = set()
unique_waters = []
for wp in water_polygons:
    if wp['id'] not in seen_ids:
        seen_ids.add(wp['id'])
        unique_waters.append(wp)

with open(OUT_WATER_FILE, 'w', encoding='utf-8') as f:
    json.dump(unique_waters, f, ensure_ascii=False)

print(f"\n🎉 Successfully compiled {len(unique_waters)} real water polygons to {OUT_WATER_FILE}!")
for wp in unique_waters[:15]:
    print(f"  • {wp['name']} (ID {wp['id']}): {len(wp['polygon'])} points")
