import io
import os
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO
AI_MODEL_PATH = os.environ.get("AI_MODEL_PATH", "best.pt")
MODEL_CONFIDENCE_THRESHOLD = float(os.environ.get("AI_MODEL_CONFIDENCE", "0.25"))

CATEGORY_MAPPING = {
    "pothole": "POTHOLE",
    "road damage": "POTHOLE",
    "water leak": "WATER_LEAK",
    "leak": "WATER_LEAK",
    "broken street light": "BROKEN_STREETLIGHT",
    "streetlight": "BROKEN_STREETLIGHT",
    "graffiti": "GRAFFITI",
    "illegal dumping": "ILLEGAL_DUMPING",
    "dumping": "ILLEGAL_DUMPING",
    "flood": "FLOODING",
    "damaged sign": "DAMAGED_SIGN",
    "sign": "DAMAGED_SIGN",
}

app = FastAPI(
    title="SafeCity YOLO AI Service",
    description="FastAPI service for image analysis using a YOLO model.",
    version="0.1.0"
)


class AnalyzeResponse(BaseModel):
    category: str
    confidence: float
    simulated: bool
    message: str


@app.on_event("startup")
def load_model():
    app.state.model = YOLO(AI_MODEL_PATH)
    print(f"[AI SERVICE] Loaded YOLO model from: {AI_MODEL_PATH}")


def map_label_to_category(label: str) -> str:
    normalized = label.strip().lower()
    for key, category in CATEGORY_MAPPING.items():
        if key == normalized or key in normalized:
            return category
    return "DAMAGED_SIGN"


@app.get("/health")
def health():
    return {"status": "ok", "model_path": AI_MODEL_PATH}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(image: UploadFile = File(...)):
    if image.content_type.split("/")[0] != "image":
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    contents = await image.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to decode image: {exc}")

    model: YOLO = app.state.model
    results = model(img, imgsz=640, conf=MODEL_CONFIDENCE_THRESHOLD)

    if len(results) == 0 or len(results[0].boxes) == 0:
        return AnalyzeResponse(
            category="DAMAGED_SIGN",
            confidence=0.0,
            simulated=False,
            message="No objects detected by YOLO model."
        )

    top_box = results[0].boxes[0]
    raw_label = results[0].names[int(top_box.cls.item())]
    confidence = float(top_box.conf.item())
    category = map_label_to_category(raw_label)

    return AnalyzeResponse(
        category=category,
        confidence=round(confidence, 2),
        simulated=False,
        message=f"YOLO detected '{raw_label}' with confidence {confidence:.2f}."
    )
