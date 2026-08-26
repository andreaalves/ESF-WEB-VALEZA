import { BrowserRouter as Router, Switch } from 'react-router-dom';
import { CreateCategory } from '../pages/CreateCategory';
import { CreateCostumer } from '../pages/CreateCostumer';
import { CreateFreight } from '../pages/CreateFreight';
import { CreatePriceTableProducts } from '../pages/CreatePriceTableProducts';
import { CreatePriceTable } from '../pages/CreatePriceTable';
import { CreateParamsTable } from '../pages/CreateParamsTable';
import { CreateProducts } from '../pages/CreateProducts';
import { CreateProvider } from '../pages/CreateProvider';
import { CreateShipingCompany } from '../pages/CreateShippingCompany';
import { CreateUser } from '../pages/CreateUser';
import { CreateInternalUser } from '../pages/CreateInternalUser';
import { CreateScheduling } from '../pages/CreateScheduling';
import { Home } from '../pages/Home';
import ListCategory from '../pages/ListCategory';
import ListClient from '../pages/ListClient';
import ListFreight from '../pages/ListFreight';
import ListOrder from '../pages/ListOrder';
import ListProduct from '../pages/ListProduct';
import ListProvider from '../pages/ListProvider';
import ListShippingCompany from '../pages/ListShippingCompany';
import ListUser from '../pages/ListUser';
import ListInternalUser from '../pages/ListInternalUser';
import ListTableProducts from '../pages/ListTableProducts';
import ListScheduling from '../pages/ListScheduling';
import { Login } from '../pages/Login';
import PagesTest from '../pages/PageTest';
import Route from './Route';
import ListItensOrder from '../pages/ListItensOrder';
import { CreateLinkClient } from '../pages/CreateLinkClient';
import { CreateParams } from '../pages/CreateParams';
import { CreateRegrasParametrizacao } from '../pages/CreateRegrasParametrizacao';
import { CreateMeta } from '../pages/CreateMeta';
import { PainelMetas } from '../pages/PainelMetas';
import ListMetas from '../pages/ListMetas';
import ListParams from '../pages/ListParams';
import { Dashboard } from '../pages/Dashboard';
import ListBudget from '../pages/ListBudget';
import ListItensBudget from '../pages/ListItensBudget';
import SurgicalMap from '../pages/SurgicalMap';
import AgendamentoDetail from '../pages/AgendamentoDetail';
import RastreamentoEntrega from '../pages/RastreamentoEntrega';
import Apontamento from '../pages/Apontamento';
import Entregas from '../pages/Entregas';
import { ChatAssistant } from '../components/ChatAssistant';

export const Routes = () => {
  return (
    <Router>
      <Switch>
        <Route exact path="/" component={Login} />
        <Route exact path="/home" component={ListOrder} isPrivate />
        <Route
          exact
          path="/cadastro/frete"
          component={CreateFreight}
          isPrivate
        />

        <Route
          exact
          path="/edit/frete/:id"
          component={CreateFreight}
          isPrivate
        />
        <Route exact path="/listar/frete" component={ListFreight} isPrivate />

        <Route
          exact
          path="/cadastro/transportadora"
          component={CreateShipingCompany}
          isPrivate
        />

        <Route
          exact
          path="/edit/transportadora/:id"
          component={CreateShipingCompany}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/vendedor"
          component={CreateUser}
          isPrivate
        />

        <Route
          exact
          path="/edit/vendedor/:id"
          component={CreateUser}
          isPrivate
        />

        <Route exact path="/listar/vendedor" component={ListUser} isPrivate />

        <Route
          exact
          path="/listar/usuario"
          component={ListInternalUser}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route
          exact
          path="/cadastro/usuario"
          component={CreateInternalUser}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route
          exact
          path="/edit/usuario/:id"
          component={CreateInternalUser}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route exact path="/listar/meta" component={ListMetas} isPrivate />
        <Route exact path="/cadastro/meta" component={CreateMeta} isPrivate />
        <Route exact path="/cadastro/meta/:id" component={CreateMeta} isPrivate />

        <Route exact path="/painel/metas" component={PainelMetas} isPrivate />

        <Route
          exact
          path="/listar/transportadora"
          component={ListShippingCompany}
          isPrivate
        />

        <Route
          exact
          path="/listar/fornecedor"
          component={ListProvider}
          isPrivate
        />

        <Route
          exact
          path="/listar/categoria"
          component={ListCategory}
          isPrivate
        />

        <Route exact path="/listar/pedido" component={ListOrder} isPrivate />
        <Route
          exact
          path="/listar/pedido/:id"
          component={ListItensOrder}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/fornecedor"
          component={CreateProvider}
          isPrivate
        />

        <Route
          exact
          path="/edit/fornecedor/:id"
          component={CreateProvider}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/produto"
          component={CreateProducts}
          isPrivate
        />

        <Route
          exact
          path="/edit/produto/:id"
          component={CreateProducts}
          isPrivate
        />

        <Route exact path="/listar/produto" component={ListProduct} isPrivate />

        <Route
          exact
          path="/cadastro/cliente"
          component={CreateCostumer}
          isPrivate
        />

        <Route
          exact
          path="/edit/cliente/:id"
          component={CreateCostumer}
          isPrivate
        />

        <Route exact path="/listar/cliente" component={ListClient} isPrivate />

        <Route
          exact
          path="/listar/tabela-preco"
          component={ListTableProducts}
          isPrivate
        />

        <Route
          exact
          path="/vincular/tabela-preco/:id"
          component={CreateLinkClient}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/categoria"
          component={CreateCategory}
          isPrivate
        />

        <Route
          exact
          path="/edit/categoria/:id"
          component={CreateCategory}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/preco-produto/:id"
          component={CreatePriceTableProducts}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/tabela-preco"
          component={CreatePriceTable}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/parametrizacao-tabela-preco/:id"
          component={CreateParamsTable}
          isPrivate
        />

        <Route
          exact
          path="/edit/tabela-preco/:id"
          component={CreatePriceTable}
          isPrivate
        />

        <Route
          exact
          path="/listar/agendamento"
          component={ListScheduling}
          isPrivate
        />

        <Route
          exact
          path="/cadastro/agendamento"
          component={CreateScheduling}
          isPrivate
        />
        <Route
          exact
          path="/listar/parametrizacao"
          component={ListParams}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route
          exact
          path="/cadastro/parametrizacao"
          component={CreateParams}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route
          exact
          path="/edit/parametrizacao/:id"
          component={CreateParams}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route
          exact
          path="/edit/regras-parametrizacao/:id"
          component={CreateRegrasParametrizacao}
          isPrivate
          allowedRoles={['ROLE_ADMIN']}
        />

        <Route exact path="/dashboard" component={Dashboard} isPrivate />
        <Route exact path="/mapa-cirurgico" component={SurgicalMap} isPrivate />
        <Route exact path="/listar/orcamento" component={ListBudget} isPrivate />
        <Route exact path="/listar/orcamento/:id" component={ListItensBudget} isPrivate />

        <Route exact path="/agendamento/detalhe" component={AgendamentoDetail} isPrivate />
        <Route exact path="/rastreamento" component={RastreamentoEntrega} isPrivate />
        <Route exact path="/apontamento" component={Apontamento} isPrivate />
        <Route exact path="/listar/entregas" component={Entregas} isPrivate />

        <Route exact path="/teste" component={PagesTest} isPrivate />
      </Switch>

      {/* Assistente flutuante — visível em todas as páginas (exceto login). */}
      <ChatAssistant />
    </Router>
  );
};
