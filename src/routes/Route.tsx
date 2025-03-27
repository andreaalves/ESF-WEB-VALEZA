import { useToast } from "@chakra-ui/react";
import React from "react";
import { useEffect } from "react";
import {
  RouteProps as ReactDOMRouteProps,
  Route as ReactDOMRoute,
  Redirect,
  useHistory,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

interface RouteProps extends ReactDOMRouteProps {
  isPrivate?: boolean;
  component: React.ComponentType;
}

const Route: React.FC<RouteProps> = ({
  isPrivate = false,
  component: Component,
  ...rest
}) => {
  const { user, signOut } = useAuth();

  const history = useHistory();

  const toast = useToast();

  useEffect(() => {
    if (user?.role === "ROLE_SELLER") {
      signOut();
      toast({
        title: "Acesso Negado",
        description: `Você não tem permissão para acessar essa página`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      history.push("/");
    }
  }, [history, signOut, toast, user]);

  return (
    <ReactDOMRoute
      {...rest}
      render={({ location }) => {
        return isPrivate === !!user ? (
          <>
            <Component />
          </>
        ) : (
          <Redirect
            to={{
              pathname: isPrivate ? "/" : "/home",
              state: { from: location },
            }}
          />
        );
      }}
    />
  );
};

export default Route;
