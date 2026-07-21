import requests
import json
import sys
import os

API_URL = "https://modelslab.com/api/v6/images/text2img"

def generate_image(api_key: str, prompt: str):
    payload = {
        "key": api_key,
        "model_id": "realvis-xl-v5",
        "prompt": prompt,
        "negative_prompt": "nsfw, nude, naked, porn, sexual, deformed, bad anatomy, disfigured, poorly drawn face, ugly",
        "width": 1024,
        "height": 1024,
        "samples": 1,
        "num_inference_steps": 31,
        "safety_checker": "no",
        "seed": None,
        "guidance_scale": 7.5,
        "scheduler": "DPMSolverMultistepScheduler",
        "use_karras_sigmas": "yes",
        "algorithm_type": "none",
        "enhance_prompt": "yes",
        "upscale": "no",
        "clip_skip": 2,
        "temp": False,
        "base64": False,
    }

    resp = requests.post(API_URL, json=payload, timeout=120)
    data = resp.json()

    if data.get("status") == "success":
        image_url = data["output"][0]
        print(f"Image URL: {image_url}")

        img_resp = requests.get(image_url, timeout=30)
        ext = image_url.rsplit(".", 1)[-1].split("?")[0] or "png"
        filename = f"output.{ext}"
        with open(filename, "wb") as f:
            f.write(img_resp.content)
        print(f"Saved as: {filename}")
    elif data.get("status") == "processing":
        print("Request is processing. Fetch ID:", data.get("id"))
        print("Response:", json.dumps(data, indent=2))
    else:
        print("Error:", json.dumps(data, indent=2))

if __name__ == "__main__":
    api_key = os.environ.get("MODELSLAB_KEY") or (
        sys.argv[1] if len(sys.argv) > 1 else None
    )
    if not api_key:
        print("Usage: MODELSLAB_KEY=<key> python test_modelslab.py")
        sys.exit(1)

    prompt = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else (
        "ultra realistic close up portrait of a woman with freckles, "
        "soft natural lighting, detailed skin texture, cinematic shot, "
        "Canon EOS R3, 85mm lens, f/1.4, sharp focus, 8K"
    )

    generate_image(api_key, prompt)
