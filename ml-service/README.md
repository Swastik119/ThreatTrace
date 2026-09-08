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

## Deploy to Railway

The `Dockerfile` in this directory is ready for Railway. Railway supplies the `PORT` environment variable automatically, and the container binds to `0.0.0.0`.

### Dashboard deployment

1. Push the repository to GitHub.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Select the repository, then open the new service's **Settings**.
4. Set the service **Root Directory** to `/ml-service`.
5. Railway will detect the Dockerfile and build the service automatically.
6. In **Settings > Networking**, click **Generate Domain**.
7. Verify the deployment at `https://<your-railway-domain>/health`. Wait for `model_loaded: true`; the first startup downloads the Hugging Face model and may take several minutes.

### Railway CLI deployment

From the repository root:

```powershell
railway login
railway link
railway service
railway up --path-as-root ml-service
railway domain
```

If the CLI version does not support `--path-as-root`, run the command from this directory instead:

```powershell
cd C:\threattrace\ml-service
railway up
```

### Connect the backend

Set the backend service variable to the public ML service URL, without a trailing slash:

```env
ML_SERVICE_URL=https://<your-railway-domain>
ML_SERVICE_TIMEOUT_MS=30000
```

Redeploy the backend after changing the variable. Test the ML service with:

```powershell
curl https://<your-railway-domain>/health
curl -X POST https://<your-railway-domain>/predict `
  -H "Content-Type: application/json" `
  -d '{"subject":"Urgent account verification required","body":"Please verify your account immediately."}'
```

### Notes

- Do not commit `.env` files or Hugging Face cache files.
- The model is downloaded during container startup and is not included in the image.
- Keep one running replica unless you have enough memory for each replica to load its own copy of the model.
- Check **Deployments > Logs** if startup fails; model download and memory errors will be reported there.
