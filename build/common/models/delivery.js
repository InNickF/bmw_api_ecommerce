import {obtenerCosultarInformacion, obtenerValorGrabarRemesa} from '../../integrations/tcc'
const passTcc = process.env.PASSW_TCC
let moment = require('moment')

module.exports = function (Delivery) {
  const deliveryParam = Delivery
  deliveryParam.validatesPresenceOf('value', {
    message: {
      labels: 'La dirección es requerido',
      field: 'The value is required'
    }
  })
  deliveryParam.validatesPresenceOf('orderId', {
    message: {
      labels: 'La dirección de envió requerido un id de la orden',
      field: 'The orderId is required'
    }
  })
  deliveryParam.validatesPresenceOf('orderStatusId', {
    message: {
      labels: 'La dirección de envió requerido un estado de la orden',
      field: 'The orderStatusId is required'
    }
  })

  // Consultar informacion del envio racking
  deliveryParam.ConsultarInformacionDespacho = async body => {
    const {Order} = deliveryParam.app.models

    let orderInstace
    try {
      orderInstace = await Order.findById(body.orderId)
    } catch (error) {
      throw error
    }

    // valido
    if (!orderInstace) {
      throw new Error(`La orden con id ${body.orderId}, no existe`)
    }

    let orderDetailsInstance = null
    try {
      orderDetailsInstance = await orderInstace.orderDetails.find()
    } catch (error) {
      throw error
    }

    // valido
    if (!orderDetailsInstance) {
      throw new Error(`La orden con id ${body.orderId}, no existe detalles`)
    }

    const parameters = {
      RemesaUEN: {
        numeroremesa: orderInstace.delivery,
        unidadnegocio: orderDetailsInstance.length
      }
    }

    // Ejecuto la integracion
    let response
    try {
      response = await obtenerCosultarInformacion(parameters)
    } catch (error) {
      throw error
    }

    return response
  }
  deliveryParam.remoteMethod(
    'ConsultarInformacionDespacho', {
      accepts: {
        arg: 'body',
        type: 'Object',
        require: true
      },
      http: {
        verb: 'post',
        path: '/consultar-informacion-despacho'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  // Consultar informacion no esta en uso
  deliveryParam.consultarLiquidacion = async body => {
    const {Order} = deliveryParam.app.models

    // Consulto la orden de compra
    let order = null
    try {
      order = await Order.findOne({
        where: {
          id: body.orderId
        },
        include: [
          {
            relation: 'address'
          },
          {
            relation: 'user'
          },
          {
            relation: 'codeCoupon'
          }
        ]
      })
    } catch (error) {
      throw error
    }

    let store = null
    try {
      store = await order.store.get()
    } catch (error) {
      throw error
    }
    let cityStore = null
    try {
      cityStore = await store.city.get()
    } catch (error) {
      throw error
    }

    let stateStore = null
    try {
      stateStore = await cityStore.state.get()
    } catch (error) {
      throw error
    }

    let orderDetails = null
    try {
      orderDetails = await order.orderDetails.find()
    } catch (error) {
      throw error
    }

    let address = null
    try {
      address = await order.address.get()
    } catch (error) {
      throw error
    }

    if (address) {
      let cityAddress = null
      try {
        cityAddress = await address.city.get()
      } catch (error) {
        throw error
      }

      let stateAddress = null
      try {
        stateAddress = await cityAddress.state.get()
      } catch (error) {
        throw error
      }

      let dataDelivery = moment().format('YYYY/MM/DD')

      const total = orderDetails.map(item => item.price).reduce((pre, cur) => pre + cur, 0)

      const products = await Promise.all(orderDetails.map(async (item) => {
        let product = null
        try {
          product = await item.product.get()
        } catch (error) {
          throw error
        }
        return product
      }))

      const weightVolume = products.map(item => item.weightVolume).reduce((pre, cur) => pre + cur, 0)

      const weightVolumeK = weightVolume / 1000.0
      // const weightVolumeK = (weightVolume / 1000.0).toFixed(2).replace(".", ",")

      let unidadDeNEgocio = null
      let cuentaAut = null
      if (weightVolumeK < 5.1 && total <= 3511208) {
        unidadDeNEgocio = 2
        cuentaAut = 5132001
      } else if (weightVolumeK >= 5.1 && weightVolumeK < 15.0) {
        unidadDeNEgocio = 1
        cuentaAut = 1759405
      } else {
        unidadDeNEgocio = 1
        cuentaAut = 1759405
      }

      let bodyDelivery = {
        Clave: passTcc,
        Liquidacion: {
          tipoenvio: 1,
          idciudadorigen: `${stateStore.code}${cityStore.code}000`,
          idciudaddestino: `${stateAddress.code}${cityAddress.code}000`,
          valormercancia: total,
          boomerang: 0,
          cuenta: cuentaAut,
          fecharemesa: dataDelivery,
          idunidadestrategicanegocio: unidadDeNEgocio,
          unidades: {
            unidad: {
              numerounidades: 1,
              pesoreal: weightVolumeK < 1 ? 1 : weightVolumeK,
              pesovolumen: weightVolumeK,
              alto: 0,
              largo: 0,
              ancho: 0
            }
          }
        }
      }

      console.log('Objeto: ', bodyDelivery)

      let consulta = null
      try {
        consulta = await obtenerCosultarInformacion(bodyDelivery)
      } catch (error) {
        throw error
      }

      console.log('Consulta: ', consulta)

      // Actualizo la orden con el precio del envio y el id de aprobacion
      if (consulta.consultarliquidacionResult.respuesta.codigo !== '-1') {
        try {
          await Order.updateAll({
            id: body.orderId
          }, {
            delivery: consulta.consultarliquidacionResult.idliquidacion,
            priceDelivery: consulta.consultarliquidacionResult.total.totaldespacho
          }, () => { })
        } catch (error) {
          throw error
        }
      } else {
        const result = {}
        result.message = 'La consulta debe contener almenos un articulo'
        return result
      }

      const result = {}
      result.order = order
      result.consulta = consulta
      return result
    } else {
      const result = {
        message: 'Orden no tiene dirección'
      }
      return result
    }
  }
  deliveryParam.remoteMethod('consultarLiquidacion', {
    accepts: {
      arg: 'body',
      type: 'Object',
      require: true
    },
    http: {
      verb: 'post',
      path: '/consultar-liquidacion'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  })

  deliveryParam.GrabarDespacho = async function (body, cb) {
    let despacho = null
    try {
      despacho = await obtenerValorGrabarRemesa(body)
    } catch (error) {
      return cb(error)
    }

    return despacho
  }
  deliveryParam.remoteMethod(
    'GrabarDespacho', {
      accepts: {
        arg: 'body',
        type: 'Object',
        require: true
      },
      http: {
        verb: 'post',
        path: '/grabar-despacho'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  deliveryParam.TccTest = async body => {
    const {Order} = deliveryParam.app.models

    let orderInstace
    try {
      orderInstace = await Order.findById(body.orderId)
    } catch (error) {
      throw error
    }

    // valido
    if (!orderInstace) {
      throw new Error(`La orden con id ${body.orderId}, no existe`)
    }

    let orderDetailsInstance = null
    try {
      orderDetailsInstance = await orderInstace.orderDetails.find()
    } catch (error) {
      throw error
    }

    // valido
    if (!orderDetailsInstance) {
      throw new Error(`La orden con id ${body.orderId}, no existe detalles`)
    }

    let userInstance = null
    try {
      userInstance = await orderInstace.user.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!userInstance) {
      throw new Error(`La orden con id ${body.orderId}, no le pertenece a un usuario`)
    }

    let brandInstance = null
    try {
      brandInstance = await orderInstace.brand.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!brandInstance) {
      throw new Error(`La orden con id ${body.orderId}, no pertenece a una marca`)
    }

    let addressInstance = null
    try {
      addressInstance = await orderInstace.address.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!addressInstance) {
      throw new Error(`La orden con id ${body.orderId}, no tiene una direccion`)
    }

    let cityAddressInatance = null
    try {
      cityAddressInatance = await addressInstance.city.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!cityAddressInatance) {
      throw new Error(`La orden con id ${body.orderId}, no tiene una ciudad`)
    }

    let stateAddressInstance = null
    try {
      stateAddressInstance = await cityAddressInatance.state.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!stateAddressInstance) {
      throw new Error(`La ciudad de la orden con id ${body.orderId}, no tiene un estado`)
    }

    let storeInstance = null
    try {
      storeInstance = await orderInstace.store.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!storeInstance) {
      throw new Error(`La orden con id ${body.orderId}, no tiene una tienda asociada`)
    }

    let cityStoreInstance = null
    try {
      cityStoreInstance = await storeInstance.city.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!cityStoreInstance) {
      throw new Error(`La tienda de la orden con id ${body.orderId}, no tiene una tienda ciudad asociada`)
    }

    let stateStoreInstance = null
    try {
      stateStoreInstance = await cityStoreInstance.state.get()
    } catch (error) {
      throw error
    }

    // valido
    if (!stateStoreInstance) {
      throw new Error(`La tienda de la orden con id ${body.orderId}, con la ciudad ${cityStoreInstance.name} no tiene un estado relacionado`)
    }

    const products = await Promise.all(orderDetailsInstance.map(async (item) => {
      let product = {
        tipounidad: 'TIPO_UND_PAQ',
        claseempaque: 'CLEM_CAJA',
        kilosreales: 1, // importante
        largo: 0,
        alto: 0,
        ancho: 0,
        pesovolumen: 1, // importante
        valormercancia: item.price,
        codigobarras: null,
        unidadesinternas: item.quantity
      }
      return product
    }))

    const parameters = {
      despacho: {
        clave: passTcc,
        solicitudrecogida: {},
        unidadnegocio: 1,
        fechadespacho: moment().format('YYYY-MM-DD'),
        cuentaremitente: 1759400,
        tipoidentificacionremitente: 'NIT',
        identificacionremitente: 860509514,
        primernombreremitente: 'AUTOGERMANA',
        segundonombreremitente: null,
        primerapellidoremitente: null,
        razonsocialremitente: 'AUTOGERMANA',
        naturalezaremitente: 'N',
        direccionremitente: 'CRA 1 #62N-231',
        contactoremitente: null,
        emailremitente: 'hola@autogermana.com',
        telefonoremitente: '6852828',
        ciudadorigen: 11001000, // `${stateStoreInstance.code}${cityStoreInstance.code}000`,
        tipoidentificaciondestinatario: userInstance.docType,
        identificaciondestinatario: userInstance.identification,
        primernombredestinatario: userInstance.firstName,
        segundonombredestinatario: null,
        primerapellidodestinatario: userInstance.lastName,
        naturalezadestinatario: 'N',
        direcciondestinatario: addressInstance.value,
        contactodestinatario: 'CONTACTO DESTINO',
        telefonodestinatario: userInstance.phone,
        ciudaddestinatario: `${stateAddressInstance.code}${cityAddressInatance.code}000`,
        totalpeso: null,
        totalpesovolumen: null,
        totalvalormercancia: orderInstace.total - orderInstace.priceDelivery,
        observaciones: `Pedidos ${orderInstace.incadeaOrderId} por valor de ${orderInstace.total}`,
        unidad: products,
        documentoreferencia: {
          tipodocumento: 'FA', // FA = Factura, PE = Pedido, OC = orden de compra, RE = Remisio, OT = Orden de traslado
          numerodocumento: 'Fa002', // Numero de factura
          fechadocumento: '2018-10-03' // Fecha de factura o pedido
        },
        generardocumentos: 'TRUE',
        tiposervicio: null,
        fuente: null
      }
    }

    // valido
    if (!parameters) {
      throw new Error('La peticion no contiene parametros')
    }

    // Ejecuto la integracion
    let response
    try {
      response = await obtenerValorGrabarRemesa(parameters)
    } catch (error) {
      throw error
    }

    return response
  }
  deliveryParam.remoteMethod(
    'TccTest', {
      accepts: {
        arg: 'body',
        type: 'Object',
        require: true
      },
      http: {
        verb: 'post',
        path: '/TccTest'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )
}
