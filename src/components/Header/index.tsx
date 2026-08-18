import { useEffect, useState } from 'react';
import { Box, Button, Flex, Text, Image } from '@chakra-ui/react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import {
  lerVersaoLogo,
  ouvirLogoAtualizada,
  recortarTransparencia,
  urlLogoEmpresa,
} from '../../helpers/logoEmpresa';
import logo from '../../assets/logo-arvore.png';

export const Header = () => {
  const { signOut, user } = useAuth();

  // Logomarca da empresa logada (Valeza), servida pela API a partir do arquivo
  // enviado em "Cadastro Empresas" — trocar a logo lá troca aqui na hora.
  const empresaId = user?.empresa?.id;
  const [versaoLogo, setVersaoLogo] = useState(lerVersaoLogo);
  const [logoComErro, setLogoComErro] = useState(false);

  const logoEmpresa = urlLogoEmpresa(empresaId, versaoLogo);

  useEffect(() => ouvirLogoAtualizada(() => setVersaoLogo(lerVersaoLogo())), []);

  // Recorta o vazio transparente em volta do arquivo enviado para as duas
  // marcas ficarem na mesma linha e com a mesma altura (48px).
  const [srcLogoEmpresa, setSrcLogoEmpresa] = useState(logoEmpresa);

  useEffect(() => {
    let ativo = true;

    // Empresa sem logo cadastrada faz o endpoint responder erro; nesse caso
    // escondemos o bloco todo (imagem + divisória) e fica só a essencial. Ao
    // trocar de URL (nova versão ou outra empresa) vale tentar de novo.
    setLogoComErro(false);
    setSrcLogoEmpresa(logoEmpresa);

    if (logoEmpresa) {
      recortarTransparencia(logoEmpresa).then((src) => {
        if (ativo) setSrcLogoEmpresa(src);
      });
    }

    return () => {
      ativo = false;
    };
  }, [logoEmpresa]);

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
          {!!logoEmpresa && !logoComErro && (
            <>
              <Image
                h="48px"
                maxW="150px"
                src={srcLogoEmpresa}
                alt="Logo da empresa"
                objectFit="contain"
                onError={() => setLogoComErro(true)}
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
