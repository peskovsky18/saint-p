import urllib.request, urllib.parse, json, ssl, os

ctx = ssl._create_unverified_context()
OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

query = '''
[out:json][timeout:60];
(
  // Roads and avenues
  way["highway"~"primary|secondary|tertiary|residential|pedestrian|living_street|service"](59.928,30.290,59.955,30.345);
  // Parks, gardens, lawns
  way["leisure"~"park|garden"](59.928,30.290,59.955,30.345);
  way["landuse"~"grass|recreation_ground|village_green"](59.928,30.290,59.955,30.345);
  relation["leisure"~"park|garden"](59.928,30.290,59.955,30.345);
  // Natural trees
  node["natural"="tree"](59.928,30.290,59.955,30.345);
);
out body;
>;
out skel qt;
'''

print("📡 Fetching real OSM roads, parks, and trees...")
data = urllib.parse.urlencode({'data': query}).encode('utf-8')
req = urllib.request.Request(OVERPASS_URL, data=data, headers={'User-Agent': 'SPb-Izo-Bot/1.0'})

with urllib.request.urlopen(req, timeout=80, context=ctx) as r:
    res = json.loads(r.read())

elements = res.get('elements', [])
print(f"✅ Total OSM elements received: {len(elements)}")

nodes = {}
ways = []
trees = []

for el in elements:
    if el['type'] == 'node':
        nodes[el['id']] = (el['lon'], el['lat'])
        if el.get('tags', {}).get('natural') == 'tree':
            trees.append({'id': el['id'], 'lat': el['lat'], 'lon': el['lon']})
    elif el['type'] == 'way':
        ways.append(el)

roads = []
parks = []

for way in ways:
    tags = way.get('tags', {})
    node_ids = way.get('nodes', [])
    coords = [nodes[nid] for nid in node_ids if nid in nodes]
    if len(coords) < 2:
        continue

    if 'highway' in tags:
        hw = tags.get('highway')
        name = tags.get('name', tags.get('name:ru', ''))
        lanes = int(tags.get('lanes', 2)) if tags.get('lanes', '').isdigit() else (4 if hw == 'primary' else 2)
        oneway = tags.get('oneway') == 'yes'
        roads.append({
            'id': way['id'],
            'name': name,
            'type': hw,
            'lanes': lanes,
            'oneway': oneway,
            'coords': coords # [[lon, lat], ...]
        })
    elif 'leisure' in tags or 'landuse' in tags:
        if len(coords) >= 3:
            name = tags.get('name', tags.get('name:ru', ''))
            kind = tags.get('leisure', tags.get('landuse', 'grass'))
            parks.append({
                'id': way['id'],
                'name': name,
                'kind': kind,
                'polygon': coords
            })

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
os.makedirs(out_dir, exist_ok=True)

with open(os.path.join(out_dir, 'spb_roads.json'), 'w', encoding='utf-8') as f:
    json.dump(roads, f, ensure_ascii=False)

with open(os.path.join(out_dir, 'spb_parks.json'), 'w', encoding='utf-8') as f:
    json.dump(parks, f, ensure_ascii=False)

with open(os.path.join(out_dir, 'spb_trees.json'), 'w', encoding='utf-8') as f:
    json.dump(trees, f, ensure_ascii=False)

print(f"🎉 Saved {len(roads)} roads, {len(parks)} parks, {len(trees)} trees to public/data/")
