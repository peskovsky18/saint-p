import glob
import json
import math
import xml.etree.ElementTree as ET

REF_LAT = 59.939095
REF_LON = 30.315868
DEG_TO_RAD = math.pi / 180.0
METERS_PER_DEG_LAT = 111320.0
METERS_PER_DEG_LON = 111320.0 * math.cos(REF_LAT * DEG_TO_RAD)

def to_m(lon, lat):
    dx = (lon - REF_LON) * METERS_PER_DEG_LON
    dz = (lat - REF_LAT) * METERS_PER_DEG_LAT
    return dx, -dz

def point_in_poly(x, z, poly):
    inside = False
    n = len(poly)
    p1x, p1z = poly[0]
    for i in range(n + 1):
        p2x, p2z = poly[i % n]
        if min(p1z, p2z) < z <= max(p1z, p2z):
            if x <= max(p1x, p2x):
                if p1z != p2z:
                    xinters = (z - p1z) * (p2x - p1x) / (p2z - p1z) + p1x
                if p1x == p2x or x <= xinters:
                    inside = not inside
        p1x, p1z = p2x, p2z
    return inside

def dist_to_segment(x, z, x1, z1, x2, z2):
    dx = x2 - x1
    dz = z2 - z1
    l2 = dx * dx + dz * dz
    if l2 == 0: return math.hypot(x - x1, z - z1)
    t = max(0.0, min(1.0, ((x - x1) * dx + (z - z1) * dz) / l2))
    return math.hypot(x - (x1 + t * dx), z - (z1 + t * dz))

def run():
    print("1. Parsing OSM slices for complete Central District greenery...")
    slices = sorted(glob.glob('/tmp/spb_osm_slices/slice_*.xml'))

    nodes = {}
    ways = {}
    relations = []

    for s in slices:
        context = ET.iterparse(s, events=('end',))
        for event, elem in context:
            if elem.tag == 'node':
                nid = int(elem.attrib['id'])
                lat = float(elem.attrib['lat'])
                lon = float(elem.attrib['lon'])
                tags = {t.attrib.get('k'): t.attrib.get('v') for t in elem.findall('tag')}
                nodes[nid] = (lon, lat, tags)
                elem.clear()
            elif elem.tag == 'way':
                wid = int(elem.attrib['id'])
                tags = {t.attrib.get('k'): t.attrib.get('v') for t in elem.findall('tag')}
                node_ids = [int(nd.attrib['ref']) for nd in elem.findall('nd')]
                ways[wid] = (tags, node_ids)
                elem.clear()
            elif elem.tag == 'relation':
                rid = int(elem.attrib['id'])
                tags = {t.attrib.get('k'): t.attrib.get('v') for t in elem.findall('tag')}
                members = [(m.attrib.get('type'), int(m.attrib.get('ref')), m.attrib.get('role')) for m in elem.findall('member')]
                relations.append((rid, tags, members))
                elem.clear()

    print(f"Loaded {len(nodes)} nodes, {len(ways)} ways, {len(relations)} relations.")

    # 1. Green polygons extraction
    def is_green_tag(tags):
        if tags.get('leisure') in ('park', 'garden', 'pitch', 'playground', 'nature_reserve'):
            return True
        if tags.get('landuse') in ('grass', 'village_green', 'recreation_ground', 'forest', 'meadow', 'flowerbed', 'orchard', 'allotments', 'cemetery', 'greenfield'):
            return True
        if tags.get('natural') in ('wood', 'scrub', 'grassland', 'heath'):
            return True
        return False

    green_polygons = []

    for wid, (tags, node_ids) in ways.items():
        if not is_green_tag(tags):
            continue
        coords = [nodes[nid][:2] for nid in node_ids if nid in nodes]
        if len(coords) >= 3:
            green_polygons.append({
                'id': wid,
                'name': tags.get('name', ''),
                'kind': tags.get('leisure') or tags.get('landuse') or tags.get('natural', 'park'),
                'polygon': coords
            })

    for rid, tags, members in relations:
        if not is_green_tag(tags):
            continue
        outer_ways = [ref for mtype, ref, role in members if mtype == 'way' and role in ('outer', '') and ref in ways]
        if not outer_ways:
            continue
        for wid in outer_ways:
            seg = [nodes[nid][:2] for nid in ways[wid][1] if nid in nodes]
            if len(seg) >= 3:
                green_polygons.append({
                    'id': rid,
                    'name': tags.get('name', ''),
                    'kind': tags.get('leisure') or tags.get('landuse') or tags.get('natural', 'park'),
                    'polygon': seg
                })

    print(f"Total green polygons: {len(green_polygons)}")
    with open('public/data/spb_parks.json', 'w', encoding='utf-8') as f:
        json.dump(green_polygons, f, ensure_ascii=False)

    # 2. Water polygons
    with open('public/data/spb_water.json') as f:
        water_raw = json.load(f)
    water_polys = []
    for w in water_raw:
        pts = [to_m(lon, lat) for lon, lat in w.get('polygon', [])]
        if len(pts) >= 3:
            water_polys.append(pts)

    # 3. Buildings spatial grid
    with open('public/data/spb_buildings.json') as f:
        bldgs = json.load(f)

    bldg_spatial = {}
    for b in bldgs:
        poly = b.get('poly', [])
        if len(poly) < 3: continue
        xs = [p[0] for p in poly]
        zs = [p[1] for p in poly]
        bmin_x, bmax_x = min(xs), max(xs)
        bmin_z, bmax_z = min(zs), max(zs)
        
        gx0, gx1 = int(math.floor(bmin_x / 50.0)), int(math.floor(bmax_x / 50.0))
        gz0, gz1 = int(math.floor(bmin_z / 50.0)), int(math.floor(bmax_z / 50.0))
        for gx in range(gx0, gx1 + 1):
            for gz in range(gz0, gz1 + 1):
                key = (gx, gz)
                if key not in bldg_spatial:
                    bldg_spatial[key] = []
                bldg_spatial[key].append((bmin_x, bmax_x, bmin_z, bmax_z, poly))

    # 4. Roads spatial grid
    with open('public/data/spb_roads.json') as f:
        roads = json.load(f)

    road_spatial = {}
    for r in roads:
        hw = r.get('type')
        halfW = 9.5 if hw == 'primary' else (7.0 if hw == 'secondary' else (5.5 if hw == 'tertiary' else 4.0))
        coords = r.get('coords', [])
        if len(coords) < 2: continue
        pts = [to_m(lon, lat) for lon, lat in coords]
        for i in range(len(pts) - 1):
            p1, p2 = pts[i], pts[i+1]
            min_x, max_x = min(p1[0], p2[0]), max(p1[0], p2[0])
            min_z, max_z = min(p1[1], p2[1]), max(p1[1], p2[1])
            gx0, gx1 = int(math.floor((min_x - halfW) / 50.0)), int(math.floor((max_x + halfW) / 50.0))
            gz0, gz1 = int(math.floor((min_z - halfW) / 50.0)), int(math.floor((max_z + halfW) / 50.0))
            seg = (p1[0], p1[1], p2[0], p2[1], halfW)
            for gx in range(gx0, gx1 + 1):
                for gz in range(gz0, gz1 + 1):
                    key = (gx, gz)
                    if key not in road_spatial: road_spatial[key] = []
                    road_spatial[key].append(seg)

    # 5. Railway tracks spatial grid
    with open('public/data/spb_railways.json') as f:
        rail_data = json.load(f)

    rail_spatial = {}
    for track in rail_data.get('tracks', []):
        coords = track.get('coords', [])
        if len(coords) < 2: continue
        pts = [to_m(lon, lat) for lon, lat in coords]
        for i in range(len(pts) - 1):
            p1, p2 = pts[i], pts[i+1]
            min_x, max_x = min(p1[0], p2[0]), max(p1[0], p2[0])
            min_z, max_z = min(p1[1], p2[1]), max(p1[1], p2[1])
            gx0, gx1 = int(math.floor((min_x - 3.0) / 50.0)), int(math.floor((max_x + 3.0) / 50.0))
            gz0, gz1 = int(math.floor((min_z - 3.0) / 50.0)), int(math.floor((max_z + 3.0) / 50.0))
            seg = (p1[0], p1[1], p2[0], p2[1])
            for gx in range(gx0, gx1 + 1):
                for gz in range(gz0, gz1 + 1):
                    key = (gx, gz)
                    if key not in rail_spatial: rail_spatial[key] = []
                    rail_spatial[key].append(seg)

    def is_in_water(x, z):
        for wp in water_polys:
            if point_in_poly(x, z, wp):
                return True
        return False

    def is_in_building(x, z):
        gx = int(math.floor(x / 50.0))
        gz = int(math.floor(z / 50.0))
        candidates = bldg_spatial.get((gx, gz), [])
        for min_x, max_x, min_z, max_z, poly in candidates:
            if min_x - 1.0 <= x <= max_x + 1.0 and min_z - 1.0 <= z <= max_z + 1.0:
                if point_in_poly(x, z, poly):
                    return True
        return False

    def is_on_road(x, z):
        gx = int(math.floor(x / 50.0))
        gz = int(math.floor(z / 50.0))
        for x1, z1, x2, z2, halfW in road_spatial.get((gx, gz), []):
            if dist_to_segment(x, z, x1, z1, x2, z2) < halfW - 0.4:
                return True
        return False

    def is_on_rail(x, z):
        gx = int(math.floor(x / 50.0))
        gz = int(math.floor(z / 50.0))
        for x1, z1, x2, z2 in rail_spatial.get((gx, gz), []):
            if dist_to_segment(x, z, x1, z1, x2, z2) < 2.4:
                return True
        return False

    def is_in_palace_square(x, z):
        # Only Alexander Column & central cobblestones circle
        return math.hypot(x - 67.86, z - 87.72) < 85.0

    # Trees collection
    trees = []
    tree_grid = {} # cell size 6.2m

    def try_add_tree(x, z, tree_type, scale, source=""):
        if is_in_water(x, z) or is_in_palace_square(x, z) or is_in_building(x, z) or is_on_road(x, z) or is_on_rail(x, z):
            return False

        cell_x = int(math.floor(x / 6.2))
        cell_z = int(math.floor(z / 6.2))
        key = (cell_x, cell_z)
        if key in tree_grid:
            return False

        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                nkey = (cell_x + dx, cell_z + dz)
                if nkey in tree_grid:
                    ex, ez = tree_grid[nkey]
                    if math.hypot(ex - x, ez - z) < 6.0:
                        return False

        tree_grid[key] = (x, z)
        lon = REF_LON + x / METERS_PER_DEG_LON
        lat = REF_LAT - z / METERS_PER_DEG_LAT
        trees.append({
            'id': len(trees) + 1,
            'x': round(x, 2),
            'z': round(z, 2),
            'lat': round(lat, 7),
            'lon': round(lon, 7),
            'type': tree_type,
            'scale': round(scale, 2)
        })
        return True

    # A. Explicit OSM tree nodes
    print("A. Adding explicit OSM tree nodes...")
    for nid, (lon, lat, tags) in nodes.items():
        if tags.get('natural') == 'tree':
            x, z = to_m(lon, lat)
            if math.hypot(x, z) < 4800:
                tt = abs(nid) % 6
                sc = 0.92 + (abs(nid * 13) % 22) / 100.0
                try_add_tree(x, z, tt, sc, "osm_node")

    # B. OSM Tree Rows
    print("B. Adding OSM tree rows...")
    for wid, (tags, node_ids) in ways.items():
        if tags.get('natural') == 'tree_row':
            pts = [to_m(nodes[nid][0], nodes[nid][1]) for nid in node_ids if nid in nodes]
            if len(pts) < 2: continue
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i + 1]
                dx = p2[0] - p1[0]
                dz = p2[1] - p1[1]
                dist = math.hypot(dx, dz)
                if dist < 4.0: continue
                steps = int(math.floor(dist / 7.0))
                for s in range(steps + 1):
                    frac = s / max(1, steps)
                    tx = p1[0] + dx * frac
                    tz = p1[1] + dz * frac
                    tt = (wid + s) % 6
                    sc = 0.95 + ((s * 7) % 15) / 100.0
                    try_add_tree(tx, tz, tt, sc, "osm_row")

    # C. Park and Garden Infill (All 5,444 polygons)
    print("C. Infilling trees across all parks, gardens, and green spaces...")
    for idx, gp in enumerate(green_polygons):
        poly = [to_m(lon, lat) for lon, lat in gp['polygon']]
        if len(poly) < 3: continue
        pxs = [p[0] for p in poly]
        pzs = [p[1] for p in poly]
        min_x, max_x = min(pxs), max(pxs)
        min_z, max_z = min(pzs), max(pzs)
        w = max_x - min_x
        h = max_z - min_z
        if w < 4.0 or h < 4.0: continue
        if math.hypot((min_x + max_x)/2, (min_z + max_z)/2) > 4800: continue

        kind = gp.get('kind', 'park')
        spacing = 8.5 if kind in ('wood', 'forest', 'nature_reserve') else 9.6

        x_steps = int(math.floor(w / spacing))
        z_steps = int(math.floor(h / spacing))
        if x_steps == 0 or z_steps == 0:
            cx = (min_x + max_x) / 2
            cz = (min_z + max_z) / 2
            if point_in_poly(cx, cz, poly):
                try_add_tree(cx, cz, idx % 6, 1.0, "courtyard")
            continue

        for ix in range(x_steps + 1):
            for iz in range(z_steps + 1):
                seed = idx * 1009 + ix * 37 + iz * 83
                jit_x = ((seed % 17) - 8) * 0.14
                jit_z = (((seed // 17) % 17) - 8) * 0.14
                tx = min_x + ix * spacing + spacing * 0.5 + jit_x
                tz = min_z + iz * spacing + spacing * 0.5 + jit_z

                if point_in_poly(tx, tz, poly):
                    tt = seed % 6
                    sc = 0.93 + ((seed % 20) / 100.0)
                    try_add_tree(tx, tz, tt, sc, "park_infill")

    # D. Street Sidewalk Trees along all avenues
    print("D. Adding street sidewalk trees...")
    for ridx, r in enumerate(roads):
        hw = r.get('type')
        if hw not in ('primary', 'secondary', 'tertiary', 'residential'): continue
        coords = r.get('coords', [])
        if len(coords) < 2: continue
        pts = [to_m(lon, lat) for lon, lat in coords]
        halfW = 9.5 if hw == 'primary' else (7.0 if hw == 'secondary' else (5.5 if hw == 'tertiary' else 4.0))

        for i in range(len(pts) - 1):
            p1, p2 = pts[i], pts[i + 1]
            dx = p2[0] - p1[0]
            dz = p2[1] - p1[1]
            seg_len = math.hypot(dx, dz)
            if seg_len < 12.0: continue

            nx = -dz / seg_len
            nz = dx / seg_len

            steps = int(math.floor(seg_len / 13.0))
            for s in range(1, steps + 1):
                frac = s / (steps + 1)
                cx = p1[0] + dx * frac
                cz = p1[1] + dz * frac

                for side in (-1, 1):
                    sw_x = cx + nx * side * (halfW + 1.8)
                    sw_z = cz + nz * side * (halfW + 1.8)
                    if math.hypot(sw_x, sw_z) > 4800: continue
                    seed = ridx * 47 + i * 13 + s * 7 + side
                    tt = seed % 6
                    sc = 0.94 + ((seed % 19) / 100.0)
                    try_add_tree(sw_x, sw_z, tt, sc, "street_tree")

    # E. Comprehensive Courtyard & Open Space Infill across the whole Central District
    print("E. Infilling trees into all open courtyards and squares...")
    # Scan from -1200 to +4400 in X, -1200 to +2400 in Z
    step = 9.2
    for x_i in range(-120, 440):
        x = x_i * step
        for z_i in range(-120, 240):
            z = z_i * step
            if math.hypot(x, z) > 4600: continue
            seed = int(abs(x_i * 97 + z_i * 131))
            jit_x = ((seed % 13) - 6) * 0.15
            jit_z = (((seed // 13) % 13) - 6) * 0.15
            tt = seed % 6
            sc = 0.92 + ((seed % 21) / 100.0)
            try_add_tree(x + jit_x, z + jit_z, tt, sc, "courtyard_infill")

    print(f"TOTAL TREES GENERATED: {len(trees)}")

    with open('public/data/spb_trees.json', 'w', encoding='utf-8') as f:
        json.dump(trees, f, ensure_ascii=False)
    print("Saved public/data/spb_trees.json successfully!")

if __name__ == '__main__':
    run()
