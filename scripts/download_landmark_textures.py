#!/usr/bin/env python3
"""
Downloads real architectural landmark images from Wikimedia Commons
for Saint Petersburg isometric pixel-art rendering.
"""

import urllib.request
import urllib.parse
import json
import ssl
import os

ctx = ssl._create_unverified_context()
headers = {'User-Agent': 'Mozilla/5.0 SPb-Izo-Bot/1.0 (https://github.com/)'}

landmarks = [
    ('hermitage', 'File:Winter_Palace_Facade.jpg'),
    ('general_staff', 'File:General_Staff_Building_Eastern_Wing.jpg'),
    ('admiralty', 'File:Admiralty_Building_Central_Frieze.jpg'),
    ('isaac', "File:Saint_Isaac's_Cathedral_in_SPB.jpeg"),
    ('spas', 'File:Spb_06-2017_img47_Church_on_the_Blood.jpg'),
    ('exchange', 'File:Architectural_ensemble_of_the_Old_Saint_Petersburg_Stock_Exchange,_2006_(01).jpg'),
    ('peter_paul', 'File:Saint_Peter_and_Paul_Cathedral_in_Saint_Petersburg_main_facade.jpg')
]

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures', 'landmarks')
os.makedirs(out_dir, exist_ok=True)

titles = '|'.join([item[1] for item in landmarks])
api_url = f'https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(titles)}&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json'

req = urllib.request.Request(api_url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        data = json.loads(r.read())
except Exception as e:
    print(f"Error querying API: {e}")
    exit(1)

pages = data.get('query', {}).get('pages', {})
title_to_url = {}
for pid, p in pages.items():
    title = p.get('title')
    ii = p.get('imageinfo', [{}])[0]
    u = ii.get('thumburl') or ii.get('url')
    if u:
        title_to_url[title] = u

for key, title in landmarks:
    # Normalize title
    matched_url = None
    for t, u in title_to_url.items():
        if t.lower().replace('_', ' ') == title.lower().replace('_', ' '):
            matched_url = u
            break
    if not matched_url:
        print(f"⚠️ Could not find URL for {title}")
        continue

    dest_path = os.path.join(out_dir, f"{key}.jpg")
    print(f"📥 Downloading {key} from {matched_url}...")
    try:
        img_req = urllib.request.Request(matched_url, headers=headers)
        with urllib.request.urlopen(img_req, timeout=30, context=ctx) as resp:
            with open(dest_path, 'wb') as f:
                f.write(resp.read())
        print(f"✅ Saved {key}.jpg ({os.path.getsize(dest_path)} bytes)")
    except Exception as e:
        print(f"❌ Failed to download {key}: {e}")

print("✨ All landmark textures downloaded successfully!")
