from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mosupisi Chat Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Mosupisi Chat Service"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "chat"}

@app.post("/chat")
async def chat():
    # TODO: Implement chat logic
    return {"response": "Chat service is under development"}
