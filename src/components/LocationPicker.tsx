import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { getCurrentPosition } from '../lib/geo';
import { CloseIcon, LocationIcon } from './icons';
import './LocationPicker.css';

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

const DEFAULT_CENTER: [number, number] = [-14.235, -51.925];

export default function LocationPicker({ initialLat, initialLng, onConfirm, onClose }: LocationPickerProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!mapElRef.current || mapInstance.current) return;
    const hasInitial = initialLat != null && initialLng != null;
    const map = L.map(mapElRef.current, { zoomControl: false }).setView(
      hasInitial ? [initialLat!, initialLng!] : DEFAULT_CENTER,
      hasInitial ? 16 : 4
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.current = map;

    const invalidate = () => mapInstance.current?.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    const t = window.setTimeout(invalidate, 300);
    const resizeObserver = new ResizeObserver(invalidate);
    resizeObserver.observe(mapElRef.current);

    if (!hasInitial) {
      getCurrentPosition().then((pos) => {
        if (pos && mapInstance.current) {
          mapInstance.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      resizeObserver.disconnect();
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUseCurrentLocation() {
    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    if (pos && mapInstance.current) {
      mapInstance.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
    }
  }

  function handleConfirm() {
    const map = mapInstance.current;
    if (!map) return;
    const center = map.getCenter();
    onConfirm(center.lat, center.lng);
  }

  return createPortal(
    <div className="location-picker">
      <div ref={mapElRef} className="location-picker__map" />
      <div className="location-picker__pin" aria-hidden="true">
        <svg width="32" height="41" viewBox="0 0 30 38">
          <path
            d="M15 2C7.8 2 2 7.8 2 15c0 10.6 13 21 13 21s13-10.4 13-21C28 7.8 22.2 2 15 2z"
            fill="#3D4C8C"
          />
          <circle cx="15" cy="15" r="5.4" fill="#fff" />
        </svg>
      </div>

      <button type="button" className="location-picker__close glass-dark tap-target press" onClick={onClose} aria-label="Fechar">
        <CloseIcon size={20} />
      </button>

      <p className="location-picker__hint glass">Arraste o mapa para posicionar o pin</p>

      <div className="location-picker__panel glass">
        <button
          type="button"
          className="location-picker__locate press"
          onClick={handleUseCurrentLocation}
          disabled={locating}
        >
          <LocationIcon size={16} />
          {locating ? 'Localizando…' : 'Usar minha localização atual'}
        </button>
        <button type="button" className="location-picker__confirm press" onClick={handleConfirm}>
          Confirmar localização
        </button>
      </div>
    </div>,
    document.body
  );
}
