
module.exports = function (Articleimage) {
  const articleimageParam = Articleimage
  articleimageParam.validatesPresenceOf('articleId', {
    message: {
      labels: 'La imagen del articulo no esta asociada a un articulo',
      field: 'The articleId is required'
    }
  })
  articleimageParam.validatesPresenceOf('imageId', {
    message: {
      labels: 'La imagen del articulo no esta asociada a un articulo imagen',
      field: 'The articleId is required'
    }
  })
}
