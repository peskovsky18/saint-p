import math
import urllib.request
import ssl
import os

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)

zoom = 16
# Center area:
# South: 59.932, North: 59.948, West: 30.298, East: 30.332
x_min, y_min = deg2num(59.948, 30.298, zoom)
x_max, y_max = deg2num(59.932, 30.332, zoom)

print(f"X range: {x_min} .. {x_max}, Y range: {y_min} .. {y_max}")

# Bounding box of all tiles combined
top_lat, left_lon = num2deg(x_min, y_min, zoom)
bottom_lat, right_lon = num2deg(x_max + 1, y_max + 1, zoom)

meta = {
    "zoom": zoom,
    "x_min": x_min,
    "x_max": x_max,
    "y_min": y_min,
    "y_max": y_max,
    "bounds": {
        "north": top_lat,
        "south": bottom_lat,
        "west": left_lon,
        "east": right_lon
    }
}

os.makedirs("public/data/satellite", exist_ok=True)
import json
with open("public/data/satellite/meta.json", "w") as f:
    json.dump(meta, f, indent=2)

ctx = ssl._create_unverified_context()

for x in range(x_min, x_max + 1):
    for y in range(y_min, y_max + 1):
        tile_path = f"public/data/satellite/{zoom}_{x}_{y}.jpg"
        if not os.path.exists(tile_path):
            url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{y}/{x}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
                    with open(tile_path, "wb") as f:
                        f.write(res.read())
                print(f"Downloaded tile {zoom}_{x}_{y}.jpg")
            except Exception as e:
                print(f"Error tile {x},{y}: {e}")
