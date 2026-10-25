"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapboxMap,
  Marker,
} from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { peerColor, peerHue } from "@/lib/color";
import { distanceKm, formatDistance, greatCircle } from "@/lib/geo";
import { LocateIcon } from "./icons";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Live threads: a glowing great-circle line between every pair of strangers
// talking right now, with a spark of light travelling along it. Three line
// layers share one GeoJSON source: a soft glow, a crisp core, and the
// animated spark (a moving line-gradient, hence lineMetrics).
const THREADS = "threads";
const SPARK_COLOR = "rgba(255, 255, 255, 0.95)";
const CLEAR = "rgba(255, 255, 255, 0)";
const SPARK_PERIOD_MS = 2600;
const SPARK_TAIL = 0.22;

type LatLng = { lat: number; lng: number };

// A conversation that just started elsewhere, announced briefly.
export interface ThreadTicker {
  key: string;
  text: string;
  ends: [LatLng, LatLng];
}

type ThreadCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { color: string; mine: boolean }
>;

function addThreadLayers(map: MapboxMap) {
  map.addSource(THREADS, {
    type: "geojson",
    lineMetrics: true,
    data: { type: "FeatureCollection", features: [] },
  });
  const mine: ExpressionSpecification = ["get", "mine"];
  const layout = { "line-cap": "round", "line-join": "round" } as const;
  map.addLayer({
    id: "threads-glow",
    type: "line",
    source: THREADS,
    layout,
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", mine, 16, 10],
      "line-blur": 8,
      "line-opacity": ["case", mine, 0.7, 0.45],
      "line-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: "threads-core",
    type: "line",
    source: THREADS,
    layout,
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", mine, 2, 1.2],
      "line-opacity": ["case", mine, 0.95, 0.65],
      "line-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: "threads-spark",
    type: "line",
    source: THREADS,
    layout,
    paint: {
      "line-width": ["case", mine, 3.5, 2.5],
      "line-gradient": sparkGradient(0),
      "line-emissive-strength": 1,
    },
  });
}

// A short bright head at `head` (0-1 along each line) fading out behind it.
function sparkGradient(head: number): ExpressionSpecification {
  const stops: [number, string][] = [[0, CLEAR]];
  const tail = head - SPARK_TAIL;
  if (tail > 0) stops.push([tail, CLEAR]);
  if (head > 0) stops.push([head, SPARK_COLOR]);
  if (head + 0.01 < 1) stops.push([head + 0.01, CLEAR]);
  if (stops[stops.length - 1][0] < 1) stops.push([1, CLEAR]);
  return ["interpolate", ["linear"], ["line-progress"], ...stops.flat()];
}

export default function WorldMap({
  peers,
  threads,
  myId,
  ticker,
  me,
  onPeerClick,
  canConnect,
  activePeerId,
}: {
  peers: PeerDot[];
  threads: [string, string][];
  myId: string | null;
  ticker: ThreadTicker | null;
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
  const threadCountRef = useRef(0);
  const framedThreadRef = useRef<string | null>(null);

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
        addThreadLayers(map);
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

  // Redraw the threads whenever pairings or positions change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const byId = new Map(peers.map((p) => [p.id, p]));
    const locate = (id: string) => (id === myId ? me : byId.get(id));

    const data: ThreadCollection = { type: "FeatureCollection", features: [] };
    for (const [a, b] of threads) {
      const from = locate(a);
      const to = locate(b);
      if (!from || !to) continue;
      const mine = a === myId || b === myId;
      data.features.push({
        type: "Feature",
        properties: {
          // Our own thread takes our partner's colour, matching their dot and
          // the chat header; everyone else's glows in Pulse mint.
          color: mine ? peerColor(a === myId ? b : a) : "#7cffc4",
          mine,
        },
        geometry: { type: "LineString", coordinates: greatCircle(from, to) },
      });
    }
    threadCountRef.current = data.features.length;
    (map.getSource(THREADS) as GeoJSONSource | undefined)?.setData(data);

    // When our own conversation starts, pull back to show both ends of it:
    // the moment you see the line reach across the world is the point.
    const ours = threads.find(([a, b]) => a === myId || b === myId);
    const key = ours ? ours.join(":") : null;
    if (key && key !== framedThreadRef.current) {
      const partner = byId.get(ours![0] === myId ? ours![1] : ours![0]);
      if (me && partner) void frame([me, partner], true);
    }
    framedThreadRef.current = key;
  },[threads, peers, me, myId, ready]);

  // Run the spark along every thread. Throttled to ~30fps and idle while
  // there's nothing to animate; skipped entirely for reduced motion.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || prefersReducedMotion()) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (threadCountRef.current === 0 || now - last < 33) return;
      last = now;
      // Overshoot so the tail fully leaves the line before the next lap.
      const t = (now % SPARK_PERIOD_MS) / SPARK_PERIOD_MS;
      const head = Math.min(t * (1 + SPARK_TAIL), 1);
      if (map.getLayer("threads-spark")) {
        map.setPaintProperty("threads-spark", "line-gradient", sparkGradient(head));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  // Fit the camera to a great-circle thread. `chatOpen` leaves room for the
  // chat panel docked on the right on wide screens.
  async function frame(ends: [LatLng, LatLng], chatOpen = false) {
    const map = mapRef.current;
    if (!map) return;
    const mapboxgl = (await import("mapbox-gl")).default;
    const coords = greatCircle(ends[0], ends[1]);
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(coords[0], coords[0]),
    );
    const wide = window.innerWidth >= 768;
    map.fitBounds(bounds, {
      padding: {
        top: 110,
        bottom: wide ? 90 : Math.round(window.innerHeight * 0.45),
        left: 60,
        right: chatOpen && wide ? 460 : 60,
      },
      maxZoom: 5,
      duration: prefersReducedMotion() ? 0 : 2200,
      essential: true,
    });
  }

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
  const live = threads.length;

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
              online
              {live > 0 && (
                <>
                  {" · "}
                  <span className="font-mono font-medium tabular-nums text-fg">
                    {live}
                  </span>{" "}
                  {live === 1 ? "live thread" : "live threads"}
                </>
              )}
            </span>
          ) : (
            <span>Just you, for now</span>
          )}
        </div>
      </header>

      {ticker && (
        <div
          key={ticker.key}
          role="status"
          className="glass animate-rise absolute right-4 top-[calc(4rem+env(safe-area-inset-top))] z-10 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-xs text-muted sm:right-6 sm:top-20"
        >
          <span className="h-px w-5 shrink-0 bg-linear-to-r from-transparent to-pulse" />
          <span className="truncate">{ticker.text}</span>
          {ready && (
            <button
              onClick={() => void frame(ticker.ends)}
              className="shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 font-medium text-fg transition hover:bg-pulse hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              Show me
            </button>
          )}
        </div>
      )}

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
