import React from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.jsx";
import "./styles.css";

// Auth0 settings come from .env (Vite only exposes variables that start with VITE_).
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

const root = createRoot(document.getElementById("root"));

if (!domain || !clientId || !audience) {
  root.render(
    <p style={{ padding: "2rem", color: "#ffb454", fontFamily: "monospace" }}>
      Auth0 isn't set up yet. Add VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE to .env, then restart.
    </p>
  );
} else {
  root.render(
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        // Must match the Allowed Callback URL in the Auth0 dashboard exactly (including the trailing slash).
        redirect_uri: window.location.origin + "/",
        // Asks Auth0 for a token our server will accept.
        audience,
      }}
      // Remember the login across page refreshes.
      cacheLocation="localstorage"
    >
      <App />
    </Auth0Provider>
  );
}

// Offline app shell. Only active in the built version (npm run build), not in dev mode.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
