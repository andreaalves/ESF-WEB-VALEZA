import { useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { MdArrowBack, MdCall, MdChat, MdMap, MdCheckCircle, MdLocationOn } from "react-icons/md";
import "leaflet/dist/leaflet.css";
import "./rastreamento.css";

const ORIGEM: [number, number] = [-15.8050, -47.9350];
const DESTINO: [number, number] = [-15.8606, -48.0415];
const ETA_INICIAL = 15;
const STEP_LABELS = ["Coletado", "Em rota", "Chegando", "Entregue"];
const STEP_ICONS = ["📦", "🚐", "📍", "✅"];

function interpolar(a: [number, number], b: [number, number], n: number): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => [
    a[0] + (b[0] - a[0]) * (i / n),
    a[1] + (b[1] - a[1]) * (i / n),
  ] as [number, number]);
}

export default function RastreamentoContent() {
  const history = useHistory();
  const location = useLocation();
  const state = location.state as any;
  const nomeHospital: string = state?.nomeHospital || "Hospital";
  const notaFiscal: string = state?.notaFiscal || "";

  const mapaRef = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState(1);
  const [etaMinutos, setEtaMinutos] = useState(ETA_INICIAL);
  const [carregandoRota, setCarregandoRota] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("agora");

  useEffect(() => {
    let mapInstance: any = null;
    let intervalo: any = null;
    let timerInterval: any = null;
    let segundos = 0;

    (async () => {
      const L = await import("leaflet");
      if (!mapaRef.current) return;

      mapInstance = L.map(mapaRef.current, { center: ORIGEM, zoom: 13, zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapInstance);

      const iconeMotorista = L.divIcon({ html: '<div class="marker-motorista">🚐</div>', className: "", iconSize: [40, 40], iconAnchor: [20, 20] });
      const iconeDestino = L.divIcon({ html: '<div class="marker-destino">🏥</div>', className: "", iconSize: [40, 40], iconAnchor: [20, 40] });

      const marcador = L.marker(ORIGEM, { icon: iconeMotorista }).addTo(mapInstance);
      L.marker(DESTINO, { icon: iconeDestino }).bindPopup(`<b>${nomeHospital}</b>`, { closeButton: false }).addTo(mapInstance).openPopup();

      const linhaConcluida = L.polyline([], { color: "#0b3260", weight: 5 }).addTo(mapInstance);
      const linhaRestante = L.polyline([], { color: "#bdbdbd", weight: 5, dashArray: "8, 6" }).addTo(mapInstance);

      let rota: [number, number][] = interpolar(ORIGEM, DESTINO, 60);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${ORIGEM[1]},${ORIGEM[0]};${DESTINO[1]},${DESTINO[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        rota = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
      } catch { /* usa fallback */ }

      linhaRestante.setLatLngs(rota);
      mapInstance.fitBounds(L.latLngBounds(rota), { padding: [40, 40] });
      setCarregandoRota(false);

      let pos = 0;
      const total = rota.length - 1;
      intervalo = setInterval(() => {
        if (pos >= total) { clearInterval(intervalo); setFase(4); return; }
        pos++;
        const ponto = rota[pos];
        const progresso = pos / total;
        marcador.setLatLng(ponto);
        mapInstance.panTo(ponto, { animate: true, duration: 0.3 });
        linhaConcluida.setLatLngs(rota.slice(0, pos + 1));
        linhaRestante.setLatLngs(rota.slice(pos));
        setEtaMinutos(Math.max(1, Math.round(ETA_INICIAL * (1 - progresso))));
        segundos = 0;
        setUltimaAtualizacao("agora");
        if (progresso < 0.15) setFase(1);
        else if (progresso < 0.80) setFase(2);
        else setFase(3);
      }, 400);

      timerInterval = setInterval(() => {
        segundos++;
        setUltimaAtualizacao(segundos < 60 ? `há ${segundos}s` : `há ${Math.floor(segundos / 60)}min`);
      }, 1000);
    })();

    return () => {
      if (intervalo) clearInterval(intervalo);
      if (timerInterval) clearInterval(timerInterval);
      if (mapInstance) mapInstance.remove();
    };
  }, [nomeHospital]);

  return (
    <div className="page-rastreamento">
      {/* Header azul */}
      <div className="page-top-bar">
        <button type="button" className="btn-back" onClick={() => history.goBack()}>
          <MdArrowBack />
        </button>
        <h2>ACOMPANHAR ENTREGA</h2>
        {fase < 4 && <span className="ultima-atualizacao">{ultimaAtualizacao}</span>}
      </div>

      {/* Mapa */}
      <div className="mapa-container">
        <div ref={mapaRef} style={{ width: "100%", height: "100%" }} />
        {carregandoRota && (
          <div className="overlay-loading">
            <span>Calculando rota...</span>
          </div>
        )}
      </div>

      {/* Drawer inferior */}
      <div className="drawer-entrega">

        {/* ETA */}
        {fase < 4 ? (
          <div className="eta-block">
            <div className="eta-numero-wrap">
              <span className="eta-numero">{etaMinutos}</span>
              <span className="eta-unidade">min</span>
            </div>
            <span className="eta-label">previsão de chegada</span>
          </div>
        ) : (
          <div className="eta-entregue">
            <MdCheckCircle className="icon-ok" />
            <span>Material entregue com sucesso!</span>
          </div>
        )}

        {/* Step tracker */}
        <div className="step-tracker">
          {STEP_LABELS.map((label, i) => {
            const idx = i + 1;
            const done = fase > idx;
            const active = fase === idx;
            return (
              <div key={label} style={{ display: "contents" }}>
                <div className={`step-item${done ? " done" : ""}${active ? " active" : ""}`}>
                  <div className="step-circle">
                    {done ? "✓" : STEP_ICONS[i]}
                  </div>
                  <span>{label}</span>
                </div>
                {i < 3 && <div className={`step-line${done ? " done" : ""}`} />}
              </div>
            );
          })}
        </div>

        <div className="divider" />

        {/* Destino */}
        <div className="destino-destaque">
          <MdLocationOn className="destino-icon" style={{ color: "#d32f2f" }} />
          <div className="destino-info">
            <span className="destino-label">DESTINO</span>
            <span className="destino-nome">{nomeHospital}</span>
          </div>
          {notaFiscal && <span className="nf-pill">NF {notaFiscal}</span>}
        </div>

        {/* Motorista */}
        <div className="motorista-row">
          <div className="motorista-avatar">🚐</div>
          <div className="motorista-info">
            <span className="motorista-nome">Francisco</span>
            <span className="motorista-veiculo">Fiat Fiorino • Branco</span>
          </div>
          {fase < 4 && (
            <div className="motorista-badge">
              <div className="bolinha-ping" />
              <span>AO VIVO</span>
            </div>
          )}
        </div>

        {/* CTAs */}
        {fase < 4 && (
          <div className="cta-row">
            <button type="button" className="cta-btn cta-ligar" onClick={() => { window.location.href = "tel:+5561999999999"; }}>
              <MdCall className="cta-icon" />
              <span>Ligar</span>
            </button>
            <button type="button" className="cta-btn cta-chat" onClick={() => window.open("https://wa.me/5561999999999", "_blank")}>
              <MdChat className="cta-icon" />
              <span>Chat</span>
            </button>
            <button type="button" className="cta-btn cta-rota" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${DESTINO[0]},${DESTINO[1]}`, "_blank")}>
              <MdMap className="cta-icon" />
              <span>Ver rota</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
