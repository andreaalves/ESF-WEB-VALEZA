import {
  IconButton as IconButtonBase,
  Tooltip as TooltipBase,
} from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useThemeMode } from '../../context/ThemeModeContext';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const IconButton = IconButtonBase as React.ComponentType<any>;
const Tooltip = TooltipBase as React.ComponentType<any>;

interface ThemeToggleProps {
  /**
   * Fixa o botão no canto superior direito da tela. Usado em telas sem Header
   * (login), onde não existe barra no topo para encaixar o botão.
   */
  flutuante?: boolean;
  size?: string;
}

export function ThemeToggle({ flutuante = false, size = 'sm' }: ThemeToggleProps) {
  const { ehClaro, alternarModo } = useThemeMode();

  const rotulo = ehClaro ? 'Ativar tema escuro' : 'Ativar tema claro';

  return (
    <Tooltip label={rotulo} placement="bottom" hasArrow openDelay={400}>
      <IconButton
        size={size}
        aria-label={rotulo}
        variant="ghost"
        borderRadius="full"
        color="orange.200"
        bg="transparent"
        _hover={{ bg: 'gray.700', transform: 'rotate(-15deg)' }}
        _active={{ bg: 'gray.600' }}
        transition="transform 0.2s ease, background 0.2s ease"
        icon={ehClaro ? <FiMoon size={18} /> : <FiSun size={18} />}
        onClick={alternarModo}
        {...(flutuante
          ? {
              position: 'fixed',
              top: '16px',
              right: '16px',
              zIndex: 100,
            }
          : {})}
      />
    </Tooltip>
  );
}
