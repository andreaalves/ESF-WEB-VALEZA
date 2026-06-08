import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  Divider as DividerBase,
  Select as SelectBase,
  Text as TextBase,
  HStack as HStackBase,
  Table as TableBase,
  Thead as TheadBase,
  Tbody as TbodyBase,
  Tr as TrBase,
  Th as ThBase,
  Td as TdBase,
  Badge as BadgeBase,
  IconButton as IconButtonBase,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import api from '../../service/api';

const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const Divider = DividerBase as any;
const Select = SelectBase as any;
const Text = TextBase as any;
const HStack = HStackBase as any;
const Table = TableBase as any;
const Thead = TheadBase as any;
const Tbody = TbodyBase as any;
const Tr = TrBase as any;
const Th = ThBase as any;
const Td = TdBase as any;
const Badge = BadgeBase as any;
const IconButton = IconButtonBase as any;

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Sistema começou em 2026 — não há anos anteriores nem futuros.
const ANO_INICIO = 2026;
const ANOS: number[] = [];
for (let a = ANO_INICIO; a <= Math.max(anoAtual, ANO_INICIO); a++) ANOS.push(a);

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Linha = { id: string; nome: string; ano: number; metaMes: number; meses: number };

export default function ListMetas() {
  const { user } = useAuth();
  const history = useHistory();

  const [ano, setAno] = useState(Math.max(anoAtual, ANO_INICIO));
  const [mes, setMes] = useState(mesAtual);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    setCarregando(true);

    // mapa colaborador_id -> nome
    const nomes: Record<string, string> = {};
    try {
      const res = await api.get('/api-essencial/v1/colaboradores');
      (res.data || []).forEach((c: any) => (nomes[c.colaborador_id] = c.nome));
    } catch {}

    // metas (endpoint ainda pode não existir → fica vazio)
    try {
      const res = await api.get(`/api-essencial/v1/metas/${user.empresa.id}`, {
        params: { ano },
      });
      const porVendedor: Record<string, Linha> = {};
      (res.data || []).forEach((m: any) => {
        if (!porVendedor[m.colaborador_id]) {
          porVendedor[m.colaborador_id] = {
            id: m.colaborador_id,
            nome: nomes[m.colaborador_id] || m.colaborador_id,
            ano: m.ano,
            metaMes: 0,
            meses: 0,
          };
        }
        const valor = Number(m.valor_meta) || 0;
        // Meta do mês selecionado
        if (Number(m.mes) === mes) porVendedor[m.colaborador_id].metaMes += valor;
        // Quantos meses do ano têm meta (independente do filtro de mês)
        if (valor > 0) porVendedor[m.colaborador_id].meses += 1;
      });
      // Só mostra vendedores que têm meta no mês selecionado
      setLinhas(Object.values(porVendedor).filter((l) => l.metaMes > 0));
    } catch {
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <HStack justify="space-between" flexWrap="wrap">
              <Heading size="md" fontWeight="normal">
                METAS CADASTRADAS
              </Heading>
              <HStack spacing="3">
                <Button size="sm" variant="outline" colorScheme="gray" onClick={carregar}>
                  Atualizar
                </Button>
                <Button
                  size="sm"
                  colorScheme="orange"
                  leftIcon={<FiIcons.FiPlus />}
                  onClick={() => history.push('/cadastro/meta')}
                >
                  Nova meta
                </Button>
              </HStack>
            </HStack>

            <Divider my="6" borderColor="gray.700" />

            <HStack spacing="4" mb="6" align="flex-end" flexWrap="wrap">
              <Box w="160px">
                <Text mb="2" color="gray.300">Mês</Text>
                <Select
                  aria-label="Filtrar por mês"
                  bgColor="gray.700" variant="filled" _hover={{ bgColor: 'gray.700' }}
                  value={mes} onChange={(e: any) => setMes(Number(e.target.value))}
                >
                  {MESES.map((nome, i) => (
                    <option key={nome} value={i + 1}>{nome}</option>
                  ))}
                </Select>
              </Box>
              <Box w="160px">
                <Text mb="2" color="gray.300">Ano</Text>
                <Select
                  aria-label="Filtrar por ano"
                  bgColor="gray.700" variant="filled" _hover={{ bgColor: 'gray.700' }}
                  value={ano} onChange={(e: any) => setAno(Number(e.target.value))}
                >
                  {ANOS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </Box>
            </HStack>

            {linhas.length === 0 ? (
              <Box bg="gray.900" borderRadius="lg" p="8" textAlign="center">
                <Text color="gray.400">
                  {carregando ? 'Carregando...' : 'Nenhuma meta cadastrada ainda.'}
                </Text>
                <Text color="orange.200" mt="2" fontSize="sm">
                  Clique em "Nova meta" para cadastrar.
                </Text>
              </Box>
            ) : (
              <Table variant="simple" size="md">
                <Thead>
                  <Tr>
                    <Th color="gray.400">Vendedor</Th>
                    <Th color="gray.400">Ano</Th>
                    <Th color="gray.400" isNumeric>Meta de {MESES[mes - 1]}</Th>
                    <Th color="gray.400" isNumeric>Meses c/ meta</Th>
                    <Th color="gray.400"> </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {linhas.map((l) => (
                    <Tr key={l.id}>
                      <Td fontWeight="bold">{l.nome}</Td>
                      <Td>{l.ano}</Td>
                      <Td isNumeric>{brl(l.metaMes)}</Td>
                      <Td isNumeric>
                        <Badge colorScheme={l.meses === 12 ? 'green' : 'orange'}>
                          {l.meses}/12
                        </Badge>
                      </Td>
                      <Td>
                        <IconButton
                          size="sm"
                          aria-label="Editar metas"
                          title="Editar metas"
                          colorScheme="green"
                          bg="green.500"
                          _hover={{ bg: 'green.700' }}
                          icon={<FiIcons.FiEdit size={16} color="#fff" />}
                          onClick={() => history.push(`/cadastro/meta/${l.id}?ano=${l.ano}`)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Box>
        </Wapper>
      </Flex>
    </>
  );
}
