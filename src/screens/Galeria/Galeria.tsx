import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Place, PlaceStatus } from '../../types';
import { STATUS_META } from '../../types';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { MenuIcon } from '../../components/icons';
import './Galeria.css';

type Filter = 'all' | 'drafts' | { type: 'tag'; id: string } | { type: 'status'; status: PlaceStatus };

function filterKey(f: Filter): string {
  if (f === 'all') return 'all';
  if (f === 'drafts') return 'drafts';
  if (f.type === 'tag') return `tag:${f.id}`;
  return `status:${f.status}`;
}

function GalleryTile({ place, index }: { place: Place; index: number }) {
  const thumbUrl = usePhotoUrl(place.coverPhotoId, 'thumb');
  const large = index % 5 === 0;
  const meta = STATUS_META[place.status];

  return (
    <Link
      to={`/lugar/${place.id}`}
      className={`gallery-tile press fade-up${large ? ' gallery-tile--large' : ''}`}
      style={{ animationDelay: `${Math.min(index, 16) * 50}ms` }}
    >
      {thumbUrl && <img src={thumbUrl} alt="" loading="lazy" />}
      <div className="gallery-tile__veil" />
      <div className="gallery-tile__info">
        <span className="gallery-tile__name">{place.name || 'Rascunho'}</span>
        <span
          className="status-pill status-pill--sm"
          style={{ color: meta.color, background: meta.soft }}
        >
          {meta.label}
        </span>
      </div>
    </Link>
  );
}

export default function Galeria() {
  const places = useLiveQuery(() => db.places.orderBy('createdAt').reverse().toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');

  const drafts = useMemo(() => (places ?? []).filter((p) => p.isDraft), [places]);

  const visiblePlaces = useMemo(() => {
    const all = places ?? [];
    if (filter === 'all') return all.filter((p) => !p.isDraft);
    if (filter === 'drafts') return drafts;
    if (filter.type === 'tag') return all.filter((p) => !p.isDraft && p.tags.includes(filter.id));
    return all.filter((p) => !p.isDraft && p.status === filter.status);
  }, [places, filter, drafts]);

  const wantCount = useMemo(
    () => (places ?? []).filter((p) => p.status === 'quero_visitar').length,
    [places]
  );

  if (places === undefined) return null;

  return (
    <div className="gallery-screen">
      <header className="gallery-header">
        <h1>Seichi</h1>
        <button type="button" className="gallery-header__menu tap-target glass" onClick={() => navigate('/config')} aria-label="Ajustes">
          <MenuIcon size={20} />
        </button>
      </header>

      <div className="gallery-filters">
        {drafts.length > 0 && (
          <button
            type="button"
            className={`chip glass press${filterKey(filter) === 'drafts' ? ' chip--active' : ''}`}
            onClick={() => setFilter('drafts')}
          >
            Rascunhos · {drafts.length}
          </button>
        )}
        <button
          type="button"
          className={`chip glass press${filterKey(filter) === 'all' ? ' chip--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        {(Object.keys(STATUS_META) as PlaceStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            className={`chip glass press${filterKey(filter) === `status:${status}` ? ' chip--active' : ''}`}
            onClick={() => setFilter({ type: 'status', status })}
          >
            {STATUS_META[status].label}
          </button>
        ))}
        {(tags ?? []).map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`chip glass press${filterKey(filter) === `tag:${tag.id}` ? ' chip--active' : ''}`}
            onClick={() => setFilter({ type: 'tag', id: tag.id })}
          >
            {tag.label}
          </button>
        ))}
      </div>

      <div className="gallery-count">
        {places.filter((p) => !p.isDraft).length} lugares · {wantCount} quero visitar
      </div>

      {visiblePlaces.length === 0 ? (
        <div className="gallery-empty">
          <p>{filter === 'drafts' ? 'Nenhum rascunho por aqui.' : 'Nenhum lugar salvo ainda.'}</p>
          {filter !== 'drafts' && (
            <>
              <p className="gallery-empty__hint">Comece salvando o primeiro lugar bonito que você encontrar.</p>
              <Link to="/" className="gallery-empty__cta press">Salvar um lugar</Link>
            </>
          )}
        </div>
      ) : (
        <div className="gallery-grid">
          {visiblePlaces.map((place, i) => (
            <GalleryTile key={place.id} place={place} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
