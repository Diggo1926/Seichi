import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdateToast.css';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // iOS costuma demorar para checar por conta própria; força a verificação
      // sempre que o app volta ao primeiro plano e periodicamente em background.
      registration.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
      window.setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL);
    },
  });

  if (!needRefresh) return null;

  return (
    <button type="button" className="update-toast glass press" onClick={() => updateServiceWorker(true)}>
      Nova versão disponível — toque para atualizar
    </button>
  );
}
