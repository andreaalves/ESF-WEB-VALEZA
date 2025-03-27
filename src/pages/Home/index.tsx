// import { useContext } from "react";
import { Flex, Box, Heading, Button, Icon } from "@chakra-ui/react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { RiAddLine } from "react-icons/ri";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";

// import AuthContext from "../../Context/AuthContext";

export const Home = () => {
  return (
    <>
      <Header />

      <Flex>
        <SiderbarResponsive />

        <Wapper>
          <Box flex="1" p="8" bg="gray.800" m="8" borderRadius={8}>
            <Flex mb="8" justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                FRETES
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
              >
                Cadastrar
              </Button>
            </Flex>
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
