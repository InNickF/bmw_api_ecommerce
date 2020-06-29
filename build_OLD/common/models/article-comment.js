
module.exports = function (Articlecomment) {
  const articlecommentParam = Articlecomment
  articlecommentParam.validatesPresenceOf('body', {
    message: {
      labels: 'El comentario es requerido',
      field: 'The body is required'
    }
  })
  articlecommentParam.validatesPresenceOf('articleId', {
    message: {
      labels: 'El comentario no esta asociado a un articulo',
      field: 'The articleId is required'
    }
  })
  articlecommentParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El comentario no esta asociado a un usuario',
      field: 'The userId is required'
    }
  })
}
