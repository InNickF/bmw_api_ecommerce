import * as autogermanaIntegration from '../../integrations/autogermana'
const throat = require('throat')

module.exports = function (Storeproduct) {
  const storeproductParam = Storeproduct
  storeproductParam.validatesPresenceOf('stock', {
    message: {
      labels: 'El campo cantidad de surtido es requerido',
      field: 'The stock is required'
    }
  })
  storeproductParam.validatesPresenceOf('price', {
    message: {
      labels: 'El campo precio es requerido',
      field: 'The price is required'
    }
  })
  storeproductParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The productId is required'
    }
  })
  storeproductParam.validatesPresenceOf('storeId', {
    message: {
      labels: 'El campo tienda es requerido',
      field: 'The storeId is required'
    }
  })

  storeproductParam.createdProducts = async (req, body) => {
    req.setTimeout(0)
    const {
      Store,
      Product
    } = Storeproduct.app.models

    // Tomo todos los productos
    let products = null
    try {
      products = await autogermanaIntegration.getProducts(body)
    } catch (error) {
      throw error
    }

    console.log(products)

    const arrayProducts = await Promise.all(products.map(
      throat(1, async product => {
        // Busca el producto
        if (!product.ItemNo_) {
          let productInstance = null
          try {
            productInstance = await Product.findOne({
              where: {
                sku: product.ItemNo_
              }
            })
          } catch (error) {
            throw error
          }

          // Busca la tienda
          let storeInstance = null
          try {
            storeInstance = await Store.findOne({
              where: {
                name: product.Almacen
              }
            })
          } catch (error) {
            throw error
          }

          // Busca el producto en la tienda
          let productoInStoreInstance = null
          try {
            productoInStoreInstance = await storeproductParam.findOne({
              where: {
                productId: productInstance.id,
                storeId: storeInstance.id
              }
            })
          } catch (error) {
            throw error
          }

          if (!productoInStoreInstance && !storeInstance) {
            await storeproductParam.create({
              productId: productInstance.id,
              storeId: storeInstance.id,
              price: product.PrecioUnitario,
              stock: product.Disponible
            })
          } else {
            await storeproductParam.updateAll({
              productId: productInstance.id,
              storeId: storeInstance.id
            }, {
              price: product.PrecioUnitario,
              stock: product.Disponible
            })
          }
        }
        return product
      })
    ))
    return arrayProducts
  }
  storeproductParam.remoteMethod(
    'createdProducts', {
      accepts: [{
        arg: 'req',
        type: 'object',
        http: {
          source: 'req'
        }
      },
      {
        arg: 'body',
        type: 'Object',
        require: true,
        description: '{ id: 0, productId: 0 }'
      }
      ],
      http: {
        verb: 'post',
        path: '/autogermana/created-products-in-store'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )
}
