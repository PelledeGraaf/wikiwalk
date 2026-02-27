"use client";

import { X, MapPin, Settings, RefreshCw, Smartphone } from "lucide-react";

export function LocationHelp({ onClose }: { onClose: () => void }) {
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-red-500 to-red-600 text-white px-6 pt-6 pb-5 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 mb-2">
            <MapPin className="w-6 h-6" />
            <h1 className="text-lg font-bold">Locatie geblokkeerd</h1>
          </div>
          <p className="text-red-100 text-sm leading-relaxed">
            WikiWalk heeft geen toegang tot je locatie. Dit kan komen doordat je
            eerder op &quot;Sta niet toe&quot; hebt getikt.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">
          {isIOS ? (
            <>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Fix voor Safari (iOS)
              </h2>

              <div className="space-y-4">
                <Step
                  number={1}
                  icon={<Smartphone className="w-4 h-4" />}
                  title="Website-instellingen openen"
                  description={
                    <>
                      Tik op het{" "}
                      <span className="font-semibold text-gray-900">
                        &quot;aA&quot;
                      </span>{" "}
                      icoon links in de adresbalk, kies dan{" "}
                      <span className="font-semibold text-gray-900">
                        &quot;Instellingen website&quot;
                      </span>
                      .
                    </>
                  }
                />
                <Step
                  number={2}
                  icon={<MapPin className="w-4 h-4" />}
                  title="Locatie toestaan"
                  description={
                    <>
                      Zet{" "}
                      <span className="font-semibold text-gray-900">
                        Locatie
                      </span>{" "}
                      op{" "}
                      <span className="font-semibold text-gray-900">
                        &quot;Vraag&quot;
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-gray-900">
                        &quot;Sta toe&quot;
                      </span>
                      .
                    </>
                  }
                />
                <Step
                  number={3}
                  icon={<RefreshCw className="w-4 h-4" />}
                  title="Herlaad de pagina"
                  description="Sluit dit venster en herlaad de pagina. Safari vraagt dan opnieuw om toestemming."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Werkt het nog niet?</span>{" "}
                  Ga naar{" "}
                  <span className="font-semibold">
                    Instellingen → Privacy en beveiliging → Locatievoorzieningen
                    → Safari-websites
                  </span>{" "}
                  en kies{" "}
                  <span className="font-semibold">
                    &quot;Tijdens gebruik van de app&quot;
                  </span>
                  .
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Locatie inschakelen
              </h2>

              <div className="space-y-4">
                <Step
                  number={1}
                  icon={<Settings className="w-4 h-4" />}
                  title="Browser-instellingen"
                  description="Klik op het slotje of het instellingen-icoon links in de adresbalk."
                />
                <Step
                  number={2}
                  icon={<MapPin className="w-4 h-4" />}
                  title="Locatie toestaan"
                  description={
                    <>
                      Zoek{" "}
                      <span className="font-semibold text-gray-900">
                        Locatie
                      </span>{" "}
                      en zet het op{" "}
                      <span className="font-semibold text-gray-900">
                        &quot;Toestaan&quot;
                      </span>
                      .
                    </>
                  }
                />
                <Step
                  number={3}
                  icon={<RefreshCw className="w-4 h-4" />}
                  title="Herlaad de pagina"
                  description="Herlaad de pagina om de locatie opnieuw te vragen."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium text-sm active:bg-emerald-700 transition-colors"
          >
            Herlaad pagina
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium text-sm active:bg-gray-200 transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}
