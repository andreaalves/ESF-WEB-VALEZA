import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  Divider as DividerBase,
  Input as InputBase,
  Select as SelectBase,
  Text as TextBase,
  HStack as HStackBase,
  VStack as VStackBase,
  Wrap as WrapBase,
  WrapItem as WrapItemBase,
  IconButton as IconButtonBase,
  Badge as BadgeBase,
  Menu as MenuBase,
  MenuButton as MenuButtonBase,
  MenuList as MenuListBase,
  MenuOptionGroup as MenuOptionGroupBase,
  MenuItemOption as MenuItemOptionBase,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams, useLocation } from 'react-router-dom';
import ReactSelect from 'react-select';
import * as FiIcons from 'react-icons/fi';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import api from '../../service/api';
import { currencyMask } from '../../helpers/currencyMask';

// Chakra UI v1 + TS strict estoura TS2590 ("union type too complex") quando
// uma página mistura muitos componentes. Casting para any contorna o limite.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const Divider = DividerBase as any;
const Input = InputBase as any;
const Select = SelectBase as any;
const Text = TextBase as any;
const HStack = HStackBase as any;
const VStack = VStackBase as any;
const Wrap = WrapBase as any;
const WrapItem = WrapItemBase as any;
const IconButton = IconButtonBase as any;
const Badge = BadgeBase as any;
const Menu = MenuBase as any;
const MenuButton = MenuButtonBase as any;
const MenuList = MenuListBase as any;
const MenuOptionGroup = MenuOptionGroupBase as any;
const MenuItemOption = MenuItemOptionBase as any;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// quantidade é a quantidade de produtos do item — métrica própria, ao lado do
// valor; não entra na conta do valor da meta.
type ItemMeta = { categoriaId: string; produtoId: string; valor: string; quantidade: string };
type MesMeta = { valorMeta: string; itens: ItemMeta[] };

type Vendedor = { id: string; nome: string };
type Categoria = { categoria_id: string; nome: string };
type Produto = { produto_id: string; nome: string; categoria_id: string; codigo?: string };
type SelectOption = { value: string; label: string };

const COR_CAMPO_META = '#353646';

// "1.000.000,00" -> 1000000
function parseMoeda(str: string): number {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function metaVazia(): MesMeta {
  return { valorMeta: '', itens: [] };
}

const selectStyles = {
  container: (base: any) => ({
    ...base,
    width: '100%',
  }),
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 32,
    backgroundColor: COR_CAMPO_META,
    borderColor: state.isFocused ? '#fe8026' : 'transparent',
    boxShadow: state.isFocused ? '0 0 0 1px #fe8026' : 'none',
    color: '#fff',
    fontSize: 14,
    '&:hover': { borderColor: '#fe8026' },
  }),
  valueContainer: (base: any) => ({
    ...base,
    backgroundColor: COR_CAMPO_META,
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    backgroundColor: COR_CAMPO_META,
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: COR_CAMPO_META,
    border: '1px solid #4A5568',
    zIndex: 20,
  }),
  menuList: (base: any) => ({
    ...base,
    maxHeight: 220,
    backgroundColor: COR_CAMPO_META,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected || state.isFocused ? '#fe8026' : COR_CAMPO_META,
    color: '#fff',
    fontSize: 14,
    '&:active': { backgroundColor: '#fe8026' },
  }),
  singleValue: (base: any) => ({ ...base, color: '#fff' }),
  input: (base: any) => ({ ...base, color: '#fff' }),
  placeholder: (base: any) => ({ ...base, color: '#A0AEC0' }),
  dropdownIndicator: (base: any) => ({ ...base, color: '#E2E8F0' }),
  clearIndicator: (base: any) => ({ ...base, color: '#E2E8F0' }),
  indicatorSeparator: (base: any) => ({ ...base, backgroundColor: 'transparent' }),
};

const anoAtual = new Date().getFullYear();
const mesCorrente = new Date().getMonth() + 1; // mês atual (1..12)

export const CreateMeta = () => {
  const { user } = useAuth();
  const history = useHistory();
  const toast = useToast();
  const params = useParams<{ id?: string }>();
  const location = useLocation();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [vendedoresSel, setVendedoresSel] = useState<string[]>([]);
  const [ano, setAno] = useState(anoAtual);
  // Meses selecionados (clicar alterna). A meta editada vale para todos eles.
  // mesFoco é o mês cujos dados estão sendo exibidos no painel de edição.
  const [mesesSel, setMesesSel] = useState<number[]>([mesCorrente]);
  const [mesFoco, setMesFoco] = useState(mesCorrente);
  const [salvando, setSalvando] = useState(false);

  // metas[1..12]
  const [metas, setMetas] = useState<Record<number, MesMeta>>(() => {
    const inicial: Record<number, MesMeta> = {};
    for (let m = 1; m <= 12; m++) inicial[m] = metaVazia();
    return inicial;
  });

  useEffect(() => {
    api
      .get('/api-essencial/v1/colaboradores')
      .then((res) => {
        setVendedores(
          (res.data || []).map((c: any) => ({
            id: c.colaborador_id,
            nome: c.nome,
          }))
        );
      })
      .catch(() => {});

    api
      .get('/api-essencial/v1/categorias')
      .then((res) => setCategorias(res.data || []))
      .catch(() => {});

    api
      .get('/api-essencial/v1/produtos')
      .then((res) => setProdutos(res.data || []))
      .catch(() => {});
  }, []);

  // Modo edição: veio um vendedor na URL → pré-seleciona, abre no mês atual
  // e carrega as metas existentes dele (leitura via GET /metas, quando subir).
  useEffect(() => {
    if (!params.id) return;
    setVendedoresSel([params.id]);
    const q = new URLSearchParams(location.search);
    const anoQ = Number(q.get('ano'));
    const anoSel = anoQ || anoAtual;
    if (anoQ) setAno(anoQ);
    setMesesSel([mesCorrente]);
    setMesFoco(mesCorrente);

    api
      .get(`/api-essencial/v1/metas/${user.empresa.id}`, {
        params: { colaborador_id: params.id, ano: anoSel },
      })
      .then((res) => {
        const novo: Record<number, MesMeta> = {};
        for (let m = 1; m <= 12; m++) novo[m] = metaVazia();
        (res.data || []).forEach((m: any) => {
          if (m.mes >= 1 && m.mes <= 12) {
            novo[m.mes] = {
              valorMeta:
                currencyMask(String(Math.round((Number(m.valor_meta) || 0) * 100))) || '',
              itens: (m.itens || []).map((i: any) => ({
                categoriaId: i.categoria_id || '',
                produtoId: i.produto_id || '',
                valor:
                  currencyMask(String(Math.round((Number(i.valor) || 0) * 100))) || '',
                quantidade:
                  i.quantidade != null && Number(i.quantidade) > 0
                    ? String(i.quantidade)
                    : '',
              })),
            };
          }
        });
        setMetas(novo);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const mes = metas[mesFoco] || metaVazia();

  const totalDistribuido = useMemo(
    () => mes.itens.reduce((soma, item) => soma + parseMoeda(item.valor), 0),
    [mes]
  );
  const totalQuantidade = useMemo(
    () => mes.itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0),
    [mes]
  );
  const opcoesCategorias = useMemo(
    () => categorias.map((c) => ({ value: c.categoria_id, label: c.nome })),
    [categorias]
  );
  const valorMetaNum = parseMoeda(mes.valorMeta);
  const restante = valorMetaNum - totalDistribuido;

  // Alterna a seleção do mês ao clicar (e foca nele para exibir/editar).
  function toggleMes(m: number) {
    const selecionado = mesesSel.includes(m);
    const novo = selecionado
      ? mesesSel.filter((x) => x !== m)
      : [...mesesSel, m].sort((a, b) => a - b);
    setMesesSel(novo);
    setMesFoco(selecionado ? novo[novo.length - 1] ?? m : m);
  }

  // As edições valem para TODOS os meses selecionados (ou o foco, se nenhum).
  function atualizarMes(novo: Partial<MesMeta>) {
    setMetas((prev) => {
      const next = { ...prev };
      const alvos = mesesSel.length ? mesesSel : [mesFoco];
      for (const m of alvos) next[m] = { ...prev[m], ...novo };
      return next;
    });
  }

  function setValorMeta(valor: string) {
    atualizarMes({ valorMeta: currencyMask(valor) || '' });
  }

  function adicionarItem() {
    atualizarMes({
      itens: [...mes.itens, { categoriaId: '', produtoId: '', valor: '', quantidade: '' }],
    });
  }

  function removerItem(index: number) {
    atualizarMes({ itens: mes.itens.filter((_, i) => i !== index) });
  }

  function atualizarItem(index: number, campo: keyof ItemMeta, valor: string) {
    const itens = mes.itens.map((item, i) => {
      if (i !== index) return item;
      const atualizado = { ...item, [campo]: valor };
      // Trocou o grupo → zera o produto (que pertencia ao grupo anterior).
      if (campo === 'categoriaId') atualizado.produtoId = '';
      if (campo === 'valor') atualizado.valor = currencyMask(valor) || '';
      // Quantidade aceita apenas números inteiros.
      if (campo === 'quantidade') atualizado.quantidade = valor.replace(/\D/g, '');
      return atualizado;
    });
    atualizarMes({ itens });
  }

  function produtosDoGrupo(categoriaId: string) {
    return produtos.filter((p) => p.categoria_id === categoriaId);
  }

  function opcoesProdutosDoGrupo(categoriaId: string): SelectOption[] {
    return produtosDoGrupo(categoriaId).map((p) => ({
      value: p.produto_id,
      label: p.codigo ? `${p.codigo} - ${p.nome}` : p.nome,
    }));
  }

  // Quantos meses já têm meta preenchida (pras "casas")
  function mesPreenchido(m: number) {
    return parseMoeda(metas[m].valorMeta) > 0;
  }

  async function handleSalvar() {
    if (!vendedoresSel.length) {
      return toast({
        title: 'Selecione ao menos um vendedor',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    }

    // Regra: a distribuição não pode passar da meta do mês. O que sobrar fica
    // como "meta livre". Se exceder, bloqueia o salvar e aponta o mês.
    for (let m = 1; m <= 12; m++) {
      const metaMes = parseMoeda(metas[m].valorMeta);
      if (metaMes <= 0) continue;
      const soma = metas[m].itens.reduce((s, i) => s + parseMoeda(i.valor), 0);
      if (soma > metaMes + 0.001) {
        return toast({
          title: `Distribuição maior que a meta em ${MESES[m - 1]}`,
          description:
            'A soma dos itens passou do valor da meta do mês. Ajuste antes de salvar.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }


    // Meses com meta definida (mesma estrutura aplicada a todos os selecionados)
    const meses = Object.entries(metas)
      .filter(([, dados]) => parseMoeda(dados.valorMeta) > 0)
      .map(([m, dados]) => ({
        mes: Number(m),
        valor_meta: parseMoeda(dados.valorMeta),
        itens: dados.itens
          .filter((i) => i.categoriaId && (parseMoeda(i.valor) > 0 || Number(i.quantidade) > 0))
          .map((i) => ({
            categoria_id: i.categoriaId,
            produto_id: i.produtoId || null,
            valor: parseMoeda(i.valor),
            quantidade: Number(i.quantidade) || 0,
          })),
      }));

    setSalvando(true);
    let salvos = 0;
    let falhou = false;
    for (const cid of vendedoresSel) {
      const payload = { empresa_id: user.empresa.id, colaborador_id: cid, ano, meses };
      try {
        await api.post('/api-essencial/v1/metas', payload);
        salvos++;
      } catch {
        falhou = true;
      }
    }
    setSalvando(false);

    if (salvos > 0) {
      toast({
        title: `Metas salvas para ${salvos} vendedor(es)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/meta');
    } else if (falhou) {
      toast({
        title: 'Erro ao salvar as metas',
        description:
          'Não foi possível salvar. Tente novamente.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <HStack justify="space-between" flexWrap="wrap">
              <Heading size="md" fontWeight="normal">
                METAS DE VENDA
              </Heading>
            </HStack>

            <Divider my="6" borderColor="gray.700" />

            {/* Vendedor + Ano */}
            <HStack spacing="6" align="flex-start" flexWrap="wrap">
              <Box minW="280px" flex="1">
                <Text mb="2" color="gray.300">
                  Vendedor(es)
                </Text>
                {params.id ? (
                  <Box bg="gray.700" borderRadius="md" px="4" py="2">
                    {vendedores.find((v) => v.id === vendedoresSel[0])?.nome || 'Vendedor'}
                  </Box>
                ) : (
                  <Menu closeOnSelect={false}>
                    <MenuButton
                      as={Button}
                      w="100%"
                      textAlign="left"
                      variant="outline"
                      colorScheme="gray"
                      borderColor={vendedoresSel.length > 0 ? 'orange.200' : 'gray.600'}
                      _hover={{
                        borderColor: 'orange.200',
                        bg: 'gray.700',
                        color: 'gray.50',
                      }}
                      _active={{ bg: 'gray.700', color: 'gray.50' }}
                      _focus={{ boxShadow: '0 0 0 1px #fe8026' }}
                      rightIcon={<FiIcons.FiChevronDown />}
                    >
                      {vendedoresSel.length === 0
                        ? 'Selecione um ou mais vendedores'
                        : vendedores.length > 0 && vendedoresSel.length === vendedores.length
                        ? 'Todos os vendedores'
                        : `${vendedoresSel.length} vendedor(es) selecionado(s)`}
                    </MenuButton>
                    <MenuList maxH="280px" overflowY="auto" bg="gray.700" borderColor="gray.600">
                      <HStack px="3" py="2" spacing="2">
                        <Button
                          size="xs"
                          colorScheme="orange"
                          variant="outline"
                          flex="1"
                          onClick={() => setVendedoresSel(vendedores.map((v) => v.id))}
                        >
                          Todos
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="gray"
                          variant="outline"
                          flex="1"
                          onClick={() => setVendedoresSel([])}
                        >
                          Limpar
                        </Button>
                      </HStack>
                      <Divider borderColor="gray.600" />
                      <MenuOptionGroup
                        type="checkbox"
                        value={vendedoresSel}
                        onChange={(v: any) => setVendedoresSel(v as string[])}
                      >
                        {vendedores.map((v) => (
                          <MenuItemOption
                            key={v.id}
                            value={v.id}
                            bg="gray.700"
                            _hover={{ bg: 'gray.600' }}
                            _focus={{ bg: 'gray.600' }}
                            _checked={{ bg: 'orange.200', color: 'white' }}
                            _active={{ bg: 'orange.200' }}
                          >
                            {v.nome}
                          </MenuItemOption>
                        ))}
                      </MenuOptionGroup>
                    </MenuList>
                  </Menu>
                )}
                {!params.id && vendedoresSel.length > 0 && (
                  <Text mt="2" fontSize="sm" color="orange.200">
                    {vendedoresSel
                      .map((id) => vendedores.find((v) => v.id === id)?.nome)
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
              </Box>

              <Box w="160px">
                <Text mb="2" color="gray.300">
                  Ano
                </Text>
                <Select
                  title="Ano"
                  aria-label="Ano"
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  value={ano}
                  onChange={(e: any) => setAno(Number(e.target.value))}
                >
                  {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Box>
            </HStack>

            <Divider my="6" borderColor="gray.700" />

            {/* As 12 casas (meses) — clique alterna a seleção (pode marcar vários) */}
            <Text mb="3" color="gray.300">
              Meses (clique para selecionar; clique de novo para tirar). A meta
              digitada vale para todos os meses selecionados.
            </Text>
            <Wrap spacing="3">
              {MESES.map((nome, i) => {
                const m = i + 1;
                const selecionado = mesesSel.includes(m);
                const foco = m === mesFoco;
                const preenchido = mesPreenchido(m);
                return (
                  <WrapItem key={m}>
                    <Button
                      size="sm"
                      minW="110px"
                      onClick={() => toggleMes(m)}
                      colorScheme={selecionado ? 'orange' : 'gray'}
                      variant={selecionado ? 'solid' : 'outline'}
                      borderColor={
                        foco ? 'orange.300' : preenchido ? 'orange.200' : 'gray.600'
                      }
                      borderWidth={foco ? '2px' : '1px'}
                    >
                      {nome}
                    </Button>
                  </WrapItem>
                );
              })}
            </Wrap>

            <Divider my="6" borderColor="gray.700" />

            {/* Meta do mês selecionado */}
            <Box>
              <Heading size="sm" fontWeight="normal" mb="2">
                {mesesSel.length <= 1
                  ? `${MESES[mesFoco - 1]} / ${ano}`
                  : `${mesesSel.length} meses selecionados / ${ano}`}
              </Heading>
              {mesesSel.length > 1 && (
                <Text mb="4" fontSize="sm" color="orange.200">
                  Editando: {mesesSel.map((m) => MESES[m - 1]).join(', ')} — o que
                  você digitar aqui é aplicado a todos eles.
                </Text>
              )}

              <Box maxW="320px" mb="6">
                <Text mb="2" color="gray.300">
                  Meta do mês (R$)
                </Text>
                <Input
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  placeholder="0,00"
                  value={mes.valorMeta}
                  onChange={(e: any) => setValorMeta(e.target.value)}
                />
              </Box>

              {/* Distribuição por grupo / produto */}
              <HStack justify="space-between" mb="3">
                <Text color="gray.300">Distribuição por grupo / produto</Text>
                <Button
                  size="sm"
                  colorScheme="orange"
                  variant="outline"
                  leftIcon={<FiIcons.FiPlus />}
                  onClick={adicionarItem}
                >
                  Adicionar
                </Button>
              </HStack>

              <VStack spacing="3" align="stretch">
                {mes.itens.length === 0 && (
                  <Text color="gray.500" fontSize="sm">
                    Nenhuma distribuição. Clique em "Adicionar" para distribuir o
                    valor da meta entre grupos e produtos.
                  </Text>
                )}

                {mes.itens.map((item, index) => (
                  <HStack
                    key={index}
                    spacing="3"
                    align="flex-end"
                    bg="gray.900"
                    p="3"
                    borderRadius="md"
                    flexWrap="wrap"
                  >
                    <Box flex="1" minW="200px">
                      <Text mb="1" fontSize="xs" color="gray.400">
                        Grupo
                      </Text>
                      <ReactSelect
                        inputId={`grupo-meta-${index}`}
                        placeholder="Selecione o grupo"
                        options={opcoesCategorias}
                        value={opcoesCategorias.find((c) => c.value === item.categoriaId) || null}
                        onChange={(opcao: any) => atualizarItem(index, 'categoriaId', opcao?.value || '')}
                        styles={selectStyles}
                        isClearable
                        noOptionsMessage={() => 'Nenhum grupo encontrado'}
                      />
                    </Box>

                    <Box flex="1" minW="200px">
                      <Text mb="1" fontSize="xs" color="gray.400">
                        Produto (opcional)
                      </Text>
                      <ReactSelect
                        inputId={`produto-meta-${index}`}
                        placeholder="Todo o grupo"
                        isDisabled={!item.categoriaId}
                        options={opcoesProdutosDoGrupo(item.categoriaId)}
                        value={opcoesProdutosDoGrupo(item.categoriaId).find((p) => p.value === item.produtoId) || null}
                        onChange={(opcao: any) => atualizarItem(index, 'produtoId', opcao?.value || '')}
                        styles={selectStyles}
                        isClearable
                        noOptionsMessage={() => 'Nenhum produto encontrado'}
                      />
                    </Box>

                    <Box w="160px">
                      <Text mb="1" fontSize="xs" color="gray.400">
                        Valor (R$)
                      </Text>
                      <Input
                        size="sm"
                        bg={COR_CAMPO_META}
                        borderColor={COR_CAMPO_META}
                        _hover={{ bg: COR_CAMPO_META, borderColor: COR_CAMPO_META }}
                        _focus={{ bg: COR_CAMPO_META, borderColor: 'orange.200', boxShadow: '0 0 0 1px #fe8026' }}
                        placeholder="0,00"
                        value={item.valor}
                        onChange={(e: any) =>
                          atualizarItem(index, 'valor', e.target.value)
                        }
                      />
                    </Box>

                    <Box w="120px">
                      <Text mb="1" fontSize="xs" color="gray.400">
                        Qtd. produtos
                      </Text>
                      <Input
                        size="sm"
                        bg={COR_CAMPO_META}
                        borderColor={COR_CAMPO_META}
                        _hover={{ bg: COR_CAMPO_META, borderColor: COR_CAMPO_META }}
                        _focus={{ bg: COR_CAMPO_META, borderColor: 'orange.200', boxShadow: '0 0 0 1px #fe8026' }}
                        placeholder="0"
                        inputMode="numeric"
                        value={item.quantidade}
                        onChange={(e: any) =>
                          atualizarItem(index, 'quantidade', e.target.value)
                        }
                      />
                    </Box>

                    <IconButton
                      size="sm"
                      aria-label="Remover"
                      colorScheme="red"
                      bg="red.500"
                      _hover={{ bg: 'red.700' }}
                      icon={<FiIcons.FiTrash2 />}
                      onClick={() => removerItem(index)}
                    />
                  </HStack>
                ))}
              </VStack>

              {/* Resumo da distribuição de VALOR */}
              {valorMetaNum > 0 && (
                <HStack mt="5" spacing="4" flexWrap="wrap">
                  <Badge colorScheme="gray" p="2" borderRadius="md">
                    Meta: R$ {mes.valorMeta || '0,00'}
                  </Badge>
                  <Badge
                    colorScheme={totalDistribuido > valorMetaNum ? 'red' : 'orange'}
                    p="2"
                    borderRadius="md"
                  >
                    Distribuído: R$ {currencyMask(String(Math.round(totalDistribuido * 100)))}
                  </Badge>
                  <Badge
                    colorScheme={restante < 0 ? 'red' : 'green'}
                    p="2"
                    borderRadius="md"
                  >
                    {restante < 0 ? 'Excedeu: R$ ' : 'Restante (livre): R$ '}
                    {currencyMask(String(Math.round(Math.abs(restante) * 100)))}
                  </Badge>
                  {totalQuantidade > 0 && (
                    <Badge colorScheme="blue" p="2" borderRadius="md">
                      Qtd. produtos: {totalQuantidade}
                    </Badge>
                  )}
                </HStack>
              )}
            </Box>

            <Flex w="100%" justify="flex-end" mt="10">
              <HStack spacing="4">
                <Button
                  variant="outline"
                  colorScheme="orange"
                  onClick={() => history.push('/listar/meta')}
                >
                  VOLTAR
                </Button>
                <Button
                  colorScheme="orange"
                  onClick={handleSalvar}
                  isLoading={salvando}
                >
                  SALVAR
                </Button>
              </HStack>
            </Flex>
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
