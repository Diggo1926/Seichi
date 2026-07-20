import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import L from 'leaflet';
import { db } from '../../db';
import type { Place, PlaceStatus } from '../../types';
import { STATUS_META } from '../../types';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { getCurrentPosition } from '../../lib/geo';
import './Mapa.css';

const STATUS_COLOR: Record<PlaceStatus, string> = {
  quero_visitar: '#3D4C8C',
  visitei: '#2F8C72',
  quero_voltar: '#D95B43',
};

function pinDivIcon(status: PlaceStatus, active: boolean) {
  const color = STATUS_COLOR[status];
  return L.divIcon({
    className: 'map-pin-icon',
    html: `<div class="map-pin${active ? ' map-pin--active' : ''}">
      <svg width="30" height="38" viewBox="0 0 30 38">
        <path d="M15 2C7.8 2 2 7.8 2 15c0 10.6 13 21 13 21s13-10.4 13-21C28 7.8 22.2 2 15 2z" fill="${color}"/>
        <circle cx="15" cy="15" r="5.4" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}

function MapCard({ place, active, register }: { place: Place; active: boolean; register: (el: HTMLAnchorElement | null) => void }) {
  const thumbUrl = usePhotoUrl(place.coverPhotoId, 'thumb');
  const meta = STATUS_META[place.status];
  return (
    <Link
      to={`/lugar/${place.id}`}
      ref={register}
      data-id={place.id}
      className={`mapa-card glass press${active ? ' mapa-card--active' : ''}`}
    >
      {thumbUrl && <img src={thumbUrl} alt="" />}
      <div className="mapa-card__body">
        <span className="mapa-card__name">{place.name || 'Rascunho'}</span>
        {place.address && <span className="mapa-card__address">{place.address}</span>}
        <span className="status-pill status-pill--sm" style={{ color: meta.color, background: meta.soft }}>
          {meta.label}
        </span>
      </div>
    </Link>
  );
}

export default function Mapa() {
  const places = useLiveQuery(() => db.places.toArray(), []);
  const navigate = useNavigate();

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const carouselRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const located = useMemo(() => (places ?? []).filter((p) => p.lat != null && p.lng != null), [places]);
  const unlocated = useMemo(() => (places ?? []).filter((p) => p.lat == null || p.lng == null), [places]);

  useEffect(() => {
    if (!online || !mapElRef.current || mapInstance.current) return;
    const map = L.map(mapElRef.current, { zoomControl: false }).setView([-14.235, -51.925], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.current = map;

    // O container pode ainda não ter altura definida no primeiro layout (ex.: barra
    // do Safari no iOS ainda se ajustando), então o mapa é recalculado algumas vezes
    // logo após a criação e sempre que o próprio container mudar de tamanho.
    const invalidate = () => mapInstance.current?.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    const t1 = window.setTimeout(invalidate, 300);
    const t2 = window.setTimeout(invalidate, 900);

    const resizeObserver = new ResizeObserver(invalidate);
    resizeObserver.observe(mapElRef.current);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      map.remove();
      mapInstance.current = null;
    };
  }, [online]);

  // Sem nenhum lugar com coordenadas ainda: centraliza na localização atual do
  // usuário (com permissão) em vez de deixar o mapa parado no centro do Brasil.
  useEffect(() => {
    if (!online || places === undefined || located.length > 0) return;
    const map = mapInstance.current;
    if (!map) return;
    let cancelled = false;
    getCurrentPosition().then((pos) => {
      if (cancelled || !pos) return;
      map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    });
    return () => {
      cancelled = true;
    };
  }, [online, places, located.length]);

  function flyTo(place: Place) {
    const map = mapInstance.current;
    if (!map) return;
    map.flyTo([place.lat!, place.lng!], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }

  function selectFromPin(id: string) {
    setActiveId(id);
    const place = located.find((p) => p.id === id);
    if (place) flyTo(place);
    isProgrammaticScroll.current = true;
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 500);
  }

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    located.forEach((place, i) => {
      const marker = L.marker([place.lat!, place.lng!], { icon: pinDivIcon(place.status, false) });
      marker.on('click', () => selectFromPin(place.id));
      marker.addTo(map);
      const el = marker.getElement();
      if (el) {
        el.style.animation = `drop-in 420ms var(--ease-spring) ${Math.min(i, 12) * 70}ms both`;
      }
      markersRef.current[place.id] = marker;
    });

    if (located.length > 0) {
      const bounds = L.latLngBounds(located.map((p) => [p.lat!, p.lng!] as [number, number]));
      map.fitBounds(bounds, { padding: [70, 90], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located]);

  useEffect(() => {
    located.forEach((place) => {
      markersRef.current[place.id]?.setIcon(pinDivIcon(place.status, place.id === activeId));
    });
  }, [activeId, located]);

  useEffect(() => {
    if (located.length > 0 && !activeId) setActiveId(located[0].id);
  }, [located, activeId]);

  useEffect(() => {
    const root = carouselRef.current;
    if (!root || located.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const id = (best.target as HTMLElement).dataset.id;
        if (!id || id === activeId) return;
        setActiveId(id);
        const place = located.find((p) => p.id === id);
        if (place) flyTo(place);
      },
      { root, threshold: [0.6, 0.9] }
    );

    Object.values(cardRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located]);

  if (places === undefined) return null;

  return (
    <div className="mapa-screen">
      <div ref={mapElRef} className="mapa-canvas" />

      {!online && (
        <div className="mapa-offline">
          <p>O mapa precisa de internet, mas seus lugares continuam aqui.</p>
          <button type="button" className="press" onClick={() => navigate('/galeria')}>
            Ir para a Galeria
          </button>
        </div>
      )}

      {online && (
        <>
          <div className="mapa-topbar glass">
            <span className="mapa-topbar__title">Seichi</span>
            <span className="mapa-topbar__count">{located.length} lugares</span>
          </div>

          <div className="mapa-legend">
            <span className="chip glass mapa-legend__item">
              <i style={{ background: STATUS_COLOR.quero_visitar }} />Quero
            </span>
            <span className="chip glass mapa-legend__item">
              <i style={{ background: STATUS_COLOR.visitei }} />Visitei
            </span>
            <span className="chip glass mapa-legend__item">
              <i style={{ background: STATUS_COLOR.quero_voltar }} />Voltar
            </span>
          </div>

          {unlocated.length > 0 && (
            <button type="button" className="mapa-unlocated glass press" onClick={() => navigate('/galeria')}>
              {unlocated.length} sem localização · completar na Galeria
            </button>
          )}

          {located.length === 0 && (
            <div className="mapa-empty glass">
              <p>Nenhum lugar com localização ainda.</p>
            </div>
          )}

          {located.length > 0 && (
            <div className="mapa-carousel" ref={carouselRef}>
              {located.map((place) => (
                <MapCard
                  key={place.id}
                  place={place}
                  active={place.id === activeId}
                  register={(el) => {
                    cardRefs.current[place.id] = el;
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
