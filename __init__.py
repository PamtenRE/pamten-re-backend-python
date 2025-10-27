# This file exists so Python treats this folder as a package.
# During pytest, we do NOT want to import Azure Functions or run cloud startup code.

import os

if "PYTEST_CURRENT_TEST" not in os.environ:
    # --- Production / Azure Functions path ---
    try:
        import azure.functions as func  # Azure Functions binding
    except ModuleNotFoundError:
        # If we're running locally without azure-functions installed,
        # just skip it instead of crashing.
        func = None
else:
    # --- Test path ---
    func = None
