import { Box, Flex, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import api from "../../service/api";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import BIView from "../SurgicalMap/BIView";

// Dashboard gerencial dos pedidos do Mapa Cirúrgico — era a aba "BI" dentro do
// próprio mapa, virou item de menu próprio. Mesma fonte de dados (resposta crua
// de /pedidos/{empresa}/empresa) e mesmo polling de 3 min do Mapa Cirúrgico,
// buscados aqui de forma independente.
export const MapaCirurgicoDashboard = () => {
    const { user } = useAuth();
    const { larguraAtual } = useSidebar();
    const [rawPedidos, setRawPedidos] = useState<any[]>([]);

    const fetchPedidos = useCallback(() => {
        const empresaId = user?.empresa?.id;
        if (!empresaId) return;

        api.get(`/api-essencial/v1/pedidos/${empresaId}/empresa`)
            .then((r) => setRawPedidos((r.data || []) as any[]))
            .catch(() => {});
    }, [user?.empresa?.id]);

    useEffect(() => {
        fetchPedidos();
        const timer = setInterval(fetchPedidos, 180000);
        return () => clearInterval(timer);
    }, [fetchPedidos]);

    return (
        <>
            <Header />
            <SiderbarResponsive />

            <Flex direction="column" ml={larguraAtual} mt="80px" minH="calc(100vh - 80px)" bg="gray.700">
                <Box
                    bg="gray.800"
                    py={4}
                    px={6}
                    textAlign="center"
                    flexShrink={0}
                    borderBottom="2px solid"
                    borderColor="orange.500"
                >
                    <Text fontWeight="semibold" fontSize="xl" color="gray.50">
                        DASHBOARD
                    </Text>
                </Box>

                <BIView pedidos={rawPedidos} />
            </Flex>
        </>
    );
};

export default MapaCirurgicoDashboard;
