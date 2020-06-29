import * as autogermanaIntegration from '../../integrations/autogermana'

module.exports = function (Store) {
  const storeParam = Store
  storeParam.createdStore = async (req, body) => {
    req.setTimeout(0)
    let stores = null
    try {
      stores = await autogermanaIntegration.getProducts(body)
    } catch (error) {
      throw (error)
    }

    if (stores) {
      let names = []
      const arrayStoresNoRep = await stores.map((store, index) => {
        if (index < 1) {
          names.push(store.Almacen)
          return store
        } else if (!names.includes(store.Almacen)) {
          names.push(store.Almacen)
          return store
        }
        return null
      }).filter(item => item !== null)

      const arrayStores = arrayStoresNoRep.map(async store => {
        let storeInstance = null
        try {
          storeInstance = await storeParam.findOne({
            where: {
              name: store.Almacen
            }
          })
        } catch (error) {
          throw (error)
        }

        if (storeInstance === null && store.Almacen !== null) {
          try {
            storeParam.create({
              name: store.Almacen,
              cityId: body.cityId
            })
          } catch (error) {
            throw error
          }
        } else {
          try {
            await storeParam.updateAll({
              name: store.Almacen
            }, {
              name: store.Almacen,
              cityId: body.cityId
            }, () => {})
          } catch (error) {
            throw error
          }
        }

        return storeInstance || store
      })
      const result = await Promise.all(arrayStores)

      return result
    } else {
      const result = {}
      result.message = 'No se encontraron tiendas o no esta pasando los parámetros adecuados'
      return result
    }
  }
  storeParam.remoteMethod(
    'createdStore', {
      accepts: [
        {
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
          description: '{ id: 0, productId: 0, cityId: 1 }'
        }
      ],
      http: {
        verb: 'get',
        path: '/autogermana/createdStore'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )
}
