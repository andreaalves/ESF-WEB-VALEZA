import { useEffect, useState } from 'react';
import { Box, Button, Flex, Text, Image } from '@chakra-ui/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import {
  baixarLogoEmpresa,
  lerVersaoLogo,
  ouvirLogoAtualizada,
  recortarTransparencia,
} from '../../helpers/logoEmpresa';
import logo from '../../assets/logo-arvore.png';

export const Header = () => {
  const { signOut, user } = useAuth();
  const history = useHistory();
  const irParaPedidos = () => history.push('/listar/pedido');

  // Logomarca da empresa logada (Valeza), servida pela API a partir do arquivo
  // enviado em "Cadastro Empresas" — trocar a logo lá troca aqui na hora.
  const empresaId = user?.empresa?.id;
  const [versaoLogo, setVersaoLogo] = useState(lerVersaoLogo);

  useEffect(() => ouvirLogoAtualizada(() => setVersaoLogo(lerVersaoLogo())), []);

  // `src` já pronto do `<img>`. Vazio = sem logo para mostrar (empresa sem
  // logo cadastrada, ou download que falhou): o bloco todo some e fica só a
  // marca da essencial.
  const [srcLogoEmpresa, setSrcLogoEmpresa] = useState('');

  useEffect(() => {
    let ativo = true;
    // O object URL do download é revogado no cleanup; o do recorte é um
    // data: URL cacheado no helper, que não pode ser revogado.
    let objectUrl = '';

    // A logo não pode mais ir direto no `src`: a rota exige token e o
    // navegador não manda o header do axios. Baixamos pelo axios e exibimos o
    // blob; o recorte tira o vazio transparente em volta do arquivo para as
    // duas marcas ficarem na mesma linha e com a mesma altura (48px).
    setSrcLogoEmpresa('');

    baixarLogoEmpresa(empresaId, versaoLogo).then((url) => {
      if (!url) return;

      // Trocou de empresa/versão enquanto baixava: descarta este resultado.
      if (!ativo) {
        URL.revokeObjectURL(url);
        return;
      }

      objectUrl = url;
      setSrcLogoEmpresa(url);

      // A chave do cache é a empresa+versão, não o object URL: este muda a
      // cada download e nunca acertaria o cache.
      recortarTransparencia(url, `${empresaId}:${versaoLogo}`).then((recortada) => {
        if (ativo) setSrcLogoEmpresa(recortada);
      });
    });

    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [empresaId, versaoLogo]);

  return (
    <>
      <Flex
        as="header"
        w="100%"
        h="20"
        mx="auto"
        align="center"
        bgColor="gray.900"
        zIndex="60"
        pos="fixed"
        top="0"
      >
        <Flex
          zIndex="60"
          bgColor="gray.900"
          pl="94px"
          pr="6"
          mx="auto"
          w="100%"
          align="center"
          justify="space-between"
        >
          <Flex
            align="center"
            cursor="pointer"
            onClick={irParaPedidos}
            title="Ir para pedidos"
          >
            {!!srcLogoEmpresa && (
              <>
                <Image
                  h="48px"
                  maxW="150px"
                  src={srcLogoEmpresa}
                  alt="Logo da empresa"
                  objectFit="contain"
                />
                <Box
                  w="1px"
                  h="32px"
                  mx="4"
                  bg="gray.600"
                  borderRadius="full"
                  flexShrink={0}
                />
              </>
            )}

            <Image
              mr="2"
              boxSize="48px"
              src={logo}
              alt="Logo essencial"
              objectFit="contain"
            />
            <Text fontFamily="kallisto" fontSize="2xl" fontWeight="bold">
              essencial
              <Text
                as="span"
                fontFamily="kallisto"
                fontSize="sm"
                ml="2"
                color="orange.200"
              >
                Sales Force
              </Text>
            </Text>
          </Flex>

          <Flex ml="auto" justify="center" align="center">
            <ThemeToggle />
            <Text mr="3" ml="3">
              Olá, {user.name}!
            </Text>
            <Button
              size="sm"
              bg="blue.500"
              color="white"
              _hover={{
                bg: 'blue.700',
              }}
              onClick={signOut}
            >
              Sair
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </>
  );
};
