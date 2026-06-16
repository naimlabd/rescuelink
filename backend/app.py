from pathlib import Path
import sys

local_dependencies = Path(__file__).resolve().parent / ".deps"
if local_dependencies.exists():
    sys.path.insert(0, str(local_dependencies))

from rescuelink_backend.api import run_server


if __name__ == "__main__":
    run_server()
