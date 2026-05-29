import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  MdOutlineBusiness, MdPersonOutline, MdMedicalServices,
  MdReceiptLong, MdLocalShipping, MdArrowBack, MdLocationOn, MdCalendarToday,
} from "react-icons/md";
import api from "../../service/api";
import "./agendamento-detail.css";

function getStepIndex(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "ENTREGUE") return 4;
  if (s === "FATURADO") return 3;
  if (s === "EM SEPARAÇÃO" || s === "SEPARACAO" || s === "ENVIADO") return 2;
  return 1;
}

const STEPS = ["Agendado", "Separação", "Nota Fiscal", "Entregue"];

export default function AgendamentoDetailContent() {
  const history = useHistory();
  const location = useLocation();
  const locationState = location.state as any;
  const agendamento = locationState?.agendamento;

  const [materiais, setMateriais] = useState<any[]>([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);

  useEffect(() => {
    if (!agendamento) { history.push("/listar/agendamento"); return; }
    const pedidoId = agendamento?.pedido?.pedido_id || agendamento?.pedidoId;
    if (!pedidoId) return;
    setLoadingMateriais(true);
    api.get(`/api-essencial/v1/pedidos/${pedidoId}`)
      .then((res) => {
        const itens = res.data?.data?.item_pedido || [];
        setMateriais(itens.map((item: any) => ({
          nome: item.produtos?.nome || item.produto_id,
          codigo: item.produtos?.codigo || item.produtos?.referencia || "-",
          qtd: item.quantidade || 1,
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingMateriais(false));
  }, [agendamento, history]);

  if (!agendamento) return null;

  const status = agendamento._status || agendamento?.pedido?.situacao || "AGENDADO";
  const stepAtual = getStepIndex(status);
  const cancelado = status === "CANCELADO" || status === "CANCELADO_ERP";
  const erro = status === "ERRO_INTEGRACAO";
  const isFaturado = status === "FATURADO" || status === "ENVIADO";
  const hasERP = !!agendamento?.pedido?.pedido_erp;
  const hasNF = !!agendamento?.pedido?.nota_erp;

  const bannerClass = `status-banner${
    agendamento.tipo === "URGENCIA" ? " urgencia-banner" :
    cancelado ? " cancelado-banner" :
    erro ? " erro-banner" :
    hasERP ? " agendado-banner" : ""
  }`;

  return (
    <div className="page-agendamento-detail">
      {/* Header azul */}
      <div className="page-top-bar">
        <button type="button" className="btn-back" onClick={() => history.push("/listar/agendamento")}>
          <MdArrowBack />
        </button>
        <h2>DETALHES DA CIRURGIA</h2>
      </div>

      {/* Workflow */}
      {!cancelado && !erro && (
        <div className="workflow-container">
          <div className="workflow-line" />
          {STEPS.map((label, i) => {
            const idx = i + 1;
            const isActive = stepAtual >= idx;
            return (
              <div key={label} className={`step${isActive ? " active" : ""}`}>
                <div className="circle">{idx}</div>
                <span className="step-label">{label}</span>
              </div>
            );
          })}
        </div>
      )}
      {cancelado && (
        <div className="workflow-container">
          <div className="step cancelado">
            <div className="circle">✕</div>
            <span className="step-label">Cancelado</span>
          </div>
        </div>
      )}

      {/* Banner de status */}
      <div className={bannerClass}>
        <div className="status-info">
          <span className="status-text">
            {cancelado ? "❌ CANCELADO" : erro ? "⚠️ ERRO DE INTEGRAÇÃO" : status}
          </span>
          {agendamento.tipo === "URGENCIA" && <span className="tipo-tag">🚨 URGÊNCIA</span>}
          {agendamento.tipo === "ELETIVO" && <span className="tipo-tag">📅 ELETIVO</span>}
        </div>
        <div className="data-hora">
          <span className="data">
            {agendamento.data_agendamento ? new Date(agendamento.data_agendamento).toLocaleDateString("pt-BR") : ""}
          </span>
          <span className="hora">{agendamento.hora_agendamento}</span>
        </div>
      </div>

      {/* Local e Paciente */}
      <div className="card-section-detail">
        <span className="section-title">LOCAL E PACIENTE</span>
        <div className="info-group">
          <MdOutlineBusiness className="info-icon" />
          <div className="info-content">
            <label>HOSPITAL</label>
            <span className="value">{agendamento._cliente || agendamento?.clientes?.fantasia || "N/A"}</span>
          </div>
        </div>
        <div className="info-group">
          <MdPersonOutline className="info-icon" />
          <div className="info-content">
            <label>PACIENTE</label>
            <span className="value">{agendamento.paciente || "Não informado"}</span>
          </div>
        </div>
        <div className="info-group">
          <MdMedicalServices className="info-icon" />
          <div className="info-content">
            <label>CONVÊNIO</label>
            <span className="value">{agendamento._convenio || agendamento?.convenio?.descricao || "Não informado"}</span>
          </div>
        </div>
      </div>

      {/* Logística */}
      {(hasERP || hasNF) && (
        <div className="card-section-detail">
          <span className="section-title">LOGÍSTICA E ENTREGA</span>
          {hasERP && (
            <div className="info-group">
              <MdReceiptLong className="info-icon" />
              <div className="info-content">
                <label>Nº PEDIDO</label>
                <span className="value">{agendamento.pedido.pedido_erp}</span>
              </div>
            </div>
          )}
          {hasNF && (
            <div className="info-group">
              <MdLocalShipping className="info-icon" />
              <div className="info-content">
                <label>NÚMERO DA NOTA (NF-E)</label>
                <span className="value">{agendamento.pedido.nota_erp}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Equipe */}
      <div className="card-section-detail">
        <span className="section-title">EQUIPE</span>
        <div className="info-group">
          <MdMedicalServices className="info-icon" />
          <div className="info-content">
            <label>MÉDICO(A)</label>
            <span className="value">{agendamento._medico || agendamento?.medico?.nome || "N/A"}</span>
          </div>
        </div>
        <div className="info-group">
          <MdPersonOutline className="info-icon" />
          <div className="info-content">
            <label>VENDEDOR(A)</label>
            <span className="value">{agendamento.vendedor || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Materiais */}
      <div className="card-section-detail">
        <span className="section-title">MATERIAIS E KITS</span>
        {loadingMateriais ? (
          <p className="empty-mat">Carregando materiais...</p>
        ) : materiais.length === 0 ? (
          <p className="empty-mat">Nenhum material listado individualmente.</p>
        ) : (
          materiais.map((m, i) => (
            <div key={i} className="material-item-detail">
              <div>
                <div className="mat-nome">{m.nome}</div>
                <div className="mat-cod">{m.codigo}</div>
              </div>
              <span className="mat-qtd">{m.qtd} un</span>
            </div>
          ))
        )}
      </div>

      {/* Observações */}
      {agendamento.observacoes && (
        <div className="card-section-detail">
          <span className="section-title">OBSERVAÇÕES ADICIONAIS</span>
          <p className="obs-text">{agendamento.observacoes}</p>
        </div>
      )}

      {/* Ações */}
      <div className="actions">
        {!isFaturado && !cancelado && !erro && (
          <button type="button" className="btn-main" onClick={() => history.push("/listar/agendamento")}>
            <MdCalendarToday /> VER NO MAPA CIRÚRGICO
          </button>
        )}
        {isFaturado && (
          <button type="button" className="btn-rastrear"
            onClick={() => history.push("/rastreamento", {
              nomeHospital: agendamento._cliente,
              notaFiscal: agendamento?.pedido?.nota_erp,
            })}
          >
            <MdLocationOn /> ACOMPANHAR ENTREGA
          </button>
        )}
        {status === "ENTREGUE" && (
          <button type="button" className="btn-apontar"
            onClick={() => history.push("/apontamento", { agendamento })}
          >
            APONTAR MATERIAL
          </button>
        )}
      </div>
    </div>
  );
}
