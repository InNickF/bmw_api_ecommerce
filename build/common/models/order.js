import * as requestIp from 'request-ip'
import { getMissinKeys, returnError } from '../../server/utils'
import * as app from '../../server/server'
import getParameterValue from '../../server/functions/get-parameter-value'
import moment from 'moment-timezone'
import { obtenerValorLiquidacion } from '../../integrations/tcc'
import * as autogermanaIntegration from '../../integrations/autogermana'
import { abandoned } from '../../integrations/mail/index';
import { priceFormatter } from '../../server/utils'

moment.tz('America/Bogota')
const integrationZonaPago = require('../../integrations/zona_virtual')
const idTiendaZonaVirtual = process.env.ZONA_VIRTUAL_API_ID_TIENDA
const claveZonaVirtual = process.env.ZONA_VIRTUAL_API_CLAVE

module.exports = function (Order, OrderDetail) {
  const orderParam = Order
  const orderDetailParam = OrderDetail

  orderParam.validatesPresenceOf('uuid', {
    message: {
      labels: 'El campo uuid de la orden es requerido',
      field: 'The uuid is required'
    }
  })
  orderParam.validatesUniquenessOf('uuid', {
    message: {
      labels: 'El uuid de la orden ya existe',
      field: 'The uuid already exists'
    }
  })
  orderParam.validatesPresenceOf('total', {
    message: {
      labels: 'El campo total es requerido',
      field: 'The total is required'
    }
  })
  orderParam.validatesPresenceOf('subtotal', {
    message: {
      labels: 'El campo subtotal es requerido',
      field: 'The subtotal is required'
    }
  })
  orderParam.validatesPresenceOf('taxes', {
    message: {
      labels: 'El campo impuesto es requerido',
      field: 'The taxes is required'
    }
  })
  orderParam.validatesPresenceOf('totalService', {
    message: {
      labels: 'El campo total del servicio es requerido',
      field: 'The totalService is required'
    }
  })
  orderParam.validatesPresenceOf('delivery', {
    message: {
      labels: 'El campo dirección de envío es requerido',
      field: 'The sendDate is required'
    }
  })
  orderParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido',
      field: 'The userId is required'
    }
  })
  orderParam.validatesPresenceOf('orderStatusId', {
    message: {
      labels: 'El campo estado de orden es requerido',
      field: 'The orderStatusId is required'
    }
  })

  // Ver la lista de todos los productos
  orderParam.createdOrderIncadea = async body => {
    let order = null
    try {
      order = await autogermanaIntegration.createdOrder(body)
    } catch (error) {
      throw (error)
    }
    if (order) {
      return order
    } else {
      const result = {}
      result.message = 'Parametros no validos'
      return result
    }
  }
  orderParam.remoteMethod('createdOrderIncadea', {
    accepts: {
      arg: 'body',
      type: 'Object',
      require: true,
      description: '{ id: 0, .... }'
    },
    http: {
      verb: 'post',
      path: '/createdOrderIncadea'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  })

  const getTccRate = async orderId => {
    // obtengo la orden
    let orderInstace
    try {
      orderInstace = await orderParam.findById(orderId)
    } catch (error) {
      throw error
    }

    // valido
    if (!orderInstace) {
      throw returnError(`La orden con id ${orderId}, no existe.`)
    }

    // obtengo la tienda de la orden
    let storeInstance
    try {
      storeInstance = await orderInstace.store.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!storeInstance) {
      throw returnError(`La tienda de la orden ${orderId}, no existe.`)
    }

    // obtengo la ciudad de la tienda
    let cityInstanceFromStore
    try {
      cityInstanceFromStore = await storeInstance.city.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!cityInstanceFromStore) {
      throw returnError(`La ciudad de la tienda ${storeInstance.id}, no existe.`)
    }

    // obtengo el estado de la ciudad
    let stateInstanceFromStore
    try {
      stateInstanceFromStore = await cityInstanceFromStore.state.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!stateInstanceFromStore) {
      throw returnError(`El estado de la ciudad ${cityInstanceFromStore.id}, no existe.`)
    }

    // obtengo la direccion de la orden
    let addressInstance
    try {
      addressInstance = await orderInstace.address.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!addressInstance) {
      return 0
    }

    // obtengo la ciudad de la direccion
    let cityInstanceFromAddress
    try {
      cityInstanceFromAddress = await addressInstance.city.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!cityInstanceFromAddress) {
      throw returnError(`La ciudad para la direccion ${addressInstance.id}, no existe.`)
    }

    // obtengo el estado de la direccion
    let stateInstanceFromAddress = null
    try {
      stateInstanceFromAddress = await cityInstanceFromAddress.state.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!stateInstanceFromAddress) {
      throw returnError(`El estado de la ciudad ${stateInstanceFromAddress.id}, no existe.`)
    }

    // obtengo los detalles
    let orderDetailInstances = []
    try {
      orderDetailInstances = await orderInstace.orderDetails.find()
    } catch (error) {
      throw error
    }

    // valido
    if (orderDetailInstances.length < 1) {
      return 0
    }

    // obtengo la fecha de envio para la simulacion
    let dateDelivery = moment().format()

    // obtengo el valor de la mercancia
    let total
    if (orderDetailInstances.length > 0) {
      total = await Promise.all(orderDetailInstances.map(async (item) => {
        let product = await item.product.get()
        console.log(product.productCategoryId)
        if (product.productCategoryId != 6142 && product.productCategoryId != 6143 && product.productCategoryId != 6141) {
          return item.price * item.quantity
        } else {
          return 0
        }
      }
      ))
      total = total.reduce((pre, cur) => pre + cur, 0)
    }

    // const quantityItems = orderDetailInstances.map(item => item.quantity).reduce((pre, cur) => pre + cur, 0)
    const quantityItems = orderDetailInstances.map(item => item.quantity).reduce((pre, cur) => pre + cur, 0)

    const products = await Promise.all(orderDetailInstances.map(async (item) => {
      let product = null
      try {
        product = await item.product.get()
      } catch (error) {
        throw error
      }
      return product
    }))

    /* console.log("entro aaqui") */
    let isTire = true;
    const weightVolume = products.map(item => {
      if (item.productCategoryId != 6142 && item.productCategoryId != 6143 && product.productCategoryId != 6141) {
        isTire = false;
        return item.weightVolume
      } else {
        return 0
      }
    }).reduce((pre, cur) => pre + cur, 0)

    const weightVolumeTemp = products.map(item => {
      if (item.productCategoryId != 6142 && item.productCategoryId != 6143 && product.productCategoryId != 6141) {
        return item.weightVolume
      } else {

      }
    })

    /* console.log(weightVolumeTemp)
    console.log(weightVolume, "teste") */

    const weightVolumeK = (weightVolume / 1000.0).toFixed(3)
    let unidadDeNEgocio = null
    let cuentaAut = null
    if (weightVolume == 0 && isTire) {
      return 0
    } else {
      if (weightVolumeK < 5 && total <= 1185000) {
        unidadDeNEgocio = 2
        cuentaAut = 5132001
      } else if (weightVolumeK >= 5 && weightVolumeK < 15.0) {
        unidadDeNEgocio = 1
        cuentaAut = 1759405
      } else {
        unidadDeNEgocio = 1
        cuentaAut = 1759405
      }
    }

    /* console.log(unidadDeNEgocio, total, weightVolumeK) */
    const parameters = {
      Liquidacion: {
        tipoenvio: 1,
        idciudadorigen: `${stateInstanceFromStore.code}${cityInstanceFromStore.code}000`,
        idciudaddestino: `${stateInstanceFromAddress.code}${cityInstanceFromAddress.code}000`,
        valormercancia: total,
        boomerang: 0,
        cuenta: cuentaAut,
        fecharemesa: dateDelivery,
        idunidadestrategicanegocio: unidadDeNEgocio,
        unidades: {
          unidad: {
            numerounidades: 1 || quantityItems || orderDetailInstances.length,
            pesoreal: weightVolumeK < 1 ? 1 : weightVolumeK,
            pesovolumen: weightVolumeK,
            alto: 0,
            largo: 0,
            ancho: 0
          }
        }
      }
    }

    // Ejecuto la integracion
    let response
    try {
      response = await obtenerValorLiquidacion(parameters)
    } catch (error) {
      response = error
    }

    // valido
    if (!response.consultarliquidacionResult.idliquidacion) {
      /*  throw returnError(`${response.consultarliquidacionResult.respuesta.codigo}: ${response.consultarliquidacionResult.respuesta.mensaje}`, 500) */
      /* console.log(response) */
      return parseInt(0)
    }

    return parseInt(response.consultarliquidacionResult.total.totaldespacho, 0)
  }

  /**
   * Funcion para obtener los valores de una orden
   *
   * @param {Object} parameters objeto con los atributos orderId, details
   * @returns {Promise} objeto con los tributos orderValue, orderIva, tccRate
   * mensajerosUrbanosRate, serviEntregaRate, details
   */
  const getOrderValues = async parameters => {
    // Obtengo las llaves faltantes
    let missingKeys = getMissinKeys(['orderId', 'details'], parameters)

    // Valido
    if (missingKeys.length > 0) {
      throw returnError(`a parameters le faltan los atributos ${missingKeys.toString()}`, 422)
    }

    // Defino el objeto para retornar
    const response = {}
    response.orderValue = 0
    response.orderIva = 0
    response.tccRate = 0

    // obtengo los detalles
    const { details = [] } = parameters

    // calculo el iva y el valor de la orden
    for (const detail of details) {
      response.orderValue += detail.price * detail.quantity
      response.orderIva += detail.taxes * detail.quantity
    }

    // obtengo la tarifa de tcc
    const { orderId } = parameters
    if (orderId) {
      try {
        response.tccRate = await getTccRate(orderId)
      } catch (error) {
        throw error
      }
    }

    return response
  }

  /**
   * Funcion para determinar los detalles de la orden que se esta manipulando mediante el uso de
   * manageCart
   *
   * @param {Number} orderId id de la orden
   * @param {Array} details detalles para la orden
   * @returns {Array} detalles de la orden ya creados en la BD
   */
  const determinateOrderDetails = async (orderId, details) => {
    // Obtengo la orden
    const { Order } = app.models
    let orderInstance = null
    try {
      orderInstance = await Order.findById(orderId)
    } catch (error) {
      throw error
    }

    // Valido
    if (!orderInstance) {
      throw returnError(`La orden con el id ${orderId}, no existe`, 422)
    }

    const { OrderDetail } = app.models
    const promises = details.map(async detail => {
      // Defino el objeto para crear
      const orderDetailObj = detail
      orderDetailObj.orderId = orderInstance.id

      // Creo encuentro o creo el detalle de la orden
      let resultOrderDetail = null
      try {
        resultOrderDetail = await OrderDetail.findOrCreate({
          where: {
            orderId: orderDetailObj.orderId,
            productId: orderDetailObj.productId
          }
        }, orderDetailObj)
      } catch (error) {
        throw error
      }

      // si el detalle se encontro, en vez de crearse, lo actualizo
      if (!resultOrderDetail[1]) {
        try {
          await resultOrderDetail[0].updateAttributes(orderDetailObj)
        } catch (error) {
          throw error
        }
      }

      // Retorno el resultado
      return resultOrderDetail[0]
    })

    const resolvedPromises = await Promise.all(promises)

    // Obtengo las id de los detalles para eliminar lo que no este en esos detalles
    const orderDetailIds = resolvedPromises.map(item => item.id)

    // Elimino lo que no este en esos ids
    let detailsFromOrder = await orderInstance.orderDetails.find()
    detailsFromOrder.forEach(async item => {
      if (!orderDetailIds.includes(item.id)) { await OrderDetail.destroyById(item.id) }
    })

    return resolvedPromises
  }

  const getDefaultStore = async () => {
    // obtengo el parametro
    const parameterName = 'CODIGO_TIENDA_POR_DEFECTO'
    let storeCode
    try {
      storeCode = await getParameterValue(parameterName)
    } catch (error) {
      throw error
    }

    // obtengo la tienda
    const { Store } = app.models
    let storeInstance
    try {
      storeInstance = await Store.findOne({ where: { name: storeCode } })
    } catch (error) {
      throw error
    }

    // valido
    if (!storeInstance) {
      throw returnError(`la tienda con el codigo ${storeCode}, no existe.`, 500)
    }

    return storeInstance
  }

  /**
   * Determina que orden se de utilizar en el proceso de manageCart
   *
   * @param {number} userId id de usuario para la orden
   * @param {number} addressId direccion a la que estaria asociada la orden
   * @param {boolean} wantRead determina si el usuario solo quiere consultar los datos de la orden
   * @param {string} clientIp ip del cliente que creo la orden
   * @param {string} clientBrowser navegador del cliente que crea la orden
   * @param {number} brandId navegador del cliente que crea la orden
   * @returns {object} instancia de la orden para el usuario
   */
  const determinateOrder = async (userId, addressId, wantRead, clientIp, clientBrowser, brandId) => {
    // Obtengo el usuario
    const { MyUser } = app.models
    let userInstance = null
    try {
      userInstance = await MyUser.findById(userId)
    } catch (error) {
      throw error
    }

    // Valido
    if (userInstance === null) {
      userInstance = await MyUser.findOrCreate({
        where: {
          firstName: userId,
          brandId: brandId
        }
      }, {
        firstName: userId,
        brandId: brandId
      })

      /*  throw returnError(`El usuario con el ${userId}, no existe`, 422) */
    }

    // obtengoe l codigo de la orden
    let nameP = 'CODIGO_ESTADO_ORDER_CREADO'
    let createdOrderCode = null
    try {
      createdOrderCode = await getParameterValue(nameP)
    } catch (error) {
      throw error
    }

    // Obtego el estado
    const { OrderStatus } = app.models
    let orderStatusInstance = null
    try {
      orderStatusInstance = await OrderStatus.findOne({
        where: {
          code: createdOrderCode
        }
      })
    } catch (error) {
      throw error
    }

    // Valido
    if (!orderStatusInstance) {
      throw returnError(`El estado de orden con el codigo ${createdOrderCode}, no existe`, 500)
    }

    // Obtego el estado
    let orderStatusInstancePen = null
    try {
      orderStatusInstancePen = await OrderStatus.findOne({
        where: {
          code: 'PENDIENTE_PAGO'
        }
      })
    } catch (error) {
      throw error
    }

    // valido
    if (!orderStatusInstancePen) {
      return new Error('Estado no encontrado.')
    }

    // Obtengo la orden
    const { Order } = app.models
    let orderLast = null
    try {
      orderLast = await Order.findOne({
        where: {
          userId: userInstance.id,
          orderStatusId: orderStatusInstancePen.id,
          brandId
        },
        include: 'payments'
      })
    } catch (error) {
      throw error
    }

    let popUp = false
    let popUpArrayOrders = []
    if (orderLast) {
      let paymentsOrder
      try {
        paymentsOrder = await orderLast.payments.find()
      } catch (error) {
        return error
      }

      // valido
      if (!paymentsOrder || paymentsOrder.length === 0) {
        return new Error(`La orden ${orderLast.id}, no tiene pagos iniciados`)
      }

      const paymentsPe = paymentsOrder[paymentsOrder.length - 1]

      let parametersVerificarPago = {
        str_id_pago: paymentsPe.uuid,
        int_id_tienda: idTiendaZonaVirtual,
        str_id_clave: claveZonaVirtual
      }

      /*     // Verifico el pago
          let response
          try {
            response = await integrationZonaPago.verificarPago(parametersVerificarPago)
          } catch (error) {
            throw error
          }
     */
      /*      // valido
           if (!response) {
             return new Error('No se puede obtener Respuesta de zona virtual.')
           } */

      let orderDetailInstances = null
      try {
        orderDetailInstances = await orderLast.orderDetails.find()
      } catch (error) {
        throw error
      }

      // valido
      if (!orderDetailInstances) {
        throw new Error(`La orden con id ${orderLast.id}, no existe detalles`)
      }

      for (const detailInOrder of orderDetailInstances) {
        // obtengo el producto asociado al detalle
        let productInstance
        try {
          productInstance = await detailInOrder.product.get()
        } catch (error) {
          throw error
        }
        // actualizo el producto
        try {
          await productInstance.updateAttributes({ intent: productInstance.intent - detailInOrder.quantity })
        } catch (error) {
          throw error
        }
      }

      /* const estadoPago = response.res_pagos_v3[0].int_estado_pago */
      /*      const estadoPendienteFinalizar = orderStatusInstancePen.paymentPlatformCode.split('|')
           const transactionCode = response.res_pagos_v3[0].str_codigo_transaccion */

      // Obtego el estado
      /*     if (orderStatusInstance.paymentPlatformCode === estadoPago.toString()) {
            try {
              await orderLast.updateAttributes({ orderStatusId: orderStatusInstance.id, transactionCode: transactionCode })
            } catch (error) {
              throw error
            }
          } else if (estadoPendienteFinalizar.includes(estadoPago.toString())) {
            try {
              await orderLast.updateAttributes({ transactionCode: transactionCode })
            } catch (error) {
              throw error
            }
            // busco la orden
            let orderLastPen = null
            try {
              orderLastPen = await Order.find({
                where: {
                  userId: userInstance.id,
                  orderStatusId: orderStatusInstance.id
                }
              })
            } catch (error) {
              throw error
            }
    
            if (orderLastPen.length === 0) {
              popUp = true
              popUpArrayOrders = orderLast
            }
          } */
    }

    // Obtengo la tienda
    let storeId = null
    try {
      let store = await getDefaultStore()
      storeId = store.id
    } catch (error) {
      throw error
    }

    // Obtengo la direccion
    let addressValue = null
    if (addressId) {
      const { Address } = app.models
      let addressInstance = null
      try {
        addressInstance = await Address.findOne({
          where: {
            userId: userInstance.id,
            id: addressId
          }
        })
      } catch (error) {
        throw error
      }
      addressValue = addressInstance ? addressInstance.value : null
      if (!addressInstance) {
        throw returnError(`La direccion ${addressId}, para el usuario ${userInstance.id}, no existe.`, 500)
      }
    }

    // Armo el objeto
    const orderObject = {
      userId: userInstance.id,
      orderStatusId: orderStatusInstance.id,
      storeId,
      addressId,
      addressValue,
      clientIp,
      clientBrowser,
      brandId
    }

    // Obtengo o creo la orden
    let orderResult = null
    try {
      orderResult = await Order.findOrCreate({
        where: {
          userId: userInstance.id,
          orderStatusId: orderStatusInstance.id,
          brandId
        }
      }, orderObject)
    } catch (error) {
      throw error
    }

    // Si el usuario solo quiere consultar
    if (wantRead) {
      orderResult[0].popUp = popUp
      orderResult[0].popUpArrayOrders = popUpArrayOrders
      return orderResult[0]
    }

    // Si la orden se encontro, entonces la actualizo
    if (!orderResult[1]) {
      try {
        await orderResult[0].updateAttributes(orderObject)
      } catch (error) {
        throw error
      }
    }

    orderResult[0].popUp = popUp
    orderResult[0].popUpArrayOrders = popUpArrayOrders
    return orderResult[0]
  }

  const manageCart = async (parameterObj = {}) => {
    // obtengo los atributos faltantes
    const missingKeys = getMissinKeys(['wantRead', 'userId', 'addressId', 'details', 'clientIp', 'clientBrowser', 'brandId'], parameterObj)
    // valido
    if (missingKeys.length > 0) {
      throw returnError(`faltan los atributos ${missingKeys.toString()}`, 422)
    }

    // obtengo el userId, addressId del objeto que llega como parametro
    let { userId, addressId } = parameterObj

    // Obtengo la variable que indica si se desea consultar
    const { wantRead, clientIp, clientBrowser, brandId } = parameterObj

    let orderInstace
    // Valido si el usuario me llega
    if (userId) {
      // Obtengo la orden para el usuario
      try {
        orderInstace = await determinateOrder(userId, addressId, wantRead, clientIp, clientBrowser, brandId)
      } catch (error) {
        throw error
      }
    }

    let sourceDetails = []
    // Valido que se quiera leer
    if (wantRead && orderInstace) {
      // Obtengo los detalles de la orden
      const detailsFromOrder = await orderInstace.orderDetails.find()
      // Filtro solo lo que necesito
      sourceDetails = detailsFromOrder.map(detail => {
        return {
          productId: detail.productId,
          quantity: detail.quantity
        }
      })
    } else {
      // Obtengo los detalles de los parametros
      // CUPON
      try {
        await orderInstace.updateAttributes({
          codeCouponId: null // AQUI
        })
      } catch (error) {
        throw error
      }
      sourceDetails = parameterObj.details ? parameterObj.details : []
    }

    // Agrupo los detalles
    let productIds = []
    let groupDetails = []
    for (const parentDetail of sourceDetails) {
      let productQuantity = 0

      // sumo la cantidad
      for (const childDetail of sourceDetails) {
        if (parentDetail.productId === childDetail.productId) {
          productQuantity += childDetail.quantity
        }
      }

      // Armo el objeto para adjuntar en el arreglo
      const obj = {
        productId: parentDetail.productId,
        quantity: productQuantity
      }

      // Agrego el objeto a los detalles
      if (!productIds.includes(obj.productId)) {
        productIds.push(obj.productId)
        groupDetails.push(obj)
      }
    }

    // obtengo la url de la imagen default
    let parameterName = 'NO_IMAGEN_URL'
    let urlDefault
    try {
      urlDefault = await getParameterValue(parameterName)
    } catch (error) {
      throw error
    }

    // filtro y curo los detalles
    const { Product, SkuVariation, ProductCategory, ProductVariation } = app.models
    let noAvaliableProducts = 0
    let productsNumber = 0
    const promises = groupDetails.map(async detail => {
      // obtengo el producto del detalle
      let productInstance
      let variation
      try {
        productInstance = await Product.findById(detail.productId)
        await SkuVariation.findOne({ where: { productChildrenId: detail.productId } })
        /* console.log(await productInstance.skuVariations.find()) */
      } catch (error) {
        return error
      }

      // valido
      if (!productInstance) {
        return new Error(`El producto con el id ${detail.productId}, no existe.`)
      } else {
        /* let availabilityAutogermana = await autogermanaIntegration.getAvailabilityPrice(
          productInstance.sku
        )
        let partes = await autogermanaIntegration.getProduct(
          productInstance.sku
        )
        productInstance.updateAttributes({
          price: availabilityAutogermana[0].PrecioUnitarioIVA,
          stock: availabilityAutogermana[0].Disponible,
          weightVolume: partes.length > 0 ? partes[0].PesoVolumen : 0,
          weight: partes.length > 0 ? partes[0].Peso : 0,
          priceWithTax: availabilityAutogermana[0].PrecioUnitarioIVA,
          priceWithoutTax: availabilityAutogermana[0].PrecioUnitario
        }) */
      }

      // Valido
      /*  if (productInstance.priceWithTax < 1 || productInstance.stock < 1 || detail.quantity > productInstance.stock) {
         noAvaliableProducts += 1
         return null
       }
  */
      // obtengo la imagen
      let imageUrl
      try {
        let images = []
        images = await productInstance.imageProducts.find()
        imageUrl = images.length > 0 ? images[0].image : urlDefault
      } catch (error) {
        throw error
      }

      // cuento los productos
      productsNumber += detail.quantity

      // retorno los datos que voy a necesitar para cada detalle
      return {
        quantity: detail.quantity,
        name: productInstance.name,
        size: productInstance.size,
        color: productInstance.color,
        price: productInstance.priceWithTax,
        description: productInstance.description,
        image: imageUrl,
        taxes: productInstance.priceWithTax - productInstance.priceWithoutTax,
        sku: productInstance.sku,
        productCategory: await ProductCategory.findById(productInstance.productCategoryId),
        productVariations: await ProductVariation.find({ where: { productId: productInstance.id } }),
        requiredInstalation: productInstance.installation,
        productId: productInstance.id,
        productStock: productInstance.stock,
        subTotal: (productInstance.priceWithTax - (productInstance.priceWithTax - productInstance.priceWithoutTax)) * detail.quantity,
        total: detail.quantity * productInstance.priceWithTax,
        createAt: moment().format(),
        updateAt: moment().format(),
        discountPercentage: productInstance.discountPercentage,
        initDateDiscount: productInstance.initDateDiscount,
        endDateDiscount: productInstance.endDateDiscount
      }
    })
    const resolvedPromises = await Promise.all(promises)
    let errors = resolvedPromises.filter(item => item instanceof Error)
    // valido
    if (errors.length > 0) {
      /*  throw new Error(`Errores filtrando los detalles: ${errors.toString()}`) */
    }

    // filtro los detalles que no cumplen con las condiciones de validez
    const filteredDetails = resolvedPromises.filter(item => item !== null)

    // Determino los detalles
    let orderDetails
    if (orderInstace) {
      try {
        orderDetails = await determinateOrderDetails(orderInstace.id, filteredDetails)
      } catch (error) {
        throw error
      }
    }

    // Obtengo la direccion
    let addressInstance
    if (orderInstace) {
      try {
        addressInstance = await orderInstace.address.get()
      } catch (error) {
        throw error
      }
    }

    // obtengo los valores de la orden
    let orderValues
    try {
      orderValues = await getOrderValues({ orderId: orderInstace ? orderInstace.id : null, details: filteredDetails })
    } catch (error) {
      throw error
    }

    // actualizo la orden
    if (orderInstace && !wantRead) {
      try {
        await orderInstace.updateAttributes({
          total: orderValues ? orderValues.orderValue + orderValues.tccRate : null,
          subtotal: orderValues ? orderValues.orderValue - orderValues.orderIva : null,
          taxes: orderValues ? orderValues.orderIva : null,
          priceDelivery: orderValues ? orderValues.tccRate : null
          // CUPON
        })
      } catch (error) {
        throw error
      }
    }

    // obtengo informacion del cupon
    let couponInstance
    if (orderInstace) {
      try {
        couponInstance = await orderInstace.codeCoupon.get()
      } catch (error) {
        throw error
      }
    }

    // TODO mejorar tema cupones

    // armo la super respuesta
    const superResponse = {
      id: orderInstace ? orderInstace.id : null,
      uuid: orderInstace ? orderInstace.uuid : null,
      brandId: orderInstace ? orderInstace.brandId : null,
      createAt: orderInstace ? orderInstace.createAt : moment().format(),
      updateAt: orderInstace ? orderInstace.updateAt : moment().format(),
      popUp: orderInstace ? orderInstace.popUp : null,
      popUpArrayOrders: orderInstace ? orderInstace.popUpArrayOrders : null,
      address: {
        id: addressInstance ? addressInstance.id : null,
        name: addressInstance ? addressInstance.name : null,
        value: addressInstance ? addressInstance.value : null,
        phone: addressInstance ? addressInstance.phone : null,
        main: addressInstance ? addressInstance.main : null
      },
      charges: {
        total: orderInstace ? orderInstace.total : orderValues.orderValue + orderValues.tccRate,
        subTotal: orderInstace ? orderInstace.subtotal : null,
        taxes: {
          IVA: orderInstace ? orderInstace.taxes : null
        },
        coupon: couponInstance || null,
        shipping: {
          TCC: orderValues ? orderValues.tccRate : null
        },
        // CUPON
        resultCoupon: couponInstance ? couponInstance.isPercentage ? ((orderValues.orderValue - orderValues.orderIva) * couponInstance.discount) / 100 : couponInstance.value : null
      },
      noAvaliableProducts,
      productsNumber,
      items: orderDetails || filteredDetails
    }
    return superResponse
  }

  orderParam.cart = async req => {
    // armo el objeto para peticionar
    let obj = {}

    // Determino si el usuario viene el el objeto req
    obj.userId = req.user ? req.user.id : null

    // si no se le setio el user id
    if (!obj.userId) {
      obj.userId = req.body.userId ? req.body.userId : null
    }

    // Determino si el atributo wantRead viene el objeto parameters
    obj.wantRead = req.body.wantRead ? req.body.wantRead : false

    // Determino si el atributo addressId viene el objeto parameters
    obj.addressId = req.body.addressId ? req.body.addressId : null

    // Detmino si atributo details viene el objeto parameters
    obj.details = req.body.details ? req.body.details : null

    // Detmino si atributo brandId viene el objeto parameters
    obj.brandId = req.body.brandId ? req.body.brandId : null

    // Valido
    if (!obj.brandId) {
      throw returnError('El atributo brandId es necesario', 422)
    }

    // Obtento la ip del cliente
    const clientIp = requestIp.getClientIp(req)
    obj.clientIp = clientIp

    let i = function ip2int(ip) {
      return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
    }

    if (!obj.userId) {
      obj.userId = i(clientIp)
    }


    // Obtengo el browser del cliente
    const clientBrowser = req.headers['user-agent']
    obj.clientBrowser = clientBrowser

    // Utilizo el metodo para calcular los valores
    let response
    try {
      response = await manageCart(obj)
    } catch (error) {
      throw error
    }

    return response
  }
  orderParam.remoteMethod('cart', {
    description: 'realiza la gestion al carro de compraas',
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    },
    http: {
      verb: 'post',
      path: '/cart'
    },
    returns: {
      type: 'object',
      description: 'objeto con la informacion requerida',
      root: true
    }
  })

  orderParam.discount = async body => {
    const {
      CodeCoupon,
      UserCoupon,
      MyUser
    } = orderParam.app.models

    let code = null
    try {
      code = await CodeCoupon.findOne({
        where: {
          code: body.code,
          active: true
        }
      })
    } catch (error) {
      throw error
    }

    let order = null
    try {
      order = await orderParam.findOne({
        where: {
          id: body.orderId
        }
      })
    } catch (error) {
      throw error
    }

    // Obtengo la cantidad usada
    let userCoupons
    if (order) {
      try {
        userCoupons = await code.userCoupons.find()
      } catch (error) {
        throw error
      }
    }

    // && !order.codeCouponId
    if (code && order.total > code.value && !order.codeCouponId) {
      let userInstance = null
      try {
        userInstance = await MyUser.findOne({
          where: {
            id: order.userId
          }
        })
      } catch (error) {
        throw error
      }

      const username = `${userInstance.firstName} ${userInstance.lastName}`

      const userCouponObj = {
        code: code.code,
        userId: order.userId,
        codeCouponId: code.id,
        orderId: order.id,
        active: true,
        username: username
      }

      try {
        await UserCoupon.findOrCreate({
          where: {
            userId: order.userId,
            codeCouponId: code.id
          }
        }, userCouponObj)
      } catch (error) {
        throw error
      }

      if (userCoupons.length >= code.quantity) {
        try {
          await CodeCoupon.updateAll({
            id: code.id
          }, {
            active: false
          })
        } catch (error) {
          throw error
        }
      }

      if (code.isPercentage) {
        if (order) {
          const subtotal = Math.floor(order.subtotal - ((order.subtotal * code.value) / 100))
          const taxes = Math.floor((subtotal * 19) / 100)
          try {
            await Order.updateAll({
              id: order.id || body.orderId
            }, {
              codeCouponId: code.id,
              subtotal: Math.floor(subtotal),
              taxes: Math.floor(taxes),
              total: Math.floor(subtotal + taxes + order.priceDelivery)
            })
          } catch (error) {
            throw error
          }
        }
        code.message = 'Con porcentaje'
      } else {
        if (order) {
          const subtotal = Math.floor(order.subtotal - code.value)
          /* const taxes = Math.floor((subtotal * 19) / 100) */
          try {
            await Order.updateAll({
              id: order.id || body.orderId
            }, {
              codeCouponId: code.id,
              subtotal: Math.floor(subtotal),
              total: Math.floor(subtotal + order.taxes + order.priceDelivery)
            })
          } catch (error) {
            throw error
          }
        }
        code.message = 'Con valor'
      }
    } else {
      code = {
        message: 'Codigo no existe o ya fue usado'
      }
    }

    const result = {}
    result.code = code
    result.order = order

    return result
  }
  orderParam.remoteMethod('discount', {
    accepts: {
      arg: 'body',
      type: 'Object',
      require: true,
      description: '{ orderId: 0, code: IMA528 }'
    },
    http: {
      verb: 'post',
      path: '/discount'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  })

  orderParam.abandoned = async body => {
    const {
      CodeCoupon,
      UserCoupon,
      MyUser,
      OrderDetail
    } = orderParam.app.models

    var date = new Date();
    let orders = null
    try {
      orders = await orderParam.find({
        where: {
          orderStatusId: 1,
          updatedAt: { gt: date.setDate(date.getDate() - 1) }
        }
      })
    } catch (error) {
      throw error
    }

    const car = await Promise.all(orders.map(async (order) => {
      try {
        return {
          car: await OrderDetail.find({
            where: {
              orderId: order.id
            }
          }),

          user: await MyUser.findOne({
            where: {
              id: order.userId
            }
          })

        }
      } catch (error) {
        throw error
      }
    })
    )

    const eventName = (brandId) => {
      switch (brandId) {
        case 1:
          return 'carrito_abandonado_motorrad'

        case 2:
          return 'carrito_abandonado_mini'

        case 3:
          return 'carrito_abandonado_bmw'
      }
    }

    console.log(car);

    car.map(async (item) => {
      let products = item.car.map(product => {
        return {
          image: product.image,
          productName: product.name.toUpperCase(),
          productPrice: priceFormatter(product.price)
        }
      })
      const data = {
        email: item.user.email,
        eventName: eventName(item.user.brandId),
        attributes: {
          event_items:
            products
        }
      }
      if (products.length > 0) {
        let response = await abandoned(data)
      }
    })

    return { ok: "abandoned ok" }
  }

  orderParam.remoteMethod('abandoned', {
    accepts: {
      arg: 'body',
      type: 'Object'
    },
    http: {
      verb: 'get',
      path: '/abandoned'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  })
}
