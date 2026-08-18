import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  VStack as VStackBase,
  Divider as DividerBase,
  ButtonGroup as ButtonGroupBase,
  useToast,
  Text as TextBase,
  Image as ImageBase,
} from '@chakra-ui/react';
import { Header } from '../../components/Header';
import { useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import api from '../../service/api';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { EmpresaFormFields } from '../../components/EmpresaFormFields';

// Chakra UI v1 + TS strict estoura TS2590 ("union type too complex") quando
// uma página mistura muitos componentes. Casting para any contorna o limite.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const VStack = VStackBase as any;
const Divider = DividerBase as any;
const ButtonGroup = ButtonGroupBase as any;
const Text = TextBase as any;
const Image = ImageBase as any;

type IParams = {
  id: string;
};

export const CreateParams = () => {
  const params = useParams<IParams>();

  const { register, handleSubmit, formState, control, setValue } =
    useForm<any>();

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  // Muda a cada upload bem-sucedido só pra forçar o <img> a buscar de novo
  // (o browser cachearia a mesma URL indefinidamente sem isso).
  // Cada abertura da tela usa uma URL nova. O endpoint da API permite cache
  // por uma hora; iniciar sempre em zero fazia o navegador reapresentar a
  // imagem antiga mesmo depois de ela já ter sido alterada no banco.
  const [logoVersion, setLogoVersion] = useState(() => Date.now());

  useEffect(() => {
    if (!params.id) return;

    api
      .get(`/empresa/${params.id}`)
      .then((response) => {
        const empresa = response.data;
        if (!empresa) return;

        setValue('razaoSocial', empresa.razao_social || '');
        setValue('fantasia', empresa.fantasia || '');
        setValue('cnpj', empresa.cnpj || '');
        setValue('ie', empresa.ie || '');
        setValue('telefone', empresa.telefone || '');
        setValue(
          'limiteCredito',
          String(Math.round(Number(empresa.limite_credito || 0) * 100))
        );
        setValue('email', empresa.email || '');
        setValue('emailXmlNfe', empresa.email_xml_nfe || '');
        setValue('segmento', empresa.segmento || '');
        setValue('observacaoEmpresa', empresa.observacao || '');
        setValue('statusEmpresa', empresa.status_empresa || 'ATIVO');
        setValue('filial', empresa.filial || '');
        setValue('matriz', String(!!empresa.matriz));
      });
  }, [params, setValue]);

  // Converte "1.234,56" (currencyMask) para 1234.56.
  const parseCurrency = (value?: string): number => {
    if (!value) return 0;
    return Number(String(value).replace(/\./g, '').replace(',', '.')) || 0;
  };

  const semValor = (v: any) => v === undefined || v === null || v === '';

  const uploadLogo = async (file: File, empresaId: string) => {
    const formData = new FormData();
    formData.append('logo', file, file.name);

    const baseURL = api.defaults.baseURL;
    if (!baseURL) throw new Error('Endereço da API não configurado.');
    const token = localStorage.getItem('@Aplication:token');

    // Não definir Content-Type aqui: o navegador precisa acrescentar o
    // boundary do multipart/form-data automaticamente.
    const resp = await fetch(`${baseURL}/editar-empresa/${empresaId}`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const responseData = await resp.json().catch(() => null);

    if (!resp.ok) {
      throw new Error(
        responseData?.message ||
          responseData?.error ||
          `Falha ao enviar a logomarca (HTTP ${resp.status}).`
      );
    }

    // Confirma pelo endpoint de leitura que o mesmo binário foi persistido.
    const savedLogoResponse = await fetch(
      `${baseURL}/empresa/${empresaId}/logo?v=${Date.now()}`,
      { cache: 'no-store' }
    );

    if (!savedLogoResponse.ok) {
      throw new Error(
        `A API respondeu ao envio, mas a logo não pôde ser confirmada (HTTP ${savedLogoResponse.status}).`
      );
    }

    const savedLogo = await savedLogoResponse.blob();
    const [sentBuffer, savedBuffer] = await Promise.all([
      file.arrayBuffer(),
      savedLogo.arrayBuffer(),
    ]);
    const sentBytes = new Uint8Array(sentBuffer);
    const savedBytes = new Uint8Array(savedBuffer);
    const sameBinary =
      sentBytes.length === savedBytes.length &&
      sentBytes.every((byte, index) => byte === savedBytes[index]);

    if (!sameBinary) {
      throw new Error(
        `A logo retornada pela API não corresponde ao arquivo enviado (enviado: ${file.size} bytes; retornado: ${savedLogo.size} bytes).`
      );
    }

    return savedLogo.size;
  };

  // PUT /editar-empresa/:id agora é parcial de verdade: campo ausente mantém
  // o valor já salvo (a API não aceita string vazia em campos como email, e
  // sobrescreveria à toa os que não têm string vazia como sentinela) — por
  // isso removemos os campos vazios do payload em vez de mandar "".
  const onSubmitEmpresa: SubmitHandler<any> = async (data) => {
    const enderecoBruto = {
      logradouro: data.endereco?.logradouro,
      numero: data.endereco?.numero,
      complemento: data.endereco?.complemento,
      bairro: data.endereco?.bairro,
      cidade: data.endereco?.cidade,
      uf: data.endereco?.uf,
      cep: data.endereco?.cep,
      codigo_ibge: data.endereco?.codigoIbge,
      ponto_referencia: data.endereco?.pontoReferencia,
    };
    const enderecoPreenchido = Object.values(enderecoBruto).some((v) => !semValor(v));

    const dados: Record<string, any> = {
      razao_social: data.razaoSocial,
      fantasia: data.fantasia,
      cnpj: data.cnpj,
      ie: data.ie,
      telefone: data.telefone,
      limite_credito: parseCurrency(data.limiteCredito),
      email: data.email,
      email_xml_nfe: data.emailXmlNfe,
      segmento: data.segmento,
      observacao: data.observacaoEmpresa,
      status_empresa: data.statusEmpresa,
      filial: data.filial,
      matriz: String(data.matriz) === 'true',
    };
    Object.keys(dados).forEach((k) => {
      if (semValor(dados[k])) delete dados[k];
    });

    // Só manda endereço se o usuário preencheu algo — sem isso o endereço já
    // cadastrado (que o front não consegue ler hoje) fica intacto.
    if (enderecoPreenchido) {
      const enderecoLimpo: Record<string, any> = {};
      Object.entries(enderecoBruto).forEach(([k, v]) => {
        if (!semValor(v)) enderecoLimpo[k] = v;
      });
      // tipo_endereco/latitude/longitude não têm campo no formulário, mas o
      // POST /cadastrar-empresas exige os três pra criar — manda um padrão
      // sensato em vez de travar o cadastro por um dado que o usuário nem
      // consegue preencher na tela.
      if (semValor(enderecoLimpo.tipo_endereco)) enderecoLimpo.tipo_endereco = 'Comercial';
      if (semValor(enderecoLimpo.latitude)) enderecoLimpo.latitude = 0;
      if (semValor(enderecoLimpo.longitude)) enderecoLimpo.longitude = 0;
      dados.endereco = enderecoLimpo;
    }

    setIsSavingEmpresa(true);
    try {
      let empresaId = params.id;

      if (params.id) {
        await api.put(`/editar-empresa/${params.id}`, dados);
      } else {
        const response = await api.post('/cadastrar-empresas', dados);
        empresaId = response.data?.empresa_id;
      }

      // Selecionar uma imagem e usar o botão principal SALVAR também precisa
      // persistir a logo. Antes, esse botão ignorava logoFile e navegava para
      // fora da tela, apesar de a prévia local dar a impressão de que ela
      // seria enviada.
      if (logoFile) {
        if (!empresaId) {
          throw new Error(
            'A empresa foi salva, mas a API não devolveu o ID necessário para enviar a logomarca.'
          );
        }
        await uploadLogo(logoFile, empresaId);
        setLogoFile(null);
        setLogoVersion(Date.now());
      }

      toast({
        title: params.id
          ? 'Dados da empresa atualizados com sucesso'
          : 'Empresa cadastrada com sucesso',
        description: logoFile ? 'Logomarca confirmada pela API' : '',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/parametrizacao');
    } catch (error: any) {
      const apiErrors = error?.response?.data?.errors;
      toast({
        title: 'Erro Inesperado',
        description: apiErrors?.[0]
          ? `${apiErrors[0].field}: ${apiErrors[0].message}`
          : error?.response?.data?.message ||
            error?.message ||
            'Tente novamente daqui alguns minutos',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoFile(e.target.files?.[0] || null);
  };

  const handleSaveLogo = async () => {
    if (!logoFile || !params.id) return;

    setIsSavingLogo(true);
    try {
      const savedLogoSize = await uploadLogo(logoFile, params.id);

      toast({
        title: 'Logomarca atualizada com sucesso',
        description: `${savedLogoSize} bytes confirmados pela API`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setLogoFile(null);
      // Um timestamp é único entre recarregamentos da página; um contador que
      // sempre volta a zero pode reutilizar ?v=1 e exibir a logo antiga.
      setLogoVersion(Date.now());
    } catch (error: any) {
      toast({
        title: 'Não foi possível salvar a logomarca',
        description:
          error?.message ||
          error?.response?.data?.message ||
          'Tente novamente daqui alguns minutos',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSavingLogo(false);
    }
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              CADASTRO DE EMPRESAS
            </Heading>

            <Divider my="6" borderColor="gray.700" />

            <VStack spacing="6" align="stretch">
              <EmpresaFormFields
                register={register}
                control={control}
                errors={errors}
              />

              <Box>
                <Text>Logomarca:</Text>
                <Box bg={'gray.700'} borderRadius="lg" p={4} mt={2}>
                  <Image
                    boxSize="100px"
                    mb={3}
                    src={
                      logoFile
                        ? URL.createObjectURL(logoFile)
                        : params.id
                        ? `${api.defaults.baseURL}/empresa/${params.id}/logo?v=${logoVersion}`
                        : ''
                    }
                    onError={(e: any) => { e.target.style.display = 'none'; }}
                    onLoad={(e: any) => { e.target.style.display = 'block'; }}
                    alt="Logo"
                    objectFit="cover"
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleLogoChange}
                  />
                  <Button
                    type="button"
                    display="block"
                    mt={2}
                    size="sm"
                    colorScheme="orange"
                    variant="outline"
                    isDisabled={!logoFile || !params.id}
                    isLoading={isSavingLogo}
                    onClick={handleSaveLogo}
                  >
                    Salvar Logomarca
                  </Button>
                </Box>
              </Box>

              <Flex w="100%" justify="flex-end">
                <ButtonGroup spacing="4">
                  <Button
                    fontSize="md"
                    variant="outline"
                    colorScheme="orange"
                    onClick={() => {
                      history.push('/listar/parametrizacao');
                    }}
                  >
                    VOLTAR
                  </Button>
                  <Button
                    fontSize="md"
                    colorScheme="orange"
                    isLoading={isSavingEmpresa}
                    onClick={handleSubmit(onSubmitEmpresa)}
                  >
                    SALVAR
                  </Button>
                </ButtonGroup>
              </Flex>
            </VStack>
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
