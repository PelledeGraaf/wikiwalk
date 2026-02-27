"use client";

import { useState, useEffect } from "react";
import {
  Compass,
  MapPin,
  Search,
  Footprints,
  Navigation,
  Globe,
  X,
  Heart,
  Coffee,
} from "lucide-react";

const STORAGE_KEY = "wikiwalk_welcome_dismissed";

export function WelcomeScreen({ onClose }: { onClose: () => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {}
    }
    // Request location on close — this is a user gesture so iOS Safari allows it
    // The actual result handling happens in wiki-map.tsx via the delayed requestLocation() call
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-6 pt-8 pb-6 rounded-t-2xl">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 mb-3">
            <Compass className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">
              Wiki<span className="text-emerald-200">Walk</span>
            </h1>
          </div>
          <p className="text-emerald-100 text-sm leading-relaxed">
            Ontdek Wikipedia artikelen op de kaart. Gebouwen, monumenten, natuur,
            kunst en meer — allemaal om je heen.
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Hoe het werkt
          </h2>

          <div className="space-y-3.5">
            <Feature
              icon={<MapPin className="w-4 h-4" />}
              color="bg-emerald-100 text-emerald-700"
              title="Verken de kaart"
              description="Beweeg en zoom op de kaart. Wikipedia artikelen met coördinaten verschijnen als groene stippen."
            />
            <Feature
              icon={<Search className="w-4 h-4" />}
              color="bg-blue-100 text-blue-700"
              title="Zoek een plek"
              description="Gebruik de zoekbalk om een specifiek monument, gebouw of natuurgebied te vinden."
            />
            <Feature
              icon={<Footprints className="w-4 h-4" />}
              color="bg-orange-100 text-orange-700"
              title="Walking Mode"
              description="Maak een wandelroute langs interessante plekken. Voeg stops toe door op markers te klikken."
            />
            <Feature
              icon={<Navigation className="w-4 h-4" />}
              color="bg-purple-100 text-purple-700"
              title="Navigatie"
              description="Start navigatie om de kaart mee te laten bewegen met je locatie en kijkrichting."
            />
            <Feature
              icon={<Globe className="w-4 h-4" />}
              color="bg-gray-100 text-gray-700"
              title="NL & EN"
              description="Wissel tussen Nederlandse en Engelse Wikipedia met de taalknop."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-4">
          <button
            onClick={handleClose}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium text-sm active:bg-emerald-700 transition-colors"
          >
            Begin met ontdekken
          </button>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-500">Niet meer tonen</span>
            </label>

            <a
              href="https://buymeacoffee.com/pello"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-600 active:text-amber-600 transition-colors"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Support the developer</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  color,
  title,
  description,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

export function useShowWelcome(): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed !== "true") {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  return show;
}
