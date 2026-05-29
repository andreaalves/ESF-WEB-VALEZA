import { useState, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { MdQrCode, MdDelete, MdCameraAlt, MdSend, MdArrowBack } from "react-icons/md";
import "./apontamento.css";

interface Material { id: number; nome: string; codigo: string; }
interface Foto { id: number; url: string; }

export default function ApontamentoContent() {
  const history = useHistory();
  const location = useLocation();
  const agendamento = (location.state as any)?.agendamento;

  const [materiais, setMateriais] = useState<Material[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [inputMaterial, setInputMaterial] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function simularLeituraQR() {
    setMateriais((prev) => [
      ...prev,
      { id: Date.now(), nome: "Micromola 3mm x 4cm", codigo: `MOL-00${prev.length + 1}` },
    ]);
  }

  function adicionarMaterial() {
    if (!inputMaterial.trim()) return;
    setMateriais((prev) => [
      ...prev,
      { id: Date.now(), nome: inputMaterial.trim(), codigo: `MAT-${String(Date.now()).slice(-4)}` },
    ]);
    setInputMaterial("");
  }

  function removerMaterial(id: number) {
    setMateriais((prev) => prev.filter((m) => m.id !== id));
  }

  function handleFotoChange(e: any) {
    Array.from(e.target.files as FileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFotos((prev) => [...prev, { id: Date.now() + Math.random(), url: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removerFoto(id: number) {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  function finalizarApontamento() {
    history.push("/listar/agendamento");
  }

  const podeEnviar = materiais.length > 0 || fotos.length > 0;

  return (
    <div className="page-apontamento">
      {/* Header azul */}
      <div className="page-top-bar">
        <button type="button" className="btn-back" onClick={() => history.push("/listar/agendamento")}>
          <MdArrowBack />
        </button>
        <h2>APONTAMENTO DE MATERIAL</h2>
      </div>

      <div className="container-apontamento">
        {/* Resumo */}
        {agendamento && (
          <div className="header-resumo">
            <h3>{agendamento._cliente || agendamento?.clientes?.fantasia || "Hospital"}</h3>
            <p><b>Paciente:</b> {agendamento.paciente || "N/A"}</p>
            <p><b>Médico:</b> {agendamento._medico || agendamento?.medico?.nome || "N/A"}</p>
          </div>
        )}

        {/* Materiais utilizados */}
        <div className="card-section">
          <span className="section-title">UTILIZADOS NA CIRURGIA</span>

          {/* Botão scan */}
          <div className="scan-area" onClick={simularLeituraQR}>
            <MdQrCode className="scan-icon" />
            <span>LER ETIQUETA / QR CODE</span>
          </div>

          {/* Input manual */}
          <div className="input-row">
            <input
              className="input-material"
              placeholder="Digitar nome do material..."
              value={inputMaterial}
              onChange={(e: any) => setInputMaterial(e.target.value)}
              onKeyDown={(e: any) => e.key === "Enter" && adicionarMaterial()}
            />
            <button type="button" className="btn-add" onClick={adicionarMaterial}>
              Adicionar
            </button>
          </div>

          {/* Lista */}
          <div className="list-materiais">
            {materiais.length === 0 ? (
              <p className="empty-msg">Nenhum material bipado no momento.</p>
            ) : (
              materiais.map((m) => (
                <div key={m.id} className="mat-item">
                  <div className="mat-info">
                    <span className="nome">{m.nome}</span>
                    <span className="cod">{m.codigo}</span>
                  </div>
                  <button type="button" className="btn-remove" onClick={() => removerMaterial(m.id)}>
                    <MdDelete />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fotos */}
        <div className="card-section">
          <span className="section-title">FOTOS DO CONSUMO (ETIQUETAS/FOLHA)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFotoChange}
          />
          <div className="photo-grid">
            <div className="add-photo-btn" onClick={() => fileInputRef.current?.click()}>
              <MdCameraAlt className="camera-icon" />
              <span>ANEXAR FOTO</span>
            </div>
            {fotos.map((f) => (
              <div key={f.id} className="photo-item">
                <img src={f.url} alt="material" />
                <button type="button" className="btn-remove-foto" onClick={() => removerFoto(f.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Botão finalizar */}
        <button
          type="button"
          className="btn-finalizar"
          disabled={!podeEnviar}
          onClick={finalizarApontamento}
        >
          <MdSend /> FINALIZAR E ENVIAR AO FATURAMENTO
        </button>
      </div>
    </div>
  );
}
