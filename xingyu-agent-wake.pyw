import os, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent
def wake():
    for port in range(8630, 8650):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/wake-agent" % port, timeout=.18) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
    return False
if not wake():
    try:
        os.startfile(str(ROOT / "xingyu-native-launcher.pyw"))
    except Exception:
        pass
    for _ in range(80):
        time.sleep(.25)
        if wake():
            break
