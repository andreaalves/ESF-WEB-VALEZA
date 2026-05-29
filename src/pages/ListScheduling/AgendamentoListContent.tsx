import { useEffect, useState, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { MdOutlineBusiness, MdMedicalServices, MdPersonOutline, MdBadge, MdInventory2, MdReceiptLong, MdChevronRight } from "react-icons/md";
import api from "../../service/api";
import "./agendamento-list.css";

function getStatusClass(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "ENTREGUE") return "status-entregue";
  if (s === "FATURADO") return "status-faturado";
  if (s === "EM SEPARAÇÃO" || s === "SEPARACAO" || s === "ENVIADO") return "status-separacao";
  if (s === "CANCELADO" || s === "CANCELADO_ERP") return "status-cancelado";
  if (s === "ERRO_INTEGRACAO") return "status-erro";
  return "status-agendado";
}

function getStatusLabel(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "SEPARACAO" || s === "ENVIADO") return "EM SEPARAÇÃO";
  if (s === "INTEGRADO") return "AGENDADO";
  if (s === "CANCELADO" || s === "CANCELADO_ERP") return "❌ CANCELADO";
  if (s === "ERRO_INTEGRACAO") return "⚠️ ERRO";
  if (s === "FATURADO") return "🧾 FATURADO";
  return status || "AGENDADO";
}

function tempoRelativo(data: string, hora: string) {
  if (!data) return "";
  const [h = "00", m = "00"] = (hora || "").split(":");
  const cirurgia = new Date(data);
  cirurgia.setHours(parseInt(h), parseInt(m), 0, 0);
  const diff = cirurgia.getTime() - Date.now();
  const min = Math.round(diff / 60000);
  const hrs = Math.round(diff / 3600000);
  const dias = Math.round(diff / 86400000);
  if (min >= -30 && min <= 30) return "⏱ agora";
  if (min > 30 && hrs < 2) return `em ${min} min`;
  if (hrs >= 2 && dias < 1) return `em ${hrs}h`;
  if (dias === 1) return "📅 amanhã";
  if (dias > 1 && dias <= 30) return `em ${dias} dias`;
  if (dias < 0) return "";
  return cirurgia.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function mapItem(item: any) {
  return {
    ...item,
    _cliente: item?.clientes?.fantasia || "SEM CLIENTE",
    _status: item?.pedido?.situacao || "AGENDADO",
    _medico: typeof item?.medico === "object" ? item?.medico?.nome : item?.medico || "N/A",
    _convenio: typeof item?.convenio === "object" ? item?.convenio?.descricao : item?.convenio || "N/A",
  };
}

export default function AgendamentoListContent() {
  const history = useHistory();
  const [allItems, setAllItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("TODOS");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    api.get("/api-essencial/v1/agendamentos")
      .then((r) => setAllItems((r.data.data || []).map(mapItem)))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => allItems.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = !searchTerm ||
      item._cliente.toLowerCase().includes(s) ||
      item._medico.toLowerCase().includes(s) ||
      (item.paciente || "").toLowerCase().includes(s) ||
      (item._convenio || "").toLowerCase().includes(s);
    const matchType = filterType === "TODOS" ||
      (filterType === "CANCELADO"
        ? item._status === "CANCELADO" || item._status === "CANCELADO_ERP"
        : item.tipo === filterType);
    const matchDate = !filterDate || (item.data_agendamento || "").substring(0, 10) === filterDate;
    return matchSearch && matchType && matchDate;
  }), [allItems, searchTerm, filterType, filterDate]);

  return (
    <div className="page-agendamento-list">

      {/* Barra superior azul */}
      <div className="page-top-bar">
        <h2>MINHAS CIRURGIAS</h2>
        <button type="button" className="btn-cadastrar" onClick={() => history.push("/cadastro/agendamento")}>
          + Cadastrar
        </button>
      </div>

      {/* Filtros */}
      <div className="filter-wrapper">
        <input
          className="custom-searchbar"
          placeholder="Buscar por Hospital, Médico ou Paciente"
          value={searchTerm}
          onChange={(e: any) => setSearchTerm(e.target.value)}
        />
        <div className="filter-chips">
          <button type="button" className={`chip${filterType === "TODOS" ? " active" : ""}`} onClick={() => setFilterType("TODOS")}>
            TODOS
          </button>
          <button type="button" className={`chip chip-urgencia${filterType === "URGENCIA" ? " active" : ""}`} onClick={() => setFilterType(filterType === "URGENCIA" ? "TODOS" : "URGENCIA")}>
            🚨 URGÊNCIA
          </button>
          <button type="button" className={`chip${filterType === "ELETIVA" ? " active" : ""}`} onClick={() => setFilterType(filterType === "ELETIVA" ? "TODOS" : "ELETIVA")}>
            🩺 ELETIVA
          </button>
          <div className="date-chip-wrapper">
            <span>📅</span>
            <input type="date" value={filterDate} onChange={(e: any) => setFilterDate(e.target.value)} title="Filtrar por data" />
          </div>
          <button type="button" className={`chip chip-cancelado${filterType === "CANCELADO" ? " active" : ""}`} onClick={() => setFilterType(filterType === "CANCELADO" ? "TODOS" : "CANCELADO")}>
            ❌ CANCELADO
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="container-list">
        {isLoading ? (
          <div className="empty-state"><p>Carregando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>Nenhum agendamento encontrado.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const status = item._status;
            const isCancelado = status === "CANCELADO" || status === "CANCELADO_ERP";
            const isUrgencia = item.tipo === "URGENCIA";
            const tempo = tempoRelativo(item.data_agendamento, item.hora_agendamento);

            return (
              <div key={item.agendamento_id} className={`card-agendamento${isUrgencia ? " urgencia" : ""}${isCancelado ? " cancelado" : ""}`}>

                <div className="card-header">
                  <div className="hospital-info">
                    <MdOutlineBusiness className="icon-header" />
                    <span className="hospital-name">{item._cliente}</span>
                  </div>
                  <div className="header-right">
                    {isUrgencia && <span className="tipo-tag-header">🚨 URGÊNCIA</span>}
                    {item.tipo === "ELETIVA" && <span className="tipo-tag-header tipo-eletiva">📅 ELETIVA</span>}
                    <span className={`status-badge ${getStatusClass(status)}`}>{getStatusLabel(status)}</span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="info-row">
                    <div className="info-item">
                      <span className="label">DATA</span>
                      <span className="value">
                        {item.data_agendamento ? new Date(item.data_agendamento).toLocaleDateString("pt-BR") : "-"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">HORA</span>
                      <span className="value">{item.hora_agendamento || "-"}</span>
                    </div>
                    {tempo && <div className="tempo-relativo"><span className="tempo-tag">{tempo}</span></div>}
                  </div>

                  <div className="divider" />

                  <div className="detail-row">
                    <MdMedicalServices className="detail-icon" />
                    <div className="detail-text">
                      <span className="detail-label">MÉDICO(A)</span>
                      <span className="detail-value">{item._medico}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <MdPersonOutline className="detail-icon" />
                    <div className="detail-text">
                      <span className="detail-label">PACIENTE</span>
                      <span className="detail-value">{item.paciente || "N/A"}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <MdBadge className="detail-icon" />
                    <div className="detail-text">
                      <span className="detail-label">CONVÊNIO</span>
                      <span className="detail-value">{item._convenio}</span>
                    </div>
                  </div>
                  {item?.pedido?.pedido_erp && (
                    <div className="detail-row">
                      <MdReceiptLong className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">Nº PEDIDO</span>
                        <span className="detail-value totvs-num">{item.pedido.pedido_erp}</span>
                      </div>
                    </div>
                  )}
                  {item?.pedido?.nota_erp && (
                    <div className="detail-row">
                      <MdInventory2 className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">Nº NF</span>
                        <span className="detail-value totvs-num">{item.pedido.nota_erp}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  {status === "ENTREGUE" && (
                    <button type="button" className="btn-apontar-list" onClick={() => history.push("/apontamento", { agendamento: item })}>
                      APONTAR <MdChevronRight />
                    </button>
                  )}
                  <button type="button" className="btn-detalhes" onClick={() => history.push("/agendamento/detalhe", { agendamento: item })}>
                    DETALHES <MdChevronRight />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
