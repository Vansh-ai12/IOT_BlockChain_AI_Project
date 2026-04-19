from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from tensorflow.keras.models import load_model
import numpy as np
import os
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model from parent directory
model_path = os.path.join(os.path.dirname(__file__), "..", "cnn_stacked_lstm_model.h5")
print(f"Loading model from: {model_path}")
model = load_model(model_path)

class PredictRequest(BaseModel):
    # Expects 50 rows of 24 features each
    data: List[List[float]]

@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        data = np.array(req.data, dtype=np.float32)
        
        # Ensure it has exactly 24 features
        if data.shape[1] > 24:
            data = data[:, :24]
            
        # Reshape to (1, 50, 24)
        data = data.reshape(1, 50, 24)

        pred = model.predict(data)
        score = float(pred[0][0])
        status = "Damaged" if score > 0.5 else "Undamaged"
        print(f"AI Prediction: {status} | Score: {score}")

        return {"prediction": status, "score": score}
    except Exception as e:
        print(f"Prediction Error: {str(e)}")
        return {"error": str(e), "prediction": "Undamaged"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
