import {getMissinKeys, returnError} from '../../server/utils'
const soap = require('soap')
const urlTcc = process.env.URL_TCC
const urlTccB = process.env.URL_TCCB

/**
 * funcion para obtener la informacion del estado del despacho
 *
 * @param {object} parameters objeto con el atributo Liquidacion
 * @returns {object} objeto con la informacion del resultado de la informacion
 */
export const obtenerCosultarInformacion = async parameters => {
  // creo el cliente
  let client
  try {
    client = await soap.createClientAsync(`${urlTcc}/informacionremesas.asmx?wsdl`)
  } catch (error) {
    throw error
  }

  // obtengo el password de tcc
  const passTcc = process.env.PASSW_TCC

  // defino el objeto para enviar como parametro
  const objToSend = {
    Clave: passTcc,
    remesas: parameters,
    Respuesta: 0,
    Mensaje: 'OK'
  }

  // ejecuto la integracion
  let result
  try {
    result = await client.ConsultarInformacionRemesasEstadosUENAsync(objToSend)
  } catch (error) {
    throw error
  }

  return result[0]
}

/**
 * funcion para obtener el valor de la liquidacion
 *
 * @param {object} parameters objeto con el atributo Liquidacion
 * @returns {object} objeto con la informacion del resultado de la informacion
 */
export const obtenerValorLiquidacion = async parameters => {
  // creo el cliente
  let client
  try {
    client = await soap.createClientAsync(`${urlTcc}/liquidacionacuerdos.asmx?wsdl`)
  } catch (error) {
    throw error
  }

  // obtengo el password de tcc
  const passTcc = process.env.PASSW_TCC

  // valido parameter
  let keys = ['Liquidacion']
  let missingKeys = getMissinKeys(keys, parameters)
  if (missingKeys.length > 1) {
    throw returnError(`Al objeto parameters le faltan estos atributos ${missingKeys.toString()}`, 422)
  }

  // obtengo el objeto liquidacion
  const {Liquidacion} = parameters

  // valido liquidacion
  keys = [
    'tipoenvio', 'idciudadorigen', 'idciudaddestino', 'valormercancia', 'boomerang', 'cuenta',
    'fecharemesa', 'idunidadestrategicanegocio'
  ]
  missingKeys = getMissinKeys(keys, Liquidacion)
  if (missingKeys.length > 1) {
    throw returnError(`Al objeto Liquidacion le faltan estos atributos ${missingKeys.toString()}`, 422)
  }

  // defino el objeto para enviar como parametro
  const objToSend = {
    Clave: passTcc,
    Liquidacion
  }

  // ejecuto la integracion
  let result
  try {
    result = await client.consultarliquidacionAsync(objToSend)
  } catch (error) {
    throw error
  }

  /* console.log('TCC : ', result[0]) */

  return result[0]
}

export const grabarDespacho = async body => {
  let client = null
  try {
    client = await soap.createClientAsync(`${urlTccB}/remesasws?wsdl`)
  } catch (error) {
    throw error
  }

  let result = null
  try {
    result = await client.grabardespacho7Async(body)
  } catch (error) {
    throw error
  }

  return result[0]
}

/**
 * funcion para obtener el valor de la liquidacion
 *
 * @param {object} parameters objeto con el atributo Liquidacion
 * @returns {object} objeto con la informacion del resultado de la informacion
 */
export const obtenerValorGrabarRemesa = async parameters => {
  // creo el cliente
  let client = null
  try {
    client = await soap.createClientAsync(`${urlTccB}/remesasws?wsdl`)
  } catch (error) {
    throw error
  }

  let result = null
  try {
    result = await client.grabardespacho7Async(parameters)
  } catch (error) {
    throw error
  }

  return result[0]
}
