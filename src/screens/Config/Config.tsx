import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportBackup, importBackup } from '../../lib/backup';
import { BackIcon } from '../../components/icons';
import './Config.css';

export default function Config() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      await exportBackup();
      setMessage('Backup exportado com sucesso.');
    } catch {
      setMessage('Não foi possível gerar o backup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await importBackup(file);
      setMessage(`Importado: ${result.places} lugares, ${result.photos} fotos, ${result.tags} tags novas.`);
    } catch {
      setMessage('Arquivo de backup inválido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="config-screen">
      <header className="config-header">
        <button type="button" className="tap-target press" onClick={() => navigate(-1)} aria-label="Voltar">
          <BackIcon size={20} />
        </button>
        <h1>Ajustes</h1>
        <span className="config-header__spacer" />
      </header>

      <section className="config-section">
        <h2>Backup</h2>
        <p className="config-section__hint">
          Seus lugares e fotos vivem só neste aparelho. Faça backup regularmente — é a única
          proteção contra troca de celular ou perda do dispositivo.
        </p>

        <button type="button" className="config-btn config-btn--primary press" onClick={handleExport} disabled={busy}>
          Exportar backup (.zip)
        </button>

        <button
          type="button"
          className="config-btn config-btn--secondary press"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          Importar backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        {message && <p className="config-message fade-up">{message}</p>}
      </section>

      <section className="config-section">
        <h2>Sobre</h2>
        <p className="config-section__hint">Seichi — toda lembrança começa em algum lugar.</p>
      </section>
    </div>
  );
}
