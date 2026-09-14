/**
 * O CRA 4 (webpack 4) não empacota o web worker do mapbox-gl sozinho. A saída
 * oficial da Mapbox é usar o build "csp" (sem worker embutido) e carregar o
 * worker pelo worker-loader — ver src/pages/EmRota/MapaEntrega.tsx.
 *
 * Os dois módulos abaixo não têm tipos próprios; o "csp" é o mesmo objeto do
 * pacote principal, então reaproveita os tipos oficiais de `mapbox-gl`.
 */
declare module 'mapbox-gl/dist/mapbox-gl-csp' {
  import mapboxgl from 'mapbox-gl';
  export default mapboxgl;
}

declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}
