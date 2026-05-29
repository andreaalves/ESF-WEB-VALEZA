import { Routes } from "./routes";
import { ChakraProvider, CSSReset } from "@chakra-ui/react";
import { theme } from "./styles/theme";
import { AuthProvider } from "./context/AuthContext";
import { ParametrizacaoProvider } from "./context/ParametrizacaoContext";
import "./styles/style.css";
// import "./estilo.css";

export function App() {
  return (
    <>
      <ChakraProvider theme={theme}>
        <CSSReset />
        <AuthProvider>
          <ParametrizacaoProvider>
            <Routes />
          </ParametrizacaoProvider>
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}
