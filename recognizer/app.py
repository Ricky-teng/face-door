import base64
import os

import cv2
import numpy as np
from flask import Flask, jsonify, request
from insightface.app import FaceAnalysis

app = Flask(__name__)

print("=== 載入 InsightFace 模型（只在啟動時發生一次）===")
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("=== 模型載入完成，服務就緒 ===")


def decode_image(image_b64):
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_b64)
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(image_array, cv2.IMREAD_COLOR)


@app.route("/embed", methods=["POST"])
def embed():
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image")

    if not image_b64:
        return jsonify({"error": "缺少 image"}), 400

    image = decode_image(image_b64)

    if image is None:
        return jsonify({"error": "無法解碼圖片"}), 400

    faces = face_app.get(image)

    if len(faces) == 0:
        return jsonify({"faces": 0})

    if len(faces) > 1:
        return jsonify({"faces": len(faces)})

    face = faces[0]
    height, width = image.shape[:2]

    return jsonify({
        "faces": 1,
        "embedding": face.embedding.tolist(),
        "detScore": float(face.det_score),
        "bbox": face.bbox.tolist(),
        "imageWidth": width,
        "imageHeight": height,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # 本機／區網部署維持只聽 127.0.0.1（安全預設，Express 才碰得到）
    # 部署到 Railway 這種每個服務各自一個容器的環境時，
    # 才需要把 HOST 設成 0.0.0.0，讓 Express 的容器能透過內部網路連進來
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 5001))
    app.run(host=host, port=port)
