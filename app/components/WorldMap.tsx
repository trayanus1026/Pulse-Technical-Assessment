"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { peerColor, peerHue } from "@/lib/color";
import { distanceKm, formatDistance } from "@/lib/geo";
import { LocateIcon } from "./icons";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  activePeerId,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  activePeerId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler
  // through a ref (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        // Start as a whole planet, then fly down to the user on load.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: 1.2,
        attributionControl: false,
      });
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      map.on("style.load", () => {
        // Night-side atmosphere with a faint star field.
        map.setFog({
          color: "rgb(10, 14, 26)",
          "high-color": "rgb(28, 60, 140)",
          "horizon-blend": 0.04,
          "space-color": "rgb(5, 6, 10)",
          "star-intensity": 0.5,
        });
      });
      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        if (me) {
          map.flyTo({
            center: [me.lng, me.lat],
            zoom: 3.4,
            duration: prefersReducedMotion() ? 0 : 3200,
            essential: true,
          });
        }
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial camera; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own beacon.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.innerHTML =
          '<span class="pulse-me__ring"></span><span class="pulse-me__ring"></span><span class="pulse-me__ring"></span><span class="pulse-me__core"></span><span class="pulse-me__label">You</span>';
        meMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "pulse-dot";
          el.style.setProperty("--dot", peerColor(peer.id));
          // Stagger the sonar so the map breathes instead of blinking in sync.
          el.style.setProperty("--delay", `${(peerHue(peer.id) % 26) / 10}s`);
          el.innerHTML =
            '<span class="pulse-dot__ring"></span><span class="pulse-dot__core"></span>';
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else {
          // A peer that re-joined gets a fresh privacy offset — follow it.
          marker.setLngLat([peer.lng, peer.lat]);
        }

        const el = marker.getElement();
        const isActive = peer.id === activePeerId;
        el.classList.toggle("is-busy", peer.busy && !isActive);
        const where = me ? ` · ${formatDistance(distanceKm(me, peer))}` : "";
        const label = isActive
          ? "Talking with you"
          : peer.busy
            ? "In a conversation"
            : canConnect
              ? `Say hi${where}`
              : `Stranger${where}`;
        el.dataset.label = label;
        el.setAttribute("aria-label", label);
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready, me, canConnect, activePeerId]);

  function recenter() {
    if (!mapRef.current || !me) return;
    mapRef.current.flyTo({
      center: [me.lng, me.lat],
      zoom: Math.max(mapRef.current.getZoom(), 4),
      duration: prefersReducedMotion() ? 0 : 1600,
      essential: true,
    });
  }

  const count = peers.length;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-ink" />

      {/* Soft vignette so floating UI always has contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(5_6_10/0.65))]"
      />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="glass max-w-md rounded-2xl p-5 text-sm text-fg">
            Set <code className="text-pulse">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the globe.
          </p>
        </div>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div className="animate-fade flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-sonar rounded-full bg-pulse" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-pulse shadow-[0_0_12px_rgb(124_255_196/0.9)]" />
          </span>
          <span className="font-display text-3xl italic leading-none tracking-tight text-fg">
            Pulse
          </span>
        </div>

        <div
          className="glass animate-fade flex items-center gap-2 rounded-full px-3.5 py-2 text-xs text-muted"
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${count > 0 ? "bg-pulse shadow-[0_0_8px_rgb(124_255_196/0.9)]" : "bg-faint"}`}
          />
          {count > 0 ? (
            <span>
              <span className="font-mono font-medium tabular-nums text-fg">
                {count}
              </span>{" "}
              {count === 1 ? "stranger" : "strangers"} online
            </span>
          ) : (
            <span>Just you, for now</span>
          )}
        </div>
      </header>

      {me && ready && (
        <button
          onClick={recenter}
          aria-label="Fly back to my location"
          title="Back to me"
          className="glass absolute bottom-[calc(2.75rem+env(safe-area-inset-bottom))] right-4 grid h-11 w-11 place-items-center rounded-full text-muted transition hover:text-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse sm:right-6"
        >
          <LocateIcon />
        </button>
      )}
    </div>
  );
}
