# __init__.py (Azure Function entry point)

import azure.functions as func
from azure.functions.wsgi import AsgiMiddleware

# Import the FastAPI app instance from your app_main.py
from .app_main import app

# 1. Create the ASGI/WSGI wrapper
asgi_app = AsgiMiddleware(app)

def http_trigger(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    # 2. Pass the request to the wrapped FastAPI application
    return asgi_app(req, context)