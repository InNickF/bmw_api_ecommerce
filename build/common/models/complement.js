
const integrationAutogermana = require('../../integrations/autogermana')
const throat = require('throat')

module.exports = function (Complement) {
  const complementParam = Complement

  // Crea los productos de la lista

  complementParam.kitComplements = async (req, body) => {
    const {
      Product
    } = complementParam.app.models
    let payload = req.body;
    payload.kit.map(async (item) => {
      let productInstace = await Product.findOne({
        where: {
          sku: item.sku
        }
      })
      item.kit.map(async (kit) => {
        await complementParam.create({
          productId: productInstace.id,
          name: kit.name,
          description: kit.name,
          price: kit.price,
          priceWithTax: kit.priceWithTax,
          amoutn: kit.quanty
        })
      })
    })
    /*  body.kit.map(async (item) => {
       let productInstace = await Product.findOne({
         where: {
           sku: item.sku
         }
       })
       console.log(productInstace)
       item.complements.map(kit => {
         console.log(kit)
       })
     }) */
    /* let products = null */
    // Recorrer areglos de los componentes para hacer lo siguiente
    // Busco el complemento con el producto
    /*     let complementInstance = null
        try {
          complementInstance = await complementParam.findOne({
            where: {
              productId: productInstance.id,
              name: 'ok'
            }
          })
        } catch (error) {
          throw error
        } */

    // si no esta lo creo
    /*     if (!complementInstance) {
          try {
            await complementParam.create({
              productId: 1,
              name: 'ok'
            })
          } catch (error) {
            return error
          }
        } */

    return "Ok"
  }
  complementParam.remoteMethod(
    'kitComplements', {
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    },
    http: {
      verb: 'post',
      path: '/kit-complements'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  }
  )
}
