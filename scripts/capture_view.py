import subprocess
import time
import json
import urllib.request
import sys

port = 9235
out_file = sys.argv[1] if len(sys.argv) > 1 else '/tmp/spb_warsaw_day.png'
action = sys.argv[2] if len(sys.argv) > 2 else 'none'

chrome_proc = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={port}',
    '--use-gl=angle',
    '--use-angle=metal',
    '--window-size=1280,720',
    'http://localhost:5173/'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

time.sleep(1.8)

try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
    page_tabs = [t for t in tabs if t.get('type') == 'page']
    target_tab = page_tabs[0] if page_tabs else tabs[0]
    ws_url = target_tab['webSocketDebuggerUrl']
    print(f"Connecting to tab: {target_tab.get('title')} ({target_tab.get('url')})")
    
    node_code = f'''
    import fs from 'fs';
    const ws = new WebSocket("{ws_url}");

    ws.onopen = () => {{
      ws.send(JSON.stringify({{ id: 1, method: "Page.enable" }}));
      ws.send(JSON.stringify({{ id: 2, method: "Runtime.enable" }}));
      ws.send(JSON.stringify({{ id: 3, method: "Page.navigate", params: {{ url: "http://localhost:5173/" }} }}));
    }};

    let appReady = false;

    ws.onmessage = (msg) => {{
      const d = JSON.parse(msg.data);
      if (d.id === 3) {{
        const poll = setInterval(() => {{
          ws.send(JSON.stringify({{
            id: 20,
            method: "Runtime.evaluate",
            params: {{ expression: "Boolean(window.app && window.app.realBuildings && window.app.realBuildings.edgesMesh && window.app.ground && window.app.ground.roadMesh)" }}
          }}));
        }}, 400);
      }}

      if (d.id === 20 && d.result?.result?.value === true && !appReady) {{
        appReady = true;
        console.log("App ready!");
        if ("{action}" === "time_modal") {{
          ws.send(JSON.stringify({{
            id: 25,
            method: "Runtime.evaluate",
            params: {{ expression: "window.app.ui.toggleTimeModal(true)" }}
          }}));
          setTimeout(takeShot, 1500);
        }} else if ("{action}" === "flight") {{
          ws.send(JSON.stringify({{
            id: 25,
            method: "Runtime.evaluate",
            params: {{ expression: "window.app.ui.toggleFlightMode(true)" }}
          }}));
          setTimeout(takeShot, 2000);
        }} else {{
          setTimeout(takeShot, 2500);
        }}
      }}

      if (d.id === 30) {{
        fs.writeFileSync("{out_file}", Buffer.from(d.result.data, "base64"));
        console.log("Saved {out_file}");
        process.exit(0);
      }}
    }};

    function takeShot() {{
      ws.send(JSON.stringify({{
        id: 30,
        method: "Page.captureScreenshot",
        params: {{ format: "png" }}
      }}));
    }}

    setTimeout(() => {{
      console.log("Timeout!");
      process.exit(1);
    }}, 16000);
    '''

    res = subprocess.run(['node', '--input-type=module', '-e', node_code], capture_output=True, text=True)
    print(res.stdout)
    if res.stderr:
        print("ERR:", res.stderr)
finally:
    chrome_proc.terminate()
