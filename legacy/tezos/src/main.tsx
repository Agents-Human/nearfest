import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

declare global {
  namespace JSX {
      interface IntrinsicElements {
          'io-print-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      }
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);