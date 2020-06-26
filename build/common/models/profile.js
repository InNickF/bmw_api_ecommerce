
module.exports = function (Profile) {
  const profileParam = Profile

  profileParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido',
      field: 'The userId is required'
    }
  })

  profileParam.validatesUniquenessOf('userId', {
    message: {
      labels: 'El usuario ya tiene un perfil',
      field: 'The userId already exists'
    }
  })
}
