import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { MdOutlineBusiness, MdCheckCircle, MdMedicalServices, MdPersonOutline, MdWork, MdInventory2, MdNavigateNext, MdLocationOn, MdArrowBack } from "react-icons/md";
import api from "../../service/api";
import { useAuth } from "../../context/AuthContext";
import "./entregas.css";

function mapItemToEntrega(item: any, nomeVendedor: string) {
  return {
    id: item?.agendamento_id || item?.pedido_id || "",
    pedidoId: item?.pedido?.pedido_id || item?.pedido_id || null,
    pedido_erp: item?.pedido?.pedido_erp || item?.pedido_erp || null,
    notaFiscal: item?.pedido?.nota_erp || item?.nota_erp || "",
    cliente: item?.clientes?.fantasia || "SEM CLIENTE",
    data: item?.data_agendamento || item?.data_emissao || "",
    hora: item?.hora_agendamento || "",
    status: item?.pedido?.situacao || item?.situacao || "PENDENTE",
    tipo: item?.tipo || "",
    medico: typeof item?.medico === "object" ? item?.medico?.nome : item?.medico || "N/A",
    paciente: item?.paciente || "N/A",
    convenio: typeof item?.convenio === "object" ? item?.convenio?.descricao : item?.convenio || "N/A",
    material: item?.observacoes || "N/A",
    vendedor: nomeVendedor,
  };
}

export default function EntregasContent() {
  const history = useHistory();
  const { user } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"COLETADAS" | "ENTREGUES">("COLETADAS");
  const [todos, setTodos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const colaboradorId = (user as any)?.colaborador?.id;
    const nomeVendedor = (user as any)?.colaborador?.nome || (user as any)?.name || "";
    const endpoint = colaboradorId
      ? `/api-essencial/v1/agendamentos/${colaboradorId}/vendedor`
      : `/api-essencial/v1/agendamentos`;
    api.get(endpoint)
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setTodos(data.map((i: any) => mapItemToEntrega(i, nomeVendedor)));
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [user]);

  const coletadas = todos.filter((i) => {
    const s = (i.status || "").toUpperCase();
    return s === "FATURADO" || s === "ENVIADO" || s === "EM ROTA" || s === "EM SEPARAÇÃO" || s === "SEPARACAO";
  });

  const entregues = todos.filter((i) => (i.status || "").toUpperCase() === "ENTREGUE");
  const lista = abaAtiva === "COLETADAS" ? coletadas : entregues;

  return (
    <div className="page-entregas">
      {/* Header azul */}
      <div className="page-top-bar">
        <button type="button" className="btn-back" onClick={() => history.push("/home")}>
          <MdArrowBack />
        </button>
        <h2>MINHAS ENTREGAS</h2>
      </div>

      {/* Tabs */}
      <div className="custom-tabs">
        <div className={`tab-item${abaAtiva === "COLETADAS" ? " active" : ""}`} onClick={() => setAbaAtiva("COLETADAS")}>
          <MdInventory2 className="tab-icon" />
          COLETADAS
          {coletadas.length > 0 && <span className="badge">{coletadas.length}</span>}
        </div>
        <div className={`tab-item${abaAtiva === "ENTREGUES" ? " active" : ""}`} onClick={() => setAbaAtiva("ENTREGUES")}>
          <MdCheckCircle className="tab-icon" />
          ENTREGUES
          {entregues.length > 0 && <span className="badge entregue">{entregues.length}</span>}
        </div>
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="loading-state"><p>Carregando entregas...</p></div>
      ) : (
        <div className="container-list">
          {abaAtiva === "COLETADAS" && (
            lista.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>Nenhum material coletado para viagem.</p>
              </div>
            ) : (
              lista.map((item) => {
                const status = (item.status || "").toUpperCase();
                const isUrgencia = item.tipo === "URGENCIA";
                const statusClass = status === "EM ROTA" ? "status-emrota" : status === "FATURADO" ? "status-faturado" : "";
                return (
                  <div key={item.id} className={`card-agendamento${isUrgencia ? " urgencia" : ""}`}>
                    <div className="card-header">
                      <div className="hospital-info">
                        <MdOutlineBusiness className="icon-header" />
                        <span className="hospital-name">{item.cliente}</span>
                      </div>
                      <div className="header-badges">
                        <div className="nf-badge">
                          {item.notaFiscal ? `NF: ${item.notaFiscal}` : item.pedido_erp ? `Ped: ${item.pedido_erp}` : "N/A"}
                        </div>
                        <div className={`status-badge ${statusClass}`}>
                          {status === "EM ROTA" ? "EM ROTA 📍" : status === "FATURADO" ? "FATURADO" : "AGUARDANDO"}
                        </div>
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="info-row">
                        <div className="info-item">
                          <span className="label">DATA</span>
                          <span className="value">
                            {item.data ? new Date(item.data).toLocaleDateString("pt-BR") : "-"}
                          </span>
                        </div>
                      </div>
                      <div className="divider" />
                      <div className="detail-row">
                        <MdMedicalServices className="detail-icon" />
                        <div className="detail-text">
                          <span className="detail-label">MÉDICO(A)</span>
                          <span className="detail-value">{item.medico}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <MdPersonOutline className="detail-icon" />
                        <div className="detail-text">
                          <span className="detail-label">PACIENTE</span>
                          <span className="detail-value">{item.paciente}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <MdWork className="detail-icon" />
                        <div className="detail-text">
                          <span className="detail-label">CONVÊNIO</span>
                          <span className="detail-value">{item.convenio}</span>
                        </div>
                      </div>
                      {isUrgencia && (
                        <div className="detail-row">
                          <span className="urgencia-tag">🚨 URGÊNCIA (PRIORIDADE ALTA)</span>
                        </div>
                      )}
                    </div>

                    <div className="card-footer card-footer--split">
                      {(status === "FATURADO" || status === "ENVIADO") && (
                        <button type="button" className="btn-rota"
                          onClick={() => history.push("/rastreamento", { nomeHospital: item.cliente, notaFiscal: item.notaFiscal })}>
                          <MdNavigateNext /> INICIAR ROTA
                        </button>
                      )}
                      {status === "EM ROTA" && (
                        <button type="button" className="btn-acompanhar"
                          onClick={() => history.push("/rastreamento", { nomeHospital: item.cliente, notaFiscal: item.notaFiscal })}>
                          <MdLocationOn /> ACOMPANHAR
                        </button>
                      )}
                      {status === "EM ROTA" && (
                        <button type="button" className="btn-detalhes">
                          CONFIRMAR ENTREGA <MdCheckCircle />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}

          {abaAtiva === "ENTREGUES" && (
            lista.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>Nenhuma entrega concluída hoje.</p>
              </div>
            ) : (
              lista.map((item) => (
                <div key={item.id} className="card-agendamento entregue-card">
                  <div className="card-header">
                    <div className="hospital-info">
                      <MdCheckCircle className="icon-header success-color" />
                      <span className="hospital-name">{item.cliente}</span>
                    </div>
                    <div className="status-badge status-entregue">ENTREGUE</div>
                  </div>
                  <div className="card-body">
                    <div className="detail-row">
                      <MdMedicalServices className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">MÉDICO(A)</span>
                        <span className="detail-value">{item.medico}</span>
                      </div>
                    </div>
                    <div className="detail-row">
                      <MdPersonOutline className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">PACIENTE</span>
                        <span className="detail-value">{item.paciente}</span>
                      </div>
                    </div>
                    <div className="detail-row">
                      <MdWork className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">CONVÊNIO</span>
                        <span className="detail-value">{item.convenio}</span>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer entregue-footer">
                    <span className="data-entrega">Entregue e aguardando apontamento do vendedor.</span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
