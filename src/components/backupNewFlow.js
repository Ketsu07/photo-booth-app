import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
// Import MediaPipe Selfie Segmentation module
import * as selfieSegmentationModule from "@mediapipe/selfie_segmentation";

// Define static assets (backgrounds, frames, stickers)
// In a real application, you might load these dynamically or from a CDN.
const BACKGROUNDS = [
  null, // Option for no background
  "/backgrounds/img.webp",
  "/backgrounds/img2.jpg",
];

const FRAME_OVERLAYS = [
  null, // Option for no frame
  { src: "/frames/img.webp" }, // Frame is static, so no x, y, scale needed here
];

const STICKERS = [
  "/stickers/image.png", // Placeholder paths for your stickers
  "/stickers/image.jpeg",
];

export default function PhotoEditorApp() {
  // Refs for webcam and canvas elements
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // State variables for application logic
  const [capturedImage, setCapturedImage] = useState(null); // Stores the captured photo as an Image object
  const [segmentationMask, setSegmentationMask] = useState(null); // Stores the MediaPipe segmentation mask
  const [bgImg, setBgImg] = useState(null); // Stores the loaded background image
  const [frameOverlay, setFrameOverlay] = useState(null); // Stores the loaded frame image
  const [stickers, setStickers] = useState([]); // Array of active stickers on the canvas
  const [selectedBg, setSelectedBg] = useState(null); // Currently selected background URL
  const [selectedFrame, setSelectedFrame] = useState(null); // Currently selected frame object
  const [selectedFilter, setSelectedFilter] = useState("none"); // Currently selected CSS filter

  // States for sticker interaction
  const [activeStickerIndex, setActiveStickerIndex] = useState(null); // Index of the sticker being interacted with
  const [dragMode, setDragMode] = useState(null); // 'move', 'resize', or null
  const [dragStart, setDragStart] = useState(null); // { x, y } for drag/resize start coordinates
  const [canvasCursor, setCanvasCursor] = useState('default'); // Cursor style for the canvas

  // States for saving and download
  const [isSaving, setIsSaving] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [canvasDims, setCanvasDims] = useState({ width: 640, height: 480 }); // Dimensions of the canvas

  // New state for storing saved photos in the gallery
  const [savedPhotos, setSavedPhotos] = useState([]);

  // Constants for sticker interaction
  const STICKER_HANDLE_SIZE = 15; // Size of the interactive resize handle area in pixels

  // Function to capture a photo from the webcam
  const takePhoto = async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      console.error("Failed to capture screenshot from webcam.");
      return;
    }

    const img = new Image();
    img.src = imageSrc;
    img.onload = async () => {
      setCapturedImage(img);
      setCanvasDims({ width: img.width, height: img.height }); // Ensure canvas dims are set on photo capture
      await generateSegmentation(img);
    };
    img.onerror = () => {
      console.error("Failed to load captured image.");
    };
  };

  // Function to generate selfie segmentation mask using MediaPipe
  const generateSegmentation = async (image) => {
    const selfieSegmentation = new selfieSegmentationModule.SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    selfieSegmentation.setOptions({ modelSelection: 1 });

    selfieSegmentation.onResults((results) => {
      setSegmentationMask(results.segmentationMask);
    });

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(image, 0, 0, image.width, image.height);

    try {
      await selfieSegmentation.send({ image: tempCanvas });
    } catch (error) {
      console.error("Error sending image to MediaPipe:", error);
    }
  };

  // Helper function to get mouse coordinates relative to the canvas's drawing dimensions
  const getCanvasCoordsFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates considering the canvas's displayed size vs. its actual drawing size
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  // Helper function to check if mouse is over a sticker's resize handle
  const isOverResizeHandle = (sticker, mouseX, mouseY) => {
    const stickerWidth = sticker.img.width * sticker.scale;
    const stickerHeight = sticker.img.height * sticker.scale;
    return (
      mouseX > sticker.x + stickerWidth - STICKER_HANDLE_SIZE &&
      mouseX < sticker.x + stickerWidth &&
      mouseY > sticker.y + stickerHeight - STICKER_HANDLE_SIZE &&
      mouseY < sticker.y + stickerHeight
    );
  };

  // Helper function to check if mouse is over a sticker's main body
  const isOverSticker = (sticker, mouseX, mouseY) => {
    const stickerWidth = sticker.img.width * sticker.scale;
    const stickerHeight = sticker.img.height * sticker.scale;
    return (
      mouseX > sticker.x &&
      mouseX < sticker.x + stickerWidth &&
      mouseY > sticker.y &&
      mouseY < sticker.y + stickerHeight
    );
  };

  // Event handler for mouse down on the canvas (initiates drag/resize)
  const onMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getCanvasCoordsFromEvent(e);
    let foundSticker = false;

    // Iterate stickers in reverse order to check top-most first
    for (let i = stickers.length - 1; i >= 0; i--) {
      const sticker = stickers[i];
      if (isOverResizeHandle(sticker, mouseX, mouseY)) {
        setActiveStickerIndex(i);
        setDragMode('resize');
        // Store initial scale for resize calculation
        setDragStart({ x: mouseX, y: mouseY, initialScale: sticker.scale, initialWidth: sticker.img.width });
        foundSticker = true;
        break;
      } else if (isOverSticker(sticker, mouseX, mouseY)) {
        setActiveStickerIndex(i);
        setDragMode('move');
        // Store initial position for move calculation
        setDragStart({ x: mouseX, y: mouseY, initialX: sticker.x, initialY: sticker.y });
        foundSticker = true;
        break;
      }
    }

    if (!foundSticker) {
      setActiveStickerIndex(null); // Clicked outside any sticker
      setDragMode(null);
      setDragStart(null);
    }
  };

  // Event handler for mouse move on the canvas (updates drag/resize)
  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: mouseX, y: mouseY } = getCanvasCoordsFromEvent(e);

    // Update cursor based on hover state
    let newCursor = 'default';
    let foundHover = false;
    for (let i = stickers.length - 1; i >= 0; i--) {
      const sticker = stickers[i];
      if (isOverResizeHandle(sticker, mouseX, mouseY)) {
        newCursor = 'nwse-resize';
        foundHover = true;
        break;
      } else if (isOverSticker(sticker, mouseX, mouseY)) {
        newCursor = 'grab';
        foundHover = true;
        break;
      }
    }
    // If currently dragging, show the grabbing cursor
    if (dragMode === 'move' && activeStickerIndex !== null) newCursor = 'grabbing';
    setCanvasCursor(newCursor);

    // Only proceed with drag/resize if an active sticker and drag mode are set
    if (activeStickerIndex === null || !dragMode || !dragStart) return;

    const dx = mouseX - dragStart.x;
    const dy = mouseY - dragStart.y; // dy is not used for resize in this specific implementation, but useful for general logic

    setStickers((prevStickers) => {
      const updatedStickers = [...prevStickers];
      const stickerToUpdate = { ...updatedStickers[activeStickerIndex] }; // Create a copy to avoid direct mutation

      if (dragMode === 'move') {
        stickerToUpdate.x = dragStart.initialX + dx;
        stickerToUpdate.y = dragStart.initialY + dy;
      } else if (dragMode === 'resize') {
        // Calculate new scale based on horizontal drag from the initial width
        const newWidth = dragStart.initialWidth * dragStart.initialScale + dx;
        const newScale = Math.max(0.05, newWidth / stickerToUpdate.img.width); // Ensure minimum scale
        stickerToUpdate.scale = newScale;
      }
      updatedStickers[activeStickerIndex] = stickerToUpdate;
      return updatedStickers;
    });
    // dragStart is not updated in onMouseMove because dx/dy are calculated from the original dragStart point.
  };

  // Event handler for mouse up on the canvas (ends drag/resize)
  const onMouseUp = () => {
    setDragMode(null);
    setDragStart(null);
    setCanvasCursor('default'); // Reset cursor
  };

  // Event handler for mouse wheel (for scaling the active sticker)
  const handleWheel = (e) => {
    if (activeStickerIndex === null) return; // Only scale if a sticker is active
    e.preventDefault(); // Prevent page scrolling

    const delta = e.deltaY > 0 ? -0.05 : 0.05; // Zoom out for positive deltaY, zoom in for negative

    setStickers((prevStickers) => {
      const updatedStickers = [...prevStickers];
      const stickerToUpdate = { ...updatedStickers[activeStickerIndex] };
      
      const newScale = Math.max(0.05, stickerToUpdate.scale + delta); // Ensure minimum scale
      
      // Optional: Adjust position to keep sticker roughly centered while scaling
      const oldWidth = stickerToUpdate.img.width * stickerToUpdate.scale;
      const oldHeight = stickerToUpdate.img.height * stickerToUpdate.scale;
      const newWidth = stickerToUpdate.img.width * newScale;
      const newHeight = stickerToUpdate.img.height * newScale;
      stickerToUpdate.x -= (newWidth - oldWidth) / 2;
      stickerToUpdate.y -= (newHeight - oldHeight) / 2;

      stickerToUpdate.scale = newScale;
      updatedStickers[activeStickerIndex] = stickerToUpdate;
      return updatedStickers;
    });
  };

  // Function to add a new sticker to the canvas
  const addSticker = (src) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      // Use canvasDims for initial positioning and scaling
      const width = canvasDims.width;
      const height = canvasDims.height;
      
      const initialWidth = 100; // Default width for a new sticker
      // Calculate initial height to maintain aspect ratio
      const initialHeight = (img.height / img.width) * initialWidth;
      const initialScale = initialWidth / img.width; // Scale factor to achieve initialWidth

      setStickers((prev) => {
        const newStickers = [
          ...prev,
          {
            img,
            x: width / 2 - initialWidth / 2, // Centered horizontally
            y: height / 2 - initialHeight / 2, // Centered vertically
            scale: initialScale,
          },
        ];
        // Set the newly added sticker as active
        setActiveStickerIndex(newStickers.length - 1); 
        return newStickers;
      });
    };
    img.onerror = () => console.error(`Failed to load sticker image: ${src}`);
  };

  // useEffect hook to draw on the canvas whenever relevant states change
  useEffect(() => {
    // Only draw if an image and segmentation mask are available
    if (!capturedImage || !segmentationMask) return;

    const canvas = canvasRef.current;
    if (!canvas) return; // Ensure canvas element exists
    const ctx = canvas.getContext("2d");
    
    // Use canvasDims from state for consistent dimensions
    const width = canvasDims.width;
    const height = canvasDims.height;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Create an offscreen buffer canvas for drawing to prevent flickering
    const bufferCanvas = document.createElement("canvas");
    bufferCanvas.width = width;
    bufferCanvas.height = height;
    const bufferCtx = bufferCanvas.getContext("2d");

    // Clear the buffer canvas
    bufferCtx.clearRect(0, 0, width, height);

    // Apply selected filter to the entire buffer context
    bufferCtx.filter = selectedFilter;

    // --- Logic for Background Replacement ---
    if (selectedBg && bgImg) {
      // If a background is selected, perform segmentation and composite
      const foregroundCanvas = document.createElement('canvas');
      foregroundCanvas.width = width;
      foregroundCanvas.height = height;
      const fgCtx = foregroundCanvas.getContext('2d');

      fgCtx.drawImage(capturedImage, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(segmentationMask, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'source-over';

      bufferCtx.drawImage(bgImg, 0, 0, width, height);
      bufferCtx.drawImage(foregroundCanvas, 0, 0, width, height);
    } else {
      // If NO background is selected, draw the ORIGINAL captured image
      bufferCtx.drawImage(capturedImage, 0, 0, width, height);
    }

    // Ensure globalCompositeOperation is 'source-over' for subsequent elements
    bufferCtx.globalCompositeOperation = "source-over";

    // Apply frame overlay if available - it's static and fills the canvas
    if (frameOverlay?.img) {
      bufferCtx.drawImage(frameOverlay.img, 0, 0, width, height);
    }

    // Draw all active stickers with their positions and scales
    stickers.forEach((sticker, index) => {
      const stickerWidth = sticker.img.width * sticker.scale;
      const stickerHeight = sticker.img.height * sticker.scale;
      bufferCtx.drawImage(sticker.img, sticker.x, sticker.y, stickerWidth, stickerHeight);

      // Draw border and handle if this is the active sticker
      if (index === activeStickerIndex) {
        bufferCtx.save();
        bufferCtx.strokeStyle = "rgba(0, 128, 255, 0.7)"; // Blue border
        bufferCtx.lineWidth = 2;
        bufferCtx.strokeRect(sticker.x, sticker.y, stickerWidth, stickerHeight);

        bufferCtx.fillStyle = "rgba(0, 128, 255, 0.8)"; // Blue fill for handle
        // Draw resize handle at the bottom-right corner of the sticker
        bufferCtx.fillRect(sticker.x + stickerWidth - STICKER_HANDLE_SIZE, sticker.y + stickerHeight - STICKER_HANDLE_SIZE, STICKER_HANDLE_SIZE, STICKER_HANDLE_SIZE);
        bufferCtx.restore();
      }
    });

    // Draw the buffered content to the main visible canvas
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bufferCanvas, 0, 0);

    // The saving logic has been moved to handleSave, so removed from here.
  }, [capturedImage, segmentationMask, bgImg, frameOverlay, stickers, activeStickerIndex, selectedFilter, canvasDims]); // Removed isSaving from dependencies

  // useEffect hook to load the selected background image
  useEffect(() => {
    if (!selectedBg) {
      setBgImg(null); // Clear background if none selected
      return;
    }
    const img = new Image();
    img.src = selectedBg;
    img.onload = () => setBgImg(img);
    img.onerror = () => console.error(`Failed to load background image: ${selectedBg}`);
  }, [selectedBg]);

  // useEffect hook to load the selected frame image (static)
  useEffect(() => {
    if (!selectedFrame) {
      setFrameOverlay(null); // Clear frame if none selected
      return;
    }
    const img = new Image();
    img.src = selectedFrame.src;
    img.onload = () => {
      setFrameOverlay({ img }); // Just store the image for static frames
    };
    img.onerror = () => console.error(`Failed to load frame image: ${selectedFrame.src}`);
  }, [selectedFrame]);

  // Function to reset the editor to its initial state
  const handleRetake = () => {
    setCapturedImage(null);
    setSegmentationMask(null);
    setBgImg(null);
    setFrameOverlay(null);
    setStickers([]); // Clear all stickers
    setActiveStickerIndex(null); // Clear active sticker index
    setDragMode(null); // Clear drag mode
    setDragStart(null); // Clear drag start
    setCanvasCursor('default'); // Reset cursor
    setSelectedBg(null);
    setSelectedFrame(null);
    setSelectedFilter("none");
    setIsSaving(false);
    setDownloadUrl(null);
  };

  // Function to trigger saving the photo
  const handleSave = () => {
    // Ensure we have a captured image to save
    if (!capturedImage || !segmentationMask) {
      console.warn("No image to save or segmentation not complete.");
      return;
    }

    setIsSaving(true); // Indicate saving is in progress

    // Create a new offscreen canvas for saving
    // Use OffscreenCanvas if available for better performance, fallback to HTMLCanvasElement
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasDims.width;
    finalCanvas.height = canvasDims.height;
    const finalCtx = finalCanvas.getContext('2d');

    // Apply filter to the final context
    finalCtx.filter = selectedFilter;

    // --- Redraw all elements onto the finalCanvas for saving ---
    if (selectedBg && bgImg) {
      const foregroundCanvas = document.createElement('canvas');
      foregroundCanvas.width = canvasDims.width;
      foregroundCanvas.height = canvasDims.height;
      const fgCtx = foregroundCanvas.getContext('2d');

      fgCtx.drawImage(capturedImage, 0, 0, canvasDims.width, canvasDims.height);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(segmentationMask, 0, 0, canvasDims.width, canvasDims.height);
      fgCtx.globalCompositeOperation = 'source-over';

      finalCtx.drawImage(bgImg, 0, 0, canvasDims.width, canvasDims.height);
      finalCtx.drawImage(foregroundCanvas, 0, 0, canvasDims.width, canvasDims.height);
    } else {
      finalCtx.drawImage(capturedImage, 0, 0, canvasDims.width, canvasDims.height);
    }

    finalCtx.globalCompositeOperation = "source-over";

    if (frameOverlay?.img) {
      finalCtx.drawImage(frameOverlay.img, 0, 0, canvasDims.width, canvasDims.height);
    }

    stickers.forEach((sticker) => {
      const stickerWidth = sticker.img.width * sticker.scale;
      const stickerHeight = sticker.img.height * sticker.scale;
      finalCtx.drawImage(sticker.img, sticker.x, sticker.y, stickerWidth, stickerHeight);
    });

    // Convert the final canvas to a blob and create a download URL
    finalCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        // Add the saved photo to the gallery
        setSavedPhotos((prevPhotos) => [...prevPhotos, url]);
      } else {
        console.error("Failed to create blob for saving.");
      }
      setIsSaving(false); // Reset saving flag
    }, 'image/png'); // Specify image format
  };

  // Function to clear all saved photos from the gallery
  const handleClearGallery = () => {
    savedPhotos.forEach(url => URL.revokeObjectURL(url)); // Release object URLs to free memory
    setSavedPhotos([]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-inter">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Photo Booth Editor</h2>

      {!capturedImage && (
        <div className="flex flex-col items-center space-y-4">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/png"
            width={640}
            height={480}
            videoConstraints={{ facingMode: "user" }}
            className="rounded-lg shadow-lg border border-gray-300"
          />
          <button
            onClick={takePhoto}
            className="px-6 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition duration-300 ease-in-out text-lg"
          >
            📸 Take Photo
          </button>
        </div>
      )}

      {capturedImage && (
        <div className="flex flex-col items-center w-full max-w-2xl">
          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-4">Live Photo Preview</h3>
          <canvas
            ref={canvasRef}
            style={{ cursor: canvasCursor }}
            className="w-full max-w-xl h-auto rounded-lg shadow-xl border-2 border-gray-300 bg-white"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={handleWheel}
            onMouseLeave={onMouseUp}
          />

          {/* Backgrounds Section */}
          <div className="w-full mt-6 p-4 bg-white rounded-lg shadow-md">
            <h4 className="text-lg font-medium text-gray-700 mb-3">Backgrounds</h4>
            <div className="flex flex-wrap justify-center gap-3">
              {BACKGROUNDS.map((bg, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedBg(bg)}
                  className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded-md overflow-hidden transition duration-200 ease-in-out"
                >
                  {bg === null ? (
                    <div className="w-24 h-16 bg-gray-200 flex items-center justify-center text-sm text-gray-600 rounded-md">No BG</div>
                  ) : (
                    <img src={bg} alt={`Background ${idx}`} className="w-24 h-16 object-cover rounded-md" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Frames Section */}
          <div className="w-full mt-4 p-4 bg-white rounded-lg shadow-md">
            <h4 className="text-lg font-medium text-gray-700 mb-3">Frames</h4>
            <div className="flex flex-wrap justify-center gap-3">
              {FRAME_OVERLAYS.map((frame, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedFrame(frame)}
                  className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded-md overflow-hidden transition duration-200 ease-in-out"
                >
                  {frame === null ? (
                    <div className="w-24 h-16 bg-gray-200 flex items-center justify-center text-sm text-gray-600 rounded-md">No Frame</div>
                  ) : (
                    <img src={frame.src} alt={`Frame ${idx}`} className="w-24 h-16 object-cover rounded-md" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stickers Section */}
          <div className="w-full mt-4 p-4 bg-white rounded-lg shadow-md">
            <h4 className="text-lg font-medium text-gray-700 mb-3">Stickers</h4>
            <div className="flex flex-wrap justify-center gap-3">
              {STICKERS.map((stickerSrc, idx) => (
                <img
                  key={idx}
                  src={stickerSrc}
                  alt={`Sticker ${idx}`}
                  className="w-16 h-16 object-contain cursor-pointer rounded-md border-2 border-transparent hover:border-blue-500 transition duration-200 ease-in-out"
                  onClick={() => addSticker(stickerSrc)}
                />
              ))}
            </div>
          </div>

          {/* Filters Section */}
          <div className="w-full mt-4 p-4 bg-white rounded-lg shadow-md">
            <h4 className="text-lg font-medium text-gray-700 mb-3">Filters</h4>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
            >
              <option value="none">None</option>
              <option value="grayscale(100%)">Grayscale</option>
              <option value="sepia(100%)">Sepia</option>
              <option value="blur(4px)">Blur</option>
              <option value="brightness(1.3)">Brighten</option>
              <option value="contrast(1.5)">High Contrast</option>
              <option value="invert(100%)">Invert</option>
              <option value="saturate(2)">Saturate</option>
              <option value="hue-rotate(90deg)">Hue Rotate</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-6 mb-8">
            <button
              onClick={handleRetake}
              className="px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition duration-300 ease-in-out text-lg"
            >
              🔄 Retake Photo
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition duration-300 ease-in-out text-lg"
            >
              💾 Save Photo
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="photo.png"
                className="px-6 py-3 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition duration-300 ease-in-out text-lg flex items-center justify-center"
              >
                ⬇️ Download
              </a>
            )}
          </div>

          {/* Saved Photos Gallery */}
          {savedPhotos.length > 0 && (
            <div className="w-full mt-8 p-4 bg-white rounded-lg shadow-md">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Saved Photos Gallery</h4>
              <div className="flex flex-wrap justify-center gap-3">
                {savedPhotos.map((photoUrl, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={photoUrl}
                      alt={`Saved Photo ${idx}`}
                      className="w-32 h-24 object-cover rounded-md border-2 border-gray-300"
                    />
                    {/* Optional: Add a download button on hover for individual images */}
                    <a
                      href={photoUrl}
                      download={`saved_photo_${idx}.png`}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md"
                      title="Download Photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
              <button
                onClick={handleClearGallery}
                className="mt-4 px-4 py-2 bg-red-400 text-white rounded-full shadow-lg hover:bg-red-500 transition duration-300 ease-in-out text-sm"
              >
                Clear Gallery
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
