import subprocess
import time
import json
import urllib.request
import os

port = 9449
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
        'name': 'flight_mode_chase_view.png',
        'action': '''
          window.app.ui.toggleFlightMode(true);
          window.app.flight.position.set(0, 75, -140);
          window.app.flight.yaw = -Math.PI * 0.72;
          window.app.flight.pitch = 0.05;
          window.app.cameraCtrl.flightCameraMode = "chase";
          window.app.cameraCtrl.flightZoomLevel = 45;
          window.app.cameraCtrl.targetFlightZoomLevel = 45;
        '''
    },
    {
        'name': 'flight_mode_zoom_close.png',
        'action': '''
          window.app.flight.position.set(20, 80, -100);
          window.app.flight.yaw = -Math.PI * 0.65;
          window.app.flight.roll = 0.25;
          window.app.cameraCtrl.flightCameraMode = "chase";
          window.app.cameraCtrl.flightZoomLevel = 28;
          window.app.cameraCtrl.targetFlightZoomLevel = 28;
        '''
    },
    {
        'name': 'flight_mode_wide_panorama.png',
        'action': '''
          window.app.flight.position.set(-150, 110, -50);
          window.app.flight.yaw = -Math.PI * 0.8;
          window.app.cameraCtrl.flightCameraMode = "wide";
          window.app.cameraCtrl.flightZoomLevel = 95;
          window.app.cameraCtrl.targetFlightZoomLevel = 95;
        '''
    },
    {
        'name': 'flight_mode_cockpit_view.png',
        'action': '''
          window.app.flight.position.set(10, 65, -80);
          window.app.flight.yaw = -Math.PI * 0.75;
          window.app.cameraCtrl.flightCameraMode = "cockpit";
          window.app.cameraCtrl.flightZoomLevel = 26;
          window.app.cameraCtrl.targetFlightZoomLevel = 26;
        '''
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
          params: {{ expression: "Boolean(window.app && window.app.flight && window.app.cameraCtrl)" }}
        }}));
      }}, 500);
    }};

    function applyNextView() {{
      const v = views[viewIdx];
      ws.send(JSON.stringify({{
        id: 200 + viewIdx,
        method: "Runtime.evaluate",
        params: {{ expression: v.action }}
      }}));

      setTimeout(() => {{
        ws.send(JSON.stringify({{
          id: 300 + viewIdx,
          method: "Page.captureScreenshot",
          params: {{ format: "png" }}
        }}));
      }}, 1500);
    }}

    ws.onmessage = (msg) => {{
      const data = JSON.parse(msg.data);
      if (data.id === 10 && data.result && data.result.result && data.result.result.value === true) {{
        polling = false;
        console.log("App ready! Switching to Flight Mode and capturing views...");
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
          console.log("All flight mode views captured successfully!");
          ws.close();
          process.exit(0);
        }}
      }}
    }};
    '''

    with open('/tmp/test_flight_runner.mjs', 'w') as f:
        f.write(node_code)

    res = subprocess.run(['node', '/tmp/test_flight_runner.mjs'], capture_output=True, text=True, timeout=40)
    print("Node output:")
    print(res.stdout)
    if res.stderr:
        print("Node error:", res.stderr)

finally:
    chrome_proc.terminate()
