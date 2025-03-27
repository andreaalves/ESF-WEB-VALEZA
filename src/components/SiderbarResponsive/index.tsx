import { Flex, Divider } from '@chakra-ui/react';
import { useState } from 'react';
import {
  HiOutlineTag,
  HiOutlineShoppingBag,
  // HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineDocumentReport,
  HiOutlineUserAdd,
} from 'react-icons/hi';
import {
  // IoGlobeOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { RiMoneyDollarCircleLine } from 'react-icons/ri';
// import { AiOutlineCalendar } from 'react-icons/ai';

import { SidebarItem } from '../SidebarItem';

export const SiderbarResponsive = () => {
  const [navSize, setNavSize] = useState('large');

  return (
    <Flex
      // p="5"
      zIndex="1"
      pos="fixed"
      top="0px"
      transitionDuration="0.3s"
      transitionTimingFunction="ease-in"
      overflow="hidden"
      h="100vh"
      w={navSize === 'large' ? '65px' : '250px'}
      flexDir="column"
      justify="space-between"
      bg="gray.900"
      border="1px solid"
      borderColor="gray.800"
      as="nav"
      onMouseEnter={() => {
        setNavSize('small');
      }}
      onMouseLeave={() => {
        setNavSize('large');
      }}
    >
      <Flex as="aside" flexDir="column" justifyContent="center" mt="100px">
        {/* <VStack spacing="6" align="flex-start"> */}

        <SidebarItem
          name="Pedidos"
          nav={navSize}
          icon={HiOutlineDocumentReport}
          path="/listar/pedido"
        />
        <Divider
          w={navSize === 'large' ? '30px' : '220px'}
          transitionDuration="0.42s"
          ml={4}
        />
        <SidebarItem
          name="Categorias"
          nav={navSize}
          icon={HiOutlineTag}
          path="/listar/categoria"
        />
        <SidebarItem
          name="Produtos"
          nav={navSize}
          icon={HiOutlineShoppingBag}
          path="/listar/produto"
        />
        <SidebarItem
          name="Tabela de Preço"
          nav={navSize}
          icon={RiMoneyDollarCircleLine}
          path="/listar/tabela-preco"
        />

        <Divider
          w={navSize === 'large' ? '30px' : '220px'}
          transitionDuration="0.42s"
          ml={4}
        />
        {/* <SidebarItem
          name="Transportadoras"
          nav={navSize}
          icon={IoGlobeOutline}
          path="/listar/transportadora"
        />

        <SidebarItem
          name="Fretes"
          nav={navSize}
          icon={HiOutlineTruck}
          path="/listar/frete"
        /> */}
        {/* <Divider
          w={navSize === 'large' ? '30px' : '220px'}
          transitionDuration="0.42s"
          ml={4}
        /> */}
        {/* <SidebarItem
          name="Fornecedores"
          nav={navSize}
          icon={HiOutlineIdentification}
          path="/listar/fornecedor"
        /> */}
        <SidebarItem
          name="Clientes"
          nav={navSize}
          icon={HiOutlineUserGroup}
          path="/listar/cliente"
        />
        <Divider
          w={navSize === 'large' ? '30px' : '220px'}
          transitionDuration="0.42s"
          ml={4}
        />
        <SidebarItem
          name="Vendedores"
          nav={navSize}
          icon={HiOutlineUserAdd}
          path="/listar/vendedor"
        />

        {/* <SidebarItem
          name="Agendamentos"
          nav={navSize}
          icon={AiOutlineCalendar}
          path="/listar/agendamento"
        /> */}
        <Divider
          w={navSize === 'large' ? '30px' : '220px'}
          transitionDuration="0.42s"
          ml={4}
        />
        <SidebarItem
          name="Parametrização"
          nav={navSize}
          icon={IoSettingsOutline}
          path="/listar/parametrizacao"
        />
        {/* </VStack> */}
      </Flex>
    </Flex>
  );
};
