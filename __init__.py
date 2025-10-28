import os

if "PYTEST_CURRENT_TEST" not in os.environ:
    try:
        import azure.functions as func
    except ModuleNotFoundError:
        func = None
else:
    func = None
