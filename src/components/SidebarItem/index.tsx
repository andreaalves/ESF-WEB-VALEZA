import { Icon, Text, Link, Flex } from "@chakra-ui/react";
import { IconType } from "react-icons";
import { Link as LinkRouter } from "react-router-dom";

interface IItem {
  name: string;
  icon: IconType;
  path: string;
  nav: string;
}

export const SidebarItem = ({ name, icon, path, nav }: IItem) => {
  return (
    <Flex p={5} h="6" py="6" _hover={{ bg: "gray.700" }}>
      <Link
        as={LinkRouter}
        display="flex"
        alignItems="center"
        to={path}
        _hover={{
          textDecoration: "none",
        }}
        _focus={{
          boxShadow: "none !important",
        }}
      >
        <Icon as={icon} fontSize="24" color="orange.200" alignItems="center" />

        <Text
          ml="5"
          w="250px"
          fontWeight="medium"
          transitionDuration="0.3s"
          opacity={nav === "small" ? 1 : 0}
        >
          {name}
        </Text>
      </Link>
    </Flex>
  );
};
