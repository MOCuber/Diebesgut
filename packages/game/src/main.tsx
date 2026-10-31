import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { requestPersistentStorage } from './storage';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Offline-Betrieb: Nur das erste Laden braucht Internet, danach läuft alles aus dem Cache.
registerSW({ immediate: true });
void requestPersistentStorage();
