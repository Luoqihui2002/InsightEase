import uvicorn
import os
from app.core.config import settings

if __name__ == "__main__":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print(f"启动 {settings.PROJECT_NAME} v{settings.VERSION}")
    print(f"API文档: http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)