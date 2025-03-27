import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  Button,
  Flex,
  HStack,
  Box,
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { InputCustom } from "../InputCustom/InputCustom";

const { register, handleSubmit, formState, reset, setValue, getValues } =
  useForm();

const { errors } = formState;

export const ModalEditProductPrice = () => {
  return (
    <>
      <Popover placement="top-end">
        <PopoverTrigger>
          <Button>Click me</Button>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverHeader fontWeight="semibold">Popover placement</PopoverHeader>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverBody>
            <Flex bg="gray.900" p="4">
              <HStack spacing="2">
                <Box w="20%">
                  <InputCustom
                    name="produto.nome"
                    label="Produto"
                    isReadOnly
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="precoCusto"
                    label="Custo"
                    isReadOnly
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="imposto"
                    label="Imposto"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="frete"
                    label="Frete"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="comissao"
                    label="Comissao"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="mkt"
                    label="Mkt"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="lucro"
                    label="Lucro"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="precoVenda"
                    label="Preço Final"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
                <Box w="10%">
                  <InputCustom
                    name="precoMinimo"
                    label="Preço Minímo"
                    errors={errors}
                    register={register}
                    size="sm"
                  />
                </Box>
              </HStack>
            </Flex>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </>
  );
};
