import cv2
import numpy as np
import streamlit as st

from demo_common import OWNER, banner

st.set_page_config(page_title="RainFogHaze - dehazing", page_icon="🌫️", layout="wide")
st.title("RainFogHaze · haze removal")
banner(
    "RainFogHaze-OpenCV-GenAI",
    "userapp/views.py",
    "the dark-channel dehazing functions, copied unchanged,",
)
st.caption(
    "The repository's own app also asks LLaVA (through Ollama) to rate the fog and haze, and uses that answer to pick the "
    "dehazing strength. A language model can't run inside a browser tab, so **you choose the level here instead** — "
    "everything after that step is the repository's code."
)


# ---- from userapp/views.py, unchanged ----
def remove_haze_param(image, strength):
    import numpy as np
    import cv2

    image = image.astype(np.float64) / 255.0

    # Dark channel
    dark = np.min(image, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    dark = cv2.erode(dark, kernel)

    # Atmospheric light
    airlight = np.max(dark)

    # Transmission map
    transmission = 1 - strength * dark / airlight
    transmission = np.clip(transmission, 0.1, 0.9)

    # Recover image
    result = np.zeros_like(image)
    for i in range(3):
        result[:, :, i] = (image[:, :, i] - airlight) / transmission + airlight

    result = np.clip(result * 255, 0, 255)
    return result.astype(np.uint8)


def get_strength(genai_text):
    text = genai_text.lower()

    if "fog: high" in text or "haze: high" in text:
        return 0.95
    elif "fog: medium" in text or "haze: medium" in text:
        return 0.85
    else:
        return 0.75
# ---- end of the repository's code ----

SHARPEN = np.array([[0, -1, 0],
                    [-1, 5, -1],
                    [0, -1, 0]])
MAX_SIDE = 1100  # keeps the in-browser run quick; the repository's app processes the full-size image

source = st.radio("Photo", ["Sample from the repository (foggy road)", "Upload my own"], horizontal=True)
if source.startswith("Upload"):
    up = st.file_uploader("JPG or PNG (it stays in your browser)", type=["jpg", "jpeg", "png"])
    data = up.getvalue() if up else None
else:
    with open("sample_fog_road.jpg", "rb") as f:
        data = f.read()

level = st.select_slider(
    "What the vision model would say about the fog / haze",
    options=["low", "medium", "high"],
    value="high",
    help="In the repository this comes from LLaVA. low → strength 0.75, medium → 0.85, high → 0.95.",
)

if data is None:
    st.info("Choose a photo to begin.")
    st.stop()

img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)  # BGR, like cv2.imread in the repository
if img is None:
    st.error("Image could not be processed")  # the repository's own message
    st.stop()
scale = min(1.0, MAX_SIDE / max(img.shape[:2]))
if scale < 1.0:
    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

with st.spinner("Removing haze…"):
    baseline = cv2.filter2D(remove_haze_param(img, 0.8), -1, SHARPEN)  # the repository's fixed "old model" strength
    strength = get_strength(f"Fog: {level}")
    guided = cv2.filter2D(remove_haze_param(img, strength), -1, SHARPEN)

rgb = lambda a: cv2.cvtColor(a, cv2.COLOR_BGR2RGB)
c1, c2, c3 = st.columns(3)
c1.image(rgb(img), caption="Original", use_container_width=True)
c2.image(rgb(baseline), caption="OpenCV baseline (fixed strength 0.8)", use_container_width=True)
c3.image(rgb(guided), caption=f"Guided by the fog level '{level}' (strength {strength})", use_container_width=True)
st.caption(
    f"Dark-channel prior with a 15×15 window, then a sharpening kernel. Images wider than {MAX_SIDE}px are shrunk first. "
    f"Source: [{OWNER.rsplit('/', 1)[1]}/RainFogHaze-OpenCV-GenAI]({OWNER}/RainFogHaze-OpenCV-GenAI)."
)
