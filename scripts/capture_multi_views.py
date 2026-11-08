import subprocess
import time
import json
import urllib.request
import os

port = 9435
chrome_proc = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={port}',
    '--use-gl=angle',
    '--use-angle=metal',
    '--window-size=1280,720',
    'http://localhost:5173/'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

time.sleep(2.5)

views = [
    {
        'name': 'verified_water_neva_and_admiralty.png',
        'target': {'x': -150, 'z': 50},
        'zoom': 200,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'verified_alexander_garden_full_trees.png',
        'target': {'x': -300, 'z': 230},
        'zoom': 180,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'verified_water_fontanka_and_bridges.png',
        'target': {'x': 1050, 'z': 650},
        'zoom': 180,
        'action': 'window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'verified_wide_city_overview_all_green.png',
        'target': {'x': 1400, 'z': 300},
        'zoom': 680,
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
          params: {{ expression: "Boolean(window.app && window.app.realBuildings && window.app.water && window.app.water.riverMesh && window.app.ground && window.app.ground.roadMesh)" }}
        }}));
      }}, 400);
    }};

    function applyNextView() {{
      const v = views[viewIdx];
      const expr = `
        window.app.cameraCtrl.target.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.currentTarget.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.zoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.targetZoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.resize(window.innerWidth, window.innerHeight);
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
        applyNextView();
      }}

      if (d.id === 25) {{
        setTimeout(() => {{
          ws.send(JSON.stringify({{
            id: 30,
            method: "Page.captureScreenshot",
            params: {{ format: "png" }}
          }}));
        }}, 2200);
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
          console.log("ALL VIEWS SAVED!");
          process.exit(0);
        }}
      }}
    }};
    '''

    with open('/tmp/capture_multi.mjs', 'w') as f:
        f.write(node_code)

    res = subprocess.run(['node', '/tmp/capture_multi.mjs'], capture_output=True, text=True, timeout=35)
    print("Node output:\n", res.stdout)
    if res.stderr:
        print("Node error:\n", res.stderr)

finally:
    chrome_proc.terminate()
