from main import app as fastapi_app

# Vercel will look for a top-level "app" object when using ASGI-compatible
# frameworks like FastAPI. We simply re-export the FastAPI app defined in
# main.py so that all routes and middleware are preserved.
app = fastapi_app
