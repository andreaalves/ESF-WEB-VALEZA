import React from "react";
import ReactDOM from "react-dom";

import { App } from "./App";

// Segurança: em produção, silencia logs de depuração para não vazar dados
// sensíveis (respostas da API, dados de usuário) no console do navegador.
// console.error é mantido para erros reais de runtime.
if (process.env.NODE_ENV === "production") {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
}

ReactDOM.render(
  <>
    {/* <React.StrictMode> */}
    <App />
    {/* </React.StrictMode> */}
  </>,
  document.getElementById("root")
);
