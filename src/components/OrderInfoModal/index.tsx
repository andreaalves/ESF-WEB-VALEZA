import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useEffect } from "react";

interface IOrderInfoModal {
  order: any[];
  showIndex: number;
  setShowIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function OrderInfoModal({
  order,
  showIndex,
  setShowIndex,
}: IOrderInfoModal) {
  const [currentOrder, setCurrentOrder] = useState<any>({});
  const [total, setTotal] = useState(0);

  function handleClose() {
    setShowIndex(-1);
  }

  useEffect(() => {
    if (order.length <= 0) return;

    const findCurrentOrder = order.find((ord) => ord.id === showIndex);
    let total = 0;

    if (!findCurrentOrder) return;

    findCurrentOrder.itensPedido.forEach((itemPedido: any) => {
      total +=
        Number(itemPedido.quantidade) * Number(itemPedido.produto.precoVenda);
    });

    setTotal(total);

    setCurrentOrder(findCurrentOrder);
  }, [order, showIndex]);

  return (
    <>
      {currentOrder && (
        <Modal isOpen={showIndex !== -1} onClose={handleClose}>
          <ModalOverlay />
          <ModalContent
            as={Flex}
            alignItems="center"
            justify="center"
            px={10}
            bg="gray.900"
            border="1px solid"
            borderColor="gray.800"
            zIndex="999999999"
            w="50vw"
            maxW="100%"
            minH="50vh"
          >
            {showIndex >= 0 && (
              <>
                <ModalHeader>LISTA DE PRODUTOS</ModalHeader>
                <ModalCloseButton />
                <ModalBody
                  w="100%"
                  as={Flex}
                  mt={4}
                  bg="gray.900"
                  flexDirection="column"
                >
                  <SimpleGrid columns={2} spacing={4} w="100%">
                    {currentOrder.itensPedido &&
                      currentOrder.itensPedido.map((itemPedido: any) => (
                        <Flex
                          p={2}
                          justifyContent="left"
                          border="1px solid"
                          borderColor="gray.700"
                          w="100%"
                          h="150px"
                          flexDirection="column"
                        >
                          <Stack spacing={2}>
                            <Text
                              as="p"
                              textAlign="center"
                              fontSize="14px"
                              color="gray.100"
                              fontWeight="bold"
                              mb={2}
                            >
                              {itemPedido.produto.nome.toUpperCase()}
                            </Text>
                            <Text as="p">
                              <Text
                                textColor="gray.200"
                                fontSize="14px"
                                as="span"
                                fontWeight="bold"
                              >
                                PREÇO UNITÁRIO:{" "}
                              </Text>
                              R$ {itemPedido.produto.precoVenda.toFixed(2)}
                            </Text>
                            <Text>
                              <Text
                                textColor="gray.200"
                                fontSize="14px"
                                as="span"
                                fontWeight="bold"
                              >
                                {" "}
                                QUANTIDADE:{" "}
                              </Text>
                              {itemPedido.quantidade}
                            </Text>
                            <Text>
                              <Text
                                textColor="gray.200"
                                fontSize="14px"
                                as="span"
                                fontWeight="bold"
                              >
                                {" "}
                                TOTAL:{" "}
                              </Text>
                              R${" "}
                              {(
                                Number(itemPedido.quantidade) *
                                Number(itemPedido.produto.precoVenda)
                              ).toFixed(2)}
                            </Text>
                          </Stack>
                        </Flex>
                      ))}
                  </SimpleGrid>

                  <Stack>
                    <Text mt={4}>
                      <Text
                        textColor="gray.200"
                        fontSize="14px"
                        as="span"
                        fontWeight="bold"
                      >
                        VALOR TOTAL DO PEDIDO:{" "}
                      </Text>
                      R$ {total.toFixed(2)}
                    </Text>

                    <Text mt={4}>
                      <Text
                        textColor="gray.200"
                        fontSize="14px"
                        as="span"
                        fontWeight="bold"
                      >
                        FORMA DE PAGAMENTO:{" "}
                      </Text>
                      {currentOrder.formaPagamento}
                    </Text>

                    <Text mt={4}>
                      <Text
                        textColor="gray.200"
                        fontSize="14px"
                        as="span"
                        fontWeight="bold"
                      >
                        CONDIÇÃO DE PAGAMENTO:{" "}
                      </Text>
                      {currentOrder.condicaoPagamento}
                    </Text>
                  </Stack>
                </ModalBody>

                <ModalFooter>
                  <Button colorScheme="orange" mr={3} onClick={handleClose}>
                    Fechar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
