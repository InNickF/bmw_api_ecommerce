
module.exports = function (Relatedproduct) {
  const relatedproductParam = Relatedproduct
  relatedproductParam.validatesPresenceOf('relatedProductId', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  relatedproductParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The name is required'
    }
  })
  relatedproductParam.Complements = async (req, body) => {
    const {
      Product
    } = relatedproductParam.app.models
    let payload = req.body;
    payload.complements.map(async (item) => {
      console.log(item)
      let productInstace = await Product.findOne({
        where: {
          sku: item.sku
        }
      })
      item.complements.map(async (complement) => {
        console.log(complement)
        let productInstaceProduct = await Product.findOne({
          where: {
            sku: complement.sku
          }
        })
        await relatedproductParam.create({
          relatedProductId: productInstaceProduct.id,
          productId: productInstace.id
        })
      })
      console.log(productInstace.id)
    })
    return "Ok"
  }

  relatedproductParam.remoteMethod(
    'Complements', {
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    },
    http: {
      verb: 'post',
      path: '/complements'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  }
  )
}
