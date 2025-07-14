import React, { useEffect, useRef, useState } from "react";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import { Camera } from "@mediapipe/camera_utils";
import Webcam from "react-webcam";

const BACKGROUNDS = [
  null, // For actual background (no virtual background)
  "/backgrounds/img.webp",
  "/backgrounds/img2.jpg",
];

export default function BackgroundReplaceApp() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedBg, setSelectedBg] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [bgImg, setBgImg] = useState(null);

  const takePhoto = () => {
    if (selectedBg === null && webcamRef.current) {
      // No background selected → use webcam directly
      const image = webcamRef.current.getScreenshot();
      setPhotos((prev) => [...prev, image]);
    } else if (canvasRef.current) {
      // Virtual background → use canvas
      const image = canvasRef.current.toDataURL("image/png");
      setPhotos((prev) => [...prev, image]);
    }
  };
  

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

  useEffect(() => {
    if (selectedBg === null) return; // Don't run segmentation if no BG selected

    const selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    selfieSegmentation.setOptions({ modelSelection: 1 });

    selfieSegmentation.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const video = webcamRef.current?.video;
    
      if (!canvas || !ctx || !video || video.readyState !== 4) return;
    
      const width = results.image.width;
      const height = results.image.height;
    
      // Skip drawing if background is selected but not loaded yet
      if (selectedBg && !bgImg?.complete) return;
    
      // Skip drawing if frame is selected but not loaded yet
      if (selectedFrame && !frameOverlayRef.current?.complete) return;
    
      // Create an offscreen buffer
      const buffer = document.createElement("canvas");
      buffer.width = width;
      buffer.height = height;
      const bctx = buffer.getContext("2d");
    
      if (!bctx) return;
    
      // Apply filter
      bctx.filter = selectedFilter;
    
      // Composite person with/without background
      if (selectedBg && bgImg) {
        bctx.drawImage(results.segmentationMask, 0, 0, width, height);
        bctx.globalCompositeOperation = "source-in";
        bctx.drawImage(results.image, 0, 0, width, height);
        bctx.globalCompositeOperation = "destination-over";
        bctx.drawImage(bgImg, 0, 0, width, height);
      } else {
        bctx.drawImage(results.image, 0, 0, width, height);
      }
    
      bctx.globalCompositeOperation = "source-over";
    
      // Apply frame if selected
      if (frameOverlayRef.current) {
        bctx.drawImage(frameOverlayRef.current, 0, 0, width, height);
      }
    
      bctx.filter = "none";
    
      // Copy offscreen buffer to visible canvas
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(buffer, 0, 0, width, height);
    });
    

    const video = webcamRef.current?.video;
    if (video) {
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
    }
  }, [bgImg, selectedBg]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Virtual Background Demo</h2>

      {selectedBg === null ? (
        <Webcam
          ref={webcamRef}
          style={{
            width: 640,
            height: 480,
            borderRadius: "10px",
            backgroundColor: "#000",
          }}
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user",
          }}
        />
      ) : (
        <>
          <Webcam
            ref={webcamRef}
            style={{ display: "none" }}
            videoConstraints={{
              width: 640,
              height: 480,
              facingMode: "user",
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              width: 640,
              height: 480,
              borderRadius: "10px",
              backgroundColor: "#000",
            }}
          />
        </>
      )}

      <div>
        <button
          onClick={takePhoto}
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
        >
          📸 Take Photo
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Select Background</h4>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          {BACKGROUNDS.map((bg, idx) => (
            <div key={idx} onClick={() => setSelectedBg(bg)} style={{ cursor: "pointer" }}>
              {bg === null ? (
                <div
                  style={{
                    width: 100,
                    height: 60,
                    background: "#ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border:
                      selectedBg === null ? "2px solid #00f" : "1px solid #ccc",
                    borderRadius: 4,
                  }}
                >
                  No BG
                </div>
              ) : (
                <img
                  src={bg}
                  alt="bg"
                  style={{
                    width: 100,
                    height: 60,
                    border: selectedBg === bg ? "2px solid #00f" : "1px solid #ccc",
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Taken Photos</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {photos.map((photo, index) => (
            <img
              key={index}
              src={photo}
              alt={`Snapshot ${index + 1}`}
              style={{
                width: "160px",
                height: "120px",
                objectFit: "cover",
                border: "2px solid #ccc",
                borderRadius: "8px",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
