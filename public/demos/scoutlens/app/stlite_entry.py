import os
# hosted showcase: demo investigation only, nothing stored (see ui/home.py)
os.environ["PUBLIC_DEMO"] = "1"
os.environ["LLM_PROVIDER"] = "none"
os.environ["SERPAPI_KEY"] = ""
import runpy
runpy.run_path("app.py", run_name="__main__")
