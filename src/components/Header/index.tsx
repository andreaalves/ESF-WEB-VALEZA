import { Button, Flex, Text, Image } from '@chakra-ui/react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logoLaranja.jpeg';

export const Header = () => {
  const { signOut, user } = useAuth();

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
          justify="space-between"
        >
          <Image
            mr="2"
            borderRadius="full"
            boxSize="40px"
            src={logo}
            alt="Logo"
            objectFit="cover"
          />
          <Text fontSize="2xl" fontWeight="bold">
            Essencial
            <Text as="span" fontSize="sm" ml="2" color="orange.200">
              Sales Force
            </Text>
          </Text>

          <Flex ml="auto" justify="center" align="center">
            <Text mr="3">Olá, {user.name}!</Text>
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
