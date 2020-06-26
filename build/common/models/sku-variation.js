
module.exports = function (SkuVariation) {
  const skuVariationParam = SkuVariation

  skuVariationParam.destroyAll = async body => {
    console.log(body)

    // obtengo la orden
    const {
      SkuVariation
    } = skuVariationParam.app.models

    let skus
    try {
      /* skus = await SkuVariation.deleteAll() */
    } catch (error) {
      throw error
    }

    return skus
  }

  skuVariationParam.remoteMethod('destroyAll', {
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    },
    http: {
      verb: 'get',
      path: '/destroy-all'
    },
    returns: {
      arg: 'retunr',
      type: 'object',
      root: true
    }
  })
}
