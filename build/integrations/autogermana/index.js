const rp = require('request-promise')
const urlBase = process.env.AUTO_APP_API_URL
const urlBasePvre = process.env.AUTO_APP_API_URL_PUVRE

const request = (url = '', body = {}, type = 'GET') => {
  const options = {
    method: type,
    uri: `${urlBase}${url}`,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'Accept-language': 'es'
    },
    body: body,
    json: true
  }
  return rp(options)
}
const requestPve = (url = '', body = {}, type = 'GET') => {
  const options = {
    method: type,
    uri: `${urlBasePvre}${url}`,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'Accept-language': 'es',
      'api-key': '1dnv0mI.f7301a8621b088238fed3b23ca09aadbaa80cf9d25f627bf8a353aee'
    },
    body: body,
    json: true
  }
  return rp(options)
}

export const getProducts = (productId) => request(`/PartesEcommerce/1/${productId}/`, null, 'GET')

export const getProduct = (sku) => request(`/PartesEcommerce/1/${sku}/`, null, 'GET')

export const getVehicleBrands = () => request('/Marcas', null, 'GET')

export const getModels = () => request('/Modelos', null, 'GET')

export const getSeries = () => request('/Series', null, 'GET')

export const getVehicle = (body) => request(`/Vehiculos/${body.chassis}`, body, 'GET')

export const getReferences = (body) => request(`/PartesVehiculos/${body.id}`, body, 'GET')

export const createdOrder = (body) => requestPve('/pvre', body, 'POST')

export const getCategories = () => request('/CategoriasAutogermana', null, 'GET')

export const getDetailAvailability = (sku) => request(`/DisponibilidadEcommerceAutogermana/${sku}/`, null, 'GET')

export const getAvailabilityPrice = (sku) => request(`/DisponibilidadPrecioEcommerceAutogermana/${sku}/`, null, 'GET')

export const getModelCompatibility = (sku) => request(`/CompatibilidadModeloAutogermana/${sku}/`, null, 'GET')

export const getBodyWorks = () => request('/CarroceriasAutogermana', null, 'GET')

export const getStockBySKU = sku => request(`/DisponibilidadEcommerceAutogermana/${sku}`)

export const getVariationBySKU = sku => request(`/VariacionReferenciasEcommerceAutogermana/${sku}`)
