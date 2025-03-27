import { Routes } from "./routes";
import { ChakraProvider, CSSReset } from "@chakra-ui/react";
import { theme } from "./styles/theme";
import { AuthProvider } from "./context/AuthContext";
import "./styles/style.css";
// import "./estilo.css";

export function App() {
  return (
    <>
      <ChakraProvider theme={theme}>
        <CSSReset />
        <AuthProvider>
          <Routes />
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}
