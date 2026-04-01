import * as Cesium from 'cesium'

export function initCesium() {
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN
  return Cesium
}