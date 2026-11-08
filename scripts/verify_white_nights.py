import subprocess
import time
import json
import urllib.request
import os

port = 9448
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

out_dir = '/Users/saskapeskovsky/.gemini/antigravity/brain/66f0bef1-6f0e-48a2-8470-2a8d33c50fac'

views = [
    {
        'name': 'whitenights_palace_bridge_and_neva.png',
        'target': {'x': -280, 'z': -180},
        'zoom': 155,
        'action': 'window.app.sun.forceWhiteNight = true; window.app.sun.setTime(23.75); window.app.bridges.setDraw(true); window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'whitenights_nevsky_lanterns_and_windows.png',
        'target': {'x': 490, 'z': 440},
        'zoom': 115,
        'action': 'window.app.sun.forceWhiteNight = true; window.app.sun.setTime(23.75); window.app.ui.toggleQuickJump(false);'
    },
    {
        'name': 'whitenights_admiralty_and_isaac_spires.png',
        'target': {'x': -380, 'z': 420},
        'zoom': 165,
        'action': 'window.app.sun.forceWhiteNight = true; window.app.sun.setTime(23.75); window.app.ui.toggleQuickJump(false);'
    }
]

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
          params: {{ expression: "Boolean(window.app && window.app.bridges && window.app.transit)" }}
        }}));
      }}, 500);
    }};

    function applyNextView() {{
      const v = views[viewIdx];
      const expr = `
        ${{v.action || ""}}
        window.app.cameraCtrl.target.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.currentTarget.set(${{v.target.x}}, 0, ${{v.target.z}});
        window.app.cameraCtrl.zoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.targetZoomLevel = ${{v.zoom}};
        window.app.cameraCtrl.resize(1440, 900);
      `;
      ws.send(JSON.stringify({{
        id: 200 + viewIdx,
        method: "Runtime.evaluate",
        params: {{ expression: expr }}
      }}));

      setTimeout(() => {{
        ws.send(JSON.stringify({{
          id: 300 + viewIdx,
          method: "Page.captureScreenshot",
          params: {{ format: "png" }}
        }}));
      }}, 2000);
    }}

    ws.onmessage = (msg) => {{
      const data = JSON.parse(msg.data);
      if (data.id === 10 && data.result && data.result.result && data.result.result.value === true) {{
        polling = false;
        console.log("App ready! Switching to White Nights illumination and capturing views...");
        setTimeout(applyNextView, 1000);
      }}

      if (data.id >= 300 && data.id < 400) {{
        const v = views[viewIdx];
        const outPath = "{out_dir}/" + v.name;
        fs.writeFileSync(outPath, Buffer.from(data.result.data, "base64"));
        console.log("Saved: " + v.name);
        viewIdx++;
        if (viewIdx < views.length) {{
          setTimeout(applyNextView, 800);
        }} else {{
          console.log("All White Nights views captured successfully!");
          ws.close();
          process.exit(0);
        }}
      }}
    }};
    '''

    with open('/tmp/test_whitenights_runner.mjs', 'w') as f:
        f.write(node_code)

    res = subprocess.run(['node', '/tmp/test_whitenights_runner.mjs'], capture_output=True, text=True, timeout=40)
    print("Node output:")
    print(res.stdout)
    if res.stderr:
        print("Node error:", res.stderr)

finally:
    chrome_proc.terminate()
