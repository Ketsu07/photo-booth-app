import React, { useEffect, useState } from 'react';

function PhotoGallery() {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('photoGallery');
    if (saved) setPhotos(JSON.parse(saved));
  }, []);

  return (
    <div className="gallery">
      <h2>Recent Photos</h2>
      <div className="photo-grid">
        {photos.map((photo, idx) => (
          <img key={idx} src={photo} alt={`snapshot-${idx}`} />
        ))}
      </div>
    </div>
  );
}

export default PhotoGallery;