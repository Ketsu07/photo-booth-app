import React, { useEffect, useRef, useState } from "react";
import * as selfieSegmentationModule from "@mediapipe/selfie_segmentation";
import { Camera } from "@mediapipe/camera_utils";
import Webcam from "react-webcam";

const BACKGROUNDS = [
  null,
  "/backgrounds/img.webp",
  "/backgrounds/img2.jpg",
];

// New: Frame overlay options
const FRAME_OVERLAYS = [
  null,
  "/frames/img.webp",
];

export default function BackgroundReplaceApp() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedBg, setSelectedBg] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [bgImg, setBgImg] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [frameOverlay, setFrameOverlay] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [timerDelay, setTimerDelay] = useState(0);
  const selfieSegmentationRef = useRef(null);
  const audioRef = useRef(null);

  const startCountdownAndTakePhoto = () => {
    if (timerDelay === 0) return takePhoto();
    let timer = timerDelay;
    setCountdown(timer);
    const interval = setInterval(() => {
      timer -= 1;
      setCountdown(timer);
      if (audioRef.current) audioRef.current.play();
      if (timer === 0) {
        clearInterval(interval);
        setTimeout(() => {
          setCountdown(0);
          takePhoto();
        }, 200);
      }
    }, 500);
  };

  const takePhoto = () => {
    if (canvasRef.current) {
      const image = canvasRef.current.toDataURL("image/png");
      setPhotos((prev) => [...prev, image]);
    }
  };

  // Load selected background image
  useEffect(() => {
    if (!selectedBg) {
      setBgImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = selectedBg;
    img.onload = () => setBgImg(img);
  }, [selectedBg]);

  // Load selected frame overlay image
  useEffect(() => {
    if (!selectedFrame) {
      setFrameOverlay(null);
      return;
    }
    const img = new Image();
    img.src = selectedFrame;
    img.onload = () => setFrameOverlay(img);
  }, [selectedFrame]);

  // Initialize MediaPipe and camera
  useEffect(() => {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !ctx) return;

    const selfieSegmentation = new selfieSegmentationModule.SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    selfieSegmentation.setOptions({ modelSelection: 1 });

    selfieSegmentation.onResults((results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
    
      const width = results.image.width;
      const height = results.image.height;
    
      // Only draw when everything is ready
      if (selectedBg && !bgImg) return;
      if (selectedFrame && !frameOverlay) return;
    
      // Optional: only update if video is playing
      if (webcamRef.current?.video?.readyState !== 4) return;
    
      // Offscreen buffer to avoid flickering
      const bufferCanvas = document.createElement("canvas");
      bufferCanvas.width = width;
      bufferCanvas.height = height;
      const bufferCtx = bufferCanvas.getContext("2d");
    
      if (!bufferCtx) return;
    
      // Draw segmentation-based result
      bufferCtx.clearRect(0, 0, width, height);
      bufferCtx.filter = selectedFilter;
    
      if (selectedBg && bgImg) {
        bufferCtx.drawImage(results.segmentationMask, 0, 0, width, height);
        bufferCtx.globalCompositeOperation = "source-in";
        bufferCtx.drawImage(results.image, 0, 0, width, height);
        bufferCtx.globalCompositeOperation = "destination-over";
        bufferCtx.drawImage(bgImg, 0, 0, width, height);
      } else {
        bufferCtx.drawImage(results.image, 0, 0, width, height);
      }
    
      bufferCtx.globalCompositeOperation = "source-over";
    
      if (frameOverlay) {
        bufferCtx.drawImage(frameOverlay, 0, 0, width, height);
      }
    
      bufferCtx.filter = "none";
    
      // Final composite to visible canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(bufferCanvas, 0, 0);
    });
    

    selfieSegmentationRef.current = selfieSegmentation;

    const camera = new Camera(video, {
      onFrame: async () => {
        if (video.readyState === 4) {
          await selfieSegmentation.send({ image: video });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
    return () => camera.stop();
  }, [bgImg, selectedBg, selectedFilter, frameOverlay]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Virtual Background Demo</h2>

      <Webcam
        ref={webcamRef}
        screenshotFormat="image/png"
        style={{ display: "none" }}
        videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
      />

      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          style={{ width: 640, height: 480, borderRadius: "10px", backgroundColor: "#000" }}
        />
        {countdown > 0 && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, width: 640, height: 480,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "72px", fontWeight: "bold", color: "white",
            backgroundColor: "rgba(0,0,0,0.5)", borderRadius: "10px",
          }}>
            {countdown}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={startCountdownAndTakePhoto}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
          disabled={countdown > 0}
        >
          📸 Take Photo
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Select Timer</h4>
        <select
          value={timerDelay}
          onChange={(e) => setTimerDelay(parseInt(e.target.value))}
          style={{ padding: "8px", fontSize: "14px", borderRadius: "4px" }}
        >
          <option value={0}>No Timer</option>
          <option value={3}>3 Seconds</option>
          <option value={5}>5 Seconds</option>
          <option value={10}>10 Seconds</option>
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Select Background</h4>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          {BACKGROUNDS.map((bg, idx) => (
            <div key={idx} onClick={() => setSelectedBg(bg)} style={{ cursor: "pointer" }}>
              {bg === null ? (
                <div
                  style={{
                    width: 100, height: 60,
                    background: "#ccc", display: "flex", alignItems: "center", justifyContent: "center",
                    border: selectedBg === null ? "2px solid #00f" : "1px solid #ccc", borderRadius: 4,
                  }}
                >No BG</div>
              ) : (
                <img
                  src={bg}
                  alt="bg"
                  style={{
                    width: 100, height: 60,
                    border: selectedBg === bg ? "2px solid #00f" : "1px solid #ccc",
                    objectFit: "cover", borderRadius: 4,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Select Frame</h4>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          {FRAME_OVERLAYS.map((frame, idx) => (
            <div key={idx} onClick={() => setSelectedFrame(frame)} style={{ cursor: "pointer" }}>
              {frame === null ? (
                <div
                  style={{
                    width: 100, height: 60,
                    background: "#eee", display: "flex", alignItems: "center", justifyContent: "center",
                    border: selectedFrame === null ? "2px solid #00f" : "1px solid #ccc", borderRadius: 4,
                  }}
                >No Frame</div>
              ) : (
                <img
                  src={frame}
                  alt="frame"
                  style={{
                    width: 100, height: 60,
                    border: selectedFrame === frame ? "2px solid #00f" : "1px solid #ccc",
                    objectFit: "cover", borderRadius: 4,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Select Filter</h4>
        <select
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value)}
          style={{ padding: "8px", fontSize: "14px", borderRadius: "4px" }}
        >
          <option value="none">None</option>
          <option value="grayscale(100%)">Grayscale</option>
          <option value="sepia(100%)">Sepia</option>
          <option value="blur(4px)">Blur</option>
          <option value="brightness(1.3)">Brighten</option>
          <option value="contrast(1.5)">High Contrast</option>
        </select>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Taken Photos</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
          {photos.map((photo, index) => (
            <img
              key={index}
              src={photo}
              alt={`Snapshot ${index + 1}`}
              style={{
                width: "160px",
                height: "120px",
                objectFit: "cover",
                border: "4px solid #eee",
                borderRadius: "12px",
                boxShadow: "0 0 10px rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
