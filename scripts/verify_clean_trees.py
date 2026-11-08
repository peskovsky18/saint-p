import subprocess
import time
import json
import urllib.request
import os

port = 9436
chrome_proc = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={port}',
    '--use-gl=angle',
    '--use-angle=metal',
    '--window-size=1440,900',
    'http://localhost:4173/'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

time.sleep(2.5)

views = [
    {
        'name': 'clean_alexander_garden_admiralty.png',
        'target': {'x': -300, 'z': 240},
        'zoom': 180,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'clean_water_neva_and_palace_square.png',
        'target': {'x': -50, 'z': 20},
        'zoom': 220,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'clean_nevsky_and_fontanka_bridges.png',
        'target': {'x': 1050, 'z': 650},
        'zoom': 180,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'clean_wide_city_central_district.png',
        'target': {'x': 1200, 'z': 400},
        'zoom': 650,
        'action': 'window.app.ui.toggleQuickJump(false);'
    }
]

out_dir = '/Users/saskapeskovsky/.gemini/antigravity/brain/66f0bef1-6f0e-48a2-8470-2a8d33c50fac'

try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
    page_tabs = [t for t in tabs if t.get('type') == 'page']
    target_tab = page_tabs[0] if page_tabs else tabs[0]
    ws_url = target_tab['webSocketDebuggerUrl']

    node_code = f'''
    import fs from 'fs';
    const ws = new WebSocket("{ws_url}");

    const views = {json.dumps(views)};
    let viewIdx = 0;
    let polling = true;

    ws.onopen = () => {{
      ws.send(JSON.stringify({{ id: 1, method: "Page.enable" }}));
      ws.send(JSON.stringify({{ id: 2, method: "Runtime.enable" }}));
      
      const poll = setInterval(() => {{
        if (!polling) return;
        ws.send(JSON.stringify({{
          id: 10,
          method: "Runtime.evaluate",
          params: {{ expression: "Boolean(window.app && window.app.trees && window.app.trees.canopyMesh && window.app.water && window.app.water.riverMesh && window.app.ground && window.app.ground.roadMesh)" }}
        }}));
      }}, 500);
    }};

    function applyNextView() {{
      const v = views[viewIdx];
      const expr = `
        window.app.cameraCtrl.target.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.currentTarget.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.zoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.targetZoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.resize(1440, 900);
        window.app.sun.setTime(13.5);
        ${{v.action || ''}}
      `;
      ws.send(JSON.stringify({{
        id: 25,
        method: "Runtime.evaluate",
        params: {{ expression: expr }}
      }}));
    }}

    ws.onmessage = (msg) => {{
      const d = JSON.parse(msg.data);
      if (d.id === 10 && d.result?.result?.value === true && polling) {{
        polling = false;
        // Query tree count
        ws.send(JSON.stringify({{
          id: 15,
          method: "Runtime.evaluate",
          params: {{ expression: "window.app.trees.canopyMesh.count" }}
        }}));
      }}

      if (d.id === 15) {{
        console.log("LIVE TREE COUNT RENDERED IN SCENE: " + d.result?.result?.value);
        applyNextView();
      }}

      if (d.id === 25) {{
        setTimeout(() => {{
          ws.send(JSON.stringify({{
            id: 30,
            method: "Page.captureScreenshot",
            params: {{ format: "png" }}
          }}));
        }}, 2500);
      }}

      if (d.id === 30) {{
        const v = views[viewIdx];
        const outPath = "{out_dir}/" + v.name;
        fs.writeFileSync(outPath, Buffer.from(d.result.data, "base64"));
        console.log("Saved: " + outPath);
        viewIdx++;
        if (viewIdx < views.length) {{
          applyNextView();
        }} else {{
          console.log("ALL VERIFICATION VIEWS SAVED SUCCESSFULLY!");
          process.exit(0);
        }}
      }}
    }};
    '''

    with open('/tmp/verify_clean_trees.mjs', 'w') as f:
        f.write(node_code)

    res = subprocess.run(['node', '/tmp/verify_clean_trees.mjs'], capture_output=True, text=True, timeout=40)
    print("Node output:\n", res.stdout)
    if res.stderr:
        print("Node error:\n", res.stderr)

finally:
    chrome_proc.terminate()
