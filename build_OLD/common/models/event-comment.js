
module.exports = function (Eventcomment) {
  const eventcommentParam = Eventcomment

  eventcommentParam.validatesPresenceOf('body', {
    message: {
      labels: 'El comentario es requerido',
      field: 'The body is required'
    }
  })
  eventcommentParam.validatesPresenceOf('score', {
    message: {
      labels: 'La calificacion es requerido',
      field: 'The score is required'
    }
  })
  eventcommentParam.validatesPresenceOf('eventId', {
    message: {
      labels: 'El comentario no esta asociado a un evento',
      field: 'The eventId is required'
    }
  })
  eventcommentParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El comentario no esta asociado a un usuario',
      field: 'The userId is required'
    }
  })
}
