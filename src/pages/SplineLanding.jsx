import React from 'react';
import { Link } from 'react-router-dom';
import Spline from '@splinetool/react-spline';

// Motion Trails scene from https://my.spline.design/motiontrails-bHcZqrWgRxDvP2930RrrVxB7/
const SPLINE_SCENE =
  'https://prod.spline.design/nr1LGOngYj8p4l9y/scene.splinecode';

const SplineLanding = () => {
  return (
    <div className="absolute inset-0 w-full h-full bg-gray-900">
      {/* Spline 3D viewer via official React package */}
      <Spline
        scene={SPLINE_SCENE}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Get Started button only */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none z-10 pb-20">
        <Link
          to="/select-role"
          className="pointer-events-auto px-10 py-4 text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-xl hover:shadow-2xl"
          style={{ background: 'linear-gradient(90deg, #00e5ff, #7c4dff)' }}
        >
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default SplineLanding;
