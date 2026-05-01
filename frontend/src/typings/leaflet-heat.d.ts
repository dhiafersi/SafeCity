import * as L from 'leaflet';

declare global {
  interface Window {
    L: typeof L & {
      heatLayer(latlngs: any[], options?: any): any;
    };
  }
}

// Augment the Leaflet namespace for the compiler
declare module 'leaflet' {
  function heatLayer(latlngs: any[], options?: any): any;
}
