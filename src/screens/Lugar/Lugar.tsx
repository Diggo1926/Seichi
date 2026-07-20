import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import type { Photo, PlaceStatus } from '../../types';
import { STATUS_META, RATING_LABELS } from '../../types';
import { processImage } from '../../lib/image';
import { getCurrentPosition, googleMapsUrl } from '../../lib/geo';
import { useBlobUrl, usePhotoUrl } from '../../hooks/usePhotoUrl';
import { BackIcon, ExternalLinkIcon, PlusIcon, TrashIcon, CloseIcon, LocationIcon } from '../../components/icons';
import './Lugar.css';

const SHEET_HEIGHT_RATIO = 0.84;
const OPEN_VISIBLE_RATIO = 0.54;
const COLLAPSED_VISIBLE_PX = 118;

function PhotoSlide({ photo }: { photo: Photo }) {
  const url = useBlobUrl(photo.blob);
  return (
    <div className="lugar-photo-slide">
      {url && <div className="lugar-photo-slide__img" style={{ backgroundImage: `url(${url})` }} />}
    </div>
  );
}

function PhotoThumb({ photo }: { photo: Photo }) {
  const url = usePhotoUrl(photo.id, 'thumb');
  return <div className="lugar-photo-thumb">{url && <img src={url} alt="" />}</div>;
}

export default function Lugar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const place = useLiveQuery(() => (id ? db.places.get(id) : undefined), [id]);
  const photos = useLiveQuery(() => (id ? db.photos.where('placeId').equals(id).sortBy('createdAt') : []), [id]) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];

  const initializedRef = useRef(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [igDraft, setIgDraft] = useState('');

  useEffect(() => {
    if (place && !initializedRef.current) {
      setNameDraft(place.name);
      setAddressDraft(place.address ?? '');
      setNotesDraft(place.notes);
      setIgDraft(place.instagramUrl ?? '');
      initializedRef.current = true;
    }
  }, [place]);

  async function updatePlace(patch: Record<string, unknown>) {
    if (!id) return;
    await db.places.update(id, { ...patch, updatedAt: Date.now() });
  }

  function computeIsDraft(name: string, hasPhoto: boolean) {
    return !name.trim() || !hasPhoto;
  }

  function commitName() {
    if (!place) return;
    const trimmed = nameDraft.trim();
    updatePlace({ name: trimmed, isDraft: computeIsDraft(trimmed, photos.length > 0) });
  }

  function commitAddress() {
    updatePlace({ address: addressDraft.trim() || undefined });
  }

  function commitInstagram() {
    updatePlace({ instagramUrl: igDraft.trim() || undefined });
  }

  const notesTimer = useRef<number | undefined>(undefined);
  function onNotesChange(v: string) {
    setNotesDraft(v);
    window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => updatePlace({ notes: v }), 600);
  }

  async function handleUseCurrentLocation() {
    const pos = await getCurrentPosition();
    if (pos) updatePlace({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !place) return;
    const { full, thumb } = await processImage(file);
    const photoId = uuid();
    await db.transaction('rw', db.photos, db.places, async () => {
      await db.photos.add({ id: photoId, placeId: place.id, blob: full, thumbBlob: thumb, createdAt: Date.now() });
      if (!place.coverPhotoId) {
        await db.places.update(place.id, {
          coverPhotoId: photoId,
          isDraft: computeIsDraft(place.name, true),
          updatedAt: Date.now(),
        });
      }
    });
  }

  function setStatus(status: PlaceStatus) {
    updatePlace({ status });
  }

  function setRating(rating: number) {
    updatePlace({ rating: place?.rating === rating ? null : rating });
  }

  function toggleTag(tagId: string) {
    if (!place) return;
    const has = place.tags.includes(tagId);
    const next = has ? place.tags.filter((t) => t !== tagId) : [...place.tags, tagId];
    updatePlace({ tags: next });
  }

  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  async function handleCreateTag() {
    const label = tagInputValue.trim();
    if (!label || !place) return;
    const tagId = uuid();
    await db.tags.add({ id: tagId, label, builtin: false });
    await updatePlace({ tags: [...place.tags, tagId] });
    setTagInputValue('');
    setShowTagInput(false);
  }

  async function handleDeleteTag(tagId: string) {
    if (!window.confirm('Excluir esta tag de todos os lugares?')) return;
    const allPlaces = await db.places.toArray();
    await db.transaction('rw', db.tags, db.places, async () => {
      await db.tags.delete(tagId);
      for (const p of allPlaces) {
        if (p.tags.includes(tagId)) {
          await db.places.update(p.id, { tags: p.tags.filter((t) => t !== tagId) });
        }
      }
    });
  }

  async function handleDeletePlace() {
    if (!place) return;
    if (!window.confirm('Excluir este lugar e todas as suas fotos? Essa ação não pode ser desfeita.')) return;
    await db.transaction('rw', db.places, db.photos, async () => {
      await db.photos.where('placeId').equals(place.id).delete();
      await db.places.delete(place.id);
    });
    navigate('/galeria');
  }

  // ---- photo carousel ----
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  function onPhotosScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setPhotoIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  // ---- draggable bottom sheet ----
  const [sheetState, setSheetState] = useState<'open' | 'collapsed'>('open');
  const [dragY, setDragY] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const dragStartClientY = useRef(0);
  const dragStartTranslate = useRef(0);
  const lastDelta = useRef(0);

  const viewportH = useMemo(() => window.innerHeight, []);
  const sheetHeight = viewportH * SHEET_HEIGHT_RATIO;
  const openY = sheetHeight - viewportH * OPEN_VISIBLE_RATIO;
  const collapsedY = sheetHeight - COLLAPSED_VISIBLE_PX;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function onHandlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStartClientY.current = e.clientY;
    dragStartTranslate.current = sheetState === 'open' ? openY : collapsedY;
    lastDelta.current = 0;
    setDragging(true);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientY - dragStartClientY.current;
    lastDelta.current = delta;
    const next = Math.min(collapsedY, Math.max(openY, dragStartTranslate.current + delta));
    setDragY(next);
  }

  function onHandlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(lastDelta.current) < 6) {
      setSheetState((s) => (s === 'collapsed' ? 'open' : s));
    } else {
      const current = dragY ?? (sheetState === 'open' ? openY : collapsedY);
      const mid = (openY + collapsedY) / 2;
      setSheetState(current < mid ? 'open' : 'collapsed');
    }
    setDragY(null);
  }

  function stopDragPropagation(e: React.PointerEvent) {
    e.stopPropagation();
  }

  if (!place) return null;

  const y = dragY ?? (sheetState === 'open' ? openY : collapsedY);
  const translateY = entered ? y : sheetHeight;
  const meta = STATUS_META[place.status];

  return (
    <div className="lugar-screen">
      <div className="lugar-photos" ref={scrollerRef} onScroll={onPhotosScroll}>
        {photos.length > 0 ? (
          photos.map((p) => <PhotoSlide key={p.id} photo={p} />)
        ) : (
          <div className="lugar-photo-slide lugar-photo-slide--empty" />
        )}
      </div>
      <div className="lugar-photos__veil" />

      {photos.length > 1 && (
        <div className="lugar-dots">
          {photos.map((p, i) => (
            <span key={p.id} className={`lugar-dot${i === photoIndex ? ' lugar-dot--active' : ''}`} />
          ))}
        </div>
      )}

      <button type="button" className="lugar-back glass-dark tap-target press" onClick={() => navigate(-1)} aria-label="Voltar">
        <BackIcon size={20} />
      </button>

      <div
        className="lugar-sheet"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: dragging || !entered ? 'none' : `transform ${entered ? 420 : 0}ms var(--ease-spring)`,
          height: sheetHeight,
        }}
      >
        <div
          className="lugar-sheet__drag"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="lugar-sheet__handle" />
          <input
            className="lugar-sheet__name"
            value={nameDraft}
            placeholder="Nome do lugar"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onPointerDown={stopDragPropagation}
          />
          <div className="lugar-sheet__address-row">
            <input
              className="lugar-sheet__address"
              value={addressDraft}
              placeholder="Endereço (opcional)"
              onChange={(e) => setAddressDraft(e.target.value)}
              onBlur={commitAddress}
              onPointerDown={stopDragPropagation}
            />
            <span className="status-pill status-pill--sm" style={{ color: meta.color, background: meta.soft }}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="lugar-sheet__body">
          <a
            href={googleMapsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="lugar-maps-btn glass press fade-up"
            style={{ animationDelay: '0ms' }}
          >
            <ExternalLinkIcon size={18} />
            Abrir no Google Maps
          </a>

          <button
            type="button"
            className="lugar-location-btn press fade-up"
            style={{ animationDelay: '30ms' }}
            onClick={handleUseCurrentLocation}
          >
            <LocationIcon size={16} />
            Usar minha localização atual
          </button>

          <section className="lugar-section fade-up" style={{ animationDelay: '60ms' }}>
            <h3>Fotos</h3>
            <div className="lugar-photo-strip">
              {photos.map((p) => (
                <PhotoThumb key={p.id} photo={p} />
              ))}
              <button
                type="button"
                className="lugar-photo-add tap-target press"
                onClick={() => addPhotoInputRef.current?.click()}
              >
                <PlusIcon size={20} />
                <span>Adicionar</span>
              </button>
            </div>
            <input
              ref={addPhotoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAddPhoto}
            />
          </section>

          <section className="lugar-section fade-up" style={{ animationDelay: '100ms' }}>
            <h3>Status</h3>
            <div className="lugar-status-row">
              {(Object.keys(STATUS_META) as PlaceStatus[]).map((status) => {
                const active = place.status === status;
                const m = STATUS_META[status];
                return (
                  <button
                    key={status}
                    type="button"
                    className={`chip press${active ? ' chip--status-active' : ' glass'}`}
                    style={active ? { background: m.soft, color: m.color } : undefined}
                    onClick={() => setStatus(status)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="lugar-section fade-up" style={{ animationDelay: '140ms' }}>
            <h3>Avaliação</h3>
            <div className="lugar-rating-list">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = place.rating === n;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`lugar-rating-item press${active ? ' lugar-rating-item--active' : ''}`}
                    onClick={() => setRating(n)}
                  >
                    <span className="lugar-rating-item__num">{n}</span>
                    <span>{RATING_LABELS[n]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="lugar-section fade-up" style={{ animationDelay: '180ms' }}>
            <h3>Notas</h3>
            <textarea
              className="lugar-notes"
              value={notesDraft}
              placeholder="Escreva livremente sobre esse lugar…"
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
            />
          </section>

          <section className="lugar-section fade-up" style={{ animationDelay: '220ms' }}>
            <h3>Link do Instagram</h3>
            <input
              className="lugar-instagram"
              value={igDraft}
              placeholder="Cole o link do post…"
              onChange={(e) => setIgDraft(e.target.value)}
              onBlur={commitInstagram}
            />
          </section>

          <section className="lugar-section fade-up" style={{ animationDelay: '260ms' }}>
            <h3>Tags</h3>
            <div className="lugar-tags-row">
              {tags.map((tag) => {
                const active = place.tags.includes(tag.id);
                return (
                  <span
                    key={tag.id}
                    className={`chip press${active ? ' chip--active' : ' glass'}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.label}
                    {!tag.builtin && (
                      <button
                        type="button"
                        className="lugar-tag-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTag(tag.id);
                        }}
                        aria-label={`Excluir tag ${tag.label}`}
                      >
                        <CloseIcon size={12} />
                      </button>
                    )}
                  </span>
                );
              })}
              {showTagInput ? (
                <span className="lugar-tag-new-form">
                  <input
                    autoFocus
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    placeholder="Nova tag"
                  />
                  <button type="button" onClick={handleCreateTag}>OK</button>
                </span>
              ) : (
                <button type="button" className="chip glass press" onClick={() => setShowTagInput(true)}>
                  + Nova tag
                </button>
              )}
            </div>
          </section>

          <button type="button" className="lugar-delete press fade-up" style={{ animationDelay: '300ms' }} onClick={handleDeletePlace}>
            <TrashIcon size={16} />
            Excluir lugar
          </button>
        </div>
      </div>
    </div>
  );
}
