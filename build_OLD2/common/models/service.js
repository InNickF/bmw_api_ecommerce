
module.exports = function (Service) {
  const serviceParam = Service
  serviceParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
}
