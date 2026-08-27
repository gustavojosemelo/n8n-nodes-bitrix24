import '@shopify/polaris/build/esm/styles.css';
import { AppProvider } from '@shopify/polaris';
import ptBR from '@shopify/polaris/locales/pt-BR.json';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');

createRoot(container).render(
  <React.StrictMode>
    <AppProvider i18n={ptBR}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>,
);
