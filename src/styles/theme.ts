import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  initialColorMode: 'dark',
  useSystemColorMode: false,

  colors: {
    gray: {
      '900': '#181b23',
      '800': '#1f2029',
      '700': '#353646',
      '600': '#4b4d63',
      '500': '#616480',
      '400': '#797D9A',
      '300': '#9699B0',
      '200': '#b3b5c6',
      '100': '#D1d2Dc',
      '50': '#eeeef2',
    },

    orange: {
      '200': '#fe8026',
    },

    components: {
      Button: {
        color: 'white',
      },
    },
  },
  styles: {
    global: {
      'body, html': {
        bg: 'gray.700',
        color: 'gray.50',
      },
    },
  },
});
