import { Flex, Divider } from '@chakra-ui/react';
import React, { useState } from 'react';
import {
  HiOutlineTag,
  HiOutlineShoppingBag,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineDocumentReport,
  HiOutlineUserAdd,
  HiOutlineLocationMarker,
} from 'react-icons/hi';
import { IoSettingsOutline } from 'react-icons/io5';
import { RiMoneyDollarCircleLine } from 'react-icons/ri';
import { FiTarget, FiBarChart2 } from 'react-icons/fi';

import { SidebarItem } from '../SidebarItem';
import { useParametrizacao } from '../../context/ParametrizacaoContext';

const NavFlex = Flex as React.ComponentType<any>;
const NavDivider = Divider as React.ComponentType<any>;

export const SiderbarResponsive = () => {
  const [navSize, setNavSize] = useState('large');
  const { utilizaOpme } = useParametrizacao();

  return (
    <NavFlex
      zIndex="20"
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
      onMouseEnter={() => { setNavSize('small'); }}
      onMouseLeave={() => { setNavSize('large'); }}
    >
      <NavFlex as="aside" flexDir="column" justifyContent="center" mt="100px">

        <SidebarItem name="Pedidos" nav={navSize} icon={HiOutlineDocumentReport} path="/listar/pedido" />
        <NavDivider w={navSize === 'large' ? '30px' : '220px'} transitionDuration="0.42s" ml={4} />
        <SidebarItem name="Orçamentos" nav={navSize} icon={HiOutlineDocumentText} path="/listar/orcamento" />
        <NavDivider w={navSize === 'large' ? '30px' : '220px'} transitionDuration="0.42s" ml={4} />
        <SidebarItem name="Categorias" nav={navSize} icon={HiOutlineTag} path="/listar/categoria" />
        <SidebarItem name="Produtos" nav={navSize} icon={HiOutlineShoppingBag} path="/listar/produto" />
        <SidebarItem name="Tabela de Preço" nav={navSize} icon={RiMoneyDollarCircleLine} path="/listar/tabela-preco" />
        <NavDivider w={navSize === 'large' ? '30px' : '220px'} transitionDuration="0.42s" ml={4} />
        <SidebarItem name="Clientes" nav={navSize} icon={HiOutlineUserGroup} path="/listar/cliente" />
        <NavDivider w={navSize === 'large' ? '30px' : '220px'} transitionDuration="0.42s" ml={4} />
        <SidebarItem name="Vendedores" nav={navSize} icon={HiOutlineUserAdd} path="/listar/vendedor" />
        <SidebarItem name="Metas" nav={navSize} icon={FiTarget} path="/listar/meta" />
        <SidebarItem name="Painel de Metas" nav={navSize} icon={FiBarChart2} path="/painel/metas" />
        {utilizaOpme && (
          <SidebarItem name="Mapa Cirúrgico" nav={navSize} icon={HiOutlineLocationMarker} path="/mapa-cirurgico" />
        )}
        <NavDivider w={navSize === 'large' ? '30px' : '220px'} transitionDuration="0.42s" ml={4} />
        <SidebarItem name="Parametrização" nav={navSize} icon={IoSettingsOutline} path="/listar/parametrizacao" />

      </NavFlex>
    </NavFlex>
  );
};
