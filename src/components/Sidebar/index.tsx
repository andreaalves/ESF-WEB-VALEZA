import { Box, Icon, Stack, Text, Link } from "@chakra-ui/react";
import { RiContactsLine, RiDashboardLine } from "react-icons/ri";
import { Link as LinkRouter } from "react-router-dom";

export const Sidebar = () => {
  return (
    <Box as="aside" w="48" mr="8">
      <Stack spacing="12" align="flex-start">
        <Box>
          <Text fontWeight="bold" color="gray.400" fontSize="small">
            GERAL
          </Text>
          <Stack spacing="4" mt="8" align="stretch">
            <Link
              as={LinkRouter}
              display="flex"
              alignItems="center"
              to={"/listar/transportadora"}
            >
              <Icon as={RiDashboardLine} fontSize="20" color="orange.200" />
              <Text ml="4" fontWeight="medium">
                Transportadora
              </Text>
            </Link>
            <Link
              as={LinkRouter}
              display="flex"
              alignItems="center"
              to={"/listar/frete"}
            >
              <Icon as={RiContactsLine} fontSize="20" color="orange.200" />
              <Text ml="4" fontWeight="medium">
                Frete
              </Text>
            </Link>

            <Link
              as={LinkRouter}
              display="flex"
              alignItems="center"
              to={"/listar/categoria"}
            >
              <Icon as={RiContactsLine} fontSize="20" color="orange.200" />
              <Text ml="4" fontWeight="medium">
                Categoria
              </Text>
            </Link>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
