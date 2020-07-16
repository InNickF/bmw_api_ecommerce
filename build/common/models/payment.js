import { generateHtmlByEmailtemplate } from "../../server/functions/generate-html-by-email-template";
import { Mailer } from "../../server/services/mailer";
import * as autogermanaIntegration from "../../integrations/autogermana";
// import moment from 'moment'
import moment from 'moment-timezone'
import getParameterValue from '../../server/functions/get-parameter-value'
import { obtenerValorGrabarRemesa } from '../../integrations/tcc'
import { inicioPago, verificarPago } from '../../integrations/mercadoPago';
import { priceFormatter } from '../../server/utils'
moment.tz('America/Bogota')
const passTcc = process.env.PASSW_TCC
const integrationZonaPago = require('../../integrations/zona_virtual')
const urlZonaVirtual = process.env.ZONA_VIRTUAL_API_URL
const rutaZonaVirtual = process.env.ZONA_VIRTUAL_API_RUTA
const idTiendaZonaVirtual = process.env.ZONA_VIRTUAL_API_ID_TIENDA
const claveZonaVirtual = process.env.ZONA_VIRTUAL_API_CLAVE
const emailIncadeaError = process.env.EMAIL_INCADEA_ERROR
const app = require('../../server/server')
import { incadeaError, orderSucces, form } from '../../integrations/mail/index';

module.exports = function (Payment) {
  const paymentParam = Payment;
  paymentParam.validatesPresenceOf("uuid", {
    message: {
      labels: "El campo uuid es requerido",
      field: "The uuid is required",
    },
  });
  paymentParam.validatesUniquenessOf("uuid", {
    message: "El uuid ya existe",
  });
  paymentParam.validatesPresenceOf("orderId", {
    message: {
      labels: "El campo orden es requerido",
      field: "The orderId is required",
    },
  });

  // Ver un producto en el servicio y en la base para consultas del front
  paymentParam.inicioPago = async (body) => {
    const { Order } = paymentParam.app.models;
    // Consulto la orden de compra
    let orderInstace = null;
    try {
      orderInstace = await Order.findOne({ where: { id: body.orderId } });
    } catch (error) {
      throw error;
    }

    // valido
    if (!orderInstace) {
      throw new Error(`La orden con id ${body.orderId}, no existe`);
    }

    // Consulto el usuario
    let userInstance = null;
    try {
      userInstance = await orderInstace.user.get();
    } catch (error) {
      throw error;
    }

    // obtengo informacion del cupon
    let couponInstance;
    if (orderInstace) {
      try {
        couponInstance = await orderInstace.codeCoupon.get();
      } catch (error) {
        throw error;
      }
    }

    // valido
    if (!userInstance) {
      throw new Error(`El usuario para orden ${body.orderId}, no existe`);
    }

    // defino el objeto pago
    const paymentObject = {
      uuid: moment().toDate().getTime(),
      observation: "pago creado desde inicioPago",
      orderId: orderInstace.id,
    };

    // creo el pago
    let paymentInstance;
    try {
      paymentInstance = await paymentParam.create(paymentObject);
    } catch (error) {
      throw error;
    }
    //Datos para el objeto de mercado pago
    const preferenceMercadoPago = {
      external_reference: orderInstace.id,
      notification_url: `${process.env.MERCADOPAGO_HOOKS}/payments/paymentConfirmation.php`,
      back_urls: {
        success:
          orderInstace.brandId == 3
            ? "https://bmwshop.com.co/payment-confirmation"
            : orderInstace.brandId == 2
              ? "https://minishop.com.co/payment-confirmation"
              : "https://bmwshop.com.co/payment-confirmation",
        pending:
          orderInstace.brandId == 3
            ? "https://bmwshop.com.co/payment-confirmation"
            : orderInstace.brandId == 2
              ? "https://minishop.com.co/payment-confirmation"
              : "https://bmwshop.com.co/confirmacion-pago",
        failure:
          orderInstace.brandId == 3
            ? "https://bmwshop.com.co/payment-confimation?state=failed"
            : orderInstace.brandId == 2
              ? "https://minishop.com.co/payment-confimation?state=failed"
              : "https://bmwshop.com.co/payment-confimation?state=failed",
      },
      items: [
        {
          title: "Envio",
          description: "Envio tcc",
          quantity: 1,
          unit_price: orderInstace.priceDelivery,
        },
      ],
    };

    // Datos para el objeto de la peticion
    const paymentObjectToZonaVirtual = {
      id_tienda: idTiendaZonaVirtual,
      clave: claveZonaVirtual,
      total_con_iva: orderInstace.total,
      valor_iva: orderInstace.codeCouponId
        ? couponInstance.isPercentage
          ? orderInstace.taxes -
          (orderInstace.taxes * couponInstance.value) / 100
          : orderInstace.taxes
        : orderInstace.taxes,
      id_pago: paymentInstance.uuid,
      descripcion_pago: "Orden de compra de usuario",
      email: userInstance.email,
      id_cliente: userInstance.identification,
      tipo_id: userInstance.docType,
      nombre_cliente: userInstance.firstName,
      apellido_cliente: userInstance.lastName,
      telefono_cliente: userInstance.phone,
      info_opcional1: null,
      info_opcional2: `Orden ${orderInstace.id}`,
      info_opcional3: `Total ${orderInstace.total}`,
      codigo_servicio_principal: 1002, // 1002 Pro, 2701 Des
      lista_codigos_servicio_multicredito: null,
      lista_nit_codigos_servicio_multicredito: null,
      lista_valores_con_iva: null,
      lista_valores_iva: null,
      total_codigos_servicio: 0,
    };

    // Creo la orden de pago en la pasarela
    let payment = null;
    try {
      let detailInOrder = await orderInstace.orderDetails.find();
      const { Product } = paymentParam.app.models;
      const today = new Date();

      /*     preferenceMercadoPago.items = preferenceMercadoPago.items.concat(await Promise.all(detailInOrder.map(async (product) => {
            let productInstanceOrder = await Product.findById(product.productId)
            const initDis = new Date(productInstanceOrder.initDateDiscount);
            const endDis = new Date(productInstanceOrder.endDateDiscount);
            const isDiscountAvalidable = today >= initDis && today <= endDis;
            const priceAvalidable = isDiscountAvalidable ? productInstanceOrder.price - (productInstanceOrder.price * productInstanceOrder.discountPercentage / 100) : productInstanceOrder.price;
            console.log(product)
            return {
              "title": product.name,
              "description": product.description,
              "quantity": product.quantity,
              "unit_price": orderInstace.codeCouponId ? couponInstance.isPercentage ? (productInstanceOrder.taxes, - (productInstanceOrder.price * couponInstance.value) / 100) : productInstanceOrder.price : productInstanceOrder.price,
              "picture_url": product.image
            }
          }))) */

      preferenceMercadoPago.items = preferenceMercadoPago.items.concat(
        await Promise.all(
          detailInOrder.map(async (product) => {
            let productInstanceOrder = await Product.findById(
              product.productId
            );
            const initDis = new Date(productInstanceOrder.initDateDiscount);
            const endDis = new Date(productInstanceOrder.endDateDiscount);
            const isDiscountAvalidable = today >= initDis && today <= endDis;
            const priceAvalidable = isDiscountAvalidable
              ? productInstanceOrder.price -
              (productInstanceOrder.price *
                productInstanceOrder.discountPercentage) /
              100
              : productInstanceOrder.price;
            return {
              title: product.name,
              description: product.description,
              quantity: product.quantity,
              unit_price: parseInt(productInstanceOrder.price),
              picture_url: product.image,
            };
          })
        )
      );
      if (
        orderInstace.codeCouponId &&
        !orderInstace.couponInstance.isPercentage
      ) {
        preferenceMercadoPago.items.push({
          title: "descuent",
          quantity: 1,
          unit_price: parseInt(couponInstance.value * -1),
        });
      } else if (
        orderInstace.couponInstance &&
        orderInstace.couponInstance.isPercentage
      ) {
        preferenceMercadoPago.items.push({
          title: `Descuento con porcentaje de ${couponInstance.discount}`,
          quantity: 1,
          unit_price: parseInt(
            ((orderInstace.total * couponInstance.discount) / 100) * -1
          ),
        });
        console.log(preferenceMercadoPago);
      }

      payment = await inicioPago(preferenceMercadoPago);
      // payment = await integrationZonaPago.inicioPago(body)

      /* paymenMercadoPago = await inicioPago(preferenceMercadoPago); */
    } catch (error) {
      // throw error
      console.log(error);
      return "Algo salio mal";
    }

    /*     // busco el codigo para el estado necesario
        let parameterName = 'ESTADO_ORDEN_PENDIENTE_PAGO'
        let orderStatusCode
        try {
          orderStatusCode = await getParameterValue(parameterName)
          console.log(orderStatusCode)
        } catch (error) {
          throw error
        }
     */
    // obtengo el estado de la orden
    /*     const { OrderStatus } = app.models
        let orderStatusInstance
        try {
          orderStatusInstance = await OrderStatus.findOne({ where: { code: orderStatusCode } })
        } catch (error) {
          throw error
        }
    
        // valido
        if (!orderStatusInstance) {
          throw new Error(`No existe el estado de la orden con el codigo ${orderStatusCode}`)
        }
        console.log(orderStatusCode)
        try {
          orderInstace.updateAttributes({ orderStatusId: orderStatusInstance.id })
        } catch (error) {
          throw error
        } */

    const result = {};
    result.payment = payment;
    result.url = payment.init_point;
    /* console.log(preferenceMercadoPago.items, "ooooooooo"); */
    result.order = orderInstace;
    return result;
  };

  paymentParam.remoteMethod("inicioPago", {
    accepts: {
      arg: "body",
      type: "Object",
      require: true,
    },
    http: {
      verb: "post",
      path: "/inicioPago",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  paymentParam.paymentConfirmation = async (req, res, next) => {
    const { body } = req;
    const { data, topic } = body;
    const id = data && data.id ? data.id : 0;
    let responseMercadoPago;
    if (id) {
      try {
        responseMercadoPago = await verificarPago(id);
      } catch (error) {
        res.status(404);
        console.log(error.response.body.message)
        return { menssage: error.response.body.message };
        /* res.status(400).send("unable to update the database") */
      }
      /* console.log(responseMercadoPago, "=========="); */
    } else {
      console.log("Pin MercadoPago")
      res.status(404);
      return { result: "pin" };
    }

    /* const { id_pago: paymentUuid, detalle_estado: detalleEstado, estado_pago: estadoPago } = query */
    // busco el pago
    let paymentInstance;
    try {
      paymentInstance = await paymentParam.findOne({
        where: { orderId: responseMercadoPago.external_reference },
      });
    } catch (error) {
      throw error;
    }

    // valido
    if (!paymentInstance) {
      throw new Error(
        `El pago con el uuid ${responseMercadoPago.external_reference}, no existe.`
      );
    }

    // encuentro la orden

    let orderInstace;
    const { Order } = paymentParam.app.models;
    try {
      orderInstace = await Order.findById(
        responseMercadoPago.external_reference
      );
    } catch (error) {
      throw error;
    }

    // valido
    if (!orderInstace) {
      throw new Error(
        `La orden con el id ${paymentInstance.orderId}, no existe.`
      );
    }

    let orderDetails = [];
    try {
      orderDetails = await orderInstace.orderDetails.find();
    } catch (error) {
      throw error;
    }

    // valido
    if (orderDetails.length < 1) {
      throw new Error(`La orden ${orderInstace.id}, no tiene detalles.`);
    }

    // obtengo los productos asociados a cada detalle
    const productInstances = [];
    for (const orderDetailInstance of orderDetails) {
      let productInstance;
      try {
        productInstance = await orderDetailInstance.product.get();
        productInstance.quantity = orderDetailInstance.quantity;
      } catch (error) {
        throw error;
      }

      // obtengo la image
      let imageInstance = [];
      try {
        imageInstance = await productInstance.imageProducts.find();
      } catch (error) {
        throw error;
      }

      let skuVariations = [];
      try {
        skuVariations = await productInstance.skuVariations.find();
      } catch (error) {
        throw error;
      }

      let skuChildrenVariations;
      try {
        skuChildrenVariations = await productInstance.skuChildren.get();
      } catch (error) {
        throw error;
      }

      productInstance.isLifeStyle = false;
      if (skuVariations.length > 0) {
        productInstance.isLifeStyle = true;
        productInstance.color = skuVariations[0]
          ? skuVariations[0].color
          : skuChildrenVariations.color;
        productInstance.size = skuVariations[0]
          ? skuVariations[0].size
          : skuChildrenVariations.size;
      }

      if (imageInstance.length < 1) {
        productInstance.imageUrl =
          "https://autogermana.s3.amazonaws.com/no%20-foto.png";
      } else {
        productInstance.imageUrl = imageInstance[0].image;
      }
      productInstances.push(productInstance);
    }

    let codeCoupon;
    try {
      codeCoupon = await orderInstace.codeCoupon.get();
    } catch (error) {
      throw error;
    }

    const productsToIncadea = productInstances.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      storeId: orderInstace.storeId,
      description: product.description,
      storeName: "ECOMM-BO",
      quantity: product.quantity,
      /* priceWithTax: orderInstace.codeCouponId ? codeCoupon.isPercentage ? product.priceWithTax - ((product.priceWithTax * codeCoupon.value) / 100) : product.priceWithTax : product.priceWithTax, */
      priceWithTax: product.priceWithTax,
      /* priceWithoutTax: orderInstace.codeCouponId ? codeCoupon.isPercentage ? product.priceWithoutTax - ((product.priceWithoutTax * codeCoupon.value) / 100) : product.priceWithoutTax : product.priceWithoutTax, */
      priceWithoutTax: product.priceWithoutTax,
      imageUrl: product.imageUrl,
      price:
        product.priceWithTax - (product.priceWithTax - product.priceWithoutTax),
      color: product.color,
      size: product.size,
      isLifeStyle: product.isLifeStyle,
    }));

    // Precio del servicio tcc
    productsToIncadea.push({
      id: 1,
      sku: "280505001",
      name: "Envio Ecommerce",
      storeId: 1,
      storeName: "ECOMM-BO",
      quantity: 1,
      priceWithTax: orderInstace.priceDelivery,
      priceWithoutTax: orderInstace.priceDelivery,
      imageUrl: "tcc.png",
    });

    /*    if (orderInstace.codeCouponId) {
         if (!codeCoupon.isPercentage) {
           productsToIncadea.push({
             id: 1,
             sku: '280505001',
             name: 'Coupon de descuento',
             storeId: 1,
             storeName: 'ECOMM-BO',
             quantity: 1,
             priceWithTax: codeCoupon.value * -1,
             priceWithoutTax: codeCoupon.value * -1,
             imageUrl: 'zv.png'
           })
         }
       } */

    // obtengo la direccion de la orden
    let addressInstance;
    try {
      addressInstance = await orderInstace.address.get();
    } catch (error) {
      throw error;
    }

    // valido
    if (!addressInstance) {
      throw new Error("La dirección de la orden, no existe.");
    }

    // Obtengo la ciudad de la dirección
    let cityInstance;
    try {
      cityInstance = await addressInstance.city.get();
    } catch (error) {
      throw error;
    }

    // valido
    if (!cityInstance) {
      throw new Error("La ciudad de la direccion no existe.");
    }

    // obtengo el usuario de la orden
    let userInstance;
    try {
      userInstance = await orderInstace.user.get();
    } catch (error) {
      throw error;
    }

    // valido
    if (!userInstance) {
      throw new Error(
        `El usuario con el id ${orderInstace.userId}, no existe.`
      );
    }

    console.log("Respuesta Aprobado: ", responseMercadoPago.status);
    if (responseMercadoPago.status === "approved") {
      console.log("debo enviar el correo");
      let parametersVerificarPago = {
        str_id_pago: paymentInstance.uuid,
        int_id_tienda: idTiendaZonaVirtual,
        str_id_clave: claveZonaVirtual,
      }; /* 
                                                                                                     if (!response.res_pagos_v3[0]) {
                                                                                                       throw new Error('response.res_pagos_v3[0] no existe en response')
                                                                                                     } */ // obtengo el estado del pago verificado

      /*    // Verifico el pago
         let response
         try {
           response = await integrationZonaPago.verificarPago(parametersVerificarPago)
         } catch (error) {
           throw error
         }
   
         console.log('response: ', response) */

      /*   if (!response.res_pagos_v3) {
          throw new Error('res_pagos_v3 no existe en response')
        }
   */ let estadoPagoVerificado =
        responseMercadoPago.status == "approved"
          ? "PAGO_APROBADO"
          : responseMercadoPago.status == "in_process" ? "PENDIENTE_PAGO" : "PAGO_RECHAZADO";
      let idClientePagoVerificado = responseMercadoPago.payer.id;
      let valorPagoVerificado = responseMercadoPago.transaction_amount;
      const transactionCode = responseMercadoPago.id;

      // obtengo la instancia
      const { OrderStatus } = app.models;
      let orderStatusInstanceFromZV;
      try {
        orderStatusInstanceFromZV = await OrderStatus.findOne({
          where: { code: estadoPagoVerificado },
        });
      } catch (error) {
        throw error;
      }

      // valido
      if (!orderStatusInstanceFromZV) {
        throw new Error(
          `El estado de la orden con el codigo ${estadoPagoVerificado} de zona virtual no existe`
        );
      }

      /*  // valido
       if (orderInstace.total !== valorPagoVerificado) {
         throw new Error('El total a pagar de la orden no es igual al del la confirmado')
       } */

      /*       if (userInstance.identification !== idClientePagoVerificado) {
              throw new Error('La identificación del usuario no es igual a la del pago confirmado')
            } */

      if (orderStatusInstanceFromZV.code !== "PAGO_APROBADO") {
        throw new Error("La orden no fue aprobada");
      }

      const incadeOrderObj = {
        id: orderInstace.id,
        docType: 0,
        identification: userInstance.identification,
        firstName: userInstance.firstName,
        lastName: userInstance.lastName,
        city: cityInstance.name,
        address: addressInstance.value,
        phone: addressInstance.phone,
        email: userInstance.email,
        total: orderInstace.total,
        producto: productsToIncadea,
      };

      // Envio orden a incadea
      console.log(
        "Confirmacion de pago solo si no tiene antes de generar incadea"
      );

      let incadeaOrder;

      if (
        orderInstace.incadeaOrderId === "0" &&
        orderInstace.delivery === "0" &&
        orderInstace.orderStatusId <= 2 &&
        orderStatusInstanceFromZV &&
        orderStatusInstanceFromZV.id == 3
      ) {
        console.log("--------------Entro aqui---------------------");
        await orderInstace.updateAttributes({
          orderStatusId: orderStatusInstanceFromZV.id,
        });
        try {
          incadeaOrder = await autogermanaIntegration.createdOrder(
            incadeOrderObj
          );
          if (incadeaOrder) {
            try {
              await orderInstace.updateAttributes({
                orderStatusId: orderStatusInstanceFromZV.id,
                incadeaOrderId: incadeaOrder.respuesta_TSQL,
                sendDate: moment().tz("America/Bogota").format("YYYY-MM-DD"),
                transactionCode: transactionCode
              });
            } catch (error) {
              throw error;
            }
          }
        } catch (error) {
          throw error;
        }

      }

      // valido
      if (!orderInstace) {
        throw new Error(`La orden con id ${orderInstace.id}, no existe`);
      }

      let orderDetailInstances = null;
      try {
        orderDetailInstances = await orderInstace.orderDetails.find();
      } catch (error) {
        throw error;
      }

      // valido
      if (!orderDetailInstances) {
        throw new Error(
          `La orden con id ${orderInstace.id}, no existe detalles`
        );
      }

      let userInstanceTcc = null;
      try {
        userInstanceTcc = await orderInstace.user.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!userInstanceTcc) {
        throw new Error(
          `La orden con id ${orderInstace.id}, no le pertenece a un usuario`
        );
      }

      let brandInstance = null;
      try {
        brandInstance = await orderInstace.brand.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!brandInstance) {
        throw new Error(
          `La orden con id ${orderInstace.id}, no pertenece a una marca`
        );
      }

      let cityAddressInatance = null;
      try {
        cityAddressInatance = await addressInstance.city.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!cityAddressInatance) {
        throw new Error(
          `La orden con id ${orderInstace.id}, no tiene una ciudad`
        );
      }

      let stateAddressInstance = null;
      try {
        stateAddressInstance = await cityAddressInatance.state.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!stateAddressInstance) {
        throw new Error(
          `La ciudad de la orden con id ${orderInstace.id}, no tiene un estado`
        );
      }

      let storeInstance = null;
      try {
        storeInstance = await orderInstace.store.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!storeInstance) {
        throw new Error(
          `La orden con id ${orderInstace.id}, no tiene una tienda asociada`
        );
      }

      let cityStoreInstance = null;
      try {
        cityStoreInstance = await storeInstance.city.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!cityStoreInstance) {
        throw new Error(
          `La tienda de la orden con id ${orderInstace.id}, no tiene una tienda ciudad asociada`
        );
      }

      let stateStoreInstance = null;
      try {
        stateStoreInstance = await cityStoreInstance.state.get();
      } catch (error) {
        throw error;
      }

      // valido
      if (!stateStoreInstance) {
        throw new Error(
          `La tienda de la orden con id ${orderInstace.id}, con la ciudad ${cityStoreInstance.name} no tiene un estado relacionado`
        );
      }

      const products = await Promise.all(
        orderDetailInstances.map(async (item) => {
          let ProductInstanDetail = null;
          try {
            ProductInstanDetail = await item.product.get();
          } catch (error) {
            throw error;
          }

          const weightVolumeK = ProductInstanDetail.weightVolume / 1000.0;
          // const weightVolumeK = (weightVolume / 1000.0).toFixed(2).replace(".", ",")

          let product = {
            tipounidad: "TIPO_UND_PAQ",
            claseempaque: "CLEM_MEDIANA",
            kilosreales: weightVolumeK < 1 ? 1 : weightVolumeK, // PENDIENTE
            largo: 0,
            alto: 0,
            ancho: 0,
            pesovolumen: weightVolumeK,
            valormercancia: item.price,
            codigobarras: null,
            unidadesinternas: 1, // PENDIENTE
          };
          return product;
        })
      );

      const productsVolumes = await Promise.all(
        orderDetailInstances.map(async (item) => {
          let product = null;
          try {
            product = await item.product.get();
          } catch (error) {
            throw error;
          }
          return product;
        })
      );

      const weightVolume = productsVolumes
        .map((item) => item.weightVolume)
        .reduce((pre, cur) => pre + cur, 0);

      const weightVolumeK = weightVolume / 1000.0;

      let unidadDeNEgocio = null;
      let cuentaAut = null;
      if (weightVolumeK < 2.4 && orderInstace.total <= 1185000) {
        unidadDeNEgocio = 2;
        cuentaAut = 5132001;
      } else if (weightVolumeK >= 2.5 && weightVolumeK < 15.0) {
        unidadDeNEgocio = 1;
        cuentaAut = 1759405;
      } else {
        unidadDeNEgocio = 1;
        cuentaAut = 1759405;
      }

      const parameters = {
        despacho: {
          clave: passTcc,
          solicitudrecogida: {},
          unidadnegocio: unidadDeNEgocio,
          fechadespacho: moment().format("YYYY-MM-DD"),
          cuentaremitente: cuentaAut,
          tipoidentificacionremitente: "NIT",
          identificacionremitente: 860509514,
          primernombreremitente: "AUTOGERMANA",
          segundonombreremitente: null,
          primerapellidoremitente: null,
          razonsocialremitente: "AUTOGERMANA",
          naturalezaremitente: "N",
          direccionremitente: "carrera 45 # 197-35",
          contactoremitente: null,
          emailremitente: "johan.rios@autogermana.com.co",
          telefonoremitente: "3202572769",
          ciudadorigen: 11001000, // `${stateStoreInstance.code}${cityStoreInstance.code}000`,
          tipoidentificaciondestinatario: userInstanceTcc.docType,
          identificaciondestinatario: userInstanceTcc.identification,
          primernombredestinatario: userInstanceTcc.firstName,
          segundonombredestinatario: null,
          primerapellidodestinatario: userInstanceTcc.lastName,
          naturalezadestinatario: "N",
          direcciondestinatario: addressInstance.value,
          contactodestinatario: "CONTACTO DESTINO",
          telefonodestinatario: userInstanceTcc.phone,
          ciudaddestinatario: `${stateAddressInstance.code}${cityAddressInatance.code}000`,
          totalpeso: null,
          totalpesovolumen: null,
          totalvalormercancia: orderInstace.total - orderInstace.priceDelivery,
          observaciones: `Pedidos ${orderInstace.incadeaOrderId} por valor de ${orderInstace.total}`,
          // unidad: products,
          unidad: {
            tipounidad: "TIPO_UND_PAQ",
            claseempaque: "CLEM_MEDIANA",
            kilosreales: weightVolumeK < 1 ? 1 : weightVolumeK,
            largo: 0,
            alto: 0,
            ancho: 0,
            pesovolumen: weightVolumeK,
            valormercancia: orderInstace.total,
            codigobarras: null,
            unidadesinternas: 1,
          },
          documentoreferencia: {
            tipodocumento: "OC",
            numerodocumento: `OC-${orderInstace.id}`,
            fechadocumento: moment().format("YYYY-MM-DD"),
          },
          generardocumentos: "TRUE",
          tiposervicio: null,
          fuente: null,
        },
      };

      // valido
      if (!parameters) {
        throw new Error("La peticion no contiene parametros");
      }

      // Ejecuto la integracion
      let responseTcc;
      console.log(orderInstace, incadeaOrder, "final test");
      if (orderInstace && orderInstace.incadeaOrderId != 0) {
        console.log(
          "---- Confirmacion de pago Solo si no tiene --------------"
        );
        try {
          responseTcc = await obtenerValorGrabarRemesa(parameters);
        } catch (error) {
          throw error;
        }

        console.log("Respuesta TCC: ");
        if (responseTcc.respuesta === "-1") {
          throw new Error(
            `Algo salio mal creando la remesa para el orden ${orderInstace.id}, en TCC.`
          );
        }

        // Actualizo la instancia
        try {
          // await orderInstace.updateAttributes({ orderStatusId: orderStatusInstanceFromZV.id, incadeaOrderId: incadeaOrder.respuesta_TSQL, delivery: responseTcc.remesa, transactionCode: transactionCode })
          await orderInstace.updateAttributes({ delivery: responseTcc.remesa });
        } catch (error) {
          throw error;
        }

        if (orderInstace.incadeaOrderId == 0 && incadeaOrder && incadeaOrder.respuesta_TSQL.split("-")[0] !== "PVRE") {

          const parametersEmailIncadea = {
            user: userInstance,
            order: orderInstace,
          };

          const eventName = (brandId) => {
            switch (brandId) {
              case 1:
                return "autorespuesta_motorrad_3_incadea_error";

              case 2:
                return "autorespuesta_mini_3_incadea_error";

              case 3:
                return "autorespuesta_bmw_3_incadea_error";
            }
          };

          const data = {
            email: "soporteenlinea@autogermana.com.co",
            eventName: eventName(userInstance.brandId),
            attributes: {
              nCompra: orderInstace.uuid,
              orderIncadeaID: orderInstace.incadeaOrderId,
            },
          };
          console.log(await incadeaError(data))

          // const htmlIncadea = generateHtmlByEmailtemplate('incadea-error', parametersEmailIncadea)

          // // send the email
          // const mailerObject = new Mailer()
          // try {
          //   await mailerObject.sendMail([emailIncadeaError], htmlIncadea, 'Error creación pedido')
          // } catch (error) {
          //   throw error
          // }
        }

        productsToIncadea.splice(productsToIncadea.length - 1);
        if (codeCoupon) {
          if (!codeCoupon.isPercentage) {
            productsToIncadea.splice(productsToIncadea.length - 1);
          }
        }

        const parametersTcc = {
          user: userInstance,
          order: {
            ...orderInstace,
            delivery: orderInstace.delivery,
            id: orderInstace.id,
            subtotal: priceFormatter(orderInstace.subtotal),
            taxes: priceFormatter(orderInstace.taxes),
            priceDelivery: priceFormatter(orderInstace.priceDelivery),
            total: priceFormatter(orderInstace.total),
          },
          products: productsToIncadea.map((item) => ({
            ...item,
            price: priceFormatter(item.price),
          })),
          address: addressInstance,
          city: cityInstance,
          discoun: {
            value: priceFormatter(
              codeCoupon
                ? codeCoupon.isPercentage
                  ? ((orderInstace.subtotal * codeCoupon.value) /
                    (100 - codeCoupon.value)) *
                  -1
                  : codeCoupon.value
                : 0
            ),
          },
        };

        const eventName2 = (brandId) => {
          switch (brandId) {
            case 1:
              return "factura_digital_motorrad";

            case 2:
              return "factura_digital_mini";

            case 3:
              return "factura_digital_bmw";
          }
        };

        const data2 = {
          email: userInstance.email,
          eventName: eventName2(userInstance.brandId),
          attributes: {
            descuentos_envio: priceFormatter(
              codeCoupon
                ? codeCoupon.isPercentage
                  ? ((orderInstace.subtotal * codeCoupon.value) /
                    (100 - codeCoupon.value)) *
                  -1
                  : codeCoupon.value
                : 0
            ),
            subTotal_envio: priceFormatter(orderInstace.subtotal),
            iva_envio: priceFormatter(orderInstace.taxes),
            envio: priceFormatter(orderInstace.priceDelivery),
            rastrea_tu_orden: "https://sisenoragencia.com",
            total: priceFormatter(orderInstace.total),
            event_items: productsToIncadea.map((product) => ({
              nombre_producto: product.name.toUpperCase(),
              cantidad_producto: product.quantity,
              precio_producto: priceFormatter(product.price),
            })),
          },
        };
        // const eventName3 = (brandId) => {
        //   switch (brandId) {
        //     case 1:
        //       return 'formulario-encuesta-motorrad'

        //     case 2:
        //       return 'formulario-encuesta-mini'

        //     case 3:
        //       return 'formulario-encuesta-bmw'
        //   }
        // }

        // const data3 = {
        //   email: userInstance.email,
        //   eventName: eventName2(userInstance.brandId),
        //   attributes: {
        //     nombreCompleto: `${userInstance.firstName} ${userInstance.lastName}`,
        //     telefono: userInstance.phone,
        //     email: userInstance.email,
        //     numeroPedido: orderInstace.incadeaOrderId,
        //     recomendacion,
        //     justificacion,
        //     entregaExitosa,
        //     tiemposEstablecidos
        //   }
        // }
        if (incadeaOrder) {
          console.log(await orderSucces(data2))
        }

        //await form(data3)

        /* const html = generateHtmlByEmailtemplate('order-succes', parametersTcc) */

        // send the email
        /*         const mailerObject = new Mailer()
        try {
          await mailerObject.sendMail([userInstance.email], html, 'Gracias por su compra!')
        } catch (error) {
          throw error
        } */
      }

      // descuento el stock de los productos
      for (const detailInOrder of orderDetailInstances) {
        // obtengo el producto asociado al detalle
        let productInstance;
        try {
          productInstance = await detailInOrder.product.get();
        } catch (error) {
          throw error;
        }
        // actualizo el producto
        try {
          await productInstance.updateAttributes({
            stock: productInstance.stock - detailInOrder.quantity,
            intent: productInstance.intent - detailInOrder.quantity,
          });
        } catch (error) {
          throw error;
        }
      }
    } else if (responseMercadoPago.status !== "approved") {
      // obtengo el estado del pago verificado
      let estadoPagoVerificado =
        responseMercadoPago.status === "approved"
          ? "PAGO_APROBADO"
          : responseMercadoPago.status === "in_process"
            ? "PENDIENTE_PAGO"
            : "CANCELADA";

      // obtengo la instancia
      const { OrderStatus } = app.models;
      let orderStatusInstanceFromZV;
      try {
        orderStatusInstanceFromZV = await OrderStatus.findOne({
          where: { paymentPlatformCode: estadoPagoVerificado },
        });
      } catch (error) {
        throw error;
      }

      let orderDetailInstances = null;
      try {
        orderDetailInstances = await orderInstace.orderDetails.find();
      } catch (error) {
        throw error;
      }

      // descuento el stock de los productos
      for (const detailInOrder of orderDetailInstances) {
        // obtengo el producto asociado al detalle
        let productInstance;
        try {
          productInstance = await detailInOrder.product.get();
        } catch (error) {
          throw error;
        }
        // actualizo el producto
        try {
          await productInstance.updateAttributes({
            intent: productInstance.intent - detailInOrder.quantity,
          });
        } catch (error) {
          throw error;
        }
      }

      // Actualizo la instancia
      console.log(orderStatusInstanceFromZV)
      try {
        await orderInstace.updateAttributes({
          orderStatusId: orderStatusInstanceFromZV ? orderStatusInstanceFromZV.id : 1,
        });
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error("Estado no controlado");
    }

    return orderInstace;
  };

  paymentParam.remoteMethod("paymentConfirmation", {
    accepts: [{
      arg: "req",
      type: "Object",
      require: true,
      http: {
        source: "req",
      },
    }, {
      arg: "res",
      type: "Object",
      require: true,
      http: {
        source: "res",
      },
    }],
    http: {
      verb: "post",
      path: "/paymentConfirmation.php",
    },
    returns: {
      type: "Object",
      root: true,
    },
  });
};
