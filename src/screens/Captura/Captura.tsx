import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import type { Place } from '../../types';
import { STATUS_META } from '../../types';
import { processImage } from '../../lib/image';
import { getCurrentPosition } from '../../lib/geo';
import { usePhotoUrl, useBlobUrl } from '../../hooks/usePhotoUrl';
import { CameraIcon, ImageIcon } from '../../components/icons';
import './Captura.css';

const SLIDE_INTERVAL = 4000;

function Slide({ place, active }: { place: Place; active: boolean }) {
  const url = usePhotoUrl(place.coverPhotoId, 'full');
  if (!url) return null;
  return (
    <div className={`capture-slide${active ? ' capture-slide--active' : ''}`}>
      <div className="capture-slide__img" style={{ backgroundImage: `url(${url})` }} />
    </div>
  );
}

export default function Captura() {
  const places = useLiveQuery(() => db.places.toArray(), []);
  const slides = useMemo(() => (places ?? []).filter((p) => p.coverPhotoId), [places]);

  const [index, setIndex] = useState(0);
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (slides.length < 2 || reducedMotion) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(t);
  }, [slides.length, reducedMotion]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const currentPlace = slides[index];

  const [name, setName] = useState('');
  const [pendingFile, setPendingFile] = useState<Blob | null>(null);
  const previewUrl = useBlobUrl(pendingFile ?? undefined);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmingLocation, setConfirmingLocation] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setSavedId(null);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
    e.target.value = '';
  }

  function discardPhoto() {
    setPendingFile(null);
  }

  function requestSave() {
    if (!pendingFile || saving) return;
    setConfirmingLocation(true);
  }

  async function handleSave(useCurrentLocation: boolean) {
    if (!pendingFile || saving) return;
    setConfirmingLocation(false);
    setSaving(true);
    try {
      const [{ full, thumb }, position] = await Promise.all([
        processImage(pendingFile),
        useCurrentLocation ? getCurrentPosition() : Promise.resolve(null),
      ]);

      const placeId = uuid();
      const photoId = uuid();
      const now = Date.now();
      const trimmedName = name.trim();

      const place: Place = {
        id: placeId,
        createdAt: now,
        updatedAt: now,
        name: trimmedName,
        status: 'quero_visitar',
        rating: null,
        notes: '',
        tags: [],
        isDraft: !trimmedName,
        coverPhotoId: photoId,
        lat: position?.coords.latitude,
        lng: position?.coords.longitude,
      };

      await db.transaction('rw', db.places, db.photos, async () => {
        await db.photos.add({ id: photoId, placeId, blob: full, thumbBlob: thumb, createdAt: now });
        await db.places.add(place);
      });

      setSavedId(placeId);
      setName('');
      setPendingFile(null);
    } finally {
      setSaving(false);
    }
  }

  const hasSlides = slides.length > 0;

  return (
    <div className="capture-screen">
      <div className="capture-bg">
        {hasSlides ? (
          slides.map((p, i) => <Slide key={p.id} place={p} active={i === index} />)
        ) : (
          <div className="capture-bg__fallback" />
        )}
        <div className="capture-bg__veil" />
      </div>

      {currentPlace && (
        <div className="capture-caption fade-up">
          <span className="capture-caption__name">{currentPlace.name || 'Rascunho'}</span>
          <span
            className="status-pill status-pill--sm"
            style={{ color: STATUS_META[currentPlace.status].color, background: STATUS_META[currentPlace.status].soft }}
          >
            {STATUS_META[currentPlace.status].label}
          </span>
        </div>
      )}

      <header className="capture-header">
        <h1>Seichi</h1>
        <p>Toda lembrança começa em algum lugar.</p>
      </header>

      <div className="capture-panel glass">
        {pendingFile && (
          <div className="capture-panel__preview">
            {previewUrl && <img src={previewUrl} alt="Prévia da foto" />}
            <button type="button" className="capture-panel__discard tap-target" onClick={discardPhoto} aria-label="Descartar foto">
              ×
            </button>
          </div>
        )}

        <input
          ref={nameInputRef}
          className="capture-panel__name"
          type="text"
          placeholder="Nome do lugar…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="capture-panel__actions">
          <button
            type="button"
            className="capture-panel__gallery tap-target press"
            onClick={() => galleryInputRef.current?.click()}
            aria-label="Escolher foto do rolo"
          >
            <ImageIcon size={22} />
          </button>

          <button
            type="button"
            className="capture-panel__shutter tap-target press"
            onClick={() => cameraInputRef.current?.click()}
            aria-label="Tirar foto"
          >
            <CameraIcon size={26} />
          </button>

          {pendingFile ? (
            <button
              type="button"
              className="capture-panel__save tap-target press"
              onClick={requestSave}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          ) : (
            <div className="capture-panel__spacer" />
          )}
        </div>

        <p className="capture-panel__microcopy">Salve agora. Detalhe depois.</p>

        {savedId && (
          <div className="capture-panel__confirm fade-up">
            <span>Lugar salvo ✓</span>
            <Link to={`/lugar/${savedId}`}>Ver lugar</Link>
          </div>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFilePicked}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFilePicked}
      />

      {confirmingLocation && (
        <div className="capture-locate">
          <div className="capture-locate__scrim" onClick={() => handleSave(false)} />
          <div className="capture-locate__card glass fade-up">
            <p className="capture-locate__title">Você está neste lugar agora?</p>
            <p className="capture-locate__hint">
              Isso grava sua localização atual como a posição deste lugar no mapa. Você pode definir
              ou ajustar isso depois, na tela do lugar.
            </p>
            <div className="capture-locate__actions">
              <button type="button" className="capture-locate__yes press" onClick={() => handleSave(true)}>
                Sim, estou aqui
              </button>
              <button type="button" className="capture-locate__no press" onClick={() => handleSave(false)}>
                Não / definir depois
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
