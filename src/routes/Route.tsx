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
  // Se informado, só usuários com esse role acessam a rota (ex.: Parametrização
  // restrita a ROLE_ADMIN). Sem essa prop, qualquer usuário logado (exceto
  // ROLE_SELLER, barrado globalmente abaixo) acessa normalmente.
  allowedRoles?: string[];
}

const Route: React.FC<RouteProps> = ({
  isPrivate = false,
  component: Component,
  allowedRoles,
  ...rest
}) => {
  const { user, signOut } = useAuth();

  const history = useHistory();

  const toast = useToast();

  const semPermissaoDeRole = !!(
    allowedRoles &&
    user &&
    !allowedRoles.includes(user.role)
  );

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
      return;
    }

    if (semPermissaoDeRole) {
      toast({
        title: "Acesso Negado",
        description: `Você não tem permissão para acessar essa página`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      history.push("/home");
    }
  }, [history, signOut, toast, user, semPermissaoDeRole]);

  return (
    <ReactDOMRoute
      {...rest}
      render={({ location }) => {
        if (isPrivate === !!user && semPermissaoDeRole) {
          return <Redirect to={{ pathname: "/home", state: { from: location } }} />;
        }

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
