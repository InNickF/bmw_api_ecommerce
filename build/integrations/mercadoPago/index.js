const rp = require('request-promise')
const url = `https://api.mercadopago.com/checkout/preferences?access_token=${process.env.MERCADO_PAGO_ACCES_TOKEN}`


function request(path, body = {}, type = 'GET') {
  const options = {
    method: type,
    uri: `${path}${process.env.MERCADO_PAGO_ACCES_TOKEN}`,
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

function inicioPago(preference) {
  console.log(preference)
  return request('https://api.mercadopago.com/checkout/preferences?access_token=', preference, 'POST')
}

function verificarPago(id) {
  return request(`https://api.mercadopago.com/v1/payments/${id}?access_token=`, 'GET')
}

module.exports = {
  inicioPago,
  verificarPago
}
