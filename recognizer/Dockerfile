FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# 建置階段就把模型權重下載進映像檔裡，
# 避免每次容器啟動都要重新從 GitHub 下載 275MB（會很慢也不穩定）
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']).prepare(ctx_id=0, det_size=(640, 640))"

ENV HOST=0.0.0.0
ENV PORT=5001

EXPOSE 5001

CMD ["python", "app.py"]
