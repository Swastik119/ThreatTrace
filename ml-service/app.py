from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import pipeline

MODEL_NAME = "ElSlay/BERT-Phishing-Email-Model"
DOCUMENTED_LABELS = {"LABEL_0": "legitimate", "LABEL_1": "phishing"}
classifier: Any = None
phishing_label: str | None = None


class PredictionInput(BaseModel):
    subject: str = Field(default="", max_length=10000)
    body: str = Field(default="", max_length=200000)


class PredictionOutput(BaseModel):
    prediction: Literal["phishing", "legitimate"]
    confidence: float
    model: str


def _find_phishing_label(id2label: dict[int, str]) -> str:
    candidates = [
        label for label in id2label.values()
        if any(term in label.lower() for term in ("phish", "malicious", "fraud"))
    ]
    if len(candidates) == 1:
        return candidates[0]

    documented_labels = {label: DOCUMENTED_LABELS.get(label) for label in id2label.values()}
    if set(documented_labels.values()) == {"legitimate", "phishing"}:
        return next(label for label, meaning in documented_labels.items() if meaning == "phishing")

    raise RuntimeError(f"Could not identify one phishing label from model id2label: {id2label}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global classifier, phishing_label
    classifier = pipeline("text-classification", model=MODEL_NAME)
    raw_labels = classifier.model.config.id2label
    phishing_label = _find_phishing_label(raw_labels)
    yield


app = FastAPI(title="ThreatTrace ML Inference", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", "model_loaded": classifier is not None}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput) -> PredictionOutput:
    if classifier is None or phishing_label is None:
        raise HTTPException(status_code=503, detail="Phishing model is not loaded")

    text = f"Subject: {payload.subject}\n\n{payload.body}".strip()
    result = classifier(text, top_k=None)
    scores = result[0] if result and isinstance(result[0], list) else result
    phishing_result = next((item for item in scores if item["label"] == phishing_label), None)
    if phishing_result is None:
        raise HTTPException(status_code=500, detail="Model output did not contain the configured phishing label")

    prediction = "phishing" if phishing_result["score"] >= 0.5 else "legitimate"
    confidence = phishing_result["score"] if prediction == "phishing" else 1 - phishing_result["score"]
    return PredictionOutput(prediction=prediction, confidence=round(float(confidence), 4), model=MODEL_NAME)
