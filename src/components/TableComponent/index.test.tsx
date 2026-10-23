import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import ReactTableComponent from './index';

const columns = [{ Header: 'Cliente', accessor: 'cliente' }];
const data = [{ cliente: 'Hospital Alfa' }, { cliente: 'Clínica Beta' }];
const CHAVE = '@teste:tabela';

const renderTabela = (props: { data?: any[]; storageKey?: string } = {}) =>
  render(
    <ChakraProvider>
      <ReactTableComponent columns={columns} data={props.data ?? data} storageKey={props.storageKey} />
    </ChakraProvider>
  );

function filtrar(texto: string) {
  fireEvent.click(document.querySelector('.filters svg') as Element);
  fireEvent.change(screen.getByPlaceholderText('Procurar ...'), { target: { value: texto } });
}

beforeEach(() => sessionStorage.clear());

test('com storageKey, o filtro da coluna volta quando a tabela remonta', () => {
  const { unmount } = renderTabela({ storageKey: CHAVE });
  filtrar('beta');
  expect(screen.queryByText('Hospital Alfa')).toBeNull();
  unmount();

  renderTabela({ storageKey: CHAVE });
  expect(screen.getByText('Clínica Beta')).toBeTruthy();
  expect(screen.queryByText('Hospital Alfa')).toBeNull();
  expect(screen.getByPlaceholderText('Procurar ...')).toMatchObject({ value: 'beta' });
});

test('recarregar os dados não apaga o filtro da coluna', () => {
  const { rerender } = renderTabela();
  filtrar('beta');
  rerender(
    <ChakraProvider>
      <ReactTableComponent columns={columns} data={[...data, { cliente: 'Beta Norte' }]} />
    </ChakraProvider>
  );
  expect(screen.getByText('Beta Norte')).toBeTruthy();
  expect(screen.queryByText('Hospital Alfa')).toBeNull();
});

test('sem storageKey, nada fica guardado', () => {
  const { unmount } = renderTabela();
  filtrar('beta');
  unmount();

  renderTabela();
  expect(screen.getByText('Hospital Alfa')).toBeTruthy();
  expect(sessionStorage.length).toBe(0);
});
