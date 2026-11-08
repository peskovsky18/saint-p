import subprocess
import time
import json
import urllib.request

port = 9340
chrome_proc = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={port}',
    '--use-gl=angle',
    '--use-angle=metal',
    '--window-size=1280,720',
    'about:blank'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

time.sleep(1.8)

try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']
    
    node_code = f'''
    import fs from 'fs';
    const ws = new WebSocket("{ws_url}");

    ws.onopen = () => {{
      ws.send(JSON.stringify({{ id: 1, method: "Page.enable" }}));
      ws.send(JSON.stringify({{ id: 2, method: "Runtime.enable" }}));
      ws.send(JSON.stringify({{ id: 3, method: "Console.enable" }}));
      ws.send(JSON.stringify({{
        id: 4,
        method: "Emulation.setDeviceMetricsOverride",
        params: {{ width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }}
      }}));
      ws.send(JSON.stringify({{ id: 5, method: "Page.navigate", params: {{ url: "http://localhost:5173/" }} }}));
    }};

    ws.onmessage = (msg) => {{
      const d = JSON.parse(msg.data);
      if (d.method === "Runtime.consoleAPICalled") {{
        console.log("CONSOLE [" + d.params.type + "]:", d.params.args.map(a => a.value || a.description).join(" "));
      }}
      if (d.method === "Runtime.exceptionThrown") {{
        console.error("EXCEPTION:", d.params.exceptionDetails);
      }}
      if (d.id === 5) {{
        setTimeout(() => {{
          ws.send(JSON.stringify({{
            id: 20,
            method: "Runtime.evaluate",
            params: {{ expression: "window.dispatchEvent(new Event('resize')); JSON.stringify({{ innerW: window.innerWidth, innerH: window.innerHeight, canvasW: document.querySelector('canvas')?.width, canvasH: document.querySelector('canvas')?.height }})" }}
          }}));
        }}, 3500);
      }}
      if (d.id === 20) {{
        console.log("EVAL:", d.result.result.value);
        ws.send(JSON.stringify({{
          id: 30,
          method: "Page.captureScreenshot",
          params: {{ format: "png" }}
        }}));
      }}
      if (d.id === 30) {{
        fs.writeFileSync("/tmp/direct_shot.png", Buffer.from(d.result.data, "base64"));
        console.log("Saved /tmp/direct_shot.png");
        process.exit(0);
      }}
    }};

    setTimeout(() => {{
      console.log("TIMEOUT");
      process.exit(1);
    }}, 10000);
    '''

    res = subprocess.run(['node', '--input-type=module', '-e', node_code], capture_output=True, text=True)
    print(res.stdout)
    if res.stderr:
        print("ERR:", res.stderr)
finally:
    chrome_proc.terminate()
