import { Flex } from '@chakra-ui/react';

interface IChildren {
  children: React.ReactElement;
}

export const Wapper = ({ children }: IChildren) => {
  return (
    <Flex w="100%" mt="80px" align="flex-start" ml="65px">
      {children}
    </Flex>
  );
};
