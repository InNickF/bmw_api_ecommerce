
module.exports = function (Instalation) {
  const instalationParam = Instalation
  instalationParam.validatesPresenceOf('cost', {
    message: {
      labels: 'El campo costo de la instalación es requerido',
      field: 'The cost is required'
    }
  })
  instalationParam.validatesPresenceOf('orderId', {
    message: {
      labels: 'La instalación no esta asociada a una orden',
      field: 'The orderId is required'
    }
  })
}
