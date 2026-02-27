"use client";

interface UserLocationMarkerProps {
  heading: number | null;
  accuracy: number;
}

export function UserLocationMarker({
  heading,
  accuracy,
}: UserLocationMarkerProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Accuracy circle */}
      {accuracy > 15 && (
        <div
          className="absolute rounded-full bg-blue-500/10 border border-blue-500/20"
          style={{
            width: Math.min(accuracy * 2, 100),
            height: Math.min(accuracy * 2, 100),
          }}
        />
      )}

      {/* Heading cone */}
      {heading !== null && (
        <div
          className="absolute w-20 h-20"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <defs>
              <linearGradient
                id="headingGrad"
                x1="0.5"
                y1="0"
                x2="0.5"
                y2="1"
              >
                <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M40,40 L28,5 Q40,-2 52,5 Z"
              fill="url(#headingGrad)"
            />
          </svg>
        </div>
      )}

      {/* Center dot */}
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-30" />
        <div className="absolute inset-0 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
        {/* Direction arrow inside dot */}
        {heading !== null && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${heading}deg)` }}
          >
            <svg viewBox="0 0 16 16" className="w-2.5 h-2.5">
              <path d="M8,2 L11,10 L8,8 L5,10 Z" fill="white" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
