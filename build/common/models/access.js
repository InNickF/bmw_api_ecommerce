
module.exports = function (Access) {
  const accessParam = Access
  accessParam.validatesPresenceOf('ip', {
    message: {
      labels: 'El campo ip es requerido',
      field: 'The ip is required'
    }
  })
  accessParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido',
      field: 'The userId is required'
    }
  })
}
