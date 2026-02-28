"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  Popup,
  Source,
  Layer,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type maplibregl from "maplibre-gl";
import type { WikiArticle } from "@/lib/wikipedia";
import { useTileArticles } from "@/hooks/use-tile-articles";
import { MapViewState, DEFAULT_VIEW } from "@/lib/constants";
import { ArticleCard } from "./article-card";
import { SearchBar } from "./search-bar";
import { WalkingMode } from "./walking-mode";
import { FilterBar } from "./filter-bar";
import { ArticlePanel } from "./article-panel";
import {
  MapPin,
  Footprints,
  Layers,
  X,
  Navigation,
  Compass,
  Coffee,
  LocateFixed,
  Plus,
  Minus,
  ArrowUp,
} from "lucide-react";
import { useNavigation } from "@/hooks/use-navigation";
import { UserLocationMarker } from "./user-location-marker";
import { WelcomeScreen, useShowWelcome } from "./welcome-screen";
import { LocationHelp } from "./location-help";

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export function WikiMap() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(
    null
  );
  const [hoveredArticle, setHoveredArticle] = useState<WikiArticle | null>(
    null
  );
  const [walkingMode, setWalkingMode] = useState(false);
  const [walkingArticles, setWalkingArticles] = useState<WikiArticle[]>([]);
  const [language, setLanguage] = useState<"nl" | "en">("nl");
  const [panelArticle, setPanelArticle] = useState<WikiArticle | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const showWelcome = useShowWelcome();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigationState = useNavigation(navigating);
  const lastCameraUpdateRef = useRef<number>(0);
  const [viewedArticles, setViewedArticles] = useState<Set<number>>(new Set());
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const locationGrantedRef = useRef(false);
  const [locationLoading, setLocationLoading] = useState(false);

  /**
   * Detect iOS synchronously — NOT via useEffect/state.
   * Using state would cause a race condition: the auto-request
   * effect fires before the iOS detection effect updates state,
   * so it sees isIOS=false and calls geolocation from useEffect
   * (not a user gesture), which iOS Safari silently blocks.
   */
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  /**
   * Request geolocation — robust iOS Safari strategy.
   *
   * Uses watchPosition instead of getCurrentPosition because:
   * - On iOS Safari, getCurrentPosition can hang forever (known bug)
   * - watchPosition fires repeatedly and is more reliable on iOS
   * - The permission dialog time doesn't eat into any timeout
   *
   * Flow:
   * 1. Start watchPosition (low-accuracy first for speed)
   * 2. As soon as the FIRST position arrives → fly to it
   * 3. Keep watching for up to 5 more seconds for a better fix
   * 4. Clear the watch and optionally start a refinement watch
   * 5. Hard timeout of 30s catches the case where everything hangs
   */
  const requestLocation = useCallback(
    (showHelpOnDeny = false) => {
      if (!navigator.geolocation) return;

      setLocationDenied(false);
      setLocationLoading(true);

      let gotPosition = false;
      let bestAccuracy = Infinity;

      const applyPosition = (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setLocationDenied(false);
        setLocationLoading(false);
        locationGrantedRef.current = true;

        // Only fly to location on the first position fix
        if (!gotPosition) {
          gotPosition = true;
          setViewState({ latitude, longitude, zoom: 14 });
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            duration: 1500,
          });
        }

        // Always update if more accurate
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          setUserLocation({ lat: latitude, lon: longitude });
        }
      };

      const onError = (error: GeolocationPositionError) => {
        if (error.code === error.PERMISSION_DENIED) {
          cleanup();
          setLocationDenied(true);
          setLocationLoading(false);
          if (showHelpOnDeny) {
            setShowLocationHelp(true);
          }
        }
        // TIMEOUT / POSITION_UNAVAILABLE: keep watching, don't give up
      };

      // Start watching with low-accuracy (fast on iOS — WiFi/cell)
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          applyPosition(position);
        },
        onError,
        {
          enableHighAccuracy: false,
          timeout: 30000,    // Long timeout — permission dialog doesn't eat this on watchPosition
          maximumAge: 10000, // Accept a recent cached position
        }
      );

      // After getting the first fix, switch to high-accuracy for refinement
      let highAccWatchId: number | null = null;
      const startHighAccuracy = () => {
        if (highAccWatchId !== null) return;
        highAccWatchId = navigator.geolocation.watchPosition(
          (position) => {
            applyPosition(position);
          },
          () => {}, // Ignore errors on refinement
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        );
      };

      // Check periodically: once we have a position, start high-accuracy
      const refinementTimer = setInterval(() => {
        if (gotPosition) {
          startHighAccuracy();
          clearInterval(refinementTimer);
          // Stop refinement after 10 seconds
          setTimeout(() => {
            if (highAccWatchId !== null) {
              navigator.geolocation.clearWatch(highAccWatchId);
              highAccWatchId = null;
            }
          }, 10000);
        }
      }, 500);

      // Hard timeout: if nothing works in 30 seconds, show help
      const hardTimeout = setTimeout(() => {
        cleanup();
        if (!gotPosition) {
          setLocationLoading(false);
          if (showHelpOnDeny) {
            setShowLocationHelp(true);
          }
        }
      }, 30000);

      // Stop low-accuracy watch after 15 seconds (we should have a fix by then)
      const lowAccTimeout = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
      }, 15000);

      function cleanup() {
        navigator.geolocation.clearWatch(watchId);
        if (highAccWatchId !== null) {
          navigator.geolocation.clearWatch(highAccWatchId);
        }
        clearInterval(refinementTimer);
        clearTimeout(hardTimeout);
        clearTimeout(lowAccTimeout);
      }
    },
    []
  );

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close popup/panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedArticle(null);
        setPanelArticle(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Show welcome screen
  useEffect(() => {
    if (showWelcome) setWelcomeOpen(true);
  }, [showWelcome]);

  // Ask for user location on mount — but NOT on iOS (requires user gesture)
  // and NOT if welcome screen is showing (will request on close)
  useEffect(() => {
    if (locationRequested) return;
    if (welcomeOpen) return;

    // iOS Safari: MUST be called from a user gesture (tap/click).
    // Calling from useEffect is silently blocked. Check inline
    // (not from state) to avoid the race condition.
    const isiOS =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    if (isiOS) {
      // On iOS, never auto-request — wait for user to tap locate button
      setLocationRequested(true);
      return;
    }
    setLocationRequested(true);
    requestLocation();
  }, [locationRequested, requestLocation, welcomeOpen]);

  // Navigation mode: follow user position and rotate map to heading
  const navStartedRef = useRef(false);
  useEffect(() => {
    if (!navigating) {
      navStartedRef.current = false;
      return;
    }
    if (!navigationState || !mapRef.current) return;

    // Update user location for other components
    setUserLocation({
      lat: navigationState.latitude,
      lon: navigationState.longitude,
    });

    // Throttle camera updates to avoid jitter (max every 500ms)
    const now = Date.now();
    if (now - lastCameraUpdateRef.current < 500) return;
    lastCameraUpdateRef.current = now;

    const map = mapRef.current.getMap();
    const options: Record<string, unknown> = {
      center: [navigationState.longitude, navigationState.latitude],
      duration: 800,
      essential: true,
    };

    // Only set zoom on first navigation update; afterwards let user zoom freely
    if (!navStartedRef.current) {
      navStartedRef.current = true;
      options.zoom = 17;
    }

    if (navigationState.heading !== null) {
      options.bearing = navigationState.heading;
      options.pitch = 50;
    }

    map.easeTo(options as maplibregl.EaseToOptions);
  }, [navigating, navigationState]);

  // When starting navigation, also enable walking mode
  const startNavigation = useCallback(() => {
    if (locationDenied) {
      setShowLocationHelp(true);
      return;
    }
    setNavigating(true);
  }, [locationDenied]);

  const stopNavigation = useCallback(() => {
    setNavigating(false);
    // Reset pitch and bearing
    mapRef.current?.getMap().easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  }, []);

  // Tile-based article loading with caching and pre-loading
  const {
    articles,
    isLoading,
    onMapMove,
    enrichArticle: enrichArticleFn,
  } = useTileArticles(mapRef, language, viewState.zoom);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      setViewState({
        latitude: e.viewState.latitude,
        longitude: e.viewState.longitude,
        zoom: e.viewState.zoom,
        bearing: e.viewState.bearing,
      });
      onMapMove();
    },
    [onMapMove]
  );

  // Mark initial load as done once we get articles (or loading finishes)
  useEffect(() => {
    if (!initialLoadDone && !isLoading && articles.length > 0) {
      setInitialLoadDone(true);
    }
  }, [articles.length, isLoading, initialLoadDone]);

  // Also mark done after a timeout (in case there are no articles in the area)
  useEffect(() => {
    const t = setTimeout(() => setInitialLoadDone(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const markViewed = useCallback((pageid: number) => {
    setViewedArticles((prev) => {
      const next = new Set(prev);
      next.add(pageid);
      return next;
    });
  }, []);

  const handleArticleClick = useCallback(
    async (article: WikiArticle) => {
      setSelectedArticle(null);
      markViewed(article.pageid);
      // Enrich article with full details before showing panel
      const enriched = await enrichArticleFn(article);
      setPanelArticle(enriched);
    },
    [enrichArticleFn, markViewed]
  );

  const handleMarkerClick = useCallback(
    async (article: WikiArticle) => {
      markViewed(article.pageid);
      if (isMobile) {
        // On mobile, skip popup and open panel directly
        const enriched = await enrichArticleFn(article);
        setPanelArticle(enriched);
      } else {
        // Enrich for popup too (needs extract for preview)
        const enriched = await enrichArticleFn(article);
        setSelectedArticle(enriched);
      }
      mapRef.current?.flyTo({
        center: [article.lon, article.lat],
        zoom: Math.max(viewState.zoom, 15),
        duration: 800,
      });
    },
    [viewState.zoom, isMobile, enrichArticleFn, markViewed]
  );

  const flyToLocation = useCallback((lat: number, lon: number, zoom = 15) => {
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom,
      duration: 1000,
    });
  }, []);

  const toggleWalkingArticle = useCallback(
    (article: WikiArticle) => {
      setWalkingArticles((prev) => {
        const exists = prev.find((a) => a.pageid === article.pageid);
        if (exists) return prev.filter((a) => a.pageid !== article.pageid);
        return [...prev, article];
      });
    },
    []
  );

  // Walking route line
  const routeGeoJson = walkingMode &&
    walkingArticles.length >= 2 && {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: walkingArticles.map((a) => [a.lon, a.lat]),
      },
    };

  return (
    <div className="relative w-full h-screen">
      {/* Welcome screen */}
      {welcomeOpen && (
        <WelcomeScreen
          onClose={() => {
            setWelcomeOpen(false);
            // This runs inside a user gesture (tap) — required for iOS Safari
            // Call requestLocation directly; don't use setTimeout which loses
            // the user-gesture context on iOS Safari.
            requestLocation(false);
          }}
        />
      )}

      {/* Location help modal */}
      {showLocationHelp && (
        <LocationHelp onClose={() => setShowLocationHelp(false)} />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none safe-top">
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 sm:flex-nowrap sm:items-start sm:gap-3">
          {/* Logo */}
          <div className="pointer-events-auto bg-white rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-1.5">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900">
              Wiki<span className="text-emerald-600">Walk</span>
            </span>
          </div>

          {/* Controls — sit next to logo on mobile */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:order-last sm:gap-2">
            {/* Buy me a coffee */}
            <a
              href="https://buymeacoffee.com/pello"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl shadow-lg px-2.5 py-2 sm:px-3 sm:py-2.5 text-amber-500 active:bg-amber-50 sm:hover:bg-amber-50 transition-colors"
              title="Support the developer"
            >
              <Coffee className="w-4 h-4" />
            </a>

            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === "nl" ? "en" : "nl")}
              className="bg-white rounded-xl shadow-lg px-2.5 py-2 sm:px-3 sm:py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 sm:hover:bg-gray-50 transition-colors"
            >
              {language === "nl" ? "🇳🇱" : "🇬🇧"}
            </button>

            {/* Walking mode toggle */}
            <button
              onClick={() => {
                setWalkingMode(!walkingMode);
                if (walkingMode) {
                  setWalkingArticles([]);
                  if (navigating) stopNavigation();
                }
              }}
              className={`rounded-xl shadow-lg px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                walkingMode
                  ? "bg-emerald-600 text-white active:bg-emerald-700"
                  : "bg-white text-gray-700 active:bg-gray-100"
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span className="hidden sm:inline">Walking Mode</span>
            </button>
          </div>

          {/* Search — full width row on mobile */}
          <div className="pointer-events-auto w-full sm:flex-1 sm:max-w-lg sm:w-auto order-last sm:order-none">
            <SearchBar
              language={language}
              onSelectResult={(article) => {
                flyToLocation(article.lat, article.lon);
                setPanelArticle(article);
              }}
            />
          </div>
        </div>
      </div>

      {/* Walking mode panel */}
      {walkingMode && (
        <WalkingMode
          articles={walkingArticles}
          userLocation={userLocation}
          navigating={navigating}
          onStartNavigation={startNavigation}
          onStopNavigation={stopNavigation}
          onRemoveArticle={(pageid) =>
            setWalkingArticles((prev) =>
              prev.filter((a) => a.pageid !== pageid)
            )
          }
          onClear={() => {
            setWalkingArticles([]);
            if (navigating) stopNavigation();
          }}
          onFlyTo={flyToLocation}
        />
      )}

      {/* Article detail panel */}
      {panelArticle && (
        <ArticlePanel
          article={panelArticle}
          language={language}
          walkingMode={walkingMode}
          isInRoute={walkingArticles.some(
            (a) => a.pageid === panelArticle.pageid
          )}
          userLocation={userLocation}
          onClose={() => setPanelArticle(null)}
          onToggleRoute={() => toggleWalkingArticle(panelArticle)}
          onNavigate={(lat, lon) => {
            flyToLocation(lat, lon, 17);
            setNavigating(true);
          }}
        />
      )}

      {/* Initial loading screen */}
      {!initialLoadDone && (
        <div className="fixed inset-0 z-40 bg-gradient-to-br from-emerald-50 to-white flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2.5">
            <Compass className="w-10 h-10 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Wiki<span className="text-emerald-600">Walk</span>
            </h1>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="text-sm text-gray-500">Artikelen laden...</p>
          </div>
        </div>
      )}

      {/* Small loading indicator for subsequent loads */}
      {isLoading && initialLoadDone && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg text-sm text-gray-600 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Artikelen laden...
        </div>
      )}

      {/* Zoom hint */}
      {viewState.zoom < 3 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg text-sm text-gray-600">
          Zoom in om Wikipedia artikelen te zien
        </div>
      )}

      {/* Floating control buttons — right side */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-2 safe-bottom">
        {/* Locate me */}
        {!navigating && (
          <button
            onClick={() => {
              requestLocation(true);
            }}
            disabled={locationLoading}
            className={`w-11 h-11 rounded-xl shadow-lg flex items-center justify-center transition-colors ${
              locationLoading
                ? "bg-blue-50 text-blue-500"
                : locationDenied
                ? "bg-red-50 text-red-500 active:bg-red-100"
                : userLocation
                ? "bg-blue-50 text-blue-500 active:bg-blue-100"
                : "bg-white text-gray-600 active:bg-gray-100 sm:hover:bg-gray-50"
            }`}
            title="Mijn locatie"
          >
            {locationLoading ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LocateFixed className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Track mode — mobile only */}
        <button
          onClick={() => {
            if (navigating) {
              stopNavigation();
            } else {
              startNavigation();
            }
          }}
          className={`sm:hidden w-11 h-11 rounded-xl shadow-lg flex items-center justify-center transition-colors ${
            navigating
              ? "bg-blue-500 text-white active:bg-blue-600"
              : "bg-white text-blue-500 active:bg-blue-50"
          }`}
          title={navigating ? "Stop tracking" : "Volg mijn locatie"}
        >
          <Navigation className={`w-5 h-5 ${navigating ? "animate-pulse" : ""}`} />
        </button>

        {/* North reset — visible when map is rotated */}
        {Math.abs(viewState.bearing ?? 0) > 1 && (
          <button
            onClick={() => {
              mapRef.current?.getMap().easeTo({
                bearing: 0,
                pitch: 0,
                duration: 400,
              });
            }}
            className="w-11 h-11 rounded-xl shadow-lg bg-white flex items-center justify-center text-gray-600 active:bg-gray-100 sm:hover:bg-gray-50 transition-colors"
            title="Noord"
          >
            <ArrowUp
              className="w-5 h-5 text-red-500 transition-transform"
              style={{ transform: `rotate(${-(viewState.bearing ?? 0)}deg)` }}
            />
          </button>
        )}

        {/* Zoom in */}
        <button
          onClick={() => {
            mapRef.current?.getMap().zoomIn({ duration: 200 });
          }}
          className="w-11 h-11 rounded-xl shadow-lg bg-white flex items-center justify-center text-gray-600 active:bg-gray-100 sm:hover:bg-gray-50 transition-colors"
          title="Zoom in"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Zoom out */}
        <button
          onClick={() => {
            mapRef.current?.getMap().zoomOut({ duration: 200 });
          }}
          className="w-11 h-11 rounded-xl shadow-lg bg-white flex items-center justify-center text-gray-600 active:bg-gray-100 sm:hover:bg-gray-50 transition-colors"
          title="Zoom uit"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onMoveEnd={handleMoveEnd}
        onLoad={onMapMove}
        onClick={() => {
          // Close popup and panel when clicking the map background
          setSelectedArticle(null);
          setPanelArticle(null);
        }}
        maxZoom={19}
        minZoom={3}
      >
        {/* Note: MapLibre's built-in controls removed — we use custom buttons
            above the map for consistent positioning and iOS Safari compat. */}

        {/* User location blue dot — ALWAYS visible when we have a position */}
        {!navigating && userLocation && (
          <Marker
            latitude={userLocation.lat}
            longitude={userLocation.lon}
            anchor="center"
          >
            <div className="relative flex items-center justify-center">
              {/* Accuracy ring */}
              <div className="absolute w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20" />
              {/* Blue dot */}
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
            </div>
          </Marker>
        )}

        {/* User location marker during navigation (with heading arrow) */}
        {navigating && navigationState && (
          <Marker
            latitude={navigationState.latitude}
            longitude={navigationState.longitude}
            anchor="center"
          >
            <UserLocationMarker
              heading={navigationState.heading}
              accuracy={navigationState.accuracy}
            />
          </Marker>
        )}

        {/* Article markers */}
        {articles.map((article) => {
          const isSelected = selectedArticle?.pageid === article.pageid;
          const isInRoute = walkingArticles.some(
            (a) => a.pageid === article.pageid
          );
          const isHovered = hoveredArticle?.pageid === article.pageid;
          const isViewed = viewedArticles.has(article.pageid);

          // Scale marker size based on zoom level
          const markerSize = viewState.zoom >= 14
            ? "w-4 h-4 sm:w-3.5 sm:h-3.5"
            : viewState.zoom >= 10
            ? "w-3 h-3 sm:w-2.5 sm:h-2.5"
            : "w-2.5 h-2.5 sm:w-2 sm:h-2";

          const markerSizeActive = viewState.zoom >= 14
            ? "!w-5 !h-5 sm:!w-4 sm:!h-4"
            : viewState.zoom >= 10
            ? "!w-4 !h-4 sm:!w-3.5 sm:!h-3.5"
            : "!w-3 !h-3 sm:!w-2.5 sm:!h-2.5";

          const borderWidth = "border-2";

          return (
            <Marker
              key={article.pageid}
              latitude={article.lat}
              longitude={article.lon}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(article);
              }}
            >
              <div
                className={`transition-all duration-200 cursor-pointer ${
                  isHovered || isSelected ? "scale-125" : "scale-100"
                }`}
                onMouseEnter={() => setHoveredArticle(article)}
                onMouseLeave={() => setHoveredArticle(null)}
              >
                {/* Invisible touch target for mobile */}
                <div className="absolute -inset-2 sm:hidden" />
                <div
                  className={`${markerSize} rounded-full ${borderWidth} shadow-md ${
                    isInRoute
                      ? `bg-orange-500 border-orange-300 ${markerSizeActive}`
                      : isSelected
                      ? `bg-emerald-600 border-emerald-300 ${markerSizeActive}`
                      : isViewed
                      ? "bg-gray-400 border-gray-200"
                      : "bg-emerald-500 border-white"
                  }`}
                />
              </div>
            </Marker>
          );
        })}

        {/* Walking route line */}
        {routeGeoJson && (
          <Source
            id="route"
            type="geojson"
            data={routeGeoJson as GeoJSON.Feature}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#f97316",
                "line-width": 3,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {/* Walking route markers with numbers */}
        {walkingMode &&
          walkingArticles.map((article, index) => (
            <Marker
              key={`walk-${article.pageid}`}
              latitude={article.lat}
              longitude={article.lon}
              anchor="center"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold border-2 border-white shadow-lg">
                {index + 1}
              </div>
            </Marker>
          ))}

        {/* Popup on click — desktop only */}
        {selectedArticle && !isMobile && (
          <Popup
            latitude={selectedArticle.lat}
            longitude={selectedArticle.lon}
            anchor="bottom"
            offset={12}
            closeOnClick={false}
            onClose={() => setSelectedArticle(null)}
            className="wiki-popup"
          >
            <ArticleCard
              article={selectedArticle}
              walkingMode={walkingMode}
              isInRoute={walkingArticles.some(
                (a) => a.pageid === selectedArticle.pageid
              )}
              onReadMore={() => handleArticleClick(selectedArticle)}
              onToggleRoute={() => toggleWalkingArticle(selectedArticle)}
            />
          </Popup>
        )}
      </Map>
    </div>
  );
}
