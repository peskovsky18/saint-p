import subprocess
import time
import json
import urllib.request

port = 9232
chrome_proc = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={port}',
    '--use-gl=angle',
    '--use-angle=metal',
    '--window-size=1280,720',
    'about:blank'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

time.sleep(1.5)
try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']
    
    node_code = '''
    const ws = new WebSocket(''' + f'"{ws_url}"' + ''');
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: "Page.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Page.navigate", params: { url: "http://localhost:5173/" } }));
    };
    ws.onmessage = (msg) => {
      const d = JSON.parse(msg.data);
      if (d.id === 2) {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: "Runtime.evaluate",
            params: {
              expression: "JSON.stringify({ camPos: window.app.cameraCtrl.camera.position, camTarget: window.app.cameraCtrl.currentTarget, zoomLevel: window.app.cameraCtrl.zoomLevel, bg: window.app.scene.background, effectiveDate: window.app.sun.getEffectiveDate().toString(), sunState: window.app.sun.update() })"
            }
          }));
        }, 4000);
      }
      if (d.id === 20) {
        console.log('APP_DEBUG:', d.result.result.value);
        process.exit(0);
      }
    };
    '''
    res = subprocess.run(['node', '--input-type=module', '-e', node_code], capture_output=True, text=True)
    print(res.stdout)
    if res.stderr:
        print('ERR:', res.stderr)
finally:
    chrome_proc.terminate()
