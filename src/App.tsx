import { Routes } from "./routes";
import { ChakraProvider, CSSReset } from "@chakra-ui/react";
import { theme } from "./styles/theme";
import { AuthProvider } from "./context/AuthContext";
import { ParametrizacaoProvider } from "./context/ParametrizacaoContext";
import { ThemeModeProvider } from "./context/ThemeModeContext";
import { SidebarProvider } from "./context/SidebarContext";
import "./styles/style.css";
import "./styles/light-theme.css";
// import "./estilo.css";

export function App() {
  return (
    <>
      <ChakraProvider theme={theme}>
        <CSSReset />
        <ThemeModeProvider>
          <AuthProvider>
            <ParametrizacaoProvider>
              <SidebarProvider>
                <Routes />
              </SidebarProvider>
            </ParametrizacaoProvider>
          </AuthProvider>
        </ThemeModeProvider>
      </ChakraProvider>
    </>
  );
}
