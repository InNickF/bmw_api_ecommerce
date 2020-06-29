const rp = require('request-promise')
const urlZonaVirtual = process.env.ZONA_VIRTUAL_API_URL

function request (url = '', body = {}, type = 'GET') {
  const options = {
    method: type,
    uri: `${urlZonaVirtual}${url}`,
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

function inicioPago (body) {
  return request('api_inicio_pago/api/inicio_pagoV2', body, 'POST')
}

function verificarPago (body) {
  return request('api_verificar_pagoV3/api/verificar_pago_v3', body, 'POST')
}

module.exports = {
  inicioPago,
  verificarPago
}
