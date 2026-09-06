# ThreatTrace ML Service

FastAPI service for the pretrained `ElSlay/BERT-Phishing-Email-Model` Hugging Face classifier. The model is loaded once during application startup and is not trained or fine-tuned by ThreatTrace.

## Windows setup

```powershell
cd C:\threattrace\ml-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

The first startup downloads the model from Hugging Face. Later starts use the local Hugging Face cache.

## Start

```powershell
uvicorn app:app --host 127.0.0.1 --port 8000
```

Health check:

```powershell
curl http://127.0.0.1:8000/health
```

Prediction:

```powershell
curl -X POST http://127.0.0.1:8000/predict `
  -H "Content-Type: application/json" `
  -d '{"subject":"Urgent account verification required","body":"Please verify your account immediately using the link below."}'
```

Example response:

```json
{
  "prediction": "phishing",
  "confidence": 0.94,
  "model": "ElSlay/BERT-Phishing-Email-Model"
}
```

The service reads the model `id2label` configuration at startup. This model exposes generic `LABEL_0` and `LABEL_1` names, so the service validates the exact pair and applies the model card's documented semantics: `LABEL_0` is legitimate and `LABEL_1` is phishing. Unexpected label configurations fail startup instead of being guessed.

## Backend configuration

Set these variables in `backend/.env`:

```env
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_TIMEOUT_MS=10000
```

The backend sends only the email subject and text body to this service. BERT is retained as one content signal and contributes at most 20 points to the existing evidence-based risk score. VirusTotal, URLScan, AbuseIPDB, and SPF/DKIM/DMARC analysis remain separate signals.
