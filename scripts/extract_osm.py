#!/usr/bin/env python3
"""
OSM Data Extractor for Saint Petersburg Isometric Map
Fetches building footprints, heights, roof shapes, waterways, and tram tracks from OpenStreetMap via Overpass API.
"""

import sys
import json
import urllib.request
import urllib.parse
import os

# Central Saint Petersburg Bounding Box
# Covering: Hermitage, Palace Sq, St. Isaac's, Peter & Paul Fortress, Vasilyevsky Spit, Nevsky Prospect
DEFAULT_BBOX = {
    "south": 59.928,
    "west": 30.290,
    "north": 59.955,
    "east": 30.345
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_overpass_query(south, west, north, east):
    bbox = f"{south},{west},{north},{east}"
    query = f"""
    [out:json][timeout:60];
    (
      // Buildings with height or levels
      way["building"]({bbox});
      relation["building"]({bbox});

      // Waterways & rivers
      way["waterway"]({bbox});
      relation["waterway"]({bbox});
      way["natural"="water"]({bbox});
      relation["natural"="water"]({bbox});

      // Tram tracks
      way["railway"="tram"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    return query

def fetch_osm_data(bbox):
    query = build_overpass_query(bbox["south"], bbox["west"], bbox["north"], bbox["east"])
    print(f"📡 Querying Overpass API for bbox {bbox}...")
    
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={"User-Agent": "SPb-Isometric-Map-Extractor/1.0 (https://github.com/)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"✅ Received {len(result.get('elements', []))} elements from OpenStreetMap.")
            return result
    except Exception as e:
        print(f"❌ Error fetching from Overpass: {e}")
        return None

def process_osm_to_geojson(osm_data, output_path):
    elements = osm_data.get("elements", [])
    nodes = {}
    ways = []

    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lon"], el["lat"])
        elif el["type"] == "way":
            ways.append(el)

    features = []

    for way in ways:
        tags = way.get("tags", {})
        node_ids = way.get("nodes", [])
        coords = [nodes[nid] for nid in node_ids if nid in nodes]

        if len(coords) < 2:
            continue

        feature_type = "building" if "building" in tags else "water" if "waterway" in tags or tags.get("natural") == "water" else "tram" if tags.get("railway") == "tram" else "other"

        # Determine height / levels
        height = 18.0
        if "height" in tags:
            try:
                height = float(tags["height"].replace("m", "").replace(",", ".").strip())
            except:
                pass
        elif "building:levels" in tags:
            try:
                levels = float(tags["building:levels"].replace(",", ".").strip())
                height = max(6.0, levels * 3.4)
            except:
                pass

        feature = {
            "type": "Feature",
            "properties": {
                "id": way["id"],
                "kind": feature_type,
                "name": tags.get("name", tags.get("name:ru", "")),
                "height": height,
                "colour": tags.get("building:colour", ""),
                "roof:shape": tags.get("roof:shape", "flat")
            },
            "geometry": {
                "type": "Polygon" if coords[0] == coords[-1] and len(coords) >= 4 else "LineString",
                "coordinates": [coords] if coords[0] == coords[-1] and len(coords) >= 4 else coords
            }
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"💾 Saved {len(features)} GeoJSON features to {output_path}")

def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    out_file = os.path.join(out_dir, "spb_center.geojson")
    
    osm_data = fetch_osm_data(DEFAULT_BBOX)
    if osm_data:
        process_osm_to_geojson(osm_data, out_file)

if __name__ == "__main__":
    main()
