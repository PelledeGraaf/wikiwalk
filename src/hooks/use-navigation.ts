"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface NavigationState {
  latitude: number;
  longitude: number;
  heading: number | null; // compass heading in degrees (0 = north)
  speed: number | null; // m/s
  accuracy: number; // meters
}

export function useNavigation(enabled: boolean) {
  const [state, setState] = useState<NavigationState | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const headingRef = useRef<number | null>(null);
  const prevPositionRef = useRef<{ lat: number; lon: number } | null>(null);

  // Calculate heading from two GPS positions as fallback
  const calcHeading = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
      const x =
        Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
        Math.sin((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.cos(dLon);
      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState(null);
      prevPositionRef.current = null;
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } =
          position.coords;

        // Use GPS heading if available, else calculate from movement
        let computedHeading = heading;
        if (
          (computedHeading === null || computedHeading === undefined || isNaN(computedHeading)) &&
          prevPositionRef.current
        ) {
          const prev = prevPositionRef.current;
          const dist = Math.sqrt(
            Math.pow(latitude - prev.lat, 2) +
              Math.pow(longitude - prev.lon, 2)
          );
          // Only compute heading if we've moved enough (to avoid jitter)
          if (dist > 0.00005) {
            computedHeading = calcHeading(
              prev.lat,
              prev.lon,
              latitude,
              longitude
            );
          }
        }

        if (computedHeading !== null && computedHeading !== undefined && !isNaN(computedHeading)) {
          headingRef.current = computedHeading;
        }

        prevPositionRef.current = { lat: latitude, lon: longitude };

        setState({
          latitude,
          longitude,
          heading: headingRef.current,
          speed,
          accuracy,
        });
      },
      (error) => {
        console.warn("Navigation geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      }
    );

    // Device orientation for compass heading (works on mobile)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS, alpha for Android
      const compassHeading =
        (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
          .webkitCompassHeading ??
        (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (compassHeading !== null && !isNaN(compassHeading)) {
        headingRef.current = compassHeading;
        setState((prev) =>
          prev ? { ...prev, heading: compassHeading } : null
        );
      }
    };

    // Request permission for device orientation on iOS 13+
    if (
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === "function"
    ) {
      (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation, true);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [enabled, calcHeading]);

  return state;
}
