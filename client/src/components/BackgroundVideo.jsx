import React from 'react';

export default function BackgroundVideo() {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden">
      {/* Dark overlay to ensure text remains readable */}
      <div className="absolute inset-0 bg-gray-950/60 z-10" />
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://res.cloudinary.com/dashtm8a6/video/upload/v1784061215/14433605_1920_1080_60fps_jdc8ql.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
